import { MotionForgeOrchestrator } from '../src/backend/orchestrator.mjs';
import fs from 'node:fs';

async function runTest() {
  const orchestrator = new MotionForgeOrchestrator({ projectsDir: 'test_projects' });
  console.log('Testing 9:16 Portrait Project Creation (YouTube Shorts)...');
  const res = await orchestrator.createProject({
    topic: 'Focus On What Matters Most',
    style: 'B1',
    ratio: '9:16',
    voiceEngine: 'sapi',
    voice: 'Microsoft David',
    onProgress: (p) => console.log(`[${p.percent}%] ${p.stage}: ${p.message}`)
  });
  console.log('Project created at:', res.projectDir);

  console.log('\nTesting 9:16 Portrait Preview Render (5s)...');
  const renderRes = await orchestrator.render({
    projectDir: res.projectDir,
    preview: true,
    seconds: 5,
    onProgress: (p) => console.log(`[${p.percent}%] ${p.stage}: ${p.message}`)
  });

  console.log('\n9:16 Portrait Render Complete!');
  console.log('Output Video:', renderRes.previewVideo);
}

runTest().catch(e => { console.error('Test failed:', e); process.exit(1); });
