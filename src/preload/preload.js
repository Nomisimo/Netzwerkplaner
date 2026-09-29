const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  appVersion:        () => ipcRenderer.invoke('app-version'),
  saveProject:       (args) => ipcRenderer.invoke('save-project', args),
  openProject:       () => ipcRenderer.invoke('open-project'),
  openRecent:        (filePath) => ipcRenderer.invoke('open-recent', filePath),
  getRecents:        () => ipcRenderer.invoke('get-recents'),
  loadLibrary:       () => ipcRenderer.invoke('load-library'),
  saveLibrary:       (data) => ipcRenderer.invoke('save-library', data),
  saveFile:          (args) => ipcRenderer.invoke('save-file', args),
  exportPdf:         (args) => ipcRenderer.invoke('export-pdf', args),
  openExternal:      (url) => ipcRenderer.invoke('open-external', url),
  checkReachability: (targets) => ipcRenderer.invoke('check-reachability', targets),
  onOpenFile:        (cb) => ipcRenderer.on('open-file', (_, msg) => cb(msg)),
});
