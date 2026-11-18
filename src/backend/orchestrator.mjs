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
import { setupEnvironmentPaths, getPythonPath, getSkillsDir, nodeChildEnv } from './path_resolver.mjs';

setupEnvironmentPaths();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const SKILL_ROOT = getSkillsDir();
const AUTOPILOT_MJS = path.join(SKILL_ROOT, 'scripts/autopilot.mjs');

export class MotionForgeOrchestrator {
  constructor(options = {}) {
    this.projectsDir = options.projectsDir || path.join(ROOT, 'projects');
    fs.mkdirSync(this.projectsDir, { recursive: true });
    this.activeProcesses = new Map();
  }

  /**
   * Safely cancels an active render child process.
   */
  cancelRender(projectDir) {
    const child = this.activeProcesses.get(projectDir);
    if (child) {
      child._wasCancelled = true;
      try {
        if (process.platform === 'win32' && child.pid) {
          spawnSync('taskkill', ['/pid', String(child.pid), '/f', '/t'], { encoding: 'utf8' });
        } else {
          child.kill('SIGTERM');
        }
      } catch {}
      this.activeProcesses.delete(projectDir);
      return true;
    }
    return false;
  }

  /**
   * Saves updated storyboard or project parameters.
   */
  saveProject(projectDir, projectData) {
    const projectJson = path.join(projectDir, 'project.json');
    if (!fs.existsSync(projectJson)) {
      throw new Error(`Project file not found: ${projectJson}`);
    }
    fs.writeFileSync(projectJson, JSON.stringify(projectData, null, 2) + '\n');
    return { success: true, projectDir };
  }

