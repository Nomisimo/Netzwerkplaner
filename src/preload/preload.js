const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  appVersion:        () => ipcRenderer.invoke('app-version'),
  fetchReleases:     () => ipcRenderer.invoke('fetch-releases'),
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
  monInterfaces:     () => ipcRenderer.invoke('mon-interfaces'),
  monStart:          (kind, opts) => ipcRenderer.invoke('mon-start', { kind, opts }),
  monStop:           (kind) => ipcRenderer.invoke('mon-stop', { kind }),
  monAction:         (kind, name, args) => ipcRenderer.invoke('mon-action', { kind, name, args }),
  monState:          () => ipcRenderer.invoke('mon-state'),
  onMonEvent:        (cb) => { const h = (_, msg) => cb(msg); ipcRenderer.on('mon-event', h); return () => ipcRenderer.removeListener('mon-event', h); },
  onOpenFile:        (cb) => ipcRenderer.on('open-file', (_, msg) => cb(msg)),
});
