import contextlib
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import shutil
import shlex
import tarfile
import tempfile
import types
import unittest
from unittest import mock

path = pathlib.Path(__file__).with_name('offload-frontend-rollback.py')
spec = importlib.util.spec_from_file_location('offload', str(path))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
NAME = 'www-prev-20261016-63d1f52a0f'


class Backend:
    def __init__(self, root):
        self.root = root
        self.source = root / NAME
        self.source.mkdir()
        (self.source / 'assets').mkdir()
        (self.source / 'index.html').write_text('old frontend')
        (self.source / 'assets/data.bin').write_bytes(b'abc' * 100)
        for item in [*self.source.rglob('*'), self.source]:
            os.utime(str(item), (1700000000, 1700000000))
        self.settings = dict(host='fixture', currentRelease='fixture', port=22, identity='fixture')
        self.compare_failure = self.change_production = self.restore_failure = self.unsafe_export = False
        self.removals = self.compares = 0
        self.records = []

    def snapshot(self):
        entries = [self.source] + sorted(self.source.rglob('*'))
        inventory = [(str(p.relative_to(self.source)), p.is_dir(), p.stat().st_size,
                      p.stat().st_mtime_ns, p.stat().st_mode) for p in entries]
        return dict(source=module.BASE + '/' + NAME, entries=len(entries),
                    inventorySha256=hashlib.sha256(repr(inventory).encode()).hexdigest(),
                    sourceIndexSha256=module.digest(self.source / 'index.html'),
                    logicalBytes=312, physicalBytes=16384, dataFree=10**10,
                    liveIndexSha256='changed' if self.change_production and self.compares else 'live',
                    rollbackIndexSha256='protected', protectedRollback=module.BASE + '/www-prev-20261017-3b0ff2ea0c',
                    services=[{'running': True}], nginxSha256='nginx')

    def export(self, package, progress):
        with tarfile.open(str(package), 'w:gz', format=tarfile.PAX_FORMAT) as archive:
            if self.unsafe_export:
                entry = tarfile.TarInfo('../escape');entry.size = 3
                archive.addfile(entry, io.BytesIO(b'bad'))
            else:
                archive.add(str(self.source), arcname=NAME)
        progress(package.stat().st_size, os.getpid())

    def compare(self, package):
        self.compares += 1
        if self.compare_failure:
            raise RuntimeError('tar comparison failed')
        with tarfile.open(str(package), 'r:gz') as archive:
            for item in archive:
                if item.isfile():
                    assert archive.extractfile(item).read() == (self.root / item.name).read_bytes()
        return {'compared': True}

    def remove(self, before):
        module.stable(before, self.snapshot())
        shutil.rmtree(self.source)
        self.removals += 1
        return {'dataFree': 10**10}

    def restore(self, package, before, file_manifest, count):
        if self.restore_failure:
            raise RuntimeError('injected restore failure')
        with tarfile.open(str(package), 'r:gz') as archive:
            archive.extractall(str(self.root))
        verified = 0
        for line in file_manifest.read_text().splitlines():
            checksum, name = line.split('  ', 1)
            assert module.digest(self.root / name) == checksum
            verified += 1
        assert verified == count
        return {'filesVerified': count}

    def record(self, data):
        self.records.append(json.loads(json.dumps(data)))
        return {'dataFree': 10**10}


class OffloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.backend = Backend(self.root)
        self.destination = self.root / 'client'

    def tearDown(self):
        self.temp.cleanup()

    def run_archive(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return module.offload(NAME, self.destination, self.backend)

    def test_full_archive_restore_compare_and_release(self):
        result = self.run_archive()
        self.assertTrue(result['restorationVerified'])
        self.assertEqual(result['phase'], 'offloaded')
        self.assertEqual(self.backend.removals, 2)
        self.assertEqual(self.backend.compares, 2)
        self.assertFalse(self.backend.source.exists())
        self.assertEqual(result['entries'], 4)
        self.assertEqual(result['filesWithDigests'], 2)
        self.assertEqual(module.digest(self.destination / result['archive']), result['archiveSha256'])
        self.assertTrue(pathlib.Path(result['restore']).exists())

    def test_compare_failure_preserves_original(self):
        self.backend.compare_failure = True
        with self.assertRaisesRegex(RuntimeError, 'comparison'):
            self.run_archive()
        self.assertTrue(self.backend.source.exists())
        self.assertEqual(self.backend.removals, 0)

    def test_production_change_preserves_original(self):
        self.backend.change_production = True
        with self.assertRaisesRegex(RuntimeError, 'Source or production changed'):
            self.run_archive()
        self.assertTrue(self.backend.source.exists())
        self.assertEqual(self.backend.removals, 0)

    def test_current_quick_rollback_rejected(self):
        snapshot = self.backend.snapshot
        def protected():
            value = snapshot();value['protectedRollback'] = value['source'];return value
        self.backend.snapshot = protected
        with self.assertRaisesRegex(ValueError, 'quick rollback'):
            self.run_archive()
        self.assertTrue(self.backend.source.exists())

    def test_client_reserve_preserves_original(self):
        with mock.patch.object(module.shutil, 'disk_usage', return_value=types.SimpleNamespace(free=module.RESERVE)):
            with self.assertRaisesRegex(RuntimeError, 'client space'):
                self.run_archive()
        self.assertTrue(self.backend.source.exists())

    def test_unsafe_member_preserves_original(self):
        self.backend.unsafe_export = True
        with self.assertRaisesRegex(RuntimeError, 'Unsafe archive member'):
            self.run_archive()
        self.assertTrue(self.backend.source.exists())
        self.assertEqual(self.backend.removals, 0)

    def test_restore_failure_keeps_complete_recovery_material(self):
        self.backend.restore_failure = True
        with self.assertRaisesRegex(RuntimeError, 'restore failure'):
            self.run_archive()
        self.assertEqual(self.backend.removals, 1)
        receipt = json.loads((self.destination / (NAME + '.json')).read_text())
        self.assertEqual(receipt['phase'], 'verifying-full-restoration')
        self.assertEqual(module.digest(self.destination / receipt['archive']), receipt['archiveSha256'])
        self.assertTrue(pathlib.Path(receipt['restore']).exists())
        self.backend.restore_failure = False
        self.backend.restore(self.destination / receipt['archive'], receipt['before'],
                             self.destination / receipt['fileManifest'], receipt['filesWithDigests'])
        self.assertTrue(self.backend.source.exists())
        self.assertEqual(self.backend.snapshot()['sourceIndexSha256'], receipt['before']['sourceIndexSha256'])

    def test_archive_must_not_be_restarted_over_existing_receipt(self):
        self.run_archive()
        with self.assertRaises(FileExistsError):
            self.run_archive()

    def test_ssh_code_quotes_context_as_data(self):
        settings = dict(self.backend.settings, identity="key'$(touch should-not-exist)`x`\npath")
        remote = module.SSHBackend(settings, NAME, io.StringIO())
        remote.holder = types.SimpleNamespace(poll=lambda: None)
        remote.pid = 123
        command = shlex.split(remote.command('snapshot')[-1])
        self.assertEqual(command[:2], ['python3', '-c'])
        prefix = command[2].split(module.REMOTE_CODE)[0]
        scope = {}
        exec(prefix, scope)
        self.assertEqual(scope['config']['identity'], settings['identity'])
        self.assertEqual(scope['config']['name'], NAME)

    def test_option_like_ssh_target_is_rejected(self):
        with self.assertRaises(ValueError):
            module.SSHBackend(dict(self.backend.settings, host='-oProxyCommand=bad'), NAME, io.StringIO())

    def test_modified_recovery_manifest_preserves_restored_source(self):
        restore = self.backend.restore
        def tamper(package, before, file_manifest, count):
            result = restore(package, before, file_manifest, count)
            file_manifest.write_text('changed')
            return result
        self.backend.restore = tamper
        with self.assertRaisesRegex(RuntimeError, 'Recovery material changed'):
            self.run_archive()
        self.assertTrue(self.backend.source.exists())
        self.assertEqual(self.backend.removals, 1)

    def test_invalid_name_cannot_be_used_as_path(self):
        with self.assertRaises(ValueError):
            module.offload('../www', self.destination, self.backend)
        self.assertTrue(self.backend.source.exists())


if __name__ == '__main__':
    unittest.main()
