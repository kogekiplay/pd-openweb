import contextlib
import importlib.util
import io
import json
import os
import pathlib
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('compact', str(pathlib.Path(__file__).with_name('compact-frontend-staging.py')))
COMPACT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(COMPACT)


class CompactionTests(unittest.TestCase):
    def fixture(self, root, fault=None):
        stage = root / ('frontend-' + 'a' * 10 + '-20261016')
        stage.mkdir()
        (stage / 'files').mkdir()
        (stage / 'dist').mkdir()
        (stage / 'files/index.html').write_text('revision=' + 'a' * 40)
        (stage / 'dist/chunk.js').write_text('candidate javascript')
        artifact = dict(revision='a' * 40, indexSha256=COMPACT.file_digest(stage / 'files/index.html'), files=2)
        (stage / 'artifact.json').write_text(json.dumps(artifact))
        (stage / 'deploy.py').write_text('# exact original deployment script\n')
        manifest = ''.join(COMPACT.file_digest(stage / name) + '  ' + target + '\n'
                           for name, target in [('files/index.html', 'index.html'), ('dist/chunk.js', 'dist/chunk.js')])
        (stage / 'candidate-sha256.txt').write_text(manifest)
        (stage / 'phase.json').write_text(json.dumps(dict(phase='completed')))
        (stage / 'rollback.sh').write_text('# preserve rollback script')
        with tarfile.open(stage / 'frontend.tar.gz', 'w:gz') as package:
            if fault in ['directories', 'duplicate-directory', 'unlisted-directory']:
                for directory in ['files', 'dist']:
                    package.add(stage / directory, arcname=directory, recursive=False)
            if fault == 'duplicate-directory':
                package.add(stage / 'files', arcname='files', recursive=False)
            if fault == 'unlisted-directory':
                member = tarfile.TarInfo('files/not-in-manifest')
                member.type = tarfile.DIRTYPE
                package.addfile(member)
            for name in ['files/index.html', 'dist/chunk.js', 'artifact.json', 'candidate-sha256.txt', 'deploy.py']:
                if fault == 'missing' and name == 'dist/chunk.js':
                    continue
                package.add(stage / name, arcname=name, recursive=False)
            if fault == 'duplicate':
                package.add(stage / 'files/index.html', arcname='files/index.html', recursive=False)
            if fault == 'traversal':
                package.add(stage / 'files/index.html', arcname='../index.html', recursive=False)
            if fault == 'tar-link':
                member = tarfile.TarInfo('files/link')
                member.type = tarfile.SYMTYPE
                member.linkname = '/outside'
                package.addfile(member)
        if fault == 'changed':
            (stage / 'dist/chunk.js').write_text('different extracted content')
        if fault == 'extra':
            (stage / 'files/extra').write_text('not in archive')
        if fault == 'linked':
            (stage / 'files/link').symlink_to(stage / 'dist/chunk.js')
        current = root / ('frontend-' + 'b' * 10 + '-20261017')
        current.mkdir()
        for name, value in [('artifact.json', dict(indexSha256='live')),
                            ('deployment-before.json', dict(rollbackDirectory='/protected', previousIndexSha256='rollback')),
                            ('phase.json', dict(phase='completed'))]:
            (current / name).write_text(json.dumps(value))
        return stage, current

    def run_compact(self, root, stage, current, production_changed=False, reviewed_sha=None,
                    changed_after_recovery=False):
        def digest(name):
            return 'live' if name == COMPACT.DEPLOY.LIVE + '/index.html' else 'rollback'
        calls = 0
        def services():
            nonlocal calls
            calls += 1
            return 'changed' if (production_changed and calls > 1) or (changed_after_recovery and calls > 2) else 'unchanged'
        with patch.object(COMPACT, 'STAGING_BASE', root), \
                patch.object(COMPACT.DEPLOY, 'services', side_effect=services), \
                patch.object(COMPACT.DEPLOY, 'digest', side_effect=digest), \
                contextlib.redirect_stdout(io.StringIO()):
            COMPACT.compact(str(stage), str(current), reviewed_sha)

    def test_success_and_real_recovery(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary).resolve()
            stage, current = self.fixture(root)
            expected = {name: COMPACT.file_digest(stage / name)
                        for name in ['files/index.html', 'dist/chunk.js', 'frontend.tar.gz', 'rollback.sh']}
            self.run_compact(root, stage, current)
            self.assertFalse((stage / 'files').exists())
            self.assertFalse((stage / 'dist').exists())
            record = json.loads((stage / 'staging-compaction.json').read_text())
            self.assertEqual(record['phase'], 'compacted')
            self.assertEqual(record['filesVerified'], 2)
            self.assertEqual(COMPACT.file_digest(stage / 'frontend.tar.gz'), expected['frontend.tar.gz'])
            self.assertEqual(COMPACT.file_digest(stage / 'rollback.sh'), expected['rollback.sh'])
            subprocess.run(['sh', str(stage / 'restore-staging.sh')], check=True, stdout=subprocess.PIPE)
            for name, checksum in expected.items():
                self.assertEqual(COMPACT.file_digest(stage / name), checksum)

    def test_mismatches_never_delete_candidate(self):
        for fault in ['missing', 'duplicate', 'traversal', 'tar-link', 'changed', 'extra', 'linked']:
            with self.subTest(fault=fault), tempfile.TemporaryDirectory() as temporary:
                root = pathlib.Path(temporary).resolve()
                stage, current = self.fixture(root, fault)
                with self.assertRaises((ValueError, RuntimeError)):
                    self.run_compact(root, stage, current)
                self.assertTrue((stage / 'files/index.html').is_file())
                self.assertTrue((stage / 'dist/chunk.js').is_file())
                self.assertFalse((stage / 'restore-staging.sh').exists())

    def test_reading_an_old_package_does_not_count_as_a_content_change(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary).resolve()
            stage, current = self.fixture(root)
            package = stage / 'frontend.tar.gz'
            stat = package.stat()
            os.utime(package, ns=(1, stat.st_mtime_ns))
            self.run_compact(root, stage, current)
            self.assertEqual(json.loads((stage / 'staging-compaction.json').read_text())['phase'], 'compacted')
            self.assertTrue(package.is_file())

    def test_current_release_is_protected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary).resolve()
            stage, current = self.fixture(root)
            with patch.object(COMPACT, 'STAGING_BASE', root), self.assertRaises(ValueError):
                COMPACT.compact(str(stage), str(stage))
            self.assertTrue((stage / 'files/index.html').is_file())

    def test_production_change_preserves_candidate(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary).resolve()
            stage, current = self.fixture(root)
            with self.assertRaises(RuntimeError):
                self.run_compact(root, stage, current, production_changed=True)
            self.assertTrue((stage / 'files/index.html').is_file())
            self.assertFalse((stage / 'restore-staging.sh').exists())

    def test_incomplete_release_is_protected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary).resolve()
            stage, current = self.fixture(root)
            (stage / 'phase.json').write_text(json.dumps(dict(phase='copying')))
            with self.assertRaises(ValueError):
                self.run_compact(root, stage, current)
            self.assertTrue((stage / 'files/index.html').is_file())

    def test_reviewed_metadata_keeps_both_versions_and_recovers_real_payload(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary).resolve()
            stage, current = self.fixture(root)
            archive_sha = COMPACT.file_digest(stage / 'frontend.tar.gz')
            original_script = (stage / 'deploy.py').read_bytes()
            corrected_script = b'# later correction used by the original release\n'
            (stage / 'deploy.py').write_bytes(corrected_script)
            with self.assertRaisesRegex(ValueError, 'Archive metadata mismatch'):
                self.run_compact(root, stage, current)
            failed_record = (stage / 'staging-compaction.json').read_bytes()
            self.run_compact(root, stage, current, reviewed_sha=COMPACT.file_digest(stage / 'deploy.py'))
            record = json.loads((stage / 'staging-compaction.json').read_text())
            self.assertEqual(record['phase'], 'compacted')
            self.assertEqual(record['metadataRecovery']['filesRecovered'], 2)
            self.assertEqual((stage / record['previousVerification']).read_bytes(), failed_record)
            self.assertEqual((stage / 'deploy.py').read_bytes(), corrected_script)
            self.assertEqual((stage / 'recovery-metadata/deploy.py').read_bytes(), corrected_script)
            with tarfile.open(stage / 'frontend.tar.gz') as package:
                self.assertEqual(package.extractfile('deploy.py').read(), original_script)
            self.assertEqual(COMPACT.file_digest(stage / 'frontend.tar.gz'), archive_sha)
            self.assertFalse((stage / 'files').exists())
            subprocess.run(['sh', str(stage / 'restore-staging.sh')], check=True, stdout=subprocess.PIPE)
            self.assertEqual((stage / 'files/index.html').read_text(), 'revision=' + 'a' * 40)
            self.assertEqual((stage / 'dist/chunk.js').read_text(), 'candidate javascript')
            self.assertEqual((stage / 'deploy.py').read_bytes(), corrected_script)

    def test_reviewed_metadata_hash_must_match(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary).resolve()
            stage, current = self.fixture(root)
            with self.assertRaisesRegex(ValueError, 'reviewed SHA256'):
                self.run_compact(root, stage, current, reviewed_sha='0' * 64)
            self.assertTrue((stage / 'files/index.html').is_file())
            self.assertFalse((stage / 'restore-staging.sh').exists())

    def test_reviewed_script_never_allows_other_archive_or_candidate_drift(self):
        for fault in ['changed', 'extra', 'duplicate', 'traversal', 'tar-link', 'metadata']:
            with self.subTest(fault=fault), tempfile.TemporaryDirectory() as temporary:
                root = pathlib.Path(temporary).resolve()
                stage, current = self.fixture(root, fault)
                if fault == 'metadata':
                    artifact = json.loads((stage / 'artifact.json').read_text())
                    artifact['unreviewed'] = True
                    (stage / 'artifact.json').write_text(json.dumps(artifact))
                (stage / 'deploy.py').write_text('# reviewed correction\n')
                with self.assertRaises((ValueError, RuntimeError)):
                    self.run_compact(root, stage, current, reviewed_sha=COMPACT.file_digest(stage / 'deploy.py'))
                self.assertTrue((stage / 'files/index.html').is_file())
                self.assertTrue((stage / 'dist/chunk.js').is_file())

    def test_production_change_after_real_recovery_preserves_original_trees(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary).resolve()
            stage, current = self.fixture(root)
            (stage / 'deploy.py').write_text('# reviewed correction\n')
            with self.assertRaisesRegex(RuntimeError, 'Production changed'):
                self.run_compact(root, stage, current, reviewed_sha=COMPACT.file_digest(stage / 'deploy.py'),
                                 changed_after_recovery=True)
            self.assertTrue((stage / 'files/index.html').is_file())
            self.assertTrue((stage / 'dist/chunk.js').is_file())

    def test_recovery_never_overwrites_metadata_changed_after_compaction(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary).resolve()
            stage, current = self.fixture(root)
            (stage / 'deploy.py').write_text('# reviewed correction\n')
            self.run_compact(root, stage, current, reviewed_sha=COMPACT.file_digest(stage / 'deploy.py'))
            (stage / 'deploy.py').write_text('# later operator edit\n')
            result = subprocess.run(['sh', str(stage / 'restore-staging.sh')], stdout=subprocess.PIPE)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((stage / 'files').exists())
            self.assertEqual((stage / 'deploy.py').read_text(), '# later operator edit\n')

    def test_manifest_ancestor_directories_and_real_recovery(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary).resolve()
            stage, current = self.fixture(root, 'directories')
            archive_sha = COMPACT.file_digest(stage / 'frontend.tar.gz')
            self.run_compact(root, stage, current, reviewed_sha=COMPACT.file_digest(stage / 'deploy.py'))
            record = json.loads((stage / 'staging-compaction.json').read_text())
            self.assertEqual(record['phase'], 'compacted')
            self.assertEqual(record['metadataRecovery']['filesRecovered'], 2)
            self.assertFalse((stage / 'files').exists())
            self.assertEqual(COMPACT.file_digest(stage / 'frontend.tar.gz'), archive_sha)
            subprocess.run(['sh', str(stage / 'restore-staging.sh')], check=True, stdout=subprocess.PIPE)
            self.assertEqual((stage / 'files/index.html').read_text(), 'revision=' + 'a' * 40)
            self.assertEqual((stage / 'dist/chunk.js').read_text(), 'candidate javascript')

    def test_duplicate_or_unlisted_directories_preserve_original_trees(self):
        for fault in ['duplicate-directory', 'unlisted-directory']:
            with self.subTest(fault=fault), tempfile.TemporaryDirectory() as temporary:
                root = pathlib.Path(temporary).resolve()
                stage, current = self.fixture(root, fault)
                with self.assertRaises(ValueError):
                    self.run_compact(root, stage, current, reviewed_sha=COMPACT.file_digest(stage / 'deploy.py'))
                self.assertTrue((stage / 'files/index.html').is_file())
                self.assertTrue((stage / 'dist/chunk.js').is_file())
                self.assertFalse((stage / 'restore-staging.sh').exists())


if __name__ == '__main__':
    unittest.main()
