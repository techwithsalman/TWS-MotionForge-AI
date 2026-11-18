import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve('.');
const targetDir = path.join(ROOT, 'bin', 'python');
fs.mkdirSync(targetDir, { recursive: true });

// Locate system python 3.11
const pyRes = spawnSync('python', ['-c', 'import sys; print(sys.prefix)'], { encoding: 'utf8' });
if (pyRes.status !== 0) {
  console.error('Cannot find python:', pyRes.stderr);
  process.exit(1);
}
const pyRoot = pyRes.stdout.trim();
console.log('Source Python:', pyRoot);
console.log('Target portable dir:', targetDir);

// 1. Copy base executables and DLLs
const baseFiles = fs.readdirSync(pyRoot).filter(f => /^(python.*\.exe|python.*\.dll|vcruntime.*\.dll)$/i.test(f));
for (const file of baseFiles) {
  fs.copyFileSync(path.join(pyRoot, file), path.join(targetDir, file));
  console.log('Copied base file:', file);
}

// 2. Robocopy DLLs
console.log('Copying DLLs...');
spawnSync('robocopy', [path.join(pyRoot, 'DLLs'), path.join(targetDir, 'DLLs'), '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS'], { stdio: 'inherit' });

// 3. Robocopy Lib
console.log('Copying Lib...');
spawnSync('robocopy', [
  path.join(pyRoot, 'Lib'),
  path.join(targetDir, 'Lib'),
  '/E',
  '/XD', '__pycache__', 'test', 'tests', 'distutils', 'idlelib', 'tkinter', 'turtledemo',
  '/XF', '*.pyc',
  '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS'
], { stdio: 'inherit' });

console.log('Validating portable Python...');
const testRes = spawnSync(path.join(targetDir, 'python.exe'), [
  '-c',
  'import numpy, PIL, cv2, pyttsx3, faster_whisper, onnxruntime, soundfile; print("PORTABLE PYTHON SUCCESS")'
], { encoding: 'utf8' });

console.log('Test result:', testRes.stdout || testRes.stderr);
if (!testRes.stdout.includes('PORTABLE PYTHON SUCCESS')) {
  throw new Error('Portable python validation failed!');
}
console.log('Portable Python runtime successfully assembled and verified in bin/python!');
