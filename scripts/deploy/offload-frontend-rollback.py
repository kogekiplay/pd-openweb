#!/usr/bin/env python3
"""Stream an inactive rollback to durable client storage, compare it, and verify a full restoration before releasing it."""
import argparse
import contextlib
import hashlib
import json
import os
import pathlib
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import time
import uuid

RESERVE = 4 * 1024 ** 3
BASE = '/usr/local/MDPrivateDeployment'
STABLE = ['source', 'entries', 'inventorySha256', 'sourceIndexSha256', 'logicalBytes', 'liveIndexSha256',
          'rollbackIndexSha256', 'protectedRollback', 'services', 'nginxSha256']


def digest(path):
    h = hashlib.sha256()
    with pathlib.Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def durable(path, value):
    path = pathlib.Path(path)
    temporary = path.with_name(path.name + '.tmp')
    with temporary.open('w') as stream:
        stream.write(value)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)
    fd = os.open(str(path.parent), os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def save(path, data):
    durable(path, json.dumps(data, indent=2) + '\n')


def stable(before, after):
    if any(before[k] != after[k] for k in STABLE):
        raise RuntimeError('Source or production changed; retain recovery materials and inspect')


def manifest(package, name, before, destination):
    seen, hashes = set(), {}
    member_path = destination / (name + '-members.jsonl')
    checksum_path = destination / (name + '-files.sha256')
    regular = 0
    with member_path.open('x') as writer, checksum_path.open('x') as checksums, tarfile.open(str(package), 'r|gz') as archive:
        for member in archive:
            path = pathlib.PurePosixPath(member.name.rstrip('/'))
            if path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0] != name:
                raise RuntimeError('Unsafe archive member: ' + str(path))
            key = str(path)
            if key in seen:
                raise RuntimeError('Duplicate archive member: ' + key)
            seen.add(key)
            checksum = None
            if member.isfile():
                h = hashlib.sha256()
                with archive.extractfile(member) as stream:
                    for block in iter(lambda: stream.read(1024 * 1024), b''):
                        h.update(block)
                checksum = h.hexdigest()
                regular += 1
            elif member.islnk():
                target = pathlib.PurePosixPath(member.linkname)
                if target.is_absolute() or '..' in target.parts or target.parts[0] != name:
                    raise RuntimeError('Unsafe hardlink target: ' + member.linkname)
                checksum = hashes.get(str(target))
                if checksum is None:
                    raise RuntimeError('Unresolved archive hardlink: ' + key)
            elif not member.isdir():
                raise RuntimeError('Unsupported rollback member: ' + key)
            if checksum:
                hashes[key] = checksum
                escaped = key.replace('\\', '\\\\').replace('\n', '\\n')
                prefix = '\\' if escaped != key else ''
                checksums.write(prefix + checksum + '  ' + escaped + '\n')
            writer.write(json.dumps(dict(path=key, sha256=checksum, type=member.type.decode('ascii'), size=member.size,
                                         uid=member.uid, gid=member.gid, mode=member.mode,
                                         mtime=member.pax_headers.get('mtime', str(member.mtime)), link=member.linkname)) + '\n')
        for stream in [writer, checksums]:
            stream.flush()
            os.fsync(stream.fileno())
    if len(seen) != before['entries'] or hashes.get(name + '/index.html') != before['sourceIndexSha256']:
        raise RuntimeError('Archive inventory or entry digest differs from the source snapshot')
    return dict(entries=len(seen), regularFiles=regular, filesWithDigests=len(hashes),
                memberManifest=member_path.name, memberManifestSha256=digest(member_path),
                fileManifest=checksum_path.name, fileManifestSha256=digest(checksum_path))


