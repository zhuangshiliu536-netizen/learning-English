import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SPEECH_LINES as BASE_SPEECH_LINES } from '../../outputs/first-day-demo/content.js';
import { EXTRA_SPEECH_LINES } from '../../outputs/first-day-demo/curriculum.js';

// Executes the delivered functions verbatim with controllable audio events.
// No browser, app source modification, network request, or real audio output.
const appPath = fileURLToPath(new URL('../../outputs/first-day-demo/app.js', import.meta.url));
const source = fs.readFileSync(appPath, 'utf8');
const functions = source.slice(source.indexOf('function stopSound()'), source.indexOf('function openVoiceSettings()'));
const manifestLoader = source.slice(source.indexOf('const neuralAudioReady = fetch('), source.indexOf('let feedback='));
const cancelListener = source.split('\n').find(line => line.startsWith("dialog.addEventListener('cancel'"));
const unitVoiceDeclaration = source.split('\n').find(line => line.startsWith('const unitVoice = '));
assert.ok(unitVoiceDeclaration, 'The harness must execute the delivered unitVoice mapping');
const speechLines = {...BASE_SPEECH_LINES,...EXTRA_SPEECH_LINES,zh:{text:'你好，我是米洛。',lang:'zh-CN'},en:{text:'Hello.',lang:'en-US'}};
const tick = () => new Promise(resolve => setImmediate(resolve));
const defaultManifest = { audio: [{ key: 'zh', lang: 'zh-CN', path: 'assets/audio-neural/zh.mp3' }] };

function harness({manifest = defaultManifest, manifestPromise = null, manifestFailure = false} = {}) {
  const audios = [], utterances = [], statuses = [], listeners = new Map();
  const context = { Map, Promise, encodeURIComponent, console };
  context.fetch = async () => {
    if (manifestFailure) throw new Error('404 voice pack');
    if (manifestPromise) return manifestPromise;
    return { ok: true, json: async () => manifest };
  };
  context.Audio = class {
    constructor(url) { this.url = url; this.paused = false; audios.push(this); }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
  };
  context.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  context.speechSynthesis = { getVoices: () => [], speak: u => utterances.push(u), cancel: () => {} };
  context.window = { speechSynthesis: context.speechSynthesis };
  context.document = { querySelector: () => ({ set textContent(value) { statuses.push(value); } }) };
  context.dialog = { addEventListener: (name, handler) => listeners.set(name, handler) };
  vm.createContext(context);
  vm.runInContext(`
    let audioToken=0,currentAudio=null,currentSpeech=null,cancelAudioResolve=null;
    const state={activeUnitId:'picnic',settings:{sound:true,guideVoice:'neural'},reader:{audioPlayed:[],audioEnded:[]}};
    const SPEECH_LINES=${JSON.stringify(speechLines)};
    ${unitVoiceDeclaration}
    function save(){}
    ${manifestLoader}
    ${functions}
    ${cancelListener || ''}
    this.api={say,stopSound,speechFallback,
      inspect:()=>({token:audioToken,hasCancel:!!cancelAudioResolve,activeAudio:!!currentAudio,activeSpeech:!!currentSpeech}),
      mute:()=>{state.settings.sound=false;},
      setUnit:id=>{state.activeUnitId=id;},
      mappedKey:key=>unitVoice(key),
      startDirectSpeech:()=>speechFallback('fallback','zh-CN',audioToken)};
  `, context, {filename: appPath});
  return { ...context.api, audios, utterances, statuses, listeners };
}

test('stale fallback events cannot clear the new local audio cancellation callback', async () => {
  const h = harness();
  const first = h.startDirectSpeech();
  const stale = h.utterances[0];
  const oldError = stale.onerror, oldEnd = stale.onend, oldStart = stale.onstart;
  const second = h.say('en');
  await tick();
  assert.equal(await first, false);
  assert.equal(h.inspect().hasCancel, true);
  const statusCount = h.statuses.length;
  oldError(); oldEnd(); oldStart();
  assert.equal(h.inspect().hasCancel, true);
  assert.equal(h.statuses.length, statusCount);
  h.stopSound();
  assert.equal(await second, false);
  assert.equal(h.audios[0].paused, true);
  assert.equal(h.inspect().activeAudio, false);
  assert.equal(h.inspect().hasCancel, false);
  assert.equal(h.utterances.length, 1);
});

test('neural error falls back to the original WAV and succeeds', async () => {
  const h = harness();
  const played = h.say('zh');
  await tick();
  assert.match(h.audios[0].url, /assets\/audio-neural\/zh\.mp3/);
  h.audios[0].onerror();
  await tick();
  assert.match(h.audios[1].url, /assets\/audio\/zh\.wav/);
  h.audios[1].onended();
  assert.equal(await played, true);
  assert.equal(h.utterances.length, 0);
});

