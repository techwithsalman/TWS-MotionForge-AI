/**
 * TWS MotionForge AI — Master Execution Orchestrator
 * Brand: Tech With Salman
 * Architecture: 100% Local, Offline, Free
 * 
 * Orchestrates:
 * Topic/Script -> Storyboard -> Local TTS -> Faster-Whisper Alignment -> Autopilot Render -> FFmpeg Assembly
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStoryboard } from './llm_engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const SKILL_ROOT = path.join(ROOT, 'skills/directing-stickman-videos');
const AUTOPILOT_MJS = path.join(SKILL_ROOT, 'scripts/autopilot.mjs');

export class MotionForgeOrchestrator {
  constructor(options = {}) {
    this.projectsDir = options.projectsDir || path.join(ROOT, 'projects');
    fs.mkdirSync(this.projectsDir, { recursive: true });
  }

  /**
   * Initializes a complete video project from a topic or raw script.
   */
  async createProject({ topic, script, style = 'B1', ratio = '16:9', voiceEngine = 'sapi', voice = 'default', onProgress = () => {} }) {
    onProgress({ stage: 'storyboard', percent: 10, message: 'Generating script and storyboard...' });
    const inputContent = script || topic || 'Introduction to Stickman Animation';
    const storyboard = await createStoryboard(inputContent, { style, ratio });

    const slug = (storyboard.title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '-' + Date.now().toString().slice(-4);
    const projectDir = path.join(this.projectsDir, slug);

    onProgress({ stage: 'scaffolding', percent: 25, message: 'Initializing project files...' });
    // Run autopilot.mjs init
    const initRes = spawnSync(process.execPath, [AUTOPILOT_MJS, 'init', projectDir, '--style', style, '--ratio', ratio], {
      cwd: ROOT,
      encoding: 'utf8'
    });

    if (initRes.status !== 0) {
      throw new Error(`Failed to initialize project: ${initRes.stderr || initRes.stdout}`);
    }

    const projectJsonPath = path.join(projectDir, 'project.json');
    const project = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));

    // Step 2: Synthesize voiceover WAV
    onProgress({ stage: 'tts', percent: 45, message: 'Synthesizing voiceover audio locally...' });
    const voiceWavPath = path.join(projectDir, 'narration.wav');
    const ttsScript = path.join(__dirname, 'tts_engine.py');
    const ttsRes = spawnSync('python', [
      ttsScript,
      '--text', storyboard.script,
      '--output', voiceWavPath,
      '--engine', voiceEngine,
      '--voice', voice
    ], { cwd: ROOT, encoding: 'utf8' });

    if (ttsRes.status !== 0) {
      throw new Error(`TTS synthesis failed: ${ttsRes.stderr || ttsRes.stdout}`);
    }
    const ttsMeta = JSON.parse(ttsRes.stdout.trim());

    // Step 3: Align words with Faster-Whisper
    onProgress({ stage: 'alignment', percent: 65, message: 'Aligning subtitle timings with Faster-Whisper...' });
    const alignScript = path.join(__dirname, 'alignment_engine.py');
    const alignJsonPath = path.join(projectDir, 'words.json');
    const alignRes = spawnSync('python', [
      alignScript,
      voiceWavPath,
      '--output', alignJsonPath,
      '--model', 'tiny',
      '--text-hint', storyboard.script
    ], { cwd: ROOT, encoding: 'utf8' });

    if (alignRes.status !== 0) {
      throw new Error(`Speech alignment failed: ${alignRes.stderr || alignRes.stdout}`);
    }

    // Step 4: Group words into semantic captions
    onProgress({ stage: 'captions', percent: 75, message: 'Formatting semantic subtitles...' });
    const captionsJsonPath = path.join(projectDir, 'captions.json');
    const capRes = spawnSync(process.execPath, [
      AUTOPILOT_MJS,
      'captions',
      alignJsonPath,
      captionsJsonPath
    ], { cwd: ROOT, encoding: 'utf8' });

    if (capRes.status !== 0) {
      throw new Error(`Caption grouping failed: ${capRes.stderr || capRes.stdout}`);
    }

    // Load grouped captions into project.json
    const captions = JSON.parse(fs.readFileSync(captionsJsonPath, 'utf8'));
    project.captions = captions;
    project.voice = {
      path: 'narration.wav',
      lead: 0,
      tail: 0,
      contains_sfx: true
    };

    // Build timeline shots synchronized with speech duration
    const totalDuration = ttsMeta.duration;
    const shotCount = storyboard.shots.length || 4;
    const shotDuration = totalDuration / shotCount;

    project.shots = storyboard.shots.map((shot, idx) => {
      const sStart = round2(idx * shotDuration);
      const sEnd = round2(idx === shotCount - 1 ? totalDuration : (idx + 1) * shotDuration);
      const span = sEnd - sStart;
      const actorX = ratio === '9:16' ? 140 : 650;

      return {
        start: sStart,
        end: sEnd,
        layers: [
          {
            type: 'text',
            id: `text_${idx + 1}`,
            text: (shot.text || storyboard.title).toUpperCase().slice(0, 32),
            x: ratio === '9:16' ? 80 : 95,
            y: ratio === '9:16' ? 140 : 110,
            size: ratio === '9:16' ? 44 : 54,
            bold: true
          },
          {
            type: 'pose',
            id: `actor_${idx + 1}`,
            pose: idx % 3,
            x: actorX,
            y: ratio === '9:16' ? 400 : 35,
            w: ratio === '9:16' ? 440 : 445,
            motion: {
              role: 'actor',
              reason: 'Stickman gestures dynamically with the spoken beat'
            },
            keys: generateContinuousKeys(actorX, span)
          },
          {
            type: 'line',
            id: `line_${idx + 1}`,
            points: [[ratio === '9:16' ? 80 : 95, ratio === '9:16' ? 195 : 175], [ratio === '9:16' ? 450 : 550, ratio === '9:16' ? 195 : 175]],
            color: '#EC4338',
            lineWidth: 5,
            motion: {
              role: 'information',
              reason: 'Animated highlight underline reveals with narration'
            },
            keys: [
              { t: 0.1, progress: 0 },
              { t: Math.min(1.8, span * 0.7), progress: 1 }
            ]
          }
        ]
      };
    });

    fs.writeFileSync(projectJsonPath, JSON.stringify(project, null, 2) + '\n');
    fs.writeFileSync(path.join(projectDir, 'storyboard.json'), JSON.stringify(storyboard, null, 2) + '\n');

    onProgress({ stage: 'ready', percent: 100, message: 'Project prepared successfully!' });

    return {
      projectDir,
      projectJson: projectJsonPath,
      title: storyboard.title,
      duration: totalDuration,
      shotsCount: project.shots.length,
      captionsCount: project.captions.length
    };
  }

  /**
   * Validates and renders an existing project to MP4.
   */
  async render({ projectDir, preview = false, seconds = 10, onProgress = () => {} }) {
    const projectJson = path.join(projectDir, 'project.json');
    if (!fs.existsSync(projectJson)) {
      throw new Error(`Project not found: ${projectJson}`);
    }

    onProgress({ stage: 'validating', percent: 15, message: 'Validating scene motion and layout...' });
    const valRes = spawnSync(process.execPath, [AUTOPILOT_MJS, 'validate', projectJson], {
      cwd: ROOT,
      encoding: 'utf8'
    });

    if (valRes.status !== 0) {
      throw new Error(`Validation failed: ${valRes.stderr || valRes.stdout}`);
    }

    const command = preview ? 'preview' : 'render';
    const renderArgs = [AUTOPILOT_MJS, command, projectJson, '--replace'];
    if (preview) {
      renderArgs.push('--seconds', String(seconds));
    }

    onProgress({ stage: 'rendering', percent: 35, message: `Rendering ${preview ? 'preview' : 'full video'} with FFmpeg...` });

    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, renderArgs, { cwd: ROOT });
      let output = '';
      let error = '';

      child.stdout.on('data', chunk => {
        const str = chunk.toString();
        output += str;
        // Parse shot progress if available
        try {
          const lines = str.trim().split('\n');
          for (const line of lines) {
            if (line.includes('"shot":') && line.includes('"total":')) {
              const data = JSON.parse(line);
              const p = Math.round(35 + (data.shot / data.total) * 55);
              onProgress({ stage: 'rendering', percent: p, message: `Rendering shot ${data.shot}/${data.total}...` });
            }
          }
        } catch {}
      });

      child.stderr.on('data', chunk => {
        error += chunk.toString();
      });

      child.on('close', code => {
        if (code !== 0) {
          return reject(new Error(`Render process exited with code ${code}: ${error || output}`));
        }

        const outDir = fs.existsSync(path.join(projectDir, 'output')) 
          ? path.join(projectDir, 'output') 
          : path.join(projectDir, 'outputs');
        const mp4 = path.join(outDir, preview ? 'preview.mp4' : 'film.mp4');
        const srt = path.join(outDir, preview ? 'preview.srt' : 'film.srt');
        const contactSheet = path.join(outDir, preview ? 'preview-contact-sheet.png' : 'film-contact-sheet.png');

        onProgress({ stage: 'complete', percent: 100, message: 'Video rendered successfully!' });

        resolve({
          success: true,
          videoPath: fs.existsSync(mp4) ? mp4 : null,
          subtitlesPath: fs.existsSync(srt) ? srt : null,
          contactSheetPath: fs.existsSync(contactSheet) ? contactSheet : null,
          rawOutput: output
        });
      });
    });
  }
}

function round2(num) {
  return Math.round(num * 100) / 100;
}

function generateContinuousKeys(baseX, span) {
  const keys = [];
  const step = 1.5;
  let t = 0;
  let toggle = false;
  while (t < span) {
    keys.push({ t: round2(t), x: baseX + (toggle ? 14 : 0) });
    t += step;
    toggle = !toggle;
  }
  keys.push({ t: round2(span), x: baseX + (toggle ? 14 : 0) });
  return keys;
}
