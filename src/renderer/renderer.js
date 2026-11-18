/**
 * TWS MotionForge AI — Desktop Renderer Script
 * Brand: Tech With Salman
 */

// Global state
let currentProject = null;
let currentVoices = [];
let currentStyles = [];
let audioTrackPlayer = new Audio();

document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupCreationForm();
  await loadSystemStatus();
  await loadVoices();
  await loadStyles();
  await loadAudioLibrary();
  await loadProjectsHistory();
  setupDiagnostics();
});

// 1. Navigation & Tabs
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Header and Dashboard Quick Action buttons
  document.getElementById('btnQuickCreate')?.addEventListener('click', () => switchTab('tab-create'));
  document.getElementById('btnStartCreation')?.addEventListener('click', () => switchTab('tab-create'));
  document.getElementById('btnExploreStyles')?.addEventListener('click', () => switchTab('tab-styles'));
  document.getElementById('btnViewAllProjects')?.addEventListener('click', () => switchTab('tab-projects'));
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const activeBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  const activePane = document.getElementById(tabId);

  if (activeBtn) activeBtn.classList.add('active');
  if (activePane) activePane.classList.add('active');
}

// 2. System Status Initialization
async function loadSystemStatus() {
  try {
    const status = await window.api.getSystemStatus();
    document.getElementById('healthText').textContent = 'All Local Engines Ready';
    document.getElementById('specOs').textContent = status.os;
    document.getElementById('specCpu').textContent = status.cpu;
    document.getElementById('specCores').textContent = `${status.cores} Cores`;
    document.getElementById('specRamTotal').textContent = status.ramTotal;
    document.getElementById('specRamFree').textContent = status.ramFree;

    document.getElementById('specKokoro').textContent = status.hasKokoro ? 'Loaded (v0.19 ONNX)' : 'Ready';
    document.getElementById('specKokoro').className = 'badge badge-success';

    document.getElementById('specSapi').textContent = status.hasSapi ? 'Available (SAPI5)' : 'Unavailable';
    document.getElementById('specSapi').className = status.hasSapi ? 'badge badge-success' : 'badge';

    document.getElementById('specWhisper').textContent = 'Loaded (CTranslate2 INT8)';
    document.getElementById('specWhisper').className = 'badge badge-success';

    document.getElementById('specOllama').textContent = status.hasOllama ? 'Active (localhost:11434)' : 'Offline (Rule Fallback Active)';
    document.getElementById('specOllama').className = status.hasOllama ? 'badge badge-success' : 'badge';
  } catch (err) {
    console.error('Failed to load system status:', err);
  }
}

// 3. Voices Studio & Dynamic Selector
async function loadVoices() {
  try {
    currentVoices = await window.api.getVoices();
    renderVoiceOptions();
    renderVoiceStudioGrid();
  } catch (err) {
    console.error('Failed to load voices:', err);
  }
}

