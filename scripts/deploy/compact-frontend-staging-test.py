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

    def run_compact(self, root, stage, current, production_changed=False):
        def digest(name):
            return 'live' if name == COMPACT.DEPLOY.LIVE + '/index.html' else 'rollback'
        state = ['unchanged', 'changed'] if production_changed else ['unchanged', 'unchanged']
        with patch.object(COMPACT, 'STAGING_BASE', root), \
                patch.object(COMPACT.DEPLOY, 'services', side_effect=state), \
                patch.object(COMPACT.DEPLOY, 'digest', side_effect=digest), \
                contextlib.redirect_stdout(io.StringIO()):
            COMPACT.compact(str(stage), str(current))

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


if __name__ == '__main__':
    unittest.main()
