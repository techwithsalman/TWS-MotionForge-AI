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

  if (additions.length > 0) {
    process.env.PATH = `${additions.join(';')};${process.env.PATH}`;
  }
}