REMOTE_CODE = r'''
import fcntl,hashlib,importlib.util,json,os,pathlib,re,shutil,subprocess,sys
assert re.fullmatch(r'www-prev-\d{8}-[a-f0-9]{10}',config['name'])
assert config['token'].encode() in pathlib.Path('/proc/'+str(config['lockPid'])+'/cmdline').read_bytes()
current=pathlib.Path(config['currentRelease'])
assert re.fullmatch(r'/data/mingdao/frontend-[a-f0-9]{10}-\d{8}',str(current))
spec=importlib.util.spec_from_file_location('deployment',str(current/'deploy.py'))
d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
source=d.BASE+'/'+config['name']
def output(args,stdin=None):return subprocess.check_output(args,stdin=stdin)
def state():
 artifact=json.loads((current/'artifact.json').read_text());before=json.loads((current/'deployment-before.json').read_text())
 assert json.loads((current/'phase.json').read_text())['phase']=='completed'
 assert source!=before['rollbackDirectory'] and source!=d.LIVE
 services=d.services();assert services==before['services']
 live=d.digest(d.LIVE+'/index.html');rollback=d.digest(before['rollbackDirectory']+'/index.html')
 assert live==artifact['indexSha256'] and rollback==before['previousIndexSha256']
 nginx=output(['docker','exec',d.APP,'/usr/local/nginx/sbin/nginx','-T'])
 assert source.encode() not in nginx
 links=output(['docker','exec',d.APP,'find',d.LIVE,before['rollbackDirectory'],'-type','l'])
 assert not links.strip()
 return dict(liveIndexSha256=live,rollbackIndexSha256=rollback,protectedRollback=before['rollbackDirectory'],
             services=services,nginxSha256=hashlib.sha256(nginx).hexdigest())
def snapshot():
 result=state()
 output(['docker','exec',d.APP,'test','-d',source]);output(['docker','exec',d.APP,'test','!','-L',source])
 raw=output(['docker','exec',d.APP,'find',source,'-printf',r'%P\0%y\0%s\0%T@\0%m\0%U\0%G\0%l\0'])
 fields=raw.split(b'\0');assert fields.pop()==b'' and len(fields)%8==0
 entries=sorted(tuple(fields[i:i+8])for i in range(0,len(fields),8));assert all(e[1]in[b'f',b'd']for e in entries)
 result.update(source=source,entries=len(entries),inventorySha256=hashlib.sha256(repr(entries).encode()).hexdigest(),
 sourceIndexSha256=d.digest(source+'/index.html'),logicalBytes=sum(int(e[2])for e in entries if e[1]==b'f'),
 physicalBytes=int(output(['docker','exec',d.APP,'du','-sk',source]).decode().split()[0])*1024,
 dataFree=shutil.disk_usage('/data').free)
 assert result['dataFree']>4*1024**3
 return result
if action=='snapshot':print(json.dumps(snapshot()))
elif action=='export':
 state()
 os.execvp('docker',['docker','exec',d.APP,'tar','--format=posix','--numeric-owner','--acls','--xattrs','-I','gzip -1','-cpf','-','-C',d.BASE,config['name']])
elif action=='compare':
 state()
 subprocess.check_call(['docker','exec','-i',d.APP,'tar','--numeric-owner','--acls','--xattrs','-dzf','-','-C',d.BASE],stdin=sys.stdin.buffer)
 print(json.dumps(dict(compared=True)))
elif action=='remove':
 actual=snapshot();assert all(actual[k]==config['expected'][k]for k in config['stable'])
 output(['docker','exec',d.APP,'rm','-rf','--',source]);print(json.dumps(dict(removed=True,dataFree=shutil.disk_usage('/data').free)))
elif action=='restore':
 state();output(['docker','exec',d.APP,'test','!','-e',source])
 assert shutil.disk_usage('/data').free>config['physicalBytes']+4*1024**3+256*1024**2
 subprocess.check_call(['docker','exec','-i',d.APP,'tar','--numeric-owner','--acls','--xattrs','-xzpf','-','-C',d.BASE],stdin=sys.stdin.buffer)
 assert d.digest(source+'/index.html')==config['sourceIndexSha256']
 print(json.dumps(dict(restored=True)))
elif action=='verify-files':
 state()
 body=output(['docker','exec','-i',d.APP,'sh','-c','cd "$1"; sha256sum -c -','sh',d.BASE],stdin=sys.stdin.buffer)
 count=len(body.splitlines());assert count==config['filesWithDigests']
 print(json.dumps(dict(filesVerified=count)))
elif action=='record':
 state();root=pathlib.Path('/data/mingdao/hap-offloaded-rollbacks');root.mkdir(mode=0o700,exist_ok=True)
 receipt=root/(config['name']+'.json');data=config['record']
 if receipt.exists():assert json.loads(receipt.read_text())['archiveSha256']==data['archiveSha256']
 temporary=receipt.with_suffix('.tmp')
 with temporary.open('w')as stream:json.dump(data,stream,indent=2);stream.flush();os.fsync(stream.fileno())
 temporary.replace(receipt);fd=os.open(str(root),os.O_RDONLY);os.fsync(fd);os.close(fd)
 print(json.dumps(dict(record=str(receipt),dataFree=shutil.disk_usage('/data').free)))
'''