test('neural and WAV errors fall back to browser speech and settle', async () => {
  const h = harness();
  const played = h.say('zh');
  await tick(); h.audios[0].onerror();
  await tick(); h.audios[1].onerror();
  await tick();
  assert.equal(h.utterances.length, 1);
  assert.equal(h.utterances[0].lang, 'zh-CN');
  h.utterances[0].onend();
  assert.equal(await played, true);
  assert.equal(h.inspect().hasCancel, false);
  assert.equal(h.inspect().activeSpeech, false);
});

test('interrupting neural playback settles false and never triggers fallback', async () => {
  const h = harness();
  const played = h.say('zh');
  await tick();
  const staleEnd = h.audios[0].onended;
  const staleError = h.audios[0].onerror;
  h.stopSound();
  staleEnd(); staleError();
  assert.equal(await played, false);
  await tick();
  assert.equal(h.audios.length, 1);
  assert.equal(h.utterances.length, 0);
});

test('interrupting original WAV playback never triggers browser speech', async () => {
  const h = harness();
  const played = h.say('zh', {guideVoice:'legacy'});
  await tick();
  assert.match(h.audios[0].url, /assets\/audio\/zh\.wav/);
  h.stopSound();
  assert.equal(await played, false);
  assert.equal(h.utterances.length, 0);
  assert.equal(h.audios.length, 1);
});

test('interruption while awaiting manifest prevents any delayed audio start', async () => {
  let release;
  const manifestPromise = new Promise(resolve => { release = resolve; });
  const h = harness({manifestPromise});
  const played = h.say('zh');
  h.stopSound();
  release({ok:true,json:async()=>defaultManifest});
  assert.equal(await played, false);
  assert.equal(h.audios.length, 0);
  assert.equal(h.utterances.length, 0);
});

test('missing manifest bypasses neural audio and preserves the original WAV', async () => {
  const h = harness({manifestFailure:true});
  const played = h.say('zh');
  await tick();
  assert.equal(h.audios.length, 1);
  assert.match(h.audios[0].url, /assets\/audio\/zh\.wav/);
  h.audios[0].onended();
  assert.equal(await played, true);
});

test('English always uses existing audio; explicit voice preview works while muted', async () => {
  const h = harness();
  const english = h.say('en');
  await tick();
  assert.match(h.audios[0].url, /assets\/audio\/en\.wav/);
  h.audios[0].onended();
  assert.equal(await english, true);
  h.mute();
  assert.equal(await h.say('zh'), false);
  assert.equal(h.audios.length, 1);
  const preview = h.say('zh', {preview:true});
  await tick();
  assert.match(h.audios[1].url, /assets\/audio-neural\/zh\.mp3/);
  h.audios[1].onended();
  assert.equal(await preview, true);
});

test('native dialog cancel (Escape) stops and settles the preview', async () => {
  const h = harness();
  assert.equal(typeof h.listeners.get('cancel'), 'function');
  const preview = h.say('zh', {preview:true});
  await tick();
  h.listeners.get('cancel')();
  assert.equal(await preview, false);
  assert.equal(h.audios[0].paused, true);
  assert.equal(h.inspect().activeAudio, false);
  assert.equal(h.inspect().hasCancel, false);
});

test('breakfast maps the guidance key and keeps asset and fallback text aligned with the source', async () => {
  const canonical=EXTRA_SPEECH_LINES.breakfast_home;
  const neuralManifest=JSON.parse(fs.readFileSync(new URL('../../outputs/first-day-demo/assets/audio-neural/manifest.json',import.meta.url),'utf8'));
  const wavManifest=JSON.parse(fs.readFileSync(new URL('../../outputs/first-day-demo/assets/audio-manifest.json',import.meta.url),'utf8'));
  const neuralRow=neuralManifest.audio.find(row=>row.key==='breakfast_home');
  const wavRow=wavManifest.audio.find(row=>row.key==='breakfast_home');
  assert.equal(neuralRow.text,canonical.text);
  assert.equal(wavRow.text,canonical.text);
  assert.match(canonical.text,/对话气泡/);
  const h=harness({manifest:{audio:[neuralRow]}});
  assert.equal(h.mappedKey('home'),'home');
  h.setUnit('breakfast');
  assert.equal(h.mappedKey('home'),'breakfast_home');
  assert.equal(h.mappedKey('breakfast_home'),'breakfast_home');
  const played=h.say('home',{text:'旧的调用方文字：点开始冒险。'});
  await tick();
  assert.match(h.audios[0].url,/assets\/audio-neural\/breakfast_home\.mp3/);
  h.audios[0].onerror();
  await tick();
  assert.match(h.audios[1].url,/assets\/audio\/breakfast_home\.wav/);
  h.audios[1].onerror();
  await tick();
  assert.equal(h.utterances.length,1);
  assert.equal(h.utterances[0].text,canonical.text);
  assert.equal(h.utterances[0].lang,canonical.lang);
  h.utterances[0].onend();
  assert.equal(await played,true);
});
