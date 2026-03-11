/**
 * exporter.js — Export slides as PPTX (primary) or PNG/JPEG/PDF
 *
 * PPTX strategy (same as html2pptx):
 *   1. html2canvas renders each slide iframe → PNG base64
 *   2. pptxgenjs places the PNG as a full-slide background image
 *   → pixel-perfect fidelity; no CSS re-interpretation needed
 */

let exportCancelled = false

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
    const iframe = document.createElement('iframe')
    iframe.style.cssText = [
      'position:fixed', 'left:-9999px', 'top:-9999px',
      'width:1280px', 'height:720px', 'border:none',
      'pointer-events:none', 'z-index:-1'
    ].join(';')
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    document.body.appendChild(iframe)

    const cleanup = () => { try { document.body.removeChild(iframe) } catch (_) {} }

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
          cleanup()
          resolve(canvas)
        } catch (err) {
          cleanup()
          reject(err)
        }
      }, 700)
    }

    // Load via blob URL so external resources (fonts, etc.) can still load
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const blobUrl = URL.createObjectURL(blob)
    iframe.src = blobUrl
    iframe.onload = () => { URL.revokeObjectURL(blobUrl); capture() }
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

  if (exportCancelled) return
  updateProgress(total, total, '正在写入 PPTX 文件...')

  await pptx.writeFile({ fileName: 'presentation.pptx' })
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

  if (exportCancelled) return
  updateProgress(indices.length, indices.length, '正在保存 PDF...')
  pdf.save('presentation.pdf')
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

  if (exportCancelled) return
  updateProgress(indices.length, indices.length, '打包中...')

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