function renderVoiceOptions() {
  const engineSelect = document.getElementById('selectVoiceEngine');
  const voiceSelect = document.getElementById('selectVoiceName');
  if (!engineSelect || !voiceSelect) return;

  const currentEngine = engineSelect.value;
  const filtered = currentVoices.filter(v => v.engine === currentEngine);

  voiceSelect.innerHTML = '';
  filtered.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.name} (${v.accent})`;
    voiceSelect.appendChild(opt);
  });
}

function renderVoiceStudioGrid() {
  const grid = document.getElementById('voicesStudioGrid');
  if (!grid) return;

  grid.innerHTML = '';
  currentVoices.forEach(v => {
    const card = document.createElement('div');
    card.className = 'voice-card';
    card.innerHTML = `
      <div class="voice-card-header">
        <div>
          <div class="voice-name">${v.name}</div>
          <span class="badge ${v.engine === 'kokoro' ? 'badge-success' : ''}">${v.engine.toUpperCase()} • ${v.sampleRate}</span>
        </div>
      </div>
      <div class="voice-desc">${v.description}</div>
      <div class="voice-actions">
        <button class="btn btn-secondary btn-sm btn-play-voice" data-engine="${v.engine}" data-voice="${v.id}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          Audition Voice
        </button>
        <button class="btn btn-primary btn-sm btn-select-voice" data-engine="${v.engine}" data-voice="${v.id}">
          Use in Project
        </button>
      </div>
    `;

    card.querySelector('.btn-play-voice').addEventListener('click', () => {
      auditionVoice(v.engine, v.id, `Hello! This is ${v.name} speaking locally from TWS MotionForge AI.`);
    });

    card.querySelector('.btn-select-voice').addEventListener('click', () => {
      document.getElementById('selectVoiceEngine').value = v.engine;
      renderVoiceOptions();
      document.getElementById('selectVoiceName').value = v.id;
      switchTab('tab-create');
    });

    grid.appendChild(card);
  });
}

async function auditionVoice(engine, voice, text) {
  const card = document.getElementById('audioPreviewCard');
  const player = document.getElementById('auditionAudioPlayer');
  const meta = document.getElementById('auditionMeta');

  if (meta) meta.textContent = `Synthesizing ${voice}...`;
  if (card) card.style.display = 'block';

  try {
    const res = await window.api.previewVoice({ engine, voice, text });
    player.src = res.mediaUrl;
    player.play();
    if (meta) meta.textContent = `Playing preview: ${voice} (${engine.toUpperCase()})`;
  } catch (err) {
    if (meta) meta.textContent = `Error: ${err.message}`;
  }
}

// 4. Styles View & Selector
async function loadStyles() {
  try {
    currentStyles = await window.api.getStyles();
    const grid = document.getElementById('stylesOverviewGrid');
    if (!grid) return;

    grid.innerHTML = '';
    currentStyles.forEach(s => {
      const card = document.createElement('div');
      card.className = 'style-card';
      card.innerHTML = `
        <div class="style-header">
          <span class="style-name">${s.id} — ${s.name}</span>
          <span class="badge ${s.badge ? 'badge-success' : ''}">${s.tag}</span>
        </div>
        <div class="style-desc">${s.description}</div>
        <div class="style-footer">
          <span>Ratios: ${s.aspectRatios.join(', ')}</span>
          <button class="btn btn-secondary btn-sm btn-choose-style" data-style="${s.id}">Select Style</button>
        </div>
      `;

      card.querySelector('.btn-choose-style').addEventListener('click', () => {
        document.getElementById('selectStyle').value = s.id;
        switchTab('tab-create');
      });

      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load styles:', err);
  }
}

// 5. Audio Library View
async function loadAudioLibrary() {
  try {
    const tracks = await window.api.getAudioLibrary();
    const tbody = document.getElementById('audioTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    tracks.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <button class="btn btn-secondary btn-sm btn-play-track" data-url="${t.mediaUrl}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Play
          </button>
        </td>
        <td><strong>${t.title}</strong></td>
        <td><span class="badge">${t.type}</span></td>
        <td style="font-size: 11px; color: var(--text-muted);">${t.license}</td>
      `;

      tr.querySelector('.btn-play-track').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        if (audioTrackPlayer.src === t.mediaUrl && !audioTrackPlayer.paused) {
          audioTrackPlayer.pause();
          btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Play`;
        } else {
          audioTrackPlayer.src = t.mediaUrl;
          audioTrackPlayer.play();
          document.querySelectorAll('.btn-play-track').forEach(b => {
            b.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Play`;
          });
          btn.innerHTML = `Pause`;
        }
      });

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load audio library:', err);
  }
}

// 6. Project History & Recent Projects
async function loadProjectsHistory() {
  try {
    const projects = await window.api.getProjects();
    const statEl = document.getElementById('statTotalProjects');
    if (statEl) statEl.textContent = projects.length;

    renderRecentProjectsDashboard(projects.slice(0, 6));
    renderProjectsManagerList(projects);
  } catch (err) {
    console.error('Failed to load projects:', err);
  }
}

