/**
 * exporter.js — Export slides as PPTX, editable PPTX, PDF, PNG/JPEG
 *
 * Standard PPTX: html2canvas renders each slide → PNG → pptxgenjs full-slide image
 *   → pixel-perfect fidelity, not editable in PowerPoint
 *
 * Editable PPTX: DOM traversal extracts text elements + background color → pptxgenjs
 *   → native text boxes, editable in PowerPoint, ~80-90% visual fidelity
 */

let exportCancelled = false

// Reusable iframe to avoid DOM thrashing during batch exports
let cachedIframe = null

function getOrCreateIframe() {
  if (cachedIframe && cachedIframe.parentNode) return cachedIframe
  const iframe = document.createElement('iframe')
  iframe.style.cssText = [
    'position:fixed', 'left:-9999px', 'top:-9999px',
    'width:1280px', 'height:720px', 'border:none',
    'pointer-events:none', 'z-index:-1'
  ].join(';')
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  document.body.appendChild(iframe)
  cachedIframe = iframe
  return iframe
}

function cleanupCachedIframe() {
  if (cachedIframe && cachedIframe.parentNode) {
    try { document.body.removeChild(cachedIframe) } catch (_) {}
  }
  cachedIframe = null
}

export function initExporter() {
  const modal = document.getElementById('export-modal')
  modal.querySelector('.modal-close').addEventListener('click', hideExportModal)
  document.getElementById('export-cancel-btn').addEventListener('click', () => {
    exportCancelled = true
    hideExportModal()
  })
  document.getElementById('export-confirm-btn').addEventListener('click', startExport)
}

export function showExportModal(totalSlides) {
  exportCancelled = false
  document.getElementById('export-total-hint').textContent = `(总共 ${totalSlides} 页)`
  document.getElementById('export-progress-section').style.display = 'none'
  document.getElementById('export-confirm-btn').disabled = false
  document.getElementById('export-confirm-btn').textContent = '开始导出'
  document.getElementById('export-modal').classList.remove('hidden')
}

function hideExportModal() {
  document.getElementById('export-modal').classList.add('hidden')
}

async function startExport() {
  const slides = window.appState?.slides
  if (!slides || slides.length === 0) return

  const format = document.querySelector('input[name="export-format"]:checked')?.value || 'pptx'
  const rangeType = document.querySelector('input[name="export-range"]:checked')?.value || 'all'
  const scale = parseFloat(document.querySelector('input[name="export-scale"]:checked')?.value || '1.5')
  const currentIndex = window.appState?.currentIndex || 0

  // Parse slide range
  let indices = []
  if (rangeType === 'all') {
    indices = slides.map((_, i) => i)
  } else if (rangeType === 'current') {
    indices = [currentIndex]
  } else {
    const rangeStr = document.getElementById('export-range-input').value
    indices = parseRange(rangeStr, slides.length)
    if (indices.length === 0) {
      alert('无效的范围，请输入如 "1-3, 5, 7" 格式')
      return
    }
  }

  // Show progress UI
  document.getElementById('export-progress-section').style.display = 'block'
  document.getElementById('export-confirm-btn').disabled = true
  document.getElementById('export-confirm-btn').textContent = '导出中...'
  exportCancelled = false

  try {
    if (format === 'pptx') {
      await exportPPTX(slides, indices, scale)
    } else if (format === 'editable-pptx') {
      await exportEditablePPTX(slides, indices)
    } else if (format === 'pdf') {
      await exportPDF(slides, indices, scale)
    } else {
      await exportImages(slides, indices, scale, format)
    }
    if (!exportCancelled) hideExportModal()
  } catch (err) {
    console.error('Export failed:', err)
    alert('导出失败：' + err.message)
  } finally {
    document.getElementById('export-confirm-btn').disabled = false
    document.getElementById('export-confirm-btn').textContent = '开始导出'
    document.getElementById('export-progress-section').style.display = 'none'
  }
}

// ── Core: render one slide to canvas ─────────────────────────────────────

async function renderSlideToCanvas(htmlContent, scale) {
  return new Promise((resolve, reject) => {
    const iframe = getOrCreateIframe()

    // Give the browser time to render after content loads
    const capture = () => {
      setTimeout(async () => {
        try {
          const canvas = await html2canvas(iframe.contentDocument.body, {
            scale,
            width: 1280,
            height: 720,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 1280,
            windowHeight: 720
          })
          resolve(canvas)
        } catch (err) {
          reject(err)
        }
      }, 300)
    }

    // Load via blob URL so external resources (fonts, etc.) can still load
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const blobUrl = URL.createObjectURL(blob)
    iframe.src = blobUrl
    iframe.onload = () => { URL.revokeObjectURL(blobUrl); capture() }
    iframe.onerror = () => { reject(new Error('幻灯片加载失败')) }
  })
}

