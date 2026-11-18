/**
 * TWS MotionForge AI — Path & Binary Resolver
 * Brand: Tech With Salman
 * 
 * Accurately locates bundled binaries (FFmpeg, Python, Models, Skills)
 * across both Development mode and Production Packaged mode (Electron NSIS).
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

export function getResourcesRoot() {
  if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'bin'))) {
    return process.resourcesPath;
  }
  return ROOT;
}

export function getPythonPath() {
  const candidates = [
    path.join(getResourcesRoot(), 'bin', 'python', 'python.exe'),
    path.join(ROOT, 'bin', 'python', 'python.exe'),
    process.platform === 'win32' ? 'python' : 'python3'
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[candidates.length - 1];
}

export function getFFmpegPath() {
  const candidates = [
    path.join(getResourcesRoot(), 'bin', 'windows', 'ffmpeg.exe'),
    path.join(ROOT, 'bin', 'windows', 'ffmpeg.exe'),
    'ffmpeg'
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffmpeg';
}

export function getFFprobePath() {
  const candidates = [
    path.join(getResourcesRoot(), 'bin', 'windows', 'ffprobe.exe'),
    path.join(ROOT, 'bin', 'windows', 'ffprobe.exe'),
    'ffprobe'
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffprobe';
}

export function getModelsDir() {
  const candidates = [
    path.join(getResourcesRoot(), 'models'),
    path.join(ROOT, 'models')
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

export function getSkillsDir() {
  const candidates = [
    path.join(getResourcesRoot(), 'skills', 'directing-stickman-videos'),
    path.join(ROOT, 'skills', 'directing-stickman-videos')
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

/**
 * Ensures bundled binaries and Python are top priority in process.env.PATH.
 */
export function setupEnvironmentPaths() {
  const resRoot = getResourcesRoot();
  const winBin = path.join(resRoot, 'bin', 'windows');
  const pyBin = path.join(resRoot, 'bin', 'python');

  const additions = [];
  if (fs.existsSync(winBin)) additions.push(winBin);
  if (fs.existsSync(pyBin)) additions.push(pyBin);

  if (additions.length > 0 && !process.env.PATH.startsWith(additions.join(';'))) {
    process.env.PATH = `${additions.join(';')};${process.env.PATH}`;
  }

  // Absolute locations consumed by the Python engines and the autopilot renderer.
  process.env.TWS_MODELS_DIR = getModelsDir();
  const ffmpeg = getFFmpegPath();
  const ffprobe = getFFprobePath();
  if (path.isAbsolute(ffmpeg)) process.env.FFMPEG = ffmpeg;
  if (path.isAbsolute(ffprobe)) process.env.FFPROBE = ffprobe;
  // Never let the bundled Python pick up packages from the user's own site-packages.
  if (getPythonPath().includes(path.join('bin', 'python'))) process.env.PYTHONNOUSERSITE = '1';
  process.env.HF_HUB_OFFLINE = '1';
}

/**
 * Environment for child processes that re-use process.execPath as a Node runtime.
 * Inside Electron, process.execPath is the app executable; ELECTRON_RUN_AS_NODE makes
 * it behave as plain Node instead of opening a second application window.
 */
export function nodeChildEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = '1';
  return env;
}

/**
 * Writable per-user data directory (never inside the install folder).
 */
export function getDataDir() {
  const dir = process.env.TWS_DATA_DIR || path.join(ROOT, 'test_outputs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
