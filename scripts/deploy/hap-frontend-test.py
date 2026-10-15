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


class PublishTests(unittest.TestCase):
    def exercise(self, old='a' * 64, change_during_prepare=False, page_failure=False):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / 'files').mkdir()
            (root / 'dist').mkdir()
            revision = 'c' * 40
            index = revision.encode()
            expected = hashlib.sha256(index).hexdigest()
            (root / 'files/index.html').write_bytes(index)
            (root / 'artifact.json').write_text(json.dumps(dict(revision=revision, indexSha256=expected, files=1)))
            (root / 'candidate-sha256.txt').write_text(expected + '  index.html\n')
            state = dict(switched=False, live_reads=0, rollback=False, mounts=0)
            def command(args, stdin=None):
                if args[:2] == ['docker', 'inspect']:
                    state['mounts'] += 1
                    mounts = [dict(Source='one', Destination='/data'), dict(Source='two', Destination='/logs')]
                    if state['mounts'] % 2:
                        mounts.reverse()
                    return json.dumps([dict(State=dict(Running=True), Id=args[2], Mounts=mounts,
                                            Config=dict(Image='fixture'), HostConfig=dict(PortBindings={}))])
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
                    return '1\twww'
                if args[0] == 'sh' and args[1] != '-n':
                    state.update(switched=False, rollback=True)
                if any('if ! mv "$2" "$1"' in part for part in args) and args[0] == 'docker':
                    state['switched'] = True
                return ''
            def pages(rev):
                self.assertEqual(rev, revision)
                if page_failure:
                    raise RuntimeError('Page failed')
                return [dict(path='/', status=200)]
            with patch.object(DEPLOY, 'command', command), patch.object(DEPLOY, 'validate_pages', pages), \
                    patch.object(DEPLOY.shutil, 'disk_usage') as disk:
                disk.return_value.free = 10 * 1024 ** 3
                if change_during_prepare or page_failure:
                    with self.assertRaises(RuntimeError):
                        DEPLOY.deploy(root, '20261015')
                else:
                    DEPLOY.deploy(root, '20261015')
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
                    DEPLOY.deploy(root, '20261015')
                self.assertEqual((root / 'deployment-before.json').read_text(), saved_text)
    def test_different_predecessors(self):
        for old in ['a' * 64, 'b' * 64]:
            self.exercise(old)
    def test_changed_predecessor(self):
        self.exercise(change_during_prepare=True)
    def test_validation_rolls_back(self):
        self.exercise(page_failure=True)


if __name__ == '__main__':
    unittest.main()
