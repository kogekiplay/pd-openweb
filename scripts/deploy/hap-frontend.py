#!/usr/bin/env python3
"""Publish a staged HAP frontend; capture and recheck the actual predecessor instead of copying a release digest."""
import argparse
import datetime
import fcntl
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import time
import urllib.request

APP = 'script-app-1'
BASE = '/usr/local/MDPrivateDeployment'
LIVE = BASE + '/www'


def command(args, stdin=None):
    return subprocess.check_output(args, stdin=stdin).decode().strip()


def services():
    result = []
    for name in ['app', 'doc', 'command', 'flink', 'sc']:
        data = json.loads(command(['docker', 'inspect', 'script-' + name + '-1']))[0]
        if not data['State']['Running']:
            raise RuntimeError('Service is not running: ' + name)
        result.append(dict(Id=data['Id'], name=name, image=data['Config']['Image'],
                           ports=data['HostConfig']['PortBindings'],
                           Mounts=sorted(data['Mounts'], key=lambda mount: (mount['Destination'], mount['Source']))))
    return result


def digest(filename):
    return command(['docker', 'exec', APP, 'sha256sum', filename]).split()[0]


def save(root, name, value):
    (root / name).write_text(json.dumps(value, indent=2) + '\n')


def phase(root, name):
    save(root, 'phase.json', dict(phase=name, time=time.time()))
    print(name, flush=True)


def validate_pages(revision):
    pages = []
    for path in ['/', '/dashboard', '/portal.html', '/admin.html', '/mobile.html', '/50x.html']:
        with urllib.request.urlopen('http://127.0.0.1:8881' + path, timeout=20) as response:
            body = response.read().decode('utf-8', 'replace')
            if response.status != 200 or (path != '/50x.html' and revision not in body):
                raise RuntimeError('Frontend page validation failed: ' + path)
            pages.append(dict(path=path, status=response.status, revision=revision in body))
    return pages


def deploy(root, stamp):
    root = pathlib.Path(root).resolve()
    if not re.fullmatch(r'\d{8}', stamp):
        raise ValueError('stamp must be YYYYMMDD')
    artifact = json.loads((root / 'artifact.json').read_text())
    revision = artifact['revision']
    if not re.fullmatch(r'[a-f0-9]{40}', revision):
        raise ValueError('Invalid artifact revision')
    index = (root / 'files/index.html').read_bytes()
    if hashlib.sha256(index).hexdigest() != artifact['indexSha256'] or revision.encode() not in index:
        raise ValueError('Artifact index does not match its revision and manifest')
    if not (root / 'dist').is_dir() or not (root / 'candidate-sha256.txt').is_file():
        raise ValueError('Incomplete frontend candidate')
    label = revision[:10]
    next_dir = BASE + '/www-next-' + label + '-' + stamp
    previous_dir = BASE + '/www-prev-' + stamp + '-' + label
    failed_dir = BASE + '/www-failed-' + label
    before = services()
    predecessor = digest(LIVE + '/index.html')
    if predecessor == artifact['indexSha256']:
        raise RuntimeError('Candidate is already live; inspect its existing deployment record')
    # Exclusive creation keeps a previous attempt's original state available for recovery.
    with (root / 'deployment-before.json').open('x') as capture:
        json.dump(dict(revision=revision, previousIndexSha256=predecessor, services=before,
                       candidateDirectory=next_dir, rollbackDirectory=previous_dir), capture, indent=2)
        capture.write('\n')
    save(root, 'services-before.json', before)
    live_kb = int(command(['docker', 'exec', APP, 'du', '-sk', LIVE]).split()[0])
    if shutil.disk_usage(root).free <= live_kb * 1024 + 4 * 1024 ** 3:
        raise RuntimeError('Insufficient space for the live copy and 4 GiB reserve')
    rollback = '''#!/bin/sh
set -eu
docker exec script-app-1 sh -c 'set -eu; test -d "$2"; test ! -e "$3"; mv "$1" "$3"; if ! mv "$2" "$1"; then mv "$3" "$1"; exit 1; fi' sh %s %s %s
''' % (LIVE, previous_dir, failed_dir)
    (root / 'rollback.sh').write_text(rollback)
    command(['sh', '-n', str(root / 'rollback.sh')])
    phase(root, 'copying-live-for-rollback')
    command(['docker', 'exec', APP, 'sh', '-c',
             'set -eu; test ! -e "$2"; test ! -e "$3"; test ! -e "$4"; cp -a "$1" "$2"',
             'sh', LIVE, next_dir, previous_dir, failed_dir])
    phase(root, 'overlaying-candidate')
    command(['docker', 'cp', str(root / 'files') + '/.', APP + ':' + next_dir + '/'])
    command(['docker', 'cp', str(root / 'dist') + '/.', APP + ':' + next_dir + '/dist/'])
    phase(root, 'verifying-all-candidate-files')
    with (root / 'candidate-sha256.txt').open('rb') as manifest:
        command(['docker', 'exec', '-i', APP, 'sh', '-c', 'cd "$1" && sha256sum -c --quiet -',
                 'sh', next_dir], stdin=manifest)
    if command(['docker', 'exec', APP, 'find', next_dir, '-name', '*.dev.js', '-print', '-quit']):
        raise RuntimeError('Development asset in candidate')
    if digest(next_dir + '/index.html') != artifact['indexSha256']:
        raise RuntimeError('Candidate index verification failed')
    command(['docker', 'exec', APP, 'test', '-f', next_dir + '/50x.html'])
    command(['docker', 'exec', APP, '/usr/local/nginx/sbin/nginx', '-t'])
    if digest(LIVE + '/index.html') != predecessor or services() != before:
        raise RuntimeError('Production changed during candidate preparation; inspect before switching')
    phase(root, 'switching-frontend')
    command(['docker', 'exec', APP, 'sh', '-c',
             'set -eu; mv "$1" "$3"; if ! mv "$2" "$1"; then mv "$3" "$1"; exit 1; fi',
             'sh', LIVE, next_dir, previous_dir])
    try:
        if digest(LIVE + '/index.html') != artifact['indexSha256'] or digest(previous_dir + '/index.html') != predecessor:
            raise RuntimeError('Live or rollback index does not match')
        after = services()
        if after != before:
            raise RuntimeError('Service identity, image, mounts or ports changed')
        save(root, 'http-internal.json', validate_pages(revision))
        save(root, 'services-after.json', after)
    except BaseException:
        command(['sh', str(root / 'rollback.sh')])
        if digest(LIVE + '/index.html') != predecessor:
            raise RuntimeError('Rollback digest mismatch; inspect production immediately')
        phase(root, 'rolled-back-after-validation-failure')
        raise
    phase(root, 'completed')
    print(json.dumps(dict(revision=revision, indexSha256=artifact['indexSha256'],
                          filesVerified=artifact['files'], rollback=previous_dir, servicesUnchanged=True)), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('staging', help='Directory containing files/, dist/, artifact.json and candidate-sha256.txt')
    parser.add_argument('--stamp', default=datetime.datetime.now().strftime('%Y%m%d'))
    args = parser.parse_args()
    with open('/var/lock/hap-frontend.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        deploy(args.staging, args.stamp)


if __name__ == '__main__':
    main()
