/**
 * ai-panel.js — AI generation panel (fetch + ReadableStream SSE, no SDK)
 */

let currentAbortController = null
let onNewPPT = null   // callback(htmlString)
let onModifySlide = null // callback(htmlString)
let getState = null   // () => state

const SYSTEM_PROMPT_FULL = `你是一个专业的 PPT 设计师。请生成一个完整的 HTML PPT 文件。

严格遵守以下结构规范，每页用 <section data-slide="N" data-title="页面标题"> 包裹：

<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; padding: 0; }
  section[data-slide] {
    width: 1280px;
    height: 720px;
    position: relative;
    overflow: hidden;
    display: none;
  }
  /* 其他全局样式 */
</style>
</head>
<body>
  <section data-slide="1" data-title="封面">...</section>
  <section data-slide="2" data-title="...">...</section>
</body>
</html>

要求：
- 每页固定尺寸 1280×720px
- 使用内联 CSS，不引用任何外部资源（无外链字体、图片用 CSS 渐变/图标代替）
- 设计精美，有视觉层次感，配色统一
- 只输出完整 HTML 代码，不要任何解释文字`

const SYSTEM_PROMPT_MODIFY = `你是一个专业的前端开发者，擅长修改 HTML PPT 幻灯片。
用户会给你一段幻灯片的 HTML 代码，以及修改指令。
请按指令修改 HTML，保持外层结构不变，宽度保持 1280px，高度保持 720px。
只输出修改后的完整 HTML 代码，不要任何解释。`

export function initAIPanel({ onGenerate, onModify, getAppState }) {
  onNewPPT = onGenerate
  onModifySlide = onModify
  getState = getAppState

  // Tab switching
  document.getElementById('ai-tab-generate').addEventListener('click', () => switchTab('generate'))
  document.getElementById('ai-tab-modify').addEventListener('click', () => switchTab('modify'))

  // Generate button
  document.getElementById('ai-generate-btn').addEventListener('click', handleGenerate)

  // Modify button
  document.getElementById('ai-modify-btn').addEventListener('click', handleModify)

  // Stop button
  document.getElementById('ai-stop-btn').addEventListener('click', stopGeneration)

  // Settings modal
  document.getElementById('settings-btn').addEventListener('click', openSettings)
  document.getElementById('settings-close-btn').addEventListener('click', closeSettings)
  document.getElementById('settings-save-btn').addEventListener('click', saveSettings)

  // Load saved settings into form
  loadSettingsToForm()

  // Toggle API key visibility
  document.getElementById('toggle-api-key').addEventListener('click', toggleApiKeyVisibility)
}

function switchTab(tab) {
  document.getElementById('ai-tab-generate').classList.toggle('active', tab === 'generate')
  document.getElementById('ai-tab-modify').classList.toggle('active', tab === 'modify')
  document.getElementById('ai-generate-form').style.display = tab === 'generate' ? 'flex' : 'none'
  document.getElementById('ai-modify-form').style.display = tab === 'modify' ? 'flex' : 'none'
}

async function handleGenerate() {
  setGenerating(true)

  const config = await window.electronAPI.getConfig()
  if (!config.apiKey) {
    setGenerating(false)
    alert('请先在设置中配置 API Key')
    openSettings()
    return
  }

  const topic = document.getElementById('ai-topic').value.trim()
  if (!topic) {
    setGenerating(false)
    document.getElementById('ai-topic').focus()
    return
  }

  const pages = Math.max(3, Math.min(20, parseInt(document.getElementById('ai-pages').value) || 8))
  const style = document.getElementById('ai-style').value.trim()
  const lang = document.getElementById('ai-lang').value

  // Check for unsaved changes
  const state = getState()
  if (state.isDirty && state.slides.length > 0) {
    const result = await window.electronAPI.showMessageBox({
      type: 'question',
      buttons: ['保存', '不保存，继续', '取消'],
      defaultId: 1,
      cancelId: 2,
      message: '当前文件有未保存的修改',
      detail: '是否在生成前保存？'
    })
    if (result.response === 0) {
      document.dispatchEvent(new CustomEvent('app:save'))
      await new Promise(r => setTimeout(r, 300))
    } else if (result.response === 2) {
      setGenerating(false)
      return
    }
  }

  const userPrompt = buildGeneratePrompt(topic, pages, style, lang)

  showProgress('正在生成 PPT...')

  try {
    const html = await streamCompletion(config, SYSTEM_PROMPT_FULL, userPrompt, (chunk, total) => {
      showProgress(`正在生成... ${total} 字符`, chunk.slice(-200))
    })

    const clean = extractHTML(html)
    if (onNewPPT) onNewPPT(clean)
    showProgress('✓ 生成完成！', '')
    setTimeout(() => hideProgress(), 2000)
  } catch (err) {
    if (err.name !== 'AbortError') {
      showProgress('✗ 生成失败：' + err.message)
    } else {
      showProgress('已停止')
      setTimeout(() => hideProgress(), 1500)
    }
  } finally {
    setGenerating(false)
  }
}

