/**
 * TWS MotionForge AI — Desktop API Bridge for Electron
 * Brand: Tech With Salman
 * Architecture: 100% Local, Offline, Free
 * 
 * Provides high-level IPC / programmatic endpoints for the Electron UI:
 * - System diagnostics
 * - Voice inventory
 * - Style catalog
 * - Audio library search
 * - Project creation & rendering
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { MotionForgeOrchestrator } from './orchestrator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const SKILL_ROOT = path.join(ROOT, 'skills/directing-stickman-videos');
const CATALOG_PATH = path.join(SKILL_ROOT, 'assets/b-audio-library/catalog.json');

export class MotionForgeBridge {
  constructor(options = {}) {
    this.orchestrator = new MotionForgeOrchestrator(options);
  }

  /**
   * System health check for desktop frontend.
   */
  async getSystemDiagnostics() {
    const checks = {
      node: Boolean(process.versions.node),
      ffmpeg: false,
      canvas: false,
      python: false,
      fasterWhisper: false,
      kokoroModel: false,
      sapiVoices: 0
    };

    // Check FFmpeg
    try {
      const res = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
      checks.ffmpeg = res.status === 0;
    } catch {}

    // Check Canvas
    try {
      const canvasPkg = pathToFileURL(path.join(SKILL_ROOT, 'node_modules/@napi-rs/canvas/index.js')).href;
      await import(canvasPkg);
      checks.canvas = true;
    } catch {
      try {
        await import('@napi-rs/canvas');
        checks.canvas = true;
      } catch {}
    }

    // Check Python & packages
    try {
      const res = spawnSync('python', ['-c', 'import numpy, PIL, cv2, pyttsx3, faster_whisper; print("ok")'], { encoding: 'utf8' });
      checks.python = res.status === 0;
      checks.fasterWhisper = res.status === 0;
    } catch {}

    // Check Kokoro model files
    const kokoroModel = path.join(ROOT, 'models/tts/kokoro-v0_19.onnx');
    const kokoroVoices = path.join(ROOT, 'models/tts/voices-v1.0.bin');
    checks.kokoroModel = fs.existsSync(kokoroModel) && fs.existsSync(kokoroVoices);

    // Check SAPI voices
    try {
      const res = spawnSync('python', ['-c', 'import pyttsx3; print(len(pyttsx3.init().getProperty("voices")))'], { encoding: 'utf8' });
      checks.sapiVoices = parseInt(res.stdout.trim(), 10) || 0;
    } catch {}

    return {
      status: checks.ffmpeg && checks.canvas && checks.python ? 'ready' : 'incomplete',
      checks,
      engine: 'TWS MotionForge Local Engine v1.0.0',
      brand: 'Tech With Salman'
    };
  }

  /**
   * Returns available voice profiles.
   */
  async getVoices() {
    const voices = [];
    
    // Windows SAPI Voices (Instant offline)
    try {
      const res = spawnSync('python', ['-c', 'import pyttsx3, json; e=pyttsx3.init(); print(json.dumps([{"id": v.id, "name": v.name, "engine": "sapi"} for v in e.getProperty("voices")]))'], { encoding: 'utf8' });
      const sapiList = JSON.parse(res.stdout.trim());
      voices.push(...sapiList);
    } catch {}

    // Kokoro Studio Voices (High-fidelity neural)
    const kokoroModel = path.join(ROOT, 'models/tts/kokoro-v0_19.onnx');
    if (fs.existsSync(kokoroModel)) {
      const neuralVoices = [
        { id: 'af_bella', name: 'Bella (US Female - Studio Expressive)', engine: 'kokoro' },
        { id: 'af_sarah', name: 'Sarah (US Female - Clear Narration)', engine: 'kokoro' },
        { id: 'am_adam', name: 'Adam (US Male - Deep Explainer)', engine: 'kokoro' },
        { id: 'am_michael', name: 'Michael (US Male - Energetic)', engine: 'kokoro' },
        { id: 'bf_emma', name: 'Emma (British Female - Calm)', engine: 'kokoro' },
        { id: 'bm_george', name: 'George (British Male - Documentarian)', engine: 'kokoro' }
      ];
      voices.push(...neuralVoices);
    }

    return voices;
  }

  /**
   * Returns supported visual animation styles.
   */
  getStyles() {
    return [
      { id: 'B1', name: 'Minimal Line Art', description: 'Clean monochrome stick figures with animated accent highlights and handwritten notes.', ratio: ['16:9', '9:16'], mode: 'autopilot' },
      { id: 'B2', name: 'Colorful Hand-Drawn', description: 'Warm organic 2D cartoon scenes with saturated pastel fills and comic reactions.', ratio: ['16:9', '9:16'], mode: 'autopilot' },
      { id: 'B3', name: 'Retro TV (CRT)', description: 'Vintage television CRT scanlines, phosphorus glow, and semantic line animations.', ratio: ['16:9', '9:16'], mode: 'autopilot' },
      { id: 'B4', name: 'Survival Thriller', description: 'Dramatic high-tension explainers, horror hooks, and suspenseful audio cuts.', ratio: ['16:9', '9:16'], mode: 'autopilot' },
      { id: 'B5', name: 'Character Explainer', description: 'CrazyMei actor rig with physical relay comedy and animated presenter avatar.', ratio: ['16:9', '9:16'], mode: 'autopilot' },
      { id: 'B6', name: 'Dynamic Meme Animation', description: 'Fast-paced planar puppet rigs powered by Python OpenCV/NumPy and bold Archivo Black subtitles.', ratio: ['16:9', '9:16'], mode: 'autopilot' },
      { id: 'B7', name: 'Pixel Theater', description: 'Retro 8-bit / 16-bit pixel art stickmen with nostalgic sound design.', ratio: ['16:9', '9:16'], mode: 'autopilot' },
      { id: 'A1_A7', name: 'Director Studio (Storyboard & Prompt Mode)', description: 'Structured multi-shot cinematic planning and frozen DNA prompts for video models.', ratio: ['16:9', '9:16', '1:1'], mode: 'director' }
    ];
  }

  /**
   * Queries the bundled offline audio library.
   */
  getAudioCatalog(query = '', category = null) {
    if (!fs.existsSync(CATALOG_PATH)) return { count: 0, items: [] };
    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    let items = catalog.assets || [];

    if (category) {
      items = items.filter(i => i.category === category);
    }
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(i => (i.id && i.id.toLowerCase().includes(q)) || (i.tags && i.tags.some(t => t.toLowerCase().includes(q))));
    }

    return {
      total: items.length,
      items: items.slice(0, 50)
    };
  }

  /**
   * Scans and returns all bundled audio items (music & sound effects).
   */
  getAudioLibrary() {
    const audioDir = path.join(SKILL_ROOT, 'assets/b-audio-library/audio');
    const evidenceDir = path.join(SKILL_ROOT, 'assets/b-audio-library/evidence');
    if (!fs.existsSync(audioDir)) return [];

    const audioItems = [];
    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(mp3|wav|ogg|flac)$/i.test(entry.name)) {
          const isBgm = entry.name.startsWith('bgm-') || dir.includes('music');
          const baseName = entry.name.replace(/\.(mp3|wav|ogg|flac)$/i, '');
          const evidencePath = path.join(evidenceDir, baseName, 'source.html.txt');
          let licenseInfo = isBgm 
            ? 'Creative Commons CC-BY 4.0 (Kevin MacLeod / Incompetech)' 
            : 'CC0 1.0 Universal / Public Domain SFX';

          if (fs.existsSync(evidencePath)) {
            try {
              licenseInfo = fs.readFileSync(evidencePath, 'utf8').slice(0, 100);
            } catch {}
          }

          audioItems.push({
            filename: entry.name,
            fullPath,
            title: baseName.replace(/^(bgm-|sfx-)/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            type: isBgm ? 'Music' : 'Sound Effect',
            license: licenseInfo
          });
        }
      }
    }

    scanDir(audioDir);
    return audioItems;
  }

  /**
   * Generates a short voice preview WAV file.
   */
  async previewVoice({ engine = 'sapi', voice = 'Microsoft David', text = 'Welcome to TWS MotionForge AI.' }) {
    const previewDir = path.join(ROOT, 'test_outputs/preview_cache');
    fs.mkdirSync(previewDir, { recursive: true });
    const safeName = voice.replace(/[^a-zA-Z0-9]+/g, '_');
    const outPath = path.join(previewDir, `preview_${engine}_${safeName}.wav`);

    const ttsScript = path.join(ROOT, 'src/backend/tts_engine.py');
    const res = spawnSync('python', [
      ttsScript,
      '--text', text,
      '--output', outPath,
      '--engine', engine,
      '--voice', voice
    ], { cwd: ROOT, encoding: 'utf8' });

    if (res.status !== 0) {
      throw new Error(`Voice preview failed: ${res.stderr || res.stdout}`);
    }

    return {
      filePath: outPath,
      engine,
      voice
    };
  }

  /**
   * Discovers all video projects across user documents and workspace directories.
   */
  async getProjects(additionalDirs = []) {
    const defaultDirs = [
      this.orchestrator.projectsDir,
      path.join(ROOT, 'projects'),
      path.join(ROOT, 'test_projects'),
      ...additionalDirs
    ];

    const uniqueDirs = Array.from(new Set(defaultDirs.filter(d => fs.existsSync(d))));
    const results = [];
    const seenPaths = new Set();

    for (const parent of uniqueDirs) {
      const subs = fs.readdirSync(parent);
      for (const sub of subs) {
        const pdir = path.join(parent, sub);
        if (seenPaths.has(pdir)) continue;

        const pjson = path.join(pdir, 'project.json');
        if (fs.existsSync(pjson)) {
          try {
            seenPaths.add(pdir);
            const data = JSON.parse(fs.readFileSync(pjson, 'utf8'));
            const previewMp4 = path.join(pdir, 'output/preview.mp4');
            const filmMp4 = path.join(pdir, 'output/film.mp4');
            const videoPath = fs.existsSync(previewMp4) ? previewMp4 : (fs.existsSync(filmMp4) ? filmMp4 : null);
            const contactSheet = path.join(pdir, 'output/preview-contact-sheet.png');

            results.push({
              name: sub,
              path: pdir,
              style: data.style || 'B1',
              ratio: data.width && data.height ? (data.width > data.height ? '16:9' : '9:16') : '16:9',
              duration: data.duration || 5,
              hasVideo: Boolean(videoPath),
              videoPath,
              contactSheetPath: fs.existsSync(contactSheet) ? contactSheet : null,
              updatedAt: fs.statSync(pjson).mtime
            });
          } catch {}
        }
      }
    }
    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Retrieves full details for a single project.
   */
  async getProjectDetails(projectDir) {
    const pjsonPath = path.join(projectDir, 'project.json');
    if (!fs.existsSync(pjsonPath)) throw new Error('Project not found');

    const project = JSON.parse(fs.readFileSync(pjsonPath, 'utf8'));
    const sbPath = path.join(projectDir, 'storyboard.json');
    const storyboard = fs.existsSync(sbPath) ? JSON.parse(fs.readFileSync(sbPath, 'utf8')) : null;

    const previewMp4 = path.join(projectDir, 'output/preview.mp4');
    const filmMp4 = path.join(projectDir, 'output/film.mp4');
    const videoPath = fs.existsSync(previewMp4) ? previewMp4 : (fs.existsSync(filmMp4) ? filmMp4 : null);

    const srtPath = path.join(projectDir, 'output/preview.srt');
    const vttPath = path.join(projectDir, 'output/preview.vtt');
    const contactSheet = path.join(projectDir, 'output/preview-contact-sheet.png');

    return {
      project,
      storyboard,
      videoPath,
      srtText: fs.existsSync(srtPath) ? fs.readFileSync(srtPath, 'utf8') : null,
      vttText: fs.existsSync(vttPath) ? fs.readFileSync(vttPath, 'utf8') : null,
      contactSheetPath: fs.existsSync(contactSheet) ? contactSheet : null
    };
  }

  /**
   * Creates a project.
   */
  async createProject(params) {
    return this.orchestrator.createProject(params);
  }

  /**
   * Renders project preview or full film.
   */
  async renderVideo(params) {
    return this.orchestrator.render(params);
  }

  /**
   * Cancels active rendering for a project.
   */
  cancelRender(projectDir) {
    return this.orchestrator.cancelRender(projectDir);
  }

  /**
   * Saves project data.
   */
  saveProject(projectDir, projectData) {
    return this.orchestrator.saveProject(projectDir, projectData);
  }

  /**
   * Exports subtitles to destination path.
   */
  exportSubtitles(projectDir, targetPath, format = 'srt') {
    return this.orchestrator.exportSubtitles(projectDir, targetPath, format);
  }
}