  /**
   * Exports subtitles to a target path in SRT or VTT format.
   */
  exportSubtitles(projectDir, targetPath, format = 'srt') {
    const outDir = fs.existsSync(path.join(projectDir, 'output'))
      ? path.join(projectDir, 'output')
      : path.join(projectDir, 'outputs');

    const sourceFile = format === 'vtt'
      ? (fs.existsSync(path.join(outDir, 'preview.vtt')) ? path.join(outDir, 'preview.vtt') : path.join(outDir, 'film.vtt'))
      : (fs.existsSync(path.join(outDir, 'preview.srt')) ? path.join(outDir, 'preview.srt') : path.join(outDir, 'film.srt'));

    if (!fs.existsSync(sourceFile)) {
      // If VTT requested but only SRT exists, or vice versa, convert or generate
      const srtFile = fs.existsSync(path.join(outDir, 'preview.srt'))
        ? path.join(outDir, 'preview.srt')
        : path.join(outDir, 'film.srt');

      if (!fs.existsSync(srtFile)) {
        throw new Error('No subtitle file found for this project.');
      }

      const srtContent = fs.readFileSync(srtFile, 'utf8');
      if (format === 'vtt') {
        const vttContent = 'WEBVTT\n\n' + srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        fs.writeFileSync(targetPath, vttContent);
        return { success: true, targetPath, format: 'vtt' };
      } else {
        fs.writeFileSync(targetPath, srtContent);
        return { success: true, targetPath, format: 'srt' };
      }
    }

    fs.copyFileSync(sourceFile, targetPath);
    return { success: true, targetPath, format };
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
      env: nodeChildEnv(),
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
    const ttsRes = spawnSync(getPythonPath(), [
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
    const alignRes = spawnSync(getPythonPath(), [
      alignScript,
      voiceWavPath,
      '--output', alignJsonPath,
      '--model', 'small.en',
      '--text-hint', storyboard.script
    ], { cwd: ROOT, encoding: 'utf8' });

    if (alignRes.status !== 0) {
      throw new Error(`Speech alignment failed: ${alignRes.stderr || alignRes.stdout}`);
    }

    // Step 4: Group words into semantic captions
    onProgress({ stage: 'captions', percent: 75, message: 'Formatting semantic subtitles...' });
    const captionsJsonPath = path.join(projectDir, 'captions.json');
    const alignData = JSON.parse(fs.readFileSync(alignJsonPath, 'utf8'));
    const captions = groupWordsForRatio(alignData, ratio);
    fs.writeFileSync(captionsJsonPath, JSON.stringify(captions, null, 2) + '\n');

    // Load grouped captions into project.json
    project.captions = captions;
    project.voice = {
      path: 'narration.wav',
      lead: 0,
      tail: 0,
      contains_sfx: true
    };

    // Build timeline shots synchronized with speech duration
    const totalDuration = ttsMeta.duration;
    const maxSpan = style === 'B4' ? 2.4 : 4.0;
    const baseCount = storyboard.shots?.length || 4;
    const shotCount = Math.max(baseCount, Math.ceil(totalDuration / maxSpan));
    const shotDuration = totalDuration / shotCount;

    const shotsToBuild = [];
    for (let i = 0; i < shotCount; i++) {
      shotsToBuild.push(storyboard.shots?.[i] || storyboard.shots?.[i % (storyboard.shots?.length || 1)] || {});
    }

    project.shots = shotsToBuild.map((shot, idx) => {
      const sStart = round2(idx * shotDuration);
      const sEnd = round2(idx === shotCount - 1 ? totalDuration : (idx + 1) * shotDuration);
      const span = round2(sEnd - sStart);
      const isPortrait = ratio === '9:16';
      const actorX = isPortrait ? 360 : 650;

      const shotObj = {
        id: `shot_${idx + 1}`,
        start: sStart,
        end: sEnd,
        layers: [
          {
            type: 'text',
            id: `text_${idx + 1}`,
            text: (shot.text || storyboard.title).toUpperCase().slice(0, 32),
            x: isPortrait ? 96 : 95,
            y: isPortrait ? 220 : 110,
            size: isPortrait ? 54 : 54,
            bold: true
          },
          {
            type: 'line',
            id: `line_${idx + 1}`,
            points: [[isPortrait ? 96 : 95, isPortrait ? 280 : 175], [isPortrait ? 900 : 550, isPortrait ? 280 : 175]],
            color: '#EC4338',
            lineWidth: 5,
            motion: {
              role: 'information',
              reason: 'Animated highlight underline reveals with narration'
            },
            keys: [
              { t: 0.1, progress: 0 },
              { t: Math.min(1.8, Math.max(0.2, round2(span * 0.7))), progress: 1 }
            ]
          },
          {
            type: 'pose',
            id: `actor_${idx + 1}`,
            pose: idx % 3,
            x: actorX,
            y: isPortrait ? 480 : 35,
            w: isPortrait ? 560 : 445,
            motion: {
              role: 'actor',
              reason: 'Stickman gestures dynamically with the spoken beat'
            },
            keys: generateContinuousKeys(actorX, span)
          }
        ]
      };

      if (isPortrait) {
        shotObj.portrait = {
          intent: 'Native vertical portrait framing highlighting stickman presenter and headline',
          regions: [
            {
              id: `reg_head_${idx + 1}`,
              role: 'information',
              intent: 'Headline title and accent highlight above the stickman presenter',
              layer_ids: [`text_${idx + 1}`, `line_${idx + 1}`],
              region: { x: 80, y: 190, w: 1000, h: 220 }
            },
            {
              id: `reg_actor_${idx + 1}`,
              role: 'actor',
              intent: 'Presenter stickman performing gestures in central stage',
              layer_ids: [`actor_${idx + 1}`],
              region: { x: 100, y: 440, w: 900, h: 1100 }
            }
          ]
        };
      }

      return shotObj;
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
      env: nodeChildEnv(),
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
      const child = spawn(process.execPath, renderArgs, { cwd: ROOT, env: nodeChildEnv() });
      this.activeProcesses.set(projectDir, child);
      let output = '';
      let error = '';

      child.stdout.on('data', chunk => {
        const str = chunk.toString();
        output += str;
        // Parse shot and frame progress
        try {
          const lines = str.trim().split('\n');
          for (const line of lines) {
            if (line.includes('"shot":') && line.includes('"total":')) {
              const data = JSON.parse(line);
              const p = Math.round(35 + (data.shot / data.total) * 55);
              onProgress({ stage: 'rendering', percent: p, message: `Rendering shot ${data.shot}/${data.total}...` });
            } else {
              const shotMatch = line.match(/(?:Rendering shot|shot)\s*(\d+)\s*(?:of|\/)\s*(\d+)/i);
              if (shotMatch) {
                const s = parseInt(shotMatch[1], 10);
                const t = parseInt(shotMatch[2], 10);
                const p = Math.round(35 + (s / t) * 55);
                onProgress({ stage: 'rendering', percent: p, message: `Rendering shot ${s}/${t}...` });
              }
              const frameMatch = line.match(/(?:frame|checked_frame)\s*[:=]?\s*(\d+)\s*(?:of|\/)\s*(\d+)/i);
              if (frameMatch) {
                const f = parseInt(frameMatch[1], 10);
                const tf = parseInt(frameMatch[2], 10);
                const p = Math.min(90, Math.round(35 + (f / tf) * 55));
                onProgress({ stage: 'rendering', percent: p, message: `Rendering frame ${f}/${tf}...` });
              }
            }
          }
        } catch {}
      });

      child.stderr.on('data', chunk => {
        error += chunk.toString();
      });

      child.on('close', code => {
        this.activeProcesses.delete(projectDir);
        if (child._wasCancelled) {
          return reject(new Error('Video generation was cancelled by the user.'));
        }
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

function groupWordsForRatio(data, ratio = '16:9') {
  const isPortrait = ratio === '9:16';
  const maxWords = isPortrait ? 4 : 8;
  const maxChars = isPortrait ? 26 : 52;
  const maxDuration = isPortrait ? 2.5 : 3.5;

  const cues = [];
  let words = [], start = 0, end = 0;
  function flush() {
    if (words.length) {
      cues.push({
        start: round2(start),
        end: round2(end),
        text: words.join(' ').replace(/\s+([,.!?;:])/g, '$1')
      });
      words = [];
    }
  }

  for (const w of (data.words || [])) {
    if (typeof w.word !== 'string' || !w.word.trim()) continue;
    const wordStr = w.word.trim();
    if (words.length && (
      w.start - end > 0.35 ||
      words.length >= maxWords ||
      w.end - start > maxDuration ||
      [...words, wordStr].join(' ').length > maxChars
    )) {
      flush();
    }
    if (!words.length) start = w.start;
    words.push(wordStr);
    end = w.end;
    if (/[.!?]$/.test(wordStr)) flush();
  }
  flush();
  return cues;
}

function generateContinuousKeys(baseX, span) {
  const keys = [];
  const step = 1.5;
  let t = 0;
  let toggle = false;
  while (t <= span - 0.3) {
    keys.push({ t: round2(t), x: baseX + (toggle ? 14 : 0) });
    t = round2(t + step);
    toggle = !toggle;
  }
  if (keys.length === 0) {
    keys.push({ t: 0, x: baseX });
  }
  return keys;
}
