#!/usr/bin/env python3
"""Archive an older frontend rollback only after tar compares every archived entry with its source."""
import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import shutil
import subprocess
import time

SPEC = importlib.util.spec_from_file_location('hap_deploy', str(pathlib.Path(__file__).with_name('hap-frontend.py')))
DEPLOY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DEPLOY)
BASE = DEPLOY.BASE
APP = DEPLOY.APP
RESERVE = 4 * 1024 ** 3


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def save(path, data):
    temporary = path.with_suffix('.json.tmp')
    with temporary.open('w') as stream:
        json.dump(data, stream, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)


def inventory(source):
    data = subprocess.check_output(['docker', 'exec', APP, 'find', source, '-printf',
                                    r'%P\0%y\0%s\0%T@\0%m\0%U\0%G\0%l\0'])
    fields = data.split(b'\0')
    if fields.pop() != b'' or len(fields) % 8:
        raise RuntimeError('Invalid rollback inventory')
    entries = sorted(tuple(fields[i:i + 8]) for i in range(0, len(fields), 8))
    return hashlib.sha256(repr(entries).encode()).hexdigest(), len(entries)


def archive(name, destination, current_release):
    if not re.fullmatch(r'www-prev-\d{8}-[a-f0-9]{10}', name):
        raise ValueError('Only a named frontend rollback directory can be archived')
    destination = pathlib.Path(destination).resolve()
    current_release = pathlib.Path(current_release).resolve()
    artifact = json.loads((current_release / 'artifact.json').read_text())
    current = json.loads((current_release / 'deployment-before.json').read_text())
    phase = json.loads((current_release / 'phase.json').read_text())
    protected = current['rollbackDirectory']
    source = BASE + '/' + name
    if source == protected or phase['phase'] != 'completed':
        raise ValueError('Current rollback must remain immediately available')
    before_services = DEPLOY.services()
    live_digest = DEPLOY.digest(DEPLOY.LIVE + '/index.html')
    protected_digest = DEPLOY.digest(protected + '/index.html')
    if live_digest != artifact['indexSha256'] or protected_digest != current['previousIndexSha256']:
        raise RuntimeError('Current release or its rollback does not match the deployment record')
    DEPLOY.command(['docker', 'exec', APP, 'test', '-d', source])
    DEPLOY.command(['docker', 'exec', APP, 'test', '!', '-L', source])
    source_digest = DEPLOY.digest(source + '/index.html')
    inventory_digest, count = inventory(source)
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    record = destination / (name + '.json')
    package = destination / (name + '.tar.gz')
    partial = destination / (name + '.tar.gz.partial')
    with record.open('x'):
        pass
    data = dict(source=source, archive=str(package), phase='creating-archive', sourceIndexSha256=source_digest,
                inventorySha256=inventory_digest, entries=count, currentRelease=str(current_release),
                protectedRollback=protected, liveIndexSha256=live_digest, services=before_services)
    save(record, data)
    if package.exists() or partial.exists():
        raise FileExistsError('Archive already exists; inspect its recovery record')
    if shutil.disk_usage(destination).free <= RESERVE:
        raise RuntimeError('Archive filesystem needs a 4 GiB reserve')
    print('creating-archive ' + name, flush=True)
    with partial.open('xb') as output, (destination / (name + '.log')).open('a') as log:
        process = subprocess.Popen(['docker', 'exec', APP, 'tar', '--numeric-owner', '--acls', '--xattrs',
                                    '-I', 'gzip -1', '-cpf', '-', '-C', BASE, name], stdout=output, stderr=log)
        while process.poll() is None:
            if shutil.disk_usage(destination).free <= RESERVE:
                process.terminate()
                process.wait()
                raise RuntimeError('Archive stopped to preserve 4 GiB; original rollback remains intact')
            time.sleep(1)
        if process.returncode:
            raise RuntimeError('Archive creation failed; inspect its log')
        output.flush()
        os.fsync(output.fileno())
    print('comparing-archive-with-original ' + name, flush=True)
    with partial.open('rb') as stream:
        DEPLOY.command(['docker', 'exec', '-i', APP, 'tar', '--numeric-owner', '--acls', '--xattrs',
                        '-dzf', '-', '-C', BASE], stdin=stream)
    if inventory(source) != (inventory_digest, count):
        raise RuntimeError('Original rollback changed during archiving')
    package_sha = sha256(partial)
    partial.rename(package)
    os.chmod(str(package), 0o600)
    checksum = destination / (name + '.sha256')
    checksum.write_text(package_sha + '  ' + package.name + '\n')
    restore = destination / (name + '-restore.sh')
    restore.write_text('''#!/bin/sh
set -eu
cd "%s"
sha256sum -c "%s"
docker exec %s test ! -e "%s"
docker exec -i %s tar --numeric-owner --acls --xattrs -xzpf - -C "%s" < "%s"
printf '%%s  %%s\\n' '%s' '%s/index.html' | docker exec -i %s sha256sum -c -
''' % (destination, checksum.name, APP, source, APP, BASE, package.name, source_digest, source, APP))
    DEPLOY.command(['sh', '-n', str(restore)])
    for path in [checksum, restore]:
        with path.open('rb') as stream:
            os.fsync(stream.fileno())
    data.update(phase='verified-before-release', archiveSha256=package_sha, restore=str(restore), verifiedAt=time.time())
    save(record, data)
    directory = os.open(str(destination), os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)
    if (DEPLOY.services() != before_services or DEPLOY.digest(DEPLOY.LIVE + '/index.html') != live_digest or
            DEPLOY.digest(protected + '/index.html') != protected_digest or
            DEPLOY.digest(source + '/index.html') != source_digest):
        raise RuntimeError('Production changed; preserve the original rollback and inspect')
    # The archive, compare, checksum and recovery script are durable before releasing this old copy.
    DEPLOY.command(['docker', 'exec', APP, 'rm', '-rf', '--', source])
    data.update(phase='archived', completedAt=time.time())
    save(record, data)
    print(json.dumps(dict(phase='archived', source=source, archive=str(package), archiveSha256=package_sha,
                          entries=count, restore=str(restore))), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', help='Exact www-prev-YYYYMMDD-revision directory name')
    parser.add_argument('--destination', required=True)
    parser.add_argument('--current-release', required=True)
    args = parser.parse_args()
    with open('/var/lock/hap-frontend.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        archive(args.source, args.destination, args.current_release)


if __name__ == '__main__':
    main()
