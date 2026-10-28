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
import tempfile
import time
import urllib.request

APP = 'script-app-1'
BASE = '/usr/local/MDPrivateDeployment'
LIVE = BASE + '/www'


def command(args, stdin=None):
    """Run a command; bytes stdin is materialized so subprocess gets a real descriptor.

    io.BytesIO has no fileno(), which subprocess refuses, so byte payloads (the generated
    remote manifest) go through a temporary file; every other call keeps the old path.
    """
    if isinstance(stdin, (bytes, bytearray, memoryview)):
        with tempfile.TemporaryFile() as handle:
            handle.write(bytes(stdin))
            handle.seek(0)
            return subprocess.check_output(args, stdin=handle).decode().strip()
    return subprocess.check_output(args, stdin=stdin).decode().strip()


def services():
    """Running services plus the identity fields that must not move during a deploy.

    RestartCount / StartedAt catch a restart that keeps the same container id; Health is
    consulted only when the service declares a healthcheck (its Status is then present).
    """
    result = []
    for name in ['app', 'doc', 'command', 'flink', 'sc']:
        data = json.loads(command(['docker', 'inspect', 'script-' + name + '-1']))[0]
        state = data['State']
        if not state['Running']:
            raise RuntimeError('Service is not running: ' + name)
        health = state.get('Health') or {}
        status = health.get('Status')
        if status is not None and status != 'healthy':
            raise RuntimeError('Service is unhealthy: %s (%s)' % (name, status))
        result.append(dict(Id=data['Id'], name=name, image=data['Config']['Image'],
                           ports=data['HostConfig']['PortBindings'],
                           Mounts=sorted(data['Mounts'], key=lambda mount: (mount['Destination'], mount['Source'])),
                           restartCount=data.get('RestartCount'),
                           startedAt=state.get('StartedAt'),
                           health=status))
    return result


def digest(filename):
    return command(['docker', 'exec', APP, 'sha256sum', filename]).split()[0]


def save(root, name, value):
    (root / name).write_text(json.dumps(value, indent=2) + '\n')


def phase(root, name):
    save(root, 'phase.json', dict(phase=name, time=time.time()))
    print(name, flush=True)


def payload_paths(name):
    """Map one manifest entry to (local staging path, remote web dir path).

    The artifact archives files/ plus dist/, while the remote web root is the flattened
    files/ content plus dist/. That is the only accepted pair: an entry which does not
    resolve to a regular file is rejected, never rewritten silently.
    """
    if not name or name.startswith('/') or any(part in ('', '.', '..') for part in name.split('/')):
        raise ValueError('Unsafe candidate path: ' + repr(name))
    if name.startswith('dist/'):
        return name, name
    if name.startswith('files/'):
        remote = name[len('files/'):]
        if not remote or remote.startswith('/') or remote.startswith('files/'):
            raise ValueError('Unresolvable candidate path: ' + repr(name))
        return name, remote
    return 'files/' + name, name


def verify_payload(root, artifact):
    """Prove the whole staging payload locally, before any remote command runs.

    Every manifest entry must map to a regular file whose bytes hash to the recorded digest,
    the entry count must equal artifact[files], and nothing regular may sit outside the
    manifest. A manifest in an unusable layout fails here, naming the offending entry.
    """
    entries = []
    seen = set()
    for line in (root / 'candidate-sha256.txt').read_text().splitlines():
        checksum, separator, name = line.partition('  ')
        if not separator or not re.fullmatch(r'[a-f0-9]{64}', checksum):
            raise ValueError('Invalid candidate manifest line: ' + line[:120])
        if name in seen:
            raise ValueError('Duplicate candidate manifest entry: ' + name)
        seen.add(name)
        entries.append((checksum, name))
    if not entries:
        raise ValueError('Empty candidate manifest')
    if len(entries) != artifact['files']:
        raise ValueError('Manifest lists %d files but artifact records %d' % (len(entries), artifact['files']))
    verified = []
    covered = set()
    remote_seen = set()
    for checksum, name in entries:
        local, remote = payload_paths(name)
        # files/index.html and index.html map onto the same pair; two entries for one file would
        # otherwise inflate the count and let artifact[files] agree with a short payload.
        if local in covered:
            raise ValueError('Two manifest entries map to the same staging file: %s (remote %s)' % (local, remote))
        if remote in remote_seen:
            raise ValueError('Two manifest entries map to the same remote path: ' + remote)
        path = root / local
        if not path.is_file() or path.is_symlink():
            raise RuntimeError('Candidate payload is missing a regular file: %s (remote %s)' % (local, remote))
        if hashlib.sha256(path.read_bytes()).hexdigest() != checksum:
            raise RuntimeError('Candidate payload digest mismatch: ' + local)
        if remote.endswith('.dev.js'):
            raise RuntimeError('Development asset in candidate: ' + remote)
        covered.add(local)
        remote_seen.add(remote)
        verified.append((checksum, remote))
    present = set()
    for directory in ('files', 'dist'):
        base = root / directory
        if not base.is_dir():
            raise RuntimeError('Missing candidate directory: ' + directory)
        for path in base.rglob('*'):
            relative = path.relative_to(root).as_posix()
            if path.is_symlink():
                raise RuntimeError('Linked candidate file: ' + relative)
            if path.is_file():
                present.add(relative)
    unlisted = sorted(present - covered)
    if unlisted:
        raise RuntimeError('Candidate payload has unlisted files: %d e.g. %s' % (len(unlisted), unlisted[:3]))
    return verified


