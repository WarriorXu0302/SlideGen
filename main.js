const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { randomUUID } = require('crypto')

let mainWindow
let isDirtyFlag = false
let config = {}

const CONFIG_PATH = () => path.join(app.getPath('userData'), 'config.json')

function loadConfig() {
  try {
    const data = fs.readFileSync(CONFIG_PATH(), 'utf8')
    config = JSON.parse(data)
  } catch (e) {
    config = {
      recentFiles: [],
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      memoryFiles: [],
      styleConfig: null
    }
  }
  // Ensure new fields exist on old configs
  if (!config.memoryFiles) config.memoryFiles = []
  if (config.styleConfig === undefined) config.styleConfig = null
}

function saveConfig() {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH()), { recursive: true })
    fs.writeFileSync(CONFIG_PATH(), JSON.stringify(config, null, 2), 'utf8')
  } catch (e) {
    console.error('Failed to save config:', e)
  }
}

function addRecentFile(filePath) {
  if (!config.recentFiles) config.recentFiles = []
  config.recentFiles = config.recentFiles.filter(f => f !== filePath)
  config.recentFiles.unshift(filePath)
  config.recentFiles = config.recentFiles.slice(0, 10)
  saveConfig()
  buildMenu()
}

function buildRecentFilesMenu() {
  const recent = config.recentFiles || []
  if (recent.length === 0) {
    return [{ label: '(无最近文件)', enabled: false }]
  }
  return recent.map(filePath => ({
    label: path.basename(filePath),
    sublabel: filePath,
    click: () => mainWindow && mainWindow.webContents.send('menu-open-file', filePath)
  }))
}

function buildMenu() {
  const isMac = process.platform === 'darwin'

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow && mainWindow.webContents.send('menu-new')
        },
        {
          label: '打开...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow && mainWindow.webContents.send('menu-open')
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow && mainWindow.webContents.send('menu-save')
        },
        {
          label: '另存为...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow && mainWindow.webContents.send('menu-save-as')
        },
        { type: 'separator' },
        {
          label: '最近打开',
          submenu: buildRecentFilesMenu()
        },
        { type: 'separator' },
        ...(isMac ? [] : [{ role: 'quit', label: '退出' }])
      ]
    },
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow && mainWindow.webContents.send('menu-undo')
        },
        {
          label: '重做',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow && mainWindow.webContents.send('menu-redo')
        },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 PPT Editor',
          click: async () => {
            await dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: 'PPT HTML Editor',
              detail: 'Version 1.0.0\n基于 Electron 构建'
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow() {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false  // Allow loading local resources and CDN from file:// context
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  mainWindow.on('close', async (e) => {
    if (isDirtyFlag) {
      e.preventDefault()
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['保存', '不保存', '取消'],
        defaultId: 0,
        cancelId: 2,
        title: '未保存的更改',
        message: '文件已修改，是否保存？'
      })
      if (choice.response === 0) {
        mainWindow.webContents.send('menu-save')
        setTimeout(() => mainWindow.destroy(), 500)
      } else if (choice.response === 1) {
        mainWindow.destroy()
      }
      // response === 2: cancel, do nothing
    }
  })
}

// ──── IPC Handlers ────

ipcMain.handle('read-file', async (event, filePath) => {
  return fs.readFileSync(filePath, 'utf8')
})

ipcMain.handle('write-file', async (event, filePath, content) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
  addRecentFile(filePath)
  return true
})

ipcMain.handle('show-open-dialog', async () => {
  return dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }],
    properties: ['openFile']
  })
})

ipcMain.handle('show-save-dialog', async (event, defaultPath) => {
  return dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || 'presentation.html',
    filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }]
  })
})

ipcMain.handle('get-config', () => config)

ipcMain.handle('set-config', (event, updates) => {
  config = { ...config, ...updates }
  saveConfig()
  if (updates.recentFiles !== undefined) buildMenu()
  return true
})

ipcMain.handle('show-message-box', async (event, options) => {
  return dialog.showMessageBox(mainWindow, options)
})

ipcMain.handle('get-path', (event, name) => {
  return app.getPath(name)
})

ipcMain.on('set-title', (event, title) => {
  if (mainWindow) mainWindow.setTitle(title)
})

