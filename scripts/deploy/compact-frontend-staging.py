#!/usr/bin/env python3
"""Release duplicate candidate trees only after verifying their durable recovery archive."""
import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import shutil
import tarfile
import time

SPEC = importlib.util.spec_from_file_location('hap_deploy', str(pathlib.Path(__file__).with_name('hap-frontend.py')))
DEPLOY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DEPLOY)
STAGING_BASE = pathlib.Path('/data/mingdao')


def digest(stream):
    result = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        result.update(block)
    return result.hexdigest()


def file_digest(path):
    with path.open('rb') as stream:
        return digest(stream)


def durable(path, text):
    with path.open('x') as stream:
        stream.write(text)
        stream.flush()
        os.fsync(stream.fileno())


def save(path, data):
    temporary = path.with_suffix('.json.tmp')
    with temporary.open('w') as stream:
        json.dump(data, stream, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)
    descriptor = os.open(str(path.parent), os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def safe_name(name):
    path = pathlib.PurePosixPath(name)
    if not name or '\n' in name or path.is_absolute() or any(part in ('', '.', '..') for part in name.split('/')):
        raise ValueError('Unsafe candidate path: ' + repr(name))
    return path


def candidate_manifest(root):
    expected = {}
    for line in (root / 'candidate-sha256.txt').read_text().splitlines():
        checksum, separator, name = line.partition('  ')
        if not separator or not re.fullmatch(r'[a-f0-9]{64}', checksum):
            raise ValueError('Invalid candidate manifest')
        safe_name(name)
        archived = name if name.startswith('dist/') else 'files/' + name
        if archived in expected:
            raise ValueError('Duplicate candidate manifest entry')
        expected[archived] = checksum
    artifact = json.loads((root / 'artifact.json').read_text())
    if not re.fullmatch(r'[a-f0-9]{40}', artifact['revision']) or len(expected) != artifact['files']:
        raise ValueError('Invalid artifact revision or count')
    if expected.get('files/index.html') != artifact['indexSha256']:
        raise ValueError('Candidate index does not match the artifact')
    return artifact, expected


def inventory(root):
    result = {}
    for directory in ['files', 'dist']:
        base = root / directory
        if not base.is_dir() or base.is_symlink():
            raise ValueError('Missing or linked candidate directory')
        for path in base.rglob('*'):
            if path.is_symlink():
                raise ValueError('Linked candidate member')
            if path.is_dir():
                continue
            if not path.is_file():
                raise ValueError('Non-file candidate member')
            name = path.relative_to(root).as_posix()
            safe_name(name)
            stat = path.stat()
            result[name] = (stat.st_size, stat.st_mtime_ns, stat.st_mode, stat.st_ino)
    return result


def verify_candidate(root):
    artifact, expected = candidate_manifest(root)
    archive = root / 'frontend.tar.gz'
    if archive.is_symlink() or not archive.is_file():
        raise ValueError('Missing or linked recovery archive')
    archive_stat = archive.stat()
    archive_sha = file_digest(archive)
    seen = set()
    metadata = {'artifact.json', 'candidate-sha256.txt', 'deploy.py'}
    with tarfile.open(archive, 'r:gz') as package:
        for member in package:
            safe_name(member.name)
            if not member.isfile() or member.name in seen:
                raise ValueError('Non-file or duplicate archive entry')
            seen.add(member.name)
            stream = package.extractfile(member)
            if stream is None:
                raise ValueError('Unreadable archive member')
            with stream:
                checksum = digest(stream)
            if member.name in expected:
                if checksum != expected[member.name]:
                    raise ValueError('Archive candidate mismatch: ' + member.name)
            elif member.name not in metadata or checksum != file_digest(root / member.name):
                raise ValueError('Archive metadata mismatch: ' + member.name)
    if seen != set(expected) | metadata:
        raise ValueError('Recovery archive is incomplete')
    before = inventory(root)
    if set(before) != set(expected):
        raise ValueError('Extracted candidate has missing or extra files')
    for name, checksum in expected.items():
        if file_digest(root / name) != checksum:
            raise ValueError('Extracted candidate mismatch: ' + name)
    if artifact['revision'].encode() not in (root / 'files/index.html').read_bytes():
        raise ValueError('Extracted index lacks its source revision')
    if inventory(root) != before or archive.stat() != archive_stat:
        raise RuntimeError('Candidate changed during verification')
    return artifact, archive_sha, before


def compact(staging, current_release):
    root = pathlib.Path(staging)
    current_release = pathlib.Path(current_release).resolve()
    if (root.parent != STAGING_BASE or not re.fullmatch(r'frontend-[a-f0-9]{10}-\d{8}', root.name)
            or root.is_symlink() or root.resolve() != root or root == current_release):
        raise ValueError('Only an older named staging directory may be compacted')
    if json.loads((root / 'phase.json').read_text())['phase'] != 'completed':
        raise ValueError('Only a completed release candidate may be compacted')
    current_artifact = json.loads((current_release / 'artifact.json').read_text())
    current = json.loads((current_release / 'deployment-before.json').read_text())
    if json.loads((current_release / 'phase.json').read_text())['phase'] != 'completed':
        raise ValueError('Current release is not complete')
    services = DEPLOY.services()
    live_sha = DEPLOY.digest(DEPLOY.LIVE + '/index.html')
    rollback_sha = DEPLOY.digest(current['rollbackDirectory'] + '/index.html')
    if live_sha != current_artifact['indexSha256'] or rollback_sha != current['previousIndexSha256']:
        raise RuntimeError('Production does not match its current release record')
    record = root / 'staging-compaction.json'
    durable(record, '{}\n')
    save(record, dict(phase='verifying', currentRelease=str(current_release)))
    print('verifying ' + str(root), flush=True)
    artifact, archive_sha, files = verify_candidate(root)
    if (services != DEPLOY.services() or DEPLOY.digest(DEPLOY.LIVE + '/index.html') != live_sha
            or DEPLOY.digest(current['rollbackDirectory'] + '/index.html') != rollback_sha):
        raise RuntimeError('Production changed; preserve extracted candidates')
    durable(root / 'frontend-archive.sha256', archive_sha + '  frontend.tar.gz\n')
    restore = root / 'restore-staging.sh'
    durable(restore, '''#!/bin/sh
set -eu
cd '%s'
sha256sum -c frontend-archive.sha256
test ! -e files
test ! -e dist
tar -xzf frontend.tar.gz
printf '%%s  %%s\n' '%s' 'files/index.html' | sha256sum -c -
''' % (root, artifact['indexSha256']))
    DEPLOY.command(['sh', '-n', str(restore)])
    data = dict(phase='verified-before-compaction', revision=artifact['revision'], filesVerified=len(files),
                archiveSha256=archive_sha, indexSha256=artifact['indexSha256'], restore=str(restore),
                currentRelease=str(current_release), liveIndexSha256=live_sha, rollbackIndexSha256=rollback_sha,
                protectedRollback=current['rollbackDirectory'], services=services, verifiedAt=time.time())
    save(record, data)
    if inventory(root) != files or file_digest(root / 'frontend.tar.gz') != archive_sha:
        raise RuntimeError('Recovery or candidate changed before compaction')
    for name in ['files', 'dist']:
        shutil.rmtree(root / name)
    data.update(phase='compacted', completedAt=time.time(), freeBytes=shutil.disk_usage(root).free)
    save(record, data)
    print(json.dumps(data), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('staging', nargs='+')
    parser.add_argument('--current-release', required=True)
    args = parser.parse_args()
    with open('/var/lock/hap-frontend.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        for staging in args.staging:
            compact(staging, args.current_release)


if __name__ == '__main__':
    main()