REVISION_MARKER = re.compile(r'(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])')


def revision_marker(text):
    """Build revision stamped inside an index page, if that page carries one.

    The web root has no artifact.json, so the only honest source is the marker the build writes
    into index.html itself. Callers must treat None as "unknown, so not verified".
    """
    if not text:
        return None
    match = REVISION_MARKER.search(text)
    return match.group(0) if match else None


def live_revision_marker():
    """Revision marker of the page that is live now (after a rollback: the predecessor)."""
    return revision_marker(command(['docker', 'exec', APP, 'sh', '-c',
                                    'head -c 262144 "$1/index.html" 2>/dev/null || true', 'sh', LIVE]))


ATTEMPT_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,31}')


def checked_attempt_id(attempt_id):
    """Validate the opt-in attempt token here, so a direct deploy() call cannot bypass the CLI."""
    if attempt_id is None:
        return None
    if not isinstance(attempt_id, str) or not ATTEMPT_ID.fullmatch(attempt_id):
        raise ValueError('attempt id must be a safe token: [A-Za-z0-9][A-Za-z0-9._-]{0,31}')
    return attempt_id


def attempt_directories(revision, stamp, attempt_id=None):
    """Directory names for this attempt.

    attempt_id is opt-in: without it the names are exactly the ones earlier releases used.
    """
    attempt_id = checked_attempt_id(attempt_id)
    label = revision[:10]
    suffix = '' if attempt_id is None else '-' + attempt_id
    return (BASE + '/www-next-' + label + '-' + stamp + suffix,
            BASE + '/www-prev-' + stamp + '-' + label + suffix,
            BASE + '/www-failed-' + label + suffix)


def validate_pages(revision):
    pages = []
    for path in ['/', '/dashboard', '/portal.html', '/admin.html', '/mobile.html', '/50x.html']:
        with urllib.request.urlopen('http://127.0.0.1:8881' + path, timeout=20) as response:
            body = response.read().decode('utf-8', 'replace')
            if response.status != 200 or (path != '/50x.html' and revision not in body):
                raise RuntimeError('Frontend page validation failed: ' + path)
            pages.append(dict(path=path, status=response.status, revision=revision in body))
    return pages


def deploy(root, stamp, attempt_id=None):
    root = pathlib.Path(root).resolve()
    attempt_id = checked_attempt_id(attempt_id)
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
    verified = verify_payload(root, artifact)
    next_dir, previous_dir, failed_dir = attempt_directories(revision, stamp, attempt_id)
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
    # The remote check re-verifies the same set the local payload check already proved, but in
    # the flattened remote layout the container actually holds.
    remote_manifest = ''.join('%s  %s\n' % (checksum, remote) for checksum, remote in verified)
    command(['docker', 'exec', '-i', APP, 'sh', '-c', 'cd "$1" && sha256sum -c --quiet -',
             'sh', next_dir], stdin=remote_manifest.encode())
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
        restored = services()
        if restored != before:
            raise RuntimeError('Services changed during rollback; inspect production immediately')
        # Re-check the restored pages using the revision marker read from the live index, so a
        # failed switch is never validated as if the new build were live. When no marker is
        # available the record says the page check was NOT performed - it is never claimed.
        rolled_back_revision = live_revision_marker()
        if rolled_back_revision and rolled_back_revision != revision:
            save(root, 'http-rollback.json', validate_pages(rolled_back_revision))
        else:
            save(root, 'http-rollback.json',
                 dict(validated=False, revision=rolled_back_revision,
                      reason='no usable predecessor revision marker in the live index'))
        phase(root, 'rolled-back-after-validation-failure')
        raise
    phase(root, 'completed')
    print(json.dumps(dict(revision=revision, indexSha256=artifact['indexSha256'],
                          filesVerified=artifact['files'], rollback=previous_dir, servicesUnchanged=True)), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('staging', help='Directory containing files/, dist/, artifact.json and candidate-sha256.txt')
    parser.add_argument('--stamp', default=datetime.datetime.now().strftime('%Y%m%d'))
    parser.add_argument('--attempt-id', default=None,
                        help='Optional safe token that makes the next/prev/failed directories unique')
    args = parser.parse_args()
    checked_attempt_id(args.attempt_id)
    with open('/var/lock/hap-frontend.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        deploy(args.staging, args.stamp, args.attempt_id)


if __name__ == '__main__':
    main()
