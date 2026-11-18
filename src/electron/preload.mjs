import { contextBridge, ipcRenderer } from 'electron';

// Expose safe, validated API methods to renderer process
contextBridge.exposeInMainWorld('api', {
  // System diagnostics & hardware status
  getSystemStatus: () => ipcRenderer.invoke('api:get-system-status'),
  runDiagnostics: () => ipcRenderer.invoke('api:run-diagnostics'),

  // Voice studio
  getVoices: () => ipcRenderer.invoke('api:get-voices'),
  previewVoice: (params) => ipcRenderer.invoke('api:preview-voice', params),

  // Styles & Audio library
  getStyles: () => ipcRenderer.invoke('api:get-styles'),
  getAudioLibrary: () => ipcRenderer.invoke('api:get-audio-library'),

  // Project management & creation
  getProjects: () => ipcRenderer.invoke('api:get-projects'),
  getProjectDetails: (projectDir) => ipcRenderer.invoke('api:get-project-details', projectDir),
  createProject: (params) => ipcRenderer.invoke('api:create-project', params),
  renderProject: (params) => ipcRenderer.invoke('api:render-project', params),

  // File explorer integration
  openPath: (targetPath) => ipcRenderer.invoke('api:open-path', targetPath),

  // Live progress notifications
  onProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('project:progress', handler);
    return () => ipcRenderer.removeListener('project:progress', handler);
  }
});
