const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
interface Exports {
  [name: string]: unknown;
}
function load(file: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}): Exports {
  const moduleLike: { exports: Exports } = { exports: {} };
  new Function('module', 'exports', 'require', ...Object.keys(globals), transformFileSync(file).code)(
    moduleLike,
    moduleLike.exports,
    (name: string) => {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error('Unstubbed browser helper dependency ' + name);
    },
    ...Object.values(globals),
  );
  return moduleLike.exports;
}
const lodash = require('lodash');
const validator = load(path.join(__dirname, 'expression.ts'), { lodash }).default;
const cover = load(
  path.join(__dirname, 'view.ts'),
  {
    lodash,
    'src/utils/expression': { __esModule: true, default: validator },
  },
  {
    safeParse: (value: unknown) => {
      if (typeof value !== 'string') return value;
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    },
  },
).getCoverUrl as (
  id: string | undefined,
  row: Record<string, unknown>,
  controls: { controlId?: string }[],
) => string | undefined;
const controls = [{ controlId: 'cover' }];
assert.equal(
  cover(
    'cover',
    { cover: '[{"ext":".txt","previewUrl":"text"},{"ext":".jpg","previewUrl":"https://file?token=x"}]' },
    controls,
  ),
  'https://file?token=x&imageView2/1/w/200/h/140',
);
assert.equal(
  cover('cover', { cover: [{ ext: '.png', previewUrl: 'https://file?imageView2/2/w/500/h/400/q/90' }] }, controls),
  'https://file?imageView2/1/w/200/h/140',
);
assert.equal(
  cover('cover', { cover: { first: { ext: '.WEBP', previewUrl: 'https://file?x' } } }, controls),
  'https://file?x&imageView2/1/w/200/h/140',
  'Legacy file maps remain readable',
);
assert.equal(
  cover(
    'cover',
    {
      cover: [
        { ext: '.png', previewUrl: 42 },
        { ext: '.png', previewUrl: 'later' },
      ],
    },
    controls,
  ),
  undefined,
  'The first image still determines the cover',
);
assert.equal(cover('cover', { cover: '[null,42,{"ext":5}]' }, controls), undefined);
assert.equal(cover('cover', { cover: '{bad' }, controls), undefined);
assert.equal(cover(undefined, {}, controls), undefined);
assert.equal(cover('other', {}, controls), undefined);

interface Utterance {
  text: string;
  voice?: unknown;
  lang?: string;
  rate?: number;
  onend?: () => void;
}
interface Speech {
  voice: unknown;
  queue: unknown[];
  speaking: boolean;
  speak(text: string, options?: { rate?: number; onEnd?: () => void }): void;
  speakStream(text: string, options?: { rate?: number; onEnd?: () => void }): void;
  finishStream(): void;
  clear(): void;
  mergeAndSpeakQueue(): void;
}
const spoken: Utterance[] = [];
let cancelCalls = 0;
let voices: unknown[] = [];
const synth: {
  getVoices: () => unknown[];
  speak: (utterance: Utterance) => void;
  cancel: () => void;
  onvoiceschanged?: () => void;
} = {
  getVoices: () => voices,
  speak: utterance => spoken.push(utterance),
  cancel: () => {
    cancelCalls++;
  },
};
class FakeUtterance implements Utterance {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}
const timers = new Map<number, () => void>();
let nextTimer = 0;
const audio = load(
  path.join(__dirname, 'audio.ts'),
  {},
  {
    window: { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance },
    setTimeout: (callback: () => void) => {
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout: (id: number) => timers.delete(id),
  },
);
const create = audio.SpeechSynthesizer as new (options?: { bufferDelay?: number }) => Speech;
const speech = new create({ bufferDelay: 10 });
synth.onvoiceschanged?.();
assert.equal(speech.voice, null, 'An empty voice list uses the browser default voice');
voices = [{ lang: 'en-US' }, { lang: 'zh-CN' }];
synth.onvoiceschanged?.();
assert.equal(speech.voice, voices[1]);
speech.speakStream('first', { rate: 2 });
speech.speakStream('second');
speech.speakStream('third');
speech.speakStream('fourth');
assert.equal(spoken.length, 1, 'Streaming does not overlap the active utterance');
assert.equal(spoken[0].text, 'first');
assert.equal(spoken[0].rate, 2);
spoken[0].onend?.();
for (const [id, callback] of [...timers]) {
  timers.delete(id);
  callback();
}
assert.equal(spoken[1].text, 'secondthirdfourth', 'Queued text merges at most three chunks in their original order');
speech.speakStream('pending');
speech.clear();
assert.deepEqual(speech.queue, []);
assert.equal(speech.speaking, false);
assert.ok(cancelCalls > 0);
let ended = 0;
speech.speak('whole paragraph', {
  onEnd: () => {
    ended++;
  },
});
spoken.at(-1)?.onend?.();
assert.equal(ended, 1, 'The public completion callback still fires once');
speech.mergeAndSpeakQueue();
speech.finishStream();
assert.equal(spoken.at(-1)?.text, 'whole paragraph');
console.log('Real cover decoding and browser speech queue, voices, completion and cancellation passed');