function renderRecentProjectsDashboard(projects) {
  const container = document.getElementById('dashboardRecentProjects');
  if (!container) return;

  if (projects.length === 0) {
    container.innerHTML = '<div class="empty-state">No projects yet. Click "Create New Video" to begin!</div>';
    return;
  }

  container.innerHTML = '';
  projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="project-card-header">
        <span class="project-card-title">${p.name}</span>
        <span class="badge ${p.hasVideo ? 'badge-success' : ''}">${p.hasVideo ? 'Rendered MP4' : 'Draft'}</span>
      </div>
      <div class="project-card-meta">
        <span>Style: ${p.style}</span>
        <span>${p.ratio}</span>
        <span>${p.duration}s</span>
      </div>
      <button class="btn btn-secondary btn-sm" style="margin-top: 8px;">Open in Player</button>
    `;

    card.addEventListener('click', () => loadProjectIntoPlayer(p.path));
    container.appendChild(card);
  });
}

function renderProjectsManagerList(projects) {
  const list = document.getElementById('projectsHistoryList');
  if (!list) return;

  if (projects.length === 0) {
    list.innerHTML = '<div class="empty-state">No projects found.</div>';
    return;
  }

  list.innerHTML = '';
  projects.forEach(p => {
    const row = document.createElement('div');
    row.className = 'project-card';
    row.style.marginBottom = '12px';
    row.innerHTML = `
      <div class="project-card-header">
        <div>
          <h4 style="margin: 0 0 4px; color: #fff;">${p.name}</h4>
          <span class="text-muted" style="font-size: 11px;">Path: ${p.path}</span>
        </div>
        <span class="badge ${p.hasVideo ? 'badge-success' : ''}">${p.hasVideo ? 'Rendered' : 'Scaffolded'}</span>
      </div>
      <div class="form-actions" style="margin-top: 8px;">
        <button class="btn btn-secondary btn-sm btn-open-folder" data-path="${p.path}">Open Folder</button>
        <button class="btn btn-primary btn-sm btn-open-player" data-path="${p.path}">Load in Player</button>
      </div>
    `;

    row.querySelector('.btn-open-folder').addEventListener('click', (e) => {
      e.stopPropagation();
      window.api.openPath(p.path);
    });

    row.querySelector('.btn-open-player').addEventListener('click', (e) => {
      e.stopPropagation();
      loadProjectIntoPlayer(p.path);
    });

    list.appendChild(row);
  });
}

// 7. Video Player Integration
async function loadProjectIntoPlayer(projectDir) {
  try {
    const details = await window.api.getProjectDetails(projectDir);
    currentProject = { projectDir, ...details };

    document.getElementById('playerProjectName').textContent = pathBasename(projectDir);
    document.getElementById('playerStyleBadge').textContent = details.project.style || 'B1';
    document.getElementById('playerRatio').textContent = `${details.project.width || 1280}x${details.project.height || 720}`;
    document.getElementById('playerDuration').textContent = `${details.project.duration || 5}s`;
    document.getElementById('playerResolution').textContent = details.project.width > details.project.height ? '16:9 Landscape' : '9:16 Portrait';

    const videoEl = document.getElementById('mainVideoPlayer');
    if (details.mediaUrl) {
      videoEl.src = details.mediaUrl;
      videoEl.load();
    }

    const subBox = document.getElementById('playerSubtitlesBox');
    if (details.srtText) {
      subBox.innerHTML = `<pre style="font-size: 11px; color: #a5f3fc; white-space: pre-wrap;">${details.srtText}</pre>`;
    } else {
      subBox.innerHTML = '<p class="placeholder-text">No subtitle file found for this project.</p>';
    }

    const csCard = document.getElementById('contactSheetCard');
    const csImg = document.getElementById('playerContactSheetImg');
    if (details.contactSheetUrl) {
      csImg.src = details.contactSheetUrl;
      csCard.style.display = 'block';
    } else {
      csCard.style.display = 'none';
    }

    renderStoryboardView(details.storyboard || details.project);
    switchTab('tab-player');
  } catch (err) {
    alert(`Could not load project: ${err.message}`);
  }
}

// 8. Storyboard Studio View
function renderStoryboardView(data) {
  const container = document.getElementById('storyboardContainer');
  if (!container) return;

  const shots = data.shots || [];
  if (shots.length === 0) {
    container.innerHTML = '<div class="empty-state">No shot breakdown found in this project.</div>';
    return;
  }

  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h3 style="color: #fff; margin-bottom: 4px;">${data.title || 'Project Storyboard'}</h3>
      <p style="color: var(--text-muted); font-size: 13px;">${data.script || 'Custom Script Storyboard'}</p>
    </div>
    <div class="shots-timeline-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
      ${shots.map((s, i) => `
        <div class="card" style="border-left: 3px solid var(--accent-primary);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong style="color: #60a5fa;">Shot ${i + 1} (${s.beat || 'Beat'})</strong>
            <span class="badge">${s.duration ? s.duration + 's' : (s.end - s.start) + 's'}</span>
          </div>
          <p style="font-size: 13px; color: #fff; margin-bottom: 8px;">"${s.text || 'Visual gesture'}"</p>
          <div style="font-size: 11px; color: var(--text-muted);">
            <div><strong>Pose:</strong> ${s.suggested_pose || 'Dynamic Actor'}</div>
            <div><strong>SFX:</strong> ${s.sfx_hint || 'Ambient'}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// 9. Video Creation Wizard
function setupCreationForm() {
  const btnTopic = document.getElementById('btnModeTopic');
  const btnScript = document.getElementById('btnModeScript');
  const groupTopic = document.getElementById('groupTopic');
  const groupScript = document.getElementById('groupScript');
  const engineSelect = document.getElementById('selectVoiceEngine');
  const ratioCards = document.querySelectorAll('.ratio-card');

  btnTopic?.addEventListener('click', () => {
    btnTopic.classList.add('active');
    btnScript.classList.remove('active');
    groupTopic.classList.remove('hidden');
    groupScript.classList.add('hidden');
  });

  btnScript?.addEventListener('click', () => {
    btnScript.classList.add('active');
    btnTopic.classList.remove('active');
    groupScript.classList.remove('hidden');
    groupTopic.classList.add('hidden');
  });

  engineSelect?.addEventListener('change', () => {
    renderVoiceOptions();
  });

  ratioCards.forEach(card => {
    card.addEventListener('click', () => {
      ratioCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      card.querySelector('input').checked = true;
    });
  });

  document.getElementById('btnAuditionCurrentVoice')?.addEventListener('click', () => {
    const engine = document.getElementById('selectVoiceEngine').value;
    const voice = document.getElementById('selectVoiceName').value;
    auditionVoice(engine, voice, 'Hello from TWS MotionForge AI voice studio.');
  });

  // Master Project Creation Submission
  document.getElementById('btnSubmitGenerate')?.addEventListener('click', async () => {
    const isTopic = btnTopic.classList.contains('active');
    const topic = document.getElementById('inputTopic').value.trim();
    const script = document.getElementById('inputScript').value.trim();

    if (isTopic && !topic) {
      alert('Please enter a topic for your video.');
      return;
    }
    if (!isTopic && !script) {
      alert('Please enter or paste your narration script.');
      return;
    }

    const ratio = document.querySelector('input[name="videoRatio"]:checked').value;
    const style = document.getElementById('selectStyle').value;
    const voiceEngine = document.getElementById('selectVoiceEngine').value;
    const voice = document.getElementById('selectVoiceName').value;

    showModal('Preparing Project...', 'Synthesizing local voice and aligning subtitles with Faster-Whisper...');

    // Hook progress listener
    const unsubscribe = window.api.onProgress((p) => {
      updateModalProgress(p.percent, p.message, p.stage);
    });

    try {
      const result = await window.api.createProject({
        topic: isTopic ? topic : undefined,
        script: !isTopic ? script : undefined,
        style,
        ratio,
        voiceEngine,
        voice
      });

      updateModalProgress(100, 'Project Prepared! Starting video render...', 'rendering');
      
      // Auto-render preview video (5 seconds)
      const renderResult = await window.api.renderProject({
        projectDir: result.projectDir,
        preview: true,
        seconds: 5
      });

      hideModal();
      unsubscribe();
      await loadProjectsHistory();
      await loadProjectIntoPlayer(result.projectDir);
    } catch (err) {
      hideModal();
      unsubscribe();
      alert(`Generation failed: ${err.message}`);
    }
  });

  // Render current storyboard button
  document.getElementById('btnRenderCurrentStoryboard')?.addEventListener('click', async () => {
    if (!currentProject || !currentProject.projectDir) {
      alert('No active project to render.');
      return;
    }

    showModal('Rendering Video...', 'Executing Canvas drawing and FFmpeg encoding...');
    const unsubscribe = window.api.onProgress((p) => {
      updateModalProgress(p.percent, p.message, p.stage);
    });

    try {
      const renderRes = await window.api.renderProject({
        projectDir: currentProject.projectDir,
        preview: true,
        seconds: 5
      });
      hideModal();
      unsubscribe();
      await loadProjectsHistory();
      await loadProjectIntoPlayer(currentProject.projectDir);
    } catch (err) {
      hideModal();
      unsubscribe();
      alert(`Render failed: ${err.message}`);
    }
  });

  document.getElementById('btnOpenVideoFolder')?.addEventListener('click', () => {
    if (currentProject && currentProject.projectDir) {
      window.api.openPath(currentProject.projectDir);
    }
  });
}

// 10. Modal & Progress Handling
function showModal(title, message) {
  const modal = document.getElementById('progressModal');
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMessage').textContent = message;
  document.getElementById('modalProgressBar').style.width = '5%';
  document.getElementById('modalPercent').textContent = '5%';
  if (modal) modal.style.display = 'flex';
}

function updateModalProgress(percent, message, stage) {
  document.getElementById('modalProgressBar').style.width = `${percent}%`;
  document.getElementById('modalPercent').textContent = `${percent}%`;
  document.getElementById('modalMessage').textContent = message;

  document.querySelectorAll('.stage-tag').forEach(tag => tag.classList.remove('active'));
  if (stage === 'storyboard') document.getElementById('stageStoryboard')?.classList.add('active');
  if (stage === 'tts') document.getElementById('stageTts')?.classList.add('active');
  if (stage === 'alignment' || stage === 'captions') document.getElementById('stageAlignment')?.classList.add('active');
  if (stage === 'rendering' || stage === 'validating') document.getElementById('stageRender')?.classList.add('active');
  if (stage === 'complete') document.getElementById('stageMux')?.classList.add('active');
}

function hideModal() {
  const modal = document.getElementById('progressModal');
  if (modal) modal.style.display = 'none';
}

// 11. Diagnostics & Doctor Button
function setupDiagnostics() {
  const btn = document.getElementById('btnRunDiagnosticsCheck');
  const out = document.getElementById('diagnosticsOutput');
  btn?.addEventListener('click', async () => {
    out.textContent = 'Running live doctor checks across dependencies and styles...';
    try {
      const res = await window.api.runDiagnostics();
      out.textContent = JSON.stringify(res, null, 2);
    } catch (err) {
      out.textContent = `Diagnostic error: ${err.message}`;
    }
  });
}

function pathBasename(p) {
  return p ? p.replace(/\\/g, '/').split('/').pop() : 'Project';
}