class SSHBackend:
    def __init__(self, settings, name, log):
        if not re.fullmatch(r'(?:[A-Za-z0-9_.-]+@)?[A-Za-z0-9][A-Za-z0-9_.:-]*', settings['host']):
            raise ValueError('Invalid SSH target')
        if not 1 <= settings['port'] <= 65535:
            raise ValueError('Invalid SSH port')
        self.settings, self.name, self.log = dict(settings), name, log
        self.token, self.pid, self.holder = uuid.uuid4().hex, None, None
        self.ssh = ['ssh', '-i', settings['identity'], '-p', str(settings['port']), '-o', 'BatchMode=yes',
                    '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4', settings['host']]

    def __enter__(self):
        code = "import fcntl,os,sys; token=" + repr(self.token) + "; f=open('/var/lock/hap-frontend.lock','a'); fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB); print(os.getpid(),flush=True); sys.stdin.read()"
        self.holder = subprocess.Popen(self.ssh + ['python3 -c ' + shlex.quote(code)], stdin=subprocess.PIPE,
                                       stdout=subprocess.PIPE, stderr=self.log)
        value = self.holder.stdout.readline().strip()
        if not value.isdigit():
            raise RuntimeError('Could not acquire the production frontend lock')
        self.pid = int(value)
        return self

    def __exit__(self, *_):
        if self.holder:
            self.holder.stdin.close()
            self.holder.wait(timeout=30)

    def command(self, action, **extra):
        if self.holder.poll() is not None:
            raise RuntimeError('Production lock connection ended')
        config = dict(self.settings, name=self.name, token=self.token, lockPid=self.pid)
        config.update(extra)
        code = 'config=json.loads(' + repr(json.dumps(config)) + ')\naction=' + repr(action) + '\n' + REMOTE_CODE
        code = 'import json\n' + code
        return self.ssh + ['python3 -c ' + shlex.quote(code)]

    def call(self, action, stdin=None, **extra):
        return json.loads(subprocess.check_output(self.command(action, **extra), stdin=stdin, stderr=self.log).decode())

    def snapshot(self):
        return self.call('snapshot')

    def export(self, package, progress):
        process = subprocess.Popen(self.command('export'), stdout=subprocess.PIPE, stderr=self.log)
        try:
            with package.open('xb') as out:
                while True:
                    block = process.stdout.read(1024 * 1024)
                    if not block:
                        break
                    if shutil.disk_usage(package.parent).free <= RESERVE:
                        raise RuntimeError('Client archive stopped to preserve its 4 GiB reserve')
                    out.write(block)
                    progress(out.tell(), process.pid)
                out.flush()
                os.fsync(out.fileno())
            if process.wait():
                raise RuntimeError('Remote tar export failed; original remains intact')
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait()

    def compare(self, package):
        with package.open('rb') as stream:
            return self.call('compare', stdin=stream)

    def remove(self, before):
        return self.call('remove', expected=before, stable=STABLE)

    def restore(self, package, before, file_manifest, count):
        with package.open('rb') as stream:
            self.call('restore', stdin=stream, physicalBytes=before['physicalBytes'], sourceIndexSha256=before['sourceIndexSha256'])
        with file_manifest.open('rb') as stream:
            return self.call('verify-files', stdin=stream, filesWithDigests=count)

    def record(self, data):
        return self.call('record', record=data)


