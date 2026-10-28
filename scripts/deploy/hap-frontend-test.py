"""Exercise predecessor capture, concurrent-change rejection and automatic rollback without Docker or network."""
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('hap_frontend', pathlib.Path(__file__).with_name('hap-frontend.py'))
DEPLOY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DEPLOY)

REVISION = 'c' * 40
PREVIOUS = 'b' * 40


class PublishTests(unittest.TestCase):
    def exercise(self, old='a' * 64, change_during_prepare=False, page_failure=False, attempt_id=None,
                 predecessor_marker=None):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / 'files').mkdir()
            (root / 'dist').mkdir()
            index = REVISION.encode()
            expected = hashlib.sha256(index).hexdigest()
            (root / 'files/index.html').write_bytes(index)
            (root / 'artifact.json').write_text(json.dumps(dict(revision=REVISION, indexSha256=expected, files=1)))
            (root / 'candidate-sha256.txt').write_text(expected + '  index.html' + chr(10))
            pages_calls = []
            state = dict(switched=False, live_reads=0, rollback=False, mounts=0, calls=[])

            def command(args, stdin=None):
                state['calls'].append([str(part) for part in args])
                if args[:2] == ['docker', 'inspect']:
                    state['mounts'] += 1
                    mounts = [dict(Source='one', Destination='/data'), dict(Source='two', Destination='/logs')]
                    if state['mounts'] % 2:
                        mounts.reverse()
                    return json.dumps([dict(
                        Id=args[2], RestartCount=0, Mounts=mounts,
                        State=dict(Running=True, StartedAt='started-at'),
                        Config=dict(Image='fixture'), HostConfig=dict(PortBindings={}))])
                if any('head -c' in str(part) for part in args):
                    return predecessor_marker or ''
                if 'sha256sum' in args and args[-1].endswith('index.html'):
                    filename = args[-1]
                    if filename == DEPLOY.LIVE + '/index.html':
                        state['live_reads'] += 1
                        value = expected if state['switched'] else old
                        if change_during_prepare and state['live_reads'] > 1:
                            value = 'changed'
                    elif '/www-next-' in filename:
                        value = expected
                    else:
                        value = old
                    return value + '  ' + filename
                if 'du' in args:
                    return '1' + chr(9) + 'www'
                if args[0] == 'sh' and args[1] != '-n':
                    state.update(switched=False, rollback=True)
                if any('if ! mv "$2" "$1"' in part for part in args) and args[0] == 'docker':
                    state['switched'] = True
                return ''

            def pages(rev):
                pages_calls.append(rev)
                if page_failure and rev == REVISION:
                    raise RuntimeError('Page failed')
                return [dict(path='/', status=200)]

            with patch.object(DEPLOY, 'command', command), patch.object(DEPLOY, 'validate_pages', pages), \
                    patch.object(DEPLOY.shutil, 'disk_usage') as disk:
                disk.return_value.free = 10 * 1024 ** 3
                if change_during_prepare or page_failure:
                    with self.assertRaises(RuntimeError):
                        DEPLOY.deploy(root, '20261015', attempt_id)
                else:
                    DEPLOY.deploy(root, '20261015', attempt_id)
                saved = json.loads((root / 'deployment-before.json').read_text())
                self.assertEqual(saved['previousIndexSha256'], old)
                if change_during_prepare:
                    self.assertFalse(state['switched'])
                if page_failure:
                    self.assertTrue(state['rollback'])
                    self.assertFalse(state['switched'])
                    self.assertEqual(json.loads((root / 'phase.json').read_text())['phase'], 'rolled-back-after-validation-failure')
                if not (change_during_prepare or page_failure):
                    self.assertEqual(json.loads((root / 'phase.json').read_text())['phase'], 'completed')
                saved_text = (root / 'deployment-before.json').read_text()
                with self.assertRaises((FileExistsError, RuntimeError)):
                    DEPLOY.deploy(root, '20261015', attempt_id)
                self.assertEqual((root / 'deployment-before.json').read_text(), saved_text)
                # Read the rollback record while the temp directory still exists; returning the
                # path would only fail later, after the context manager has removed it.
                rollback_path = root / 'http-rollback.json'
                rollback_record = json.loads(rollback_path.read_text()) if rollback_path.is_file() else None
            return state, pages_calls, rollback_record

    def test_different_predecessors(self):
        for old in ['a' * 64, 'b' * 64]:
            self.exercise(old)

    def test_changed_predecessor(self):
        self.exercise(change_during_prepare=True)

    def test_validation_rolls_back(self):
        self.exercise(page_failure=True)

    def test_rollback_revalidates_the_predecessor_revision(self):
        marker = '<html>' + PREVIOUS + '</html>'
        _state, pages_calls, _record = self.exercise(page_failure=True, predecessor_marker=marker)
        self.assertEqual(pages_calls, [REVISION, PREVIOUS])

    def test_rollback_without_marker_records_it_as_not_validated(self):
        _state, pages_calls, record = self.exercise(page_failure=True)
        self.assertEqual(pages_calls, [REVISION])
        self.assertIsNotNone(record, 'rollback must record a result even when the page check is skipped')
        self.assertFalse(record['validated'])
        self.assertIsNone(record['revision'])

    def test_attempt_id_reaches_the_directory_names(self):
        state, _pages, _record = self.exercise(attempt_id='a1')
        joined = ' '.join(' '.join(call) for call in state['calls'])
        self.assertIn('/www-next-' + REVISION[:10] + '-20261015-a1', joined)
        self.assertIn('/www-prev-20261015-' + REVISION[:10] + '-a1', joined)
        self.assertIn('/www-failed-' + REVISION[:10] + '-a1', joined)

    def test_api_rejects_an_unsafe_attempt_id(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            with self.assertRaises(ValueError):
                DEPLOY.deploy(root, '20261015', '../escape')
        with self.assertRaises(ValueError):
            DEPLOY.attempt_directories(REVISION, '20261015', 'a/b')


class AttemptDirectoryTests(unittest.TestCase):
    def test_default_names_are_unchanged(self):
        next_dir, previous, failed = DEPLOY.attempt_directories(REVISION, '20261015')
        self.assertEqual(next_dir, DEPLOY.BASE + '/www-next-' + REVISION[:10] + '-20261015')
        self.assertEqual(previous, DEPLOY.BASE + '/www-prev-20261015-' + REVISION[:10])
        self.assertEqual(failed, DEPLOY.BASE + '/www-failed-' + REVISION[:10])

    def test_attempt_id_makes_every_name_unique(self):
        first = DEPLOY.attempt_directories(REVISION, '20261015', 'a1')
        second = DEPLOY.attempt_directories(REVISION, '20261015', 'a2')
        for left, right in zip(first, second):
            self.assertNotEqual(left, right)
            self.assertTrue(left.endswith('-a1') and right.endswith('-a2'))


class PayloadVerificationTests(unittest.TestCase):
    """Local payload checks must reject before any remote command runs."""

    def build(self, payload=None, artifact_files=1, entries=None):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = pathlib.Path(directory.name)
        index = REVISION.encode()
        expected = hashlib.sha256(index).hexdigest()
        payload = {'files/index.html': index} if payload is None else payload
        for relative, data in payload.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        (root / 'dist').mkdir(parents=True, exist_ok=True)
        (root / 'artifact.json').write_text(json.dumps(dict(revision=REVISION, indexSha256=expected,
                                                            files=artifact_files)))
        lines = [expected + '  index.html'] if entries is None else entries
        (root / 'candidate-sha256.txt').write_text(chr(10).join(lines) + chr(10))
        return root, expected

    def rewrite_manifest(self, root, lines):
        (root / 'candidate-sha256.txt').write_text(chr(10).join(lines) + chr(10))

    def forbidden(self):
        def command(args, stdin=None):
            raise AssertionError('remote command ran before local verification: %r' % (args,))
        return command

    def test_manifest_entry_without_payload_file_is_rejected(self):
        root, _expected = self.build()
        self.rewrite_manifest(root, ['a' * 64 + '  dist/missing.js'])
        with patch.object(DEPLOY, 'command', self.forbidden()):
            with self.assertRaises(RuntimeError):
                DEPLOY.deploy(root, '20261015')

    def test_manifest_count_must_match_the_artifact(self):
        root, _expected = self.build(artifact_files=2)
        with patch.object(DEPLOY, 'command', self.forbidden()):
            with self.assertRaises(ValueError):
                DEPLOY.deploy(root, '20261015')

    def test_duplicate_raw_entry_is_rejected(self):
        root, expected = self.build()
        self.rewrite_manifest(root, [expected + '  index.html', expected + '  index.html'])
        with patch.object(DEPLOY, 'command', self.forbidden()):
            with self.assertRaises(ValueError):
                DEPLOY.deploy(root, '20261015')

    def test_two_spellings_of_one_file_are_rejected(self):
        # files/index.html and index.html land on the same staging file, so a two-entry manifest
        # must not be able to satisfy artifact[files] with a single payload file.
        root, expected = self.build(artifact_files=2)
        self.rewrite_manifest(root, [expected + '  files/index.html', expected + '  index.html'])
        with patch.object(DEPLOY, 'command', self.forbidden()):
            with self.assertRaises(ValueError):
                DEPLOY.deploy(root, '20261015')

    def test_traversal_entry_is_rejected(self):
        root, _expected = self.build()
        self.rewrite_manifest(root, ['a' * 64 + '  ../escape.js'])
        with patch.object(DEPLOY, 'command', self.forbidden()):
            with self.assertRaises(ValueError):
                DEPLOY.deploy(root, '20261015')

    def test_development_asset_is_rejected(self):
        payload = {'files/index.html': REVISION.encode(), 'dist/app.dev.js': b'x'}
        root, expected = self.build(payload=payload, artifact_files=2)
        dev = hashlib.sha256(b'x').hexdigest()
        self.rewrite_manifest(root, [expected + '  index.html', dev + '  dist/app.dev.js'])
        with patch.object(DEPLOY, 'command', self.forbidden()):
            with self.assertRaises(RuntimeError):
                DEPLOY.deploy(root, '20261015')

    def test_payload_file_outside_the_manifest_is_rejected(self):
        payload = {'files/index.html': REVISION.encode(), 'files/extra.js': b'y'}
        root, _expected = self.build(payload=payload)
        with patch.object(DEPLOY, 'command', self.forbidden()):
            with self.assertRaises(RuntimeError):
                DEPLOY.deploy(root, '20261015')

    def test_archive_layout_manifest_maps_to_the_flattened_remote_path(self):
        payload = {'files/index.html': REVISION.encode(), 'dist/app.js': b'z'}
        root, expected = self.build(payload=payload, artifact_files=2)
        app = hashlib.sha256(b'z').hexdigest()
        self.rewrite_manifest(root, [expected + '  files/index.html', app + '  dist/app.js'])
        verified = DEPLOY.verify_payload(root, json.loads((root / 'artifact.json').read_text()))
        self.assertEqual(verified, [(expected, 'index.html'), (app, 'dist/app.js')])


class ServicesTests(unittest.TestCase):
    """The snapshot must carry restart/started/health and reject an unhealthy service."""

    def fake(self, restart_count=0, health=None):
        state = dict(Running=True, StartedAt='t0')
        if health is not None:
            state['Health'] = dict(Status=health)

        def command(args, stdin=None):
            return json.dumps([dict(Id=args[2], RestartCount=restart_count, State=state,
                                    Config=dict(Image='fixture'), HostConfig=dict(PortBindings={}), Mounts=[])])
        return command

    def test_snapshot_carries_restart_started_and_health(self):
        with patch.object(DEPLOY, 'command', self.fake(restart_count=3, health='healthy')):
            snapshot = DEPLOY.services()
        self.assertEqual(len(snapshot), 5)
        for entry in snapshot:
            self.assertEqual(entry['restartCount'], 3)
            self.assertEqual(entry['startedAt'], 't0')
            self.assertEqual(entry['health'], 'healthy')

    def test_unhealthy_service_is_rejected(self):
        with patch.object(DEPLOY, 'command', self.fake(health='unhealthy')):
            with self.assertRaises(RuntimeError):
                DEPLOY.services()

    def test_service_without_healthcheck_is_accepted(self):
        with patch.object(DEPLOY, 'command', self.fake()):
            snapshot = DEPLOY.services()
        self.assertIsNone(snapshot[0]['health'])


if __name__ == '__main__':
    unittest.main()
