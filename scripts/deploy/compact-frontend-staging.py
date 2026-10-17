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
import tempfile
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


def archive_identity(path):
    stat = path.stat()
    # Reading an old package may update atime. It does not change its content.
    return stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns


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


def verify_candidate(root, deployment_metadata_sha256=None):
    artifact, expected = candidate_manifest(root)
    for name in ['artifact.json', 'candidate-sha256.txt', 'deploy.py']:
        if (root / name).is_symlink() or not (root / name).is_file():
            raise ValueError('Missing or linked candidate metadata: ' + name)
    if deployment_metadata_sha256 is not None:
        if (not re.fullmatch(r'[a-f0-9]{64}', deployment_metadata_sha256)
                or file_digest(root / 'deploy.py') != deployment_metadata_sha256):
            raise ValueError('Deployment metadata does not match its reviewed SHA256')
    archive = root / 'frontend.tar.gz'
    if archive.is_symlink() or not archive.is_file():
        raise ValueError('Missing or linked recovery archive')
    archive_stat = archive_identity(archive)
    archive_sha = file_digest(archive)
    seen = set()
    metadata = {'artifact.json', 'candidate-sha256.txt', 'deploy.py'}
    archived_metadata = {}
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
            elif member.name in metadata:
                archived_metadata[member.name] = checksum
                if checksum != file_digest(root / member.name):
                    if member.name != 'deploy.py' or deployment_metadata_sha256 is None:
                        raise ValueError('Archive metadata mismatch: ' + member.name)
            else:
                raise ValueError('Unexpected archive member: ' + member.name)
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
    if inventory(root) != before or archive_identity(archive) != archive_stat:
        raise RuntimeError('Candidate changed during verification')
    if deployment_metadata_sha256 is not None and file_digest(root / 'deploy.py') != deployment_metadata_sha256:
        raise RuntimeError('Deployment metadata changed during verification')
    return artifact, archive_sha, before, archived_metadata