def offload(name, destination, backend):
    if not re.fullmatch(r'www-prev-\d{8}-[a-f0-9]{10}', name):
        raise ValueError('Only an exact named rollback directory can be offloaded')
    destination = pathlib.Path(destination).resolve()
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    receipt = destination / (name + '.json')
    with receipt.open('x'):
        pass
    before = backend.snapshot()
    if before['source'] != BASE + '/' + name or before['source'] == before['protectedRollback']:
        raise ValueError('Current quick rollback must stay on the production host')
    required = before['logicalBytes'] + before['entries'] * 2048 + RESERVE
    if shutil.disk_usage(destination).free <= required:
        raise RuntimeError('Insufficient client space for a complete archive and reserve')
    package = destination / (name + '.tar.gz')
    partial = destination / (name + '.tar.gz.partial')
    if package.exists() or partial.exists():
        raise FileExistsError('Recovery material exists; inspect it rather than restarting')
    data = dict(phase='exporting', source=before['source'], archive=package.name, archiveDirectory=str(destination),
                remote=backend.settings, before=before, startedAt=time.time(), pid=os.getpid(), productionSwitched=False)
    save(receipt, data)
    last = [0]

    def progress(size, pid):
        if time.monotonic() - last[0] > 2:
            data.update(bytesWritten=size, streamPid=pid)
            save(receipt, data)
            last[0] = time.monotonic()

    backend.export(partial, progress)
    data.update(phase='validating-archive', bytesWritten=partial.stat().st_size)
    save(receipt, data)
    info = manifest(partial, name, before, destination)
    backend.compare(partial)
    stable(before, backend.snapshot())
    checksum = digest(partial)
    partial.rename(package)
    os.chmod(str(package), 0o600)
    data.update(info, archiveSha256=checksum, phase='verified-before-release')
    tool_sha = digest(__file__)
    tool = destination / ('offload-tool-' + tool_sha[:12] + '.py')
    if not tool.exists():
        with tool.open('xb') as out:
            out.write(pathlib.Path(__file__).read_bytes())
            out.flush()
            os.fsync(out.fileno())
    if digest(tool) != tool_sha:
        raise RuntimeError('Recovery tool copy differs')
    restore = destination / (name + '-restore.sh')
    script = '#!/bin/sh\nset -eu\n' + 'test "$#" -eq 1\n' + 'exec python3 ' + shlex.quote(str(tool)) + ' restore ' + shlex.quote(str(receipt)) + ' --current-release "$1"\n'
    durable(restore, script)
    subprocess.check_call(['sh', '-n', str(restore)])
    data.update(restore=str(restore), restoreSha256=digest(restore), tool=tool.name, toolSha256=tool_sha)
    save(receipt, data)
    backend.record(data)
    if digest(package) != checksum:
        raise RuntimeError('Durable archive changed')
    backend.remove(before)
    data.update(phase='verifying-full-restoration')
    save(receipt, data)
    restored = backend.restore(package, before, destination / info['fileManifest'], info['filesWithDigests'])
    backend.compare(package)
    stable(before, backend.snapshot())
    data.update(phase='restoration-verified-before-final-release', restorationVerified=True, restoration=restored)
    save(receipt, data)
    backend.record(data)
    for material, expected in [(package, checksum), (destination / info['fileManifest'], info['fileManifestSha256']),
                               (destination / info['memberManifest'], info['memberManifestSha256']),
                               (tool, tool_sha), (restore, data['restoreSha256'])]:
        if digest(material) != expected:
            raise RuntimeError('Recovery material changed before final release: ' + str(material))
    backend.remove(before)
    data.update(phase='offloaded', completedAt=time.time())
    remote = backend.record(data)
    data.update(dataFreeAfter=remote.get('dataFree'))
    save(receipt, data)
    print(json.dumps(dict(phase=data['phase'], source=data['source'], archive=str(package), archiveSha256=checksum,
                          entries=data['entries'], restorationVerified=True, dataFreeAfter=data['dataFreeAfter'])), flush=True)
    return data


def restore(receipt, current_release):
    receipt = pathlib.Path(receipt).resolve()
    data = json.loads(receipt.read_text())
    name = pathlib.PurePosixPath(data['source']).name
    if not re.fullmatch(r'www-prev-\d{8}-[a-f0-9]{10}', name) or data['source'] != BASE + '/' + name:
        raise ValueError('Invalid recovery source')
    for key in ['archive', 'fileManifest', 'memberManifest']:
        if pathlib.Path(data[key]).name != data[key]:
            raise ValueError('Recovery assets must remain beside their receipt')
    package = receipt.parent / data['archive']
    file_manifest = receipt.parent / data['fileManifest']
    if digest(package) != data['archiveSha256'] or digest(file_manifest) != data['fileManifestSha256']:
        raise RuntimeError('Recovery materials changed')
    settings = dict(data['remote'], currentRelease=current_release)
    with (receipt.parent / (receipt.stem + '-restore.log')).open('a') as log:
        with SSHBackend(settings, pathlib.PurePosixPath(data['source']).name, log) as backend:
            backend.restore(package, data['before'], file_manifest, data['filesWithDigests'])
            backend.compare(package)
            actual = backend.snapshot()
            for key in ['entries', 'inventorySha256', 'sourceIndexSha256', 'logicalBytes']:
                if actual[key] != data['before'][key]:
                    raise RuntimeError('Restored rollback differs: ' + key)
    print('Inactive rollback restored and verified: ' + data['source'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest='action')
    archive = actions.add_parser('archive')
    archive.add_argument('source')
    archive.add_argument('--destination', required=True)
    archive.add_argument('--current-release', required=True)
    archive.add_argument('--host', required=True)
    archive.add_argument('--identity', required=True)
    archive.add_argument('--port', type=int, default=22)
    recovery = actions.add_parser('restore')
    recovery.add_argument('receipt')
    recovery.add_argument('--current-release', required=True)
    args = parser.parse_args()
    if args.action == 'restore':
        restore(args.receipt, args.current_release)
    elif args.action == 'archive':
        if not re.fullmatch(r'www-prev-\d{8}-[a-f0-9]{10}', args.source):
            parser.error('Choose an exact named rollback directory')
        destination = pathlib.Path(args.destination).resolve()
        destination.mkdir(mode=0o700, parents=True, exist_ok=True)
        with (destination / (args.source + '.log')).open('a') as log:
            settings = dict(host=args.host, identity=args.identity, port=args.port, currentRelease=args.current_release)
            with SSHBackend(settings, args.source, log) as backend:
                offload(args.source, destination, backend)
    else:
        parser.error('Choose archive or restore')


if __name__ == '__main__':
    main()
