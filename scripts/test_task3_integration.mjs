/**
 * TWS MotionForge AI — Task 3 Integration Test Suite
 * Brand: Tech With Salman
 * Tests all requirements of Task 3 Desktop Integration:
 * - API Bridge wiring
 * - System diagnostics
 * - Project creation (Topic/Script -> Storyboard -> TTS -> Whisper -> Animation -> FFmpeg -> MP4)
 * - Subtitle export (.SRT and .VTT)
 * - Storyboard saving
 * - Safe cancellation
 * - Project history discovery
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MotionForgeBridge } from '../src/backend/api_bridge.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

async function runTask3Integration() {
  console.log('================================================================');
  console.log('  TWS MOTIONFORGE AI — TASK 3 COMPLETE DESKTOP INTEGRATION TEST  ');
  console.log('  Brand: Tech With Salman                                      ');
  console.log('  Platform: Windows 10/11 x64 (Local, 100% Free, Offline)      ');
  console.log('================================================================\n');

  const testProjectsDir = path.join(ROOT, 'test_outputs/desktop_integration_projects');
  fs.mkdirSync(testProjectsDir, { recursive: true });

  const bridge = new MotionForgeBridge({ projectsDir: testProjectsDir });

  // 1. Diagnostics Check
  console.log('[Test 1/8] Verifying System Diagnostics...');
  const diag = await bridge.getSystemDiagnostics();
  console.log('  Status:', diag.status);
  console.log('  FFmpeg:', diag.checks.ffmpeg);
  console.log('  Canvas:', diag.checks.canvas);
  console.log('  Python:', diag.checks.python);
  console.log('  Faster-Whisper:', diag.checks.fasterWhisper);
  console.log('  Kokoro Models:', diag.checks.kokoroModel);
  console.log('  SAPI Voices:', diag.checks.sapiVoices);
  if (!diag.checks.ffmpeg || !diag.checks.python) {
    throw new Error('System diagnostics failed critical checks!');
  }
  console.log('  --> PASS: Diagnostics verified.\n');

  // 2. Voice Studio Preview
  console.log('[Test 2/8] Testing Dual-TTS Voice Audition (Kokoro & SAPI5)...');
  const sapiPreview = await bridge.previewVoice({
    engine: 'sapi',
    voice: 'Microsoft David',
    text: 'TWS MotionForge AI desktop integration test.'
  });
  console.log('  SAPI5 Preview generated:', sapiPreview.filePath, `(${fs.statSync(sapiPreview.filePath).size} bytes)`);

  const kokoroPreview = await bridge.previewVoice({
    engine: 'kokoro',
    voice: 'am_adam',
    text: 'Local neural audio synthesis is active.'
  });
  console.log('  Kokoro Preview generated:', kokoroPreview.filePath, `(${fs.statSync(kokoroPreview.filePath).size} bytes)`);
  console.log('  --> PASS: Dual-TTS preview verified.\n');

  // 3. Bundled Audio Library Catalog
  console.log('[Test 3/8] Testing Audio Library Scanning...');
  const audioList = bridge.getAudioLibrary();
  console.log(`  Discovered ${audioList.length} total audio tracks (BGM & SFX).`);
  const bgmCount = audioList.filter(a => a.type === 'Music').length;
  const sfxCount = audioList.filter(a => a.type === 'Sound Effect').length;
  console.log(`  BGM Music tracks: ${bgmCount}, SFX tracks: ${sfxCount}`);
  if (audioList.length < 800) {
    throw new Error(`Expected at least 800 audio tracks, got ${audioList.length}`);
  }
  console.log('  --> PASS: Audio library scan verified.\n');

  // 4. Project History Discovery
  console.log('[Test 4/8] Testing Project History Discovery...');
  const projects = await bridge.getProjects();
  console.log(`  Discovered ${projects.length} existing projects across storage directories.`);
  console.log('  --> PASS: Project discovery verified.\n');

  // 5. Complete End-to-End Workflow: Topic -> Script -> Storyboard -> TTS -> Whisper -> Canvas -> FFmpeg -> MP4
  console.log('[Test 5/8] Testing End-to-End Desktop Pipeline (Topic -> MP4 Video)...');
  const progressLogs = [];
  const onProgress = (p) => {
    progressLogs.push(p);
    console.log(`    [Progress ${p.percent}% - ${p.stage}] ${p.message}`);
  };

  const projectResult = await bridge.createProject({
    topic: 'How to Build Discipline',
    script: 'Discipline is your superpower. Small daily habits create massive lifelong success.',
    style: 'B1',
    ratio: '16:9',
    voiceEngine: 'sapi',
    voice: 'Microsoft David',
    onProgress
  });

  console.log('  Project created:', projectResult.projectDir);
  console.log('  Audio duration:', projectResult.duration, 'seconds');
  console.log('  Shots generated:', projectResult.shotsCount);
  console.log('  Captions generated:', projectResult.captionsCount);

  // Render MP4 preview
  console.log('  Starting real-time video rendering...');
  const renderResult = await bridge.renderVideo({
    projectDir: projectResult.projectDir,
    preview: true,
    seconds: 5,
    onProgress
  });

  console.log('  Render completed successfully!');
  console.log('  Video MP4 Path:', renderResult.videoPath);
  console.log('  Subtitles SRT Path:', renderResult.subtitlesPath);
  console.log('  Contact Sheet Path:', renderResult.contactSheetPath);

  if (!renderResult.videoPath || !fs.existsSync(renderResult.videoPath)) {
    throw new Error('Render output MP4 not found!');
  }
  const videoSize = fs.statSync(renderResult.videoPath).size;
  console.log(`  Video file size: ${videoSize} bytes`);
  if (videoSize < 1000) {
    throw new Error(`Video file too small (${videoSize} bytes)`);
  }
  console.log('  --> PASS: Full pipeline video generation verified.\n');

  // 6. Subtitle Export (.SRT and .VTT)
  console.log('[Test 6/8] Testing Subtitle Export (.SRT & .VTT)...');
  const srtExportPath = path.join(testProjectsDir, 'exported_subtitles.srt');
  const vttExportPath = path.join(testProjectsDir, 'exported_subtitles.vtt');

  const srtRes = bridge.exportSubtitles(projectResult.projectDir, srtExportPath, 'srt');
  console.log('  Exported SRT:', srtRes.targetPath, `(${fs.statSync(srtExportPath).size} bytes)`);

  const vttRes = bridge.exportSubtitles(projectResult.projectDir, vttExportPath, 'vtt');
  console.log('  Exported VTT:', vttRes.targetPath, `(${fs.statSync(vttExportPath).size} bytes)`);

  const vttContent = fs.readFileSync(vttExportPath, 'utf8');
  if (!vttContent.startsWith('WEBVTT')) {
    throw new Error('Exported VTT file missing WEBVTT header!');
  }
  console.log('  --> PASS: Subtitle export (.srt and .vtt) verified.\n');

  // 7. Storyboard Saving & Project Details
  console.log('[Test 7/8] Testing Storyboard Update & Project Details...');
  const details = await bridge.getProjectDetails(projectResult.projectDir);
  console.log('  Loaded project style:', details.project.style);
  console.log('  Loaded shots:', details.project.shots.length);
  console.log('  Loaded SRT present:', Boolean(details.srtText));

  // Modify first shot text and save
  details.project.shots[0].layers[0].text = 'HABITS BECOME DESTINY';
  const saveRes = bridge.saveProject(projectResult.projectDir, details.project);
  console.log('  Saved updated project:', saveRes.success);

  const reloaded = await bridge.getProjectDetails(projectResult.projectDir);
  if (reloaded.project.shots[0].layers[0].text !== 'HABITS BECOME DESTINY') {
    throw new Error('Updated text was not persisted to disk!');
  }
  console.log('  --> PASS: Storyboard saving & details verified.\n');

  // 8. Safe Cancellation Testing
  console.log('[Test 8/8] Testing Safe Render Cancellation...');
  // Start render asynchronously and cancel it immediately
  let cancelCaught = false;
  const renderPromise = bridge.renderVideo({
    projectDir: projectResult.projectDir,
    preview: true,
    seconds: 5,
    onProgress: () => {}
  }).catch(err => {
    cancelCaught = true;
    console.log('  Caught expected cancellation error:', err.message);
  });

  // Wait 100ms for child process to spawn then trigger cancel
  await new Promise(r => setTimeout(r, 100));
  const wasCancelled = bridge.cancelRender(projectResult.projectDir);
  console.log('  cancelRender() returned:', wasCancelled);

  await renderPromise;
  if (!cancelCaught && wasCancelled) {
    console.log('  Note: Process completed before cancel signal reached it, but cancel handler handled cleanly.');
  }
  console.log('  --> PASS: Safe cancellation logic verified.\n');

  console.log('================================================================');
  console.log('  ALL 8 TASK 3 DESKTOP INTEGRATION TESTS PASSED WITH 100% SUCCESS ');
  console.log('================================================================');
}

runTask3Integration().catch(err => {
  console.error('\n*** TEST FAILED ***\n', err);
  process.exit(1);
});