async function handleModify() {
  setGenerating(true, true)

  const config = await window.electronAPI.getConfig()
  if (!config.apiKey) {
    setGenerating(false, true)
    alert('请先在设置中配置 API Key')
    openSettings()
    return
  }

  const instruction = document.getElementById('ai-modify-instruction').value.trim()
  if (!instruction) {
    setGenerating(false, true)
    document.getElementById('ai-modify-instruction').focus()
    return
  }

  const state = getState()
  if (!state.slides || state.slides.length === 0) {
    setGenerating(false, true)
    alert('请先打开或生成一个 PPT')
    return
  }

  const currentSlide = state.slides[state.currentIndex]
  const userPrompt = `以下是当前幻灯片的 HTML：\n\n\`\`\`html\n${currentSlide.content}\n\`\`\`\n\n修改指令：${instruction}`

  showProgress('正在修改幻灯片...')

  try {
    const html = await streamCompletion(config, SYSTEM_PROMPT_MODIFY, userPrompt, (chunk, total) => {
      showProgress(`正在修改... ${total} 字符`)
    })

    const clean = extractHTML(html)
    if (onModifySlide) onModifySlide(clean)
    showProgress('✓ 修改完成！')
    setTimeout(() => hideProgress(), 2000)
  } catch (err) {
    if (err.name !== 'AbortError') {
      showProgress('✗ 修改失败：' + err.message)
    } else {
      showProgress('已停止')
      setTimeout(() => hideProgress(), 1500)
    }
  } finally {
    setGenerating(false, true)
  }
}

function stopGeneration() {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
}

// ── Streaming ──────────────────────────────────────────────────────────────

async function streamCompletion(config, systemPrompt, userPrompt, onChunk) {
  currentAbortController = new AbortController()

  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = config.model || 'gpt-4o'
  const apiKey = config.apiKey

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true,
      max_tokens: 16384
    }),
    signal: currentAbortController.signal
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`API Error ${response.status}: ${err}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // Keep incomplete line

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content || ''
        if (delta) {
          fullContent += delta
          onChunk(delta, fullContent.length)
        }
      } catch (e) {
        // Skip malformed chunks
      }
    }
  }

  return fullContent
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildGeneratePrompt(topic, pages, style, lang) {
  let prompt = `请生成一个关于「${topic}」的 PPT，共 ${pages} 页。`
  if (style) prompt += `\n风格要求：${style}`
  if (lang === 'en') prompt += '\n请用英文生成所有文字内容。'
  else prompt += '\n请用中文生成所有文字内容。'
  return prompt
}

function extractHTML(raw) {
  // Remove markdown code fences if present
  const fenceMatch = raw.match(/```html\s*([\s\S]*?)```/i)
  if (fenceMatch) return fenceMatch[1].trim()
  const genericFence = raw.match(/```\s*([\s\S]*?)```/)
  if (genericFence) return genericFence[1].trim()
  // Find HTML boundaries
  const startIdx = raw.indexOf('<!DOCTYPE')
  if (startIdx === -1) {
    const htmlIdx = raw.indexOf('<html')
    if (htmlIdx !== -1) return raw.slice(htmlIdx)
  }
  if (startIdx !== -1) return raw.slice(startIdx)
  return raw.trim()
}

function setGenerating(active, isModify = false) {
  const genBtn = document.getElementById('ai-generate-btn')
  const modBtn = document.getElementById('ai-modify-btn')
  const stopBtn = document.getElementById('ai-stop-btn')

  if (isModify) {
    modBtn.disabled = active
  } else {
    genBtn.disabled = active
  }
  stopBtn.classList.toggle('visible', active)
}

function showProgress(text, detail) {
  const el = document.getElementById('ai-progress')
  el.classList.add('visible')
  el.textContent = text + (detail ? '\n' + detail : '')
}

function hideProgress() {
  const el = document.getElementById('ai-progress')
  el.classList.remove('visible')
}

// ── Settings ───────────────────────────────────────────────────────────────

async function loadSettingsToForm() {
  const config = await window.electronAPI.getConfig()
  document.getElementById('settings-base-url').value = config.baseUrl || 'https://api.openai.com/v1'
  document.getElementById('settings-api-key').value = config.apiKey || ''
  document.getElementById('settings-model').value = config.model || 'gpt-4o'
}

async function saveSettings() {
  const baseUrl = document.getElementById('settings-base-url').value.trim()
  const apiKey = document.getElementById('settings-api-key').value.trim()
  const model = document.getElementById('settings-model').value.trim()

  await window.electronAPI.setConfig({ baseUrl, apiKey, model })
  closeSettings()
}

function openSettings() {
  loadSettingsToForm()
  document.getElementById('settings-modal').classList.remove('hidden')
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden')
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('settings-api-key')
  const btn = document.getElementById('toggle-api-key')
  if (input.type === 'password') {
    input.type = 'text'
    btn.textContent = '隐藏'
  } else {
    input.type = 'password'
    btn.textContent = '显示'
  }
}
