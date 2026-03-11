const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // File I/O
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),

  // Dialogs
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showSaveDialog: (defaultPath) => ipcRenderer.invoke('show-save-dialog', defaultPath),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),

  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (updates) => ipcRenderer.invoke('set-config', updates),

  // Paths
  getPath: (name) => ipcRenderer.invoke('get-path', name),

  // Window
  setTitle: (title) => ipcRenderer.send('set-title', title),
  setDocumentEdited: (edited) => ipcRenderer.send('set-document-edited', edited),
  setDirtyFlag: (dirty) => ipcRenderer.send('set-dirty-flag', dirty),

  // Presentation window
  openPresentation: (htmlContent, startIndex) =>
    ipcRenderer.invoke('open-presentation', htmlContent, startIndex),

  // Menu event listeners
  onMenuEvent: (channel, callback) => {
    const validChannels = [
      'menu-open', 'menu-save', 'menu-save-as', 'menu-undo',
      'menu-redo', 'menu-open-file', 'menu-new'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args))
    }
  },
  removeMenuListener: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  }
})