// ── PPTX Export (primary) ─────────────────────────────────────────────────

async function exportPPTX(slides, indices, scale) {
  if (typeof PptxGenJS === 'undefined') {
    throw new Error('pptxgenjs 未加载，请检查网络连接后重试')
  }

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'   // 10 × 5.625 inches
  pptx.title = 'PPT Editor Export'

  const total = indices.length

  for (let i = 0; i < indices.length; i++) {
    if (exportCancelled) return
    updateProgress(i, total, `渲染第 ${indices[i] + 1} 页...`)

    const canvas = await renderSlideToCanvas(slides[indices[i]].content, scale)
    const imgData = canvas.toDataURL('image/png')   // base64 png

    const slide = pptx.addSlide()
    // 10 × 5.625 inches = 16:9, matches LAYOUT_16x9
    slide.addImage({
      data: imgData,
      x: 0, y: 0,
      w: 10, h: 5.625
    })
  }

  if (exportCancelled) { cleanupCachedIframe(); return }
  updateProgress(total, total, '正在写入 PPTX 文件...')

  await pptx.writeFile({ fileName: 'presentation.pptx' })
  cleanupCachedIframe()
}

// ── PDF Export ────────────────────────────────────────────────────────────

async function exportPDF(slides, indices, scale) {
  const { jsPDF } = window.jspdf
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [1280, 720],
    compress: true
  })

  for (let i = 0; i < indices.length; i++) {
    if (exportCancelled) return
    updateProgress(i, indices.length, `渲染第 ${indices[i] + 1} 页...`)

    const canvas = await renderSlideToCanvas(slides[indices[i]].content, scale)
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    if (i > 0) pdf.addPage([1280, 720], 'landscape')
    pdf.addImage(imgData, 'JPEG', 0, 0, 1280, 720, undefined, 'FAST')
  }

  if (exportCancelled) { cleanupCachedIframe(); return }
  updateProgress(indices.length, indices.length, '正在保存 PDF...')
  pdf.save('presentation.pdf')
  cleanupCachedIframe()
}

// ── Image Export ──────────────────────────────────────────────────────────

async function exportImages(slides, indices, scale, format) {
  const images = []

  for (let i = 0; i < indices.length; i++) {
    if (exportCancelled) return
    updateProgress(i, indices.length, `渲染第 ${indices[i] + 1} 页...`)

    const canvas = await renderSlideToCanvas(slides[indices[i]].content, scale)
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
    images.push({ dataUrl: canvas.toDataURL(mimeType, 0.92), index: indices[i] })
  }

  if (exportCancelled) { cleanupCachedIframe(); return }
  updateProgress(indices.length, indices.length, '打包中...')

  cleanupCachedIframe()
  if (images.length === 1) {
    const ext = format === 'jpeg' ? 'jpg' : 'png'
    downloadDataUrl(images[0].dataUrl, `slide-${images[0].index + 1}.${ext}`)
  } else {
    const zip = new JSZip()
    for (const { dataUrl, index } of images) {
      const ext = format === 'jpeg' ? 'jpg' : 'png'
      zip.file(`slide-${String(index + 1).padStart(2, '0')}.${ext}`, dataUrl.split(',')[1], { base64: true })
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'slides-export.zip')
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function updateProgress(current, total, text) {
  const bar = document.getElementById('export-progress-bar')
  const label = document.getElementById('export-progress-text')
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  if (bar) bar.style.width = pct + '%'
  if (label) label.textContent = text || `${current} / ${total}`
}

function parseRange(str, total) {
  const indices = new Set()
  str.split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(s => parseInt(s.trim(), 10))
      if (!isNaN(a) && !isNaN(b)) {
        for (let i = Math.max(1, a); i <= Math.min(total, b); i++) indices.add(i - 1)
      }
    } else {
      const n = parseInt(part, 10)
      if (!isNaN(n) && n >= 1 && n <= total) indices.add(n - 1)
    }
  })
  return [...indices].sort((a, b) => a - b)
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ── Editable PPTX Export ──────────────────────────────────────────────────

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent') return null
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/)
  if (!match) return null
  const a = match[4] !== undefined ? parseFloat(match[4]) : 1
  if (a === 0) return null  // fully transparent
  const r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3])
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase()
}

