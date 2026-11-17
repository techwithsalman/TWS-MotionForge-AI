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
}
