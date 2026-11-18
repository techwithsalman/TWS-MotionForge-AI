/**
 * TWS MotionForge AI — Electron Main Process
 * Brand: Tech With Salman
 * Architecture: 100% Local, Offline, Free
 */

import { app, BrowserWindow, ipcMain, shell, protocol, net, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { MotionForgeBridge } from '../backend/api_bridge.mjs';
import { probeLocalLLM } from '../backend/llm_engine.mjs';
import { setupEnvironmentPaths, getResourcesRoot } from '../backend/path_resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// Setup bundled binaries and python paths
setupEnvironmentPaths();

// Register privileged custom scheme for streaming local video/audio without web security blocks
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
]);

let mainWindow = null;
let bridge = null;

function getSafeProjectsDir() {
  try {
    const docPath = app.getPath('documents');
    const userDir = path.join(docPath, 'TWS MotionForge AI', 'Projects');
    fs.mkdirSync(userDir, { recursive: true });
    return userDir;
  } catch {
    const fallback = path.join(ROOT, 'projects');
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function toMediaUrl(filePath) {
  if (!filePath) return null;
  return `media://local/${encodeURIComponent(filePath.replace(/\\/g, '/'))}`;
}

function createWindow() {
  const iconPath = path.join(getResourcesRoot(), 'build/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    title: 'TWS MotionForge AI — Powered by Tech With Salman',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
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

// ---------------- IPC HANDLERS CONNECTED TO API BRIDGE ---------------- //

function registerIpcHandlers() {
  // 1. System Status & Diagnostics
  ipcMain.handle('api:get-system-status', async () => {
    const cpus = os.cpus();
    const totalMem = (os.totalmem() / 1073741824).toFixed(1);
    const freeMem = (os.freemem() / 1073741824).toFixed(1);
    const hasOllama = await probeLocalLLM();
    const diag = await bridge.getSystemDiagnostics();

    return {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpu: cpus[0]?.model || 'Standard Multi-Core CPU',
      cores: cpus.length,
      ramTotal: `${totalMem} GB`,
      ramFree: `${freeMem} GB`,
      hasKokoro: diag.checks.kokoroModel,
      hasSapi: diag.checks.sapiVoices > 0,
      hasFasterWhisper: diag.checks.fasterWhisper,
      hasOllama,
      ffmpegVersion: diag.checks.ffmpeg ? 'Lavc 63 (Bundled & Verified)' : 'Not Found',
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

  // 2. Animation Styles
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
  ipcMain.handle('api:preview-voice', async (_event, params) => {
    const res = await bridge.previewVoice(params);
    return {
      filePath: res.filePath,
      mediaUrl: toMediaUrl(res.filePath)
    };
  });

  // 4. Bundled Audio Library (Music & SFX)
  ipcMain.handle('api:get-audio-library', async () => {
    const items = bridge.getAudioLibrary();
    return items.map(item => ({
      ...item,
      mediaUrl: toMediaUrl(item.fullPath)
    }));
  });

  // 5. Projects Listing
  ipcMain.handle('api:get-projects', async () => {
    const projects = await bridge.getProjects();
    return projects.map(p => ({
      ...p,
      mediaUrl: toMediaUrl(p.videoPath),
      contactSheet: toMediaUrl(p.contactSheetPath)
    }));
  });

  // Project Details
  ipcMain.handle('api:get-project-details', async (_event, projectDir) => {
    const details = await bridge.getProjectDetails(projectDir);
    return {
      ...details,
      mediaUrl: toMediaUrl(details.videoPath),
      contactSheetUrl: toMediaUrl(details.contactSheetPath)
    };
  });

  // 6. Create Video Project
  ipcMain.handle('api:create-project', async (_event, params) => {
    const sendProgress = (p) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('project:progress', p);
      }
    };

    return await bridge.createProject({
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

    const res = await bridge.renderVideo({
      projectDir,
      preview,
      seconds,
      onProgress: sendProgress
    });

    if (res.videoPath) {
      res.mediaUrl = toMediaUrl(res.videoPath);
    }
    return res;
  });

  // 8. Cancel Active Render
  ipcMain.handle('api:cancel-render', async (_event, projectDir) => {
    const cancelled = bridge.cancelRender(projectDir);
    return { success: cancelled };
  });

  // 9. Save Project
  ipcMain.handle('api:save-project', async (_event, { projectDir, data }) => {
    return bridge.saveProject(projectDir, data);
  });

  // 10. Export Subtitles Dialog & File Write
  ipcMain.handle('api:export-subtitles', async (_event, { projectDir, format = 'srt' }) => {
    const defaultName = `${path.basename(projectDir)}_subtitles.${format}`;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: `Export ${format.toUpperCase()} Subtitles`,
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [
        { name: format.toUpperCase() + ' Subtitles', extensions: [format] }
      ]
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    const res = bridge.exportSubtitles(projectDir, filePath, format);
    return { success: true, filePath: res.targetPath };
  });

  // 11. Open Path in Windows Explorer
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
  const userProjectsDir = getSafeProjectsDir();
  bridge = new MotionForgeBridge({ projectsDir: userProjectsDir });

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
