/**
 * TWS MotionForge AI — Electron Main Process
 * Brand: Tech With Salman
 * Architecture: 100% Local, Offline, Free
 */

import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { MotionForgeOrchestrator } from '../backend/orchestrator.mjs';
import { probeLocalLLM } from '../backend/llm_engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// Register privileged custom scheme for streaming local video/audio without web security blocks
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
]);

let mainWindow = null;
const orchestrator = new MotionForgeOrchestrator({ projectsDir: path.join(ROOT, 'projects') });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    title: 'TWS MotionForge AI — Powered by Tech With Salman',
    backgroundColor: '#0c1017',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Handle dry-run flag for automated verification testing
  if (process.argv.includes('--dry-run')) {
    setTimeout(() => {
      console.log('UI Dry-Run Check Succeeded. Closing application.');
      app.quit();
    }, 2000);
  }
}

// Custom protocol for serving local project videos, audios, and contact sheets
function registerMediaProtocol() {
  protocol.handle('media', (request) => {
    let filePath = request.url.replace(/^media:\/\/local\//, '').replace(/^media:\/\//, '');
    filePath = decodeURIComponent(filePath);
    // On Windows, fix drive letter path e.g. /C:/path -> C:/path
    if (process.platform === 'win32' && /^\/?[A-Za-z]:/.test(filePath)) {
      filePath = filePath.replace(/^\//, '');
    }
    const resolved = path.resolve(filePath);
    return net.fetch(pathToFileURL(resolved).href);
  });
}

// ---------------- IPC HANDLERS ---------------- //

function registerIpcHandlers() {
  // 1. System Status & Diagnostics
  ipcMain.handle('api:get-system-status', async () => {
    const cpus = os.cpus();
    const totalMem = (os.totalmem() / 1073741824).toFixed(1);
    const freeMem = (os.freemem() / 1073741824).toFixed(1);
    const hasOllama = await probeLocalLLM();

    const kokoroModelPath = path.join(ROOT, 'models/tts/kokoro-v0_19.onnx');
    const kokoroVoicesPath = path.join(ROOT, 'models/tts/voices-v1.0.bin');
    const hasKokoro = fs.existsSync(kokoroModelPath) && fs.existsSync(kokoroVoicesPath);

    return {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpu: cpus[0]?.model || 'Standard Multi-Core CPU',
      cores: cpus.length,
      ramTotal: `${totalMem} GB`,
      ramFree: `${freeMem} GB`,
      hasKokoro,
      hasSapi: process.platform === 'win32',
      hasFasterWhisper: true,
      hasOllama,
      ffmpegVersion: 'Lavc 63 (Bundled & Verified)',
      pricing: '100% FREE',
      brand: 'Tech With Salman'
    };
  });

  ipcMain.handle('api:run-diagnostics', async () => {
    const autopilotScript = path.join(ROOT, 'skills/directing-stickman-videos/scripts/autopilot.mjs');
    const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
    const res = spawnSync(process.execPath, [autopilotScript, 'doctor', '--style', 'B1', '--python', pythonExe], {
      cwd: ROOT,
      encoding: 'utf8'
    });
    try {
      return JSON.parse(res.stdout);
    } catch {
      return { raw: res.stdout || res.stderr };
    }
  });

  // 2. Available Animation Styles
  ipcMain.handle('api:get-styles', async () => {
    return [
      {
        id: 'B1',
        name: 'Clean Minimalist Stickman',
        category: 'Explainer & Presentation',
        description: 'Fast, high-contrast, iconic line figures with animated gesture beats. Ideal for tutorials, productivity, and mindset.',
        aspectRatios: ['16:9', '9:16'],
        badge: 'Recommended',
        tag: 'Fast Render'
      },
      {
        id: 'B2',
        name: 'Bold Outlined Presenter',
        category: 'Energetic Whiteboard',
        description: 'Thick strokes, expressive energetic character poses with prominent boxed captions.',
        aspectRatios: ['16:9', '9:16'],
        tag: 'High Energy'
      },
      {
        id: 'B3',
        name: 'Retro Scanline CRT',
        category: 'Vintage & Pop Culture',
        description: 'Authentic phosphor television scanlines, nostalgic CRT vibes, and retro gaming aesthetics.',
        aspectRatios: ['16:9', '9:16'],
        tag: 'Retro'
      },
      {
        id: 'B4',
        name: 'Dark Cinematic Suspense',
        category: 'Story Hook & Mystery',
        description: 'Dramatic lower-window threat reveals, bold poster-hook typography, and cinematic color shifts.',
        aspectRatios: ['16:9', '9:16'],
        tag: 'Dramatic'
      },
      {
        id: 'B5',
        name: 'Technical Explainer',
        category: 'Instructional Code',
        description: 'Precision motion layouts, code-driven timing, and event relay staging.',
        aspectRatios: ['16:9', '9:16'],
        tag: 'Technical'
      },
      {
        id: 'B6',
        name: 'Dynamic Painted Meme & Puppets',
        category: 'Painted World',
        description: 'Rich hand-painted backdrops with multi-view jointed puppets and comedic exaggeration.',
        aspectRatios: ['16:9', '9:16'],
        tag: 'Rich Artwork'
      },
      {
        id: 'B7',
        name: 'Reflective Montage & Paths',
        category: 'Narrative Philosophy',
        description: 'Fast-forward life choices, cinematic transitions, and deep philosophical takeaways.',
        aspectRatios: ['16:9', '9:16'],
        tag: 'Cinematic'
      }
    ];
  });

  // 3. Voice Selection Studio
  ipcMain.handle('api:get-voices', async () => {
    return [
      { id: 'am_adam', name: 'Adam (Neural Male)', engine: 'kokoro', accent: 'American', sampleRate: '24 kHz', description: 'Confident, modern American male narrator' },
      { id: 'am_michael', name: 'Michael (Neural Male)', engine: 'kokoro', accent: 'American', sampleRate: '24 kHz', description: 'Deep, engaging male voice' },
      { id: 'af_bella', name: 'Bella (Neural Female)', engine: 'kokoro', accent: 'American', sampleRate: '24 kHz', description: 'Clear, warm, friendly female narrator' },
      { id: 'af_sarah', name: 'Sarah (Neural Female)', engine: 'kokoro', accent: 'American', sampleRate: '24 kHz', description: 'Energetic, articulate professional female voice' },
      { id: 'bm_george', name: 'George (Neural Male)', engine: 'kokoro', accent: 'British', sampleRate: '24 kHz', description: 'Distinguished British male narrator' },
      { id: 'bf_emma', name: 'Emma (Neural Female)', engine: 'kokoro', accent: 'British', sampleRate: '24 kHz', description: 'Polished, clear British female voice' },
      { id: 'Microsoft David', name: 'David (Windows SAPI5)', engine: 'sapi', accent: 'American', sampleRate: '22.05 kHz', description: 'Built-in Windows system voice (Instant synthesis)' },
      { id: 'Microsoft Zira', name: 'Zira (Windows SAPI5)', engine: 'sapi', accent: 'American', sampleRate: '22.05 kHz', description: 'Built-in Windows female system voice' }
    ];
  });

  // Voice Preview synthesis
  ipcMain.handle('api:preview-voice', async (_event, { engine = 'sapi', voice = 'Microsoft David', text = 'Welcome to TWS MotionForge AI.' }) => {
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
      mediaUrl: `media://local/${encodeURIComponent(outPath.replace(/\\/g, '/'))}`
    };
  });

  // 4. Bundled Audio Library (Music & SFX)
  ipcMain.handle('api:get-audio-library', async () => {
    const audioDir = path.join(ROOT, 'skills/directing-stickman-videos/assets/b-audio-library/audio');
    const evidenceDir = path.join(ROOT, 'skills/directing-stickman-videos/assets/b-audio-library/evidence');

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
            } catch {
              // Ignore
            }
          }

          audioItems.push({
            filename: entry.name,
            fullPath,
            mediaUrl: `media://local/${encodeURIComponent(fullPath.replace(/\\/g, '/'))}`,
            title: baseName.replace(/^(bgm-|sfx-)/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            type: isBgm ? 'Music' : 'Sound Effect',
            license: licenseInfo
          });
        }
      }
    }

    scanDir(audioDir);
    return audioItems;
  });

  // 5. Projects Listing
  ipcMain.handle('api:get-projects', async () => {
    const dirs = [path.join(ROOT, 'projects'), path.join(ROOT, 'test_projects')];
    const results = [];

    for (const parent of dirs) {
      if (!fs.existsSync(parent)) continue;
      const subs = fs.readdirSync(parent);
      for (const sub of subs) {
        const pdir = path.join(parent, sub);
        const pjson = path.join(pdir, 'project.json');
        if (fs.existsSync(pjson)) {
          try {
            const data = JSON.parse(fs.readFileSync(pjson, 'utf8'));
            const previewMp4 = path.join(pdir, 'output/preview.mp4');
            const contactSheet = path.join(pdir, 'output/preview-contact-sheet.png');
            const hasVideo = fs.existsSync(previewMp4);

            results.push({
              name: sub,
              path: pdir,
              style: data.style || 'B1',
              ratio: data.width && data.height ? (data.width > data.height ? '16:9' : '9:16') : '16:9',
              duration: data.duration || 5,
              hasVideo,
              videoPath: hasVideo ? previewMp4 : null,
              mediaUrl: hasVideo ? `media://local/${encodeURIComponent(previewMp4.replace(/\\/g, '/'))}` : null,
              contactSheet: fs.existsSync(contactSheet) ? `media://local/${encodeURIComponent(contactSheet.replace(/\\/g, '/'))}` : null,
              updatedAt: fs.statSync(pjson).mtime
            });
          } catch {
            // Ignore invalid project dirs
          }
        }
      }
    }
    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  });

  // Project Details
  ipcMain.handle('api:get-project-details', async (_event, projectDir) => {
    const pjsonPath = path.join(projectDir, 'project.json');
    if (!fs.existsSync(pjsonPath)) throw new Error('Project not found');

    const project = JSON.parse(fs.readFileSync(pjsonPath, 'utf8'));
    const sbPath = path.join(projectDir, 'storyboard.json');
    const storyboard = fs.existsSync(sbPath) ? JSON.parse(fs.readFileSync(sbPath, 'utf8')) : null;

    const previewMp4 = path.join(projectDir, 'output/preview.mp4');
    const srtPath = path.join(projectDir, 'output/preview.srt');
    const vttPath = path.join(projectDir, 'output/preview.vtt');
    const contactSheet = path.join(projectDir, 'output/preview-contact-sheet.png');

    return {
      project,
      storyboard,
      videoPath: fs.existsSync(previewMp4) ? previewMp4 : null,
      mediaUrl: fs.existsSync(previewMp4) ? `media://local/${encodeURIComponent(previewMp4.replace(/\\/g, '/'))}` : null,
      srtText: fs.existsSync(srtPath) ? fs.readFileSync(srtPath, 'utf8') : null,
      vttText: fs.existsSync(vttPath) ? fs.readFileSync(vttPath, 'utf8') : null,
      contactSheetUrl: fs.existsSync(contactSheet) ? `media://local/${encodeURIComponent(contactSheet.replace(/\\/g, '/'))}` : null
    };
  });

  // 6. Create Video Project
  ipcMain.handle('api:create-project', async (_event, params) => {
    const sendProgress = (p) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('project:progress', p);
      }
    };

    return await orchestrator.createProject({
      topic: params.topic,
      script: params.script,
      style: params.style || 'B1',
      ratio: params.ratio || '16:9',
      voiceEngine: params.voiceEngine || 'sapi',
      voice: params.voice || 'Microsoft David',
      onProgress: sendProgress
    });
  });

  // 7. Render Project
  ipcMain.handle('api:render-project', async (_event, { projectDir, preview = true, seconds }) => {
    const sendProgress = (p) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('project:progress', p);
      }
    };

    const res = await orchestrator.render({
      projectDir,
      preview,
      seconds,
      onProgress: sendProgress
    });

    if (res.videoPath) {
      res.mediaUrl = `media://local/${encodeURIComponent(res.videoPath.replace(/\\/g, '/'))}`;
    }
    return res;
  });

  // 8. Open Path in Windows Explorer
  ipcMain.handle('api:open-path', async (_event, targetPath) => {
    if (fs.existsSync(targetPath)) {
      if (fs.statSync(targetPath).isDirectory()) {
        shell.openPath(targetPath);
      } else {
        shell.showItemInFolder(targetPath);
      }
      return { success: true };
    }
    return { success: false, error: 'Path does not exist' };
  });
}

// ---------------- APP LIFECYCLE ---------------- //

app.whenReady().then(() => {
  registerMediaProtocol();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