def preserve_metadata(root, expected, archive_sha, archived_metadata, reviewed_sha):
    """Keep both metadata versions and prove payload-only recovery before removing duplicates."""
    snapshot = root / 'recovery-metadata'
    snapshot.mkdir(mode=0o700)
    current_metadata = {}
    for name in sorted(archived_metadata):
        source = root / name
        shutil.copy2(source, snapshot / name)
        with (snapshot / name).open('rb') as stream:
            os.fsync(stream.fileno())
        checksum = file_digest(snapshot / name)
        if checksum != file_digest(source):
            raise RuntimeError('Metadata changed while being preserved: ' + name)
        if name != 'deploy.py' and checksum != archived_metadata[name]:
            raise RuntimeError('Unreviewed metadata changed: ' + name)
        current_metadata[name] = checksum
    if current_metadata['deploy.py'] != reviewed_sha:
        raise RuntimeError('Preserved deployment metadata differs from the reviewed version')
    descriptor = os.open(str(snapshot), os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    durable(root / 'recovery-metadata.sha256', ''.join(
        checksum + '  recovery-metadata/' + name + '\n' for name, checksum in sorted(current_metadata.items())))
    durable(root / 'recovery-payload.sha256', ''.join(
        checksum + '  ' + name + '\n' for name, checksum in sorted(expected.items())))
    # The original package stays intact. Extracting only files/dist must not replace
    # its later deployment script with the older script inside that package.
    restore = root / 'restore-staging.sh'
    durable(restore, '''#!/bin/sh
set -eu
archive_root='%s'
target_dir=${1:-"$archive_root"}
cd "$archive_root"
sha256sum -c frontend-archive.sha256
sha256sum -c recovery-metadata.sha256
test ! -e "$target_dir/files"
test ! -e "$target_dir/dist"
for name in artifact.json candidate-sha256.txt deploy.py; do
  if test -e "$target_dir/$name"; then
    cmp "$archive_root/recovery-metadata/$name" "$target_dir/$name"
  else
    cp -p "$archive_root/recovery-metadata/$name" "$target_dir/$name"
  fi
done
cd "$target_dir"
tar -xzf "$archive_root/frontend.tar.gz" files dist
sha256sum -c --quiet "$archive_root/recovery-payload.sha256"
''' % root)
    DEPLOY.command(['sh', '-n', str(restore)])
    required = sum(value[0] for value in inventory(root).values()) + 256 * 1024 ** 2
    if shutil.disk_usage(root).free <= required + 4 * 1024 ** 3:
        raise RuntimeError('Insufficient space for recovery verification and a 4 GiB reserve')
    print('verifying-real-recovery ' + str(root), flush=True)
    with tempfile.TemporaryDirectory(prefix='staging-recovery-', dir=str(root.parent)) as temporary:
        target = pathlib.Path(temporary)
        DEPLOY.command(['sh', str(restore), str(target)])
        if set(inventory(target)) != set(expected):
            raise RuntimeError('Recovered candidate has missing or extra files')
        for name, checksum in expected.items():
            if file_digest(target / name) != checksum:
                raise RuntimeError('Recovered candidate mismatch: ' + name)
        for name, checksum in current_metadata.items():
            if file_digest(target / name) != checksum or file_digest(root / name) != checksum:
                raise RuntimeError('Recovered or original metadata mismatch: ' + name)
    if file_digest(root / 'frontend.tar.gz') != archive_sha:
        raise RuntimeError('Original recovery archive changed')
    data = dict(current=current_metadata, archived=archived_metadata, reviewedDeploymentSha256=reviewed_sha,
                archiveSha256=archive_sha, filesRecovered=len(expected), verifiedAt=time.time())
    save(root / 'metadata-recovery.json', data)
    return restore, data


def compact(staging, current_release, deployment_metadata_sha256=None):
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
    previous_verification = None
    if record.exists() and deployment_metadata_sha256 is not None:
        if (json.loads(record.read_text()).get('phase') != 'verifying'
                or (root / 'frontend-archive.sha256').exists() or (root / 'restore-staging.sh').exists()):
            raise ValueError('Existing compaction progressed beyond verification; inspect its recovery state')
        previous_verification = 'staging-compaction-before-metadata-recovery.json'
        durable(root / previous_verification, record.read_text())
    else:
        durable(record, '{}\n')
    save(record, dict(phase='verifying', currentRelease=str(current_release)))
    print('verifying ' + str(root), flush=True)
    artifact, archive_sha, files, archived_metadata = verify_candidate(root, deployment_metadata_sha256)
    if (services != DEPLOY.services() or DEPLOY.digest(DEPLOY.LIVE + '/index.html') != live_sha
            or DEPLOY.digest(current['rollbackDirectory'] + '/index.html') != rollback_sha):
        raise RuntimeError('Production changed; preserve extracted candidates')
    durable(root / 'frontend-archive.sha256', archive_sha + '  frontend.tar.gz\n')
    metadata_recovery = None
    if deployment_metadata_sha256 is not None:
        _, expected = candidate_manifest(root)
        restore, metadata_recovery = preserve_metadata(
            root, expected, archive_sha, archived_metadata, deployment_metadata_sha256)
    else:
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
    if metadata_recovery is not None:
        data.update(metadataRecovery=metadata_recovery, previousVerification=previous_verification)
    save(record, data)
    if inventory(root) != files or file_digest(root / 'frontend.tar.gz') != archive_sha:
        raise RuntimeError('Recovery or candidate changed before compaction')
    if metadata_recovery is not None:
        for name, checksum in metadata_recovery['current'].items():
            if file_digest(root / name) != checksum or file_digest(root / 'recovery-metadata' / name) != checksum:
                raise RuntimeError('Preserved deployment metadata changed before compaction')
        if (services != DEPLOY.services() or DEPLOY.digest(DEPLOY.LIVE + '/index.html') != live_sha
                or DEPLOY.digest(current['rollbackDirectory'] + '/index.html') != rollback_sha):
            raise RuntimeError('Production changed during recovery verification')
    for name in ['files', 'dist']:
        shutil.rmtree(root / name)
    data.update(phase='compacted', completedAt=time.time(), freeBytes=shutil.disk_usage(root).free)
    save(record, data)
    print(json.dumps(data), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('staging', nargs='+')
    parser.add_argument('--current-release', required=True)
    parser.add_argument('--deployment-metadata-sha256', help='Preserve this reviewed deploy.py version separately and verify full recovery')
    args = parser.parse_args()
    if args.deployment_metadata_sha256 is not None and len(args.staging) != 1:
        parser.error('Reviewed deployment metadata requires exactly one staging directory')
    with open('/var/lock/hap-frontend.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        for staging in args.staging:
            compact(staging, args.current_release, args.deployment_metadata_sha256)


if __name__ == '__main__':
    main()