ipcMain.on('set-document-edited', (event, edited) => {
  if (mainWindow && process.platform === 'darwin') {
    mainWindow.setDocumentEdited(edited)
  }
})

ipcMain.on('set-dirty-flag', (event, dirty) => {
  isDirtyFlag = dirty
})

// ──── Memory File Handlers ────

ipcMain.handle('show-memory-file-dialog', async () => {
  return dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Supported Files', extensions: ['txt', 'md', 'json', 'csv', 'docx', 'pdf'] },
      { name: 'Text Files', extensions: ['txt', 'md'] },
      { name: 'Office Files', extensions: ['docx'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Data Files', extensions: ['json', 'csv'] }
    ],
    properties: ['openFile', 'multiSelections']
  })
})

ipcMain.handle('parse-memory-file', async (_event, filePath) => {
  const ext = path.extname(filePath).toLowerCase().slice(1)
  const name = path.basename(filePath)

  try {
    let content = ''

    if (ext === 'txt' || ext === 'md') {
      content = fs.readFileSync(filePath, 'utf8')
    } else if (ext === 'json') {
      const raw = fs.readFileSync(filePath, 'utf8')
      const obj = JSON.parse(raw)
      content = JSON.stringify(obj, null, 2)
    } else if (ext === 'csv') {
      content = fs.readFileSync(filePath, 'utf8')
    } else if (ext === 'docx') {
      try {
        const mammoth = require('mammoth')
        const result = await mammoth.extractRawText({ path: filePath })
        content = result.value
      } catch (e) {
        throw new Error('解析 DOCX 失败: ' + e.message)
      }
    } else if (ext === 'pdf') {
      try {
        const pdfParse = require('pdf-parse')
        const buffer = fs.readFileSync(filePath)
        const data = await pdfParse(buffer)
        content = data.text
      } catch (e) {
        throw new Error('解析 PDF 失败: ' + e.message)
      }
    } else {
      throw new Error('不支持的文件格式: ' + ext)
    }

    // Truncate very large files to avoid exceeding token limits
    const MAX_CHARS = 50000
    if (content.length > MAX_CHARS) {
      content = content.slice(0, MAX_CHARS) + '\n\n[内容已截断，显示前 50000 字符]'
    }

    return {
      id: randomUUID(),
      name,
      type: ext,
      content: content.trim(),
      size: Buffer.byteLength(content, 'utf8'),
      uploadTime: new Date().toISOString()
    }
  } catch (e) {
    throw e
  }
})

ipcMain.handle('get-memory-list', () => {
  return config.memoryFiles || []
})

ipcMain.handle('save-memory-file', async (_event, fileEntry) => {
  if (!config.memoryFiles) config.memoryFiles = []
  const existing = config.memoryFiles.findIndex(f => f.id === fileEntry.id)
  if (existing >= 0) {
    config.memoryFiles[existing] = fileEntry
  } else {
    config.memoryFiles.push(fileEntry)
  }
  saveConfig()
  return true
})

ipcMain.handle('delete-memory-file', async (_event, fileId) => {
  if (!config.memoryFiles) return true
  config.memoryFiles = config.memoryFiles.filter(f => f.id !== fileId)
  saveConfig()
  return true
})

ipcMain.handle('update-memory-tags', async (_event, fileId, tags) => {
  if (!config.memoryFiles) return false
  const file = config.memoryFiles.find(f => f.id === fileId)
  if (file) {
    file.tags = tags
    saveConfig()
  }
  return true
})

ipcMain.handle('open-presentation', async (_event, htmlContent) => {
  // htmlContent is already a fully self-contained presentation HTML
  // built by app.js — no injection needed here
  const tmpFile = path.join(os.tmpdir(), `ppt-pres-${Date.now()}.html`)
  fs.writeFileSync(tmpFile, htmlContent, 'utf8')

  const presWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    frame: false,
    backgroundColor: '#000',
    alwaysOnTop: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      webSecurity: false
    }
  })

  presWindow.loadFile(tmpFile)

  // Register ESC as a safety exit even if the in-page script fails
  presWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') presWindow.close()
  })

  presWindow.on('closed', () => {
    try { fs.unlinkSync(tmpFile) } catch (_) {}
  })

  return true
})

// ──── App lifecycle ────

app.whenReady().then(() => {
  loadConfig()
  createWindow()
  buildMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
