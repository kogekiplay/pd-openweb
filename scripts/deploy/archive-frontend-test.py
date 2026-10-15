import importlib.util
import json
import pathlib
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('archive', str(pathlib.Path(__file__).with_name('archive-frontend.py')))
ARCHIVE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ARCHIVE)


class ArchiveTests(unittest.TestCase):
    def exercise(self, failure=None):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            release = root / 'release'
            release.mkdir()
            protected = ARCHIVE.BASE + '/www-prev-20261015-' + 'b' * 10
            (release / 'artifact.json').write_text(json.dumps(dict(indexSha256='live')))
            (release / 'deployment-before.json').write_text(json.dumps(dict(rollbackDirectory=protected, previousIndexSha256='previous')))
            (release / 'phase.json').write_text(json.dumps(dict(phase='completed')))
            commands = []
            def digest(path):
                return 'live' if path.startswith(ARCHIVE.DEPLOY.LIVE + '/') else 'previous' if path.startswith(protected + '/') else 'old'
            def command(args, stdin=None):
                commands.append(args)
                if '-dzf' in args and failure == 'compare':
                    raise subprocess.CalledProcessError(1, args)
                return ''
            class Process:
                returncode = 0
                def __init__(self, args, stdout, stderr):
                    stdout.write(b'fixture-complete-archive')
                def poll(self):
                    return 0
            with patch.object(ARCHIVE.DEPLOY, 'services', return_value=['unchanged']), \
                    patch.object(ARCHIVE.DEPLOY, 'digest', side_effect=digest), \
                    patch.object(ARCHIVE.DEPLOY, 'command', side_effect=command), \
                    patch.object(ARCHIVE, 'inventory', side_effect=[('tree', 17), ('changed' if failure == 'inventory' else 'tree', 17)]), \
                    patch.object(ARCHIVE.subprocess, 'Popen', Process), \
                    patch.object(ARCHIVE.shutil, 'disk_usage') as disk:
                disk.return_value.free = 3 * 1024 ** 3 if failure == 'space' else 10 * 1024 ** 3
                name = 'www-prev-20261014-' + 'a' * 10
                destination = root / 'archives'
                if failure:
                    with self.assertRaises((RuntimeError, subprocess.CalledProcessError)):
                        ARCHIVE.archive(name, destination, release)
                else:
                    ARCHIVE.archive(name, destination, release)
                    data = json.loads((destination / (name + '.json')).read_text())
                    self.assertEqual(data['phase'], 'archived')
                    self.assertEqual(ARCHIVE.sha256(destination / (name + '.tar.gz')), data['archiveSha256'])
                    self.assertTrue(pathlib.Path(data['restore']).is_file())
                removals = [args for args in commands if 'rm' in args]
                self.assertEqual(len(removals), 0 if failure else 1)
                with self.assertRaises(ValueError):
                    ARCHIVE.archive(protected.split('/')[-1], destination, release)
                with self.assertRaises(ValueError):
                    ARCHIVE.archive('www', destination, release)
    def test_verified_archive(self):
        self.exercise()
    def test_failed_compare_preserves_source(self):
        self.exercise('compare')
    def test_changed_source_preserves_source(self):
        self.exercise('inventory')
    def test_low_space_preserves_source(self):
        self.exercise('space')


if __name__ == '__main__':
    unittest.main()