function mapAlign(cssAlign) {
  const map = { left: 'left', center: 'center', right: 'right', justify: 'justify', start: 'left', end: 'right' }
  return map[cssAlign] || 'left'
}

function extractTextElements(iframeDoc) {
  const SLIDE_W = 1280, SLIDE_H = 720
  const PPT_W = 10, PPT_H = 5.625

  const passing = []  // { el, ...pptxProps }
  const addedTexts = new Set()

  const candidates = iframeDoc.querySelectorAll(
    'h1,h2,h3,h4,h5,h6,p,li,td,th,' +
    '[class*="title"],[class*="heading"],[class*="subtitle"],' +
    '[class*="content"],[class*="text"],[class*="body"]'
  )

  for (const el of candidates) {
    const text = (el.innerText || el.textContent || '').trim()
    if (!text || text.length < 2) continue
    if (addedTexts.has(text)) continue

    const style = iframeDoc.defaultView.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    if (parseFloat(style.opacity) < 0.1) continue

    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue

    const fontSizePt = Math.round(parseFloat(style.fontSize) * 72 / 96)

    passing.push({
      el,
      text,
      x: Math.max(0, rect.left / SLIDE_W * PPT_W),
      y: Math.max(0, rect.top  / SLIDE_H * PPT_H),
      w: Math.min(Math.max(0.1, rect.width  / SLIDE_W * PPT_W), PPT_W),
      h: Math.min(Math.max(0.1, rect.height / SLIDE_H * PPT_H), PPT_H),
      fontSize: Math.max(8, Math.min(fontSizePt, 72)),
      bold: parseInt(style.fontWeight) >= 600,
      italic: style.fontStyle.includes('italic'),
      color: rgbToHex(style.color) || '333333',
      align: mapAlign(style.textAlign),
    })
    addedTexts.add(text)
  }

  // Keep only leaf candidates: drop any element that is an ancestor of another
  return passing
    .filter(item => !passing.some(other => other !== item && item.el.contains(other.el)))
    .map(({ el: _el, ...data }) => data)
}

function extractSlideBackground(iframeDoc) {
  const candidates = [
    iframeDoc.body,
    iframeDoc.querySelector('section'),
    iframeDoc.querySelector('[class*="slide"]'),
    iframeDoc.querySelector('[class*="wrapper"]'),
    iframeDoc.querySelector('div'),
  ]
  for (const el of candidates) {
    if (!el) continue
    const bg = iframeDoc.defaultView.getComputedStyle(el).backgroundColor
    const hex = rgbToHex(bg)
    if (hex) return hex
  }
  return 'FFFFFF'
}

function loadSlideForExtraction(htmlContent) {
  return new Promise((resolve, reject) => {
    const iframe = getOrCreateIframe()

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const blobUrl = URL.createObjectURL(blob)
    iframe.src = blobUrl
    iframe.onload = () => {
      URL.revokeObjectURL(blobUrl)
      setTimeout(() => {
        try {
          const doc = iframe.contentDocument
          const textElements = extractTextElements(doc)
          const bgColor = extractSlideBackground(doc)
          resolve({ textElements, bgColor })
        } catch (err) {
          reject(err)
        }
      }, 300)
    }
    iframe.onerror = (e) => { reject(e) }
  })
}

async function exportEditablePPTX(slides, indices) {
  if (typeof PptxGenJS === 'undefined') {
    throw new Error('pptxgenjs 未加载，请检查网络连接后重试')
  }

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.title = 'PPT Editor Export'

  const total = indices.length

  for (let i = 0; i < indices.length; i++) {
    if (exportCancelled) return
    updateProgress(i, total, `提取第 ${indices[i] + 1} 页文字...`)

    const { textElements, bgColor } = await loadSlideForExtraction(slides[indices[i]].content)

    const slide = pptx.addSlide()
    slide.background = { color: bgColor || 'FFFFFF' }

    for (const el of textElements) {
      try {
        slide.addText(el.text, {
          x: el.x, y: el.y, w: el.w, h: el.h,
          fontSize: el.fontSize,
          bold: el.bold,
          italic: el.italic,
          color: el.color,
          align: el.align,
          valign: 'top',
          wrap: true,
        })
      } catch (_) {
        // Skip elements that cause pptxgenjs errors
      }
    }
  }

  if (exportCancelled) { cleanupCachedIframe(); return }
  updateProgress(total, total, '正在写入可编辑 PPTX 文件...')
  await pptx.writeFile({ fileName: 'presentation-editable.pptx' })
  cleanupCachedIframe()
}
