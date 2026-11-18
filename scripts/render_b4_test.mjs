import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SKILL_ROOT = path.join(ROOT, 'skills/directing-stickman-videos');
const AUTOPILOT = path.join(SKILL_ROOT, 'scripts/autopilot.mjs');

const require = createRequire(import.meta.url);
const { createCanvas } = require(path.join(SKILL_ROOT, 'node_modules/@napi-rs/canvas'));
const { makeB4Opening, B4_PORTRAIT, B4_HOOK } = await import(pathToFileURL(path.join(SKILL_ROOT, 'scripts/b4-opening.mjs')).href);
const { BRIAN } = await import(pathToFileURL(path.join(SKILL_ROOT, 'scripts/b4-runtime.mjs')).href);

const outDir = path.join(ROOT, 'test_projects/b4_portrait_test');
fs.mkdirSync(outDir, { recursive: true });

console.log('1. Generating B4 synthetic artwork...');
const art = (file, change) => {
  const c = createCanvas(720, 1280);
  const ctx = c.getContext('2d');
  ctx.scale(c.width / 1280, c.width / 1280);
  ctx.fillStyle = '#0c151b';
  ctx.fillRect(0, 0, 1280, 1280 * c.height / c.width);
  ctx.fillStyle = '#43545c';
  ctx.fillRect(150, 1080, 980, 920);
  ctx.fillStyle = '#0b1018';
  ctx.fillRect(190, 1120, 900, 800);
  ctx.fillStyle = '#b4bab5';
  ctx.beginPath();
  ctx.arc(470, 1470, 140, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = change ? '#ba4b3f' : '#24313b';
  ctx.fillRect(800, 1180, 220, 650);
  fs.writeFileSync(path.join(outDir, file), c.toBuffer('image/png'));
};

art('before.png', false);
art('after.png', true);

console.log('2. Generating TTS narration audio for B4...');
const scriptText = 'What if you saw danger coming? Stay alert.';
const voiceWavPath = path.join(outDir, 'narration.wav');
const ttsRes = spawnSync('python', [
  path.join(ROOT, 'src/backend/tts_engine.py'),
  '--text', scriptText,
  '--output', voiceWavPath,
  '--engine', 'sapi',
  '--voice', 'Microsoft David'
], { cwd: ROOT, encoding: 'utf8' });

if (ttsRes.status !== 0) {
  console.error('TTS Failed:', ttsRes.stderr || ttsRes.stdout);
  process.exit(1);
}
const ttsMeta = JSON.parse(ttsRes.stdout.trim());
console.log('TTS Duration:', ttsMeta.duration);

console.log('3. Running Faster-Whisper alignment for B4...');
const alignJsonPath = path.join(outDir, 'words.json');
const alignRes = spawnSync('python', [
  path.join(ROOT, 'src/backend/alignment_engine.py'),
  voiceWavPath,
  '--output', alignJsonPath,
  '--model', 'tiny'
], { cwd: ROOT, encoding: 'utf8' });

if (alignRes.status !== 0) {
  console.error('Align Failed:', alignRes.stderr || alignRes.stdout);
  process.exit(1);
}

console.log('4. Formatting captions...');
const captionsJsonPath = path.join(outDir, 'captions.json');
spawnSync(process.execPath, [AUTOPILOT, 'captions', alignJsonPath, captionsJsonPath], { cwd: ROOT, encoding: 'utf8' });
const captions = JSON.parse(fs.readFileSync(captionsJsonPath, 'utf8'));

console.log('5. Building B4 project.json...');
const duration = Math.min(3.0, Math.max(1.5, Math.ceil(ttsMeta.duration * 10) / 10));
const recipe = {
  setup: 'WHAT IF YOU SAW',
  payoff: 'DANGER COMING?',
  payoffLines: ['DANGER', 'COMING?'],
  before: 'before.png',
  after: 'after.png',
  meaning: 'Dark cinematic suspense threat reveal',
  width: 720,
  height: 1280,
  duration: duration
};
const hook = makeB4Opening(recipe);

  const afterLayer = hook.shot.layers.find(layer => layer.id === hook.opening.picture.after);
  const changeTime = afterLayer ? afterLayer.from : 1.2;
  const revealSec = B4_HOOK.reveal_seconds || 0.4;

  const project = {
  version: 1,
  style: 'B4',
  width: 720,
  height: 1280,
  fps: 30,
  voice: {
    path: 'narration.wav',
    lead: 0,
    tail: 0,
    name: 'Brian',
    id: 'nPczCjzI2devNBz1zQrb',
    user_override: 'Local SAPI Narrator for B4 Thriller Test',
    contains_sfx: true
  },
  captions: captions,
  opening: hook.opening,
  shots: [hook.shot],
  sfx: [],
  ambience: [],
  dialogue: [],
  audio_cuts: [],
  picture_motion: {
    author_id: 'tws-motionforge-b4-test',
    shots: [{
      shot: 0,
      kind: 'state_reveal',
      intent: 'Suspenseful visual state reveal with local color transition',
      before: 'Dark corridor before threat reveal',
      after: 'Threat emerges in the illuminated sector',
      layer_ids: [hook.opening.picture.before, hook.opening.picture.after],
      region: hook.opening.picture.region,
      times: {
        before: Math.floor((changeTime - 0.1) * 30) / 30,
        mid: Math.round((changeTime + revealSec / 2) * 30) / 30,
        after: Math.ceil((changeTime + revealSec + 0.05) * 30) / 30,
        hold: Math.floor(Math.min(hook.shot.end - 0.08, changeTime + revealSec + 0.4) * 30) / 30
      }
    }]
  },
  typography: {
    author_id: 'tws-motionforge-b4-typography'
  }
};

const projectJsonPath = path.join(outDir, 'project.json');
fs.writeFileSync(projectJsonPath, JSON.stringify(project, null, 2));

console.log('6. Rendering B4 Portrait Preview with Autopilot...');
const prevRes = spawnSync(process.execPath, [
  AUTOPILOT,
  'preview',
  projectJsonPath,
  '--seconds', String(duration)
], { cwd: ROOT, encoding: 'utf8' });

console.log('Autopilot preview stdout:\n', prevRes.stdout);
if (prevRes.stderr) console.error('Autopilot preview stderr:\n', prevRes.stderr);

console.log('Done! Checking preview output...');
const previewMp4 = path.join(outDir, 'output/preview.mp4');
if (fs.existsSync(previewMp4)) {
  console.log('B4 Portrait video generated successfully:', previewMp4);
} else {
  console.log('Preview file not found at expected location.');
}
