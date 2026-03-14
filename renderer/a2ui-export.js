/**
 * a2ui-export.js — A2UI 组件导出回退
 *
 * 将 A2UI 组件转换为静态 HTML，用于 PPTX/PDF 导出。
 * html2canvas 无法渲染 Web Components，所以需要在导出前转换。
 */

// A2UI 组件到静态 HTML 的转换映射
const FALLBACK_CONVERTERS = {
  'a2ui-button': (el) => {
    const label = el.getAttribute('label') || el.textContent?.trim() || 'Button'
    const variant = el.getAttribute('variant') || 'default'
    const disabled = el.hasAttribute('disabled')
    const variantClass = `a2ui-fb-btn--${variant}`
    const disabledClass = disabled ? 'a2ui-fb-btn--disabled' : ''
    return `<button class="a2ui-fb-btn ${variantClass} ${disabledClass}">${escapeHtml(label)}</button>`
  },

  'a2ui-text': (el) => {
    const text = el.getAttribute('text') || el.textContent || ''
    const usageHint = el.getAttribute('usageHint') || 'body'
    const tagMap = {
      headline: 'h1',
      title: 'h2',
      subtitle: 'h3',
      body: 'p',
      caption: 'span',
      label: 'span'
    }
    const tag = tagMap[usageHint] || 'span'
    return `<${tag} class="a2ui-fb-text a2ui-fb-text--${usageHint}">${escapeHtml(text)}</${tag}>`
  },

  'a2ui-card': (el) => {
    const title = el.getAttribute('title') || ''
    const childContent = processChildNodes(el)
    return `<div class="a2ui-fb-card">
      ${title ? `<div class="a2ui-fb-card__title">${escapeHtml(title)}</div>` : ''}
      <div class="a2ui-fb-card__content">${childContent}</div>
    </div>`
  },

  'a2ui-row': (el) => {
    const alignment = el.getAttribute('alignment') || 'stretch'
    const distribution = el.getAttribute('distribution') || 'start'
    const childContent = processChildNodes(el)
    return `<div class="a2ui-fb-row a2ui-fb-row--align-${alignment} a2ui-fb-row--dist-${distribution}">${childContent}</div>`
  },

  'a2ui-column': (el) => {
    const alignment = el.getAttribute('alignment') || 'stretch'
    const distribution = el.getAttribute('distribution') || 'start'
    const childContent = processChildNodes(el)
    return `<div class="a2ui-fb-column a2ui-fb-column--align-${alignment} a2ui-fb-column--dist-${distribution}">${childContent}</div>`
  },

  'a2ui-image': (el) => {
    const url = el.getAttribute('url') || ''
    const fit = el.getAttribute('fit') || 'contain'
    if (!url) return ''
    return `<img class="a2ui-fb-image a2ui-fb-image--${fit}" src="${escapeHtml(url)}" alt="" />`
  },

  'a2ui-icon': (el) => {
    const name = el.getAttribute('name') || 'star'
    // 使用 Material Icons 或 emoji fallback
    return `<span class="a2ui-fb-icon material-symbols-outlined">${escapeHtml(name)}</span>`
  },

  'a2ui-tabs': (el) => {
    const tabs = Array.from(el.querySelectorAll('a2ui-tab'))
    if (tabs.length === 0) return processChildNodes(el)

    const tabHeaders = tabs.map((tab, i) => {
      const title = tab.getAttribute('title') || `Tab ${i + 1}`
      const activeClass = i === 0 ? 'a2ui-fb-tabs__tab--active' : ''
      return `<div class="a2ui-fb-tabs__tab ${activeClass}">${escapeHtml(title)}</div>`
    }).join('')

    // 只显示第一个 tab 的内容
    const firstTabContent = tabs[0] ? processChildNodes(tabs[0]) : ''

    return `<div class="a2ui-fb-tabs">
      <div class="a2ui-fb-tabs__header">${tabHeaders}</div>
      <div class="a2ui-fb-tabs__content">${firstTabContent}</div>
    </div>`
  },

  'a2ui-tab': (el) => {
    // Tab 内容在 a2ui-tabs 中处理
    return processChildNodes(el)
  },

  'a2ui-slider': (el) => {
    const value = el.getAttribute('value') || '50'
    const min = el.getAttribute('minValue') || '0'
    const max = el.getAttribute('maxValue') || '100'
    const range = parseFloat(max) - parseFloat(min)
    // Prevent divide by zero
    const percent = range !== 0 ? ((parseFloat(value) - parseFloat(min)) / range) * 100 : 0
    return `<div class="a2ui-fb-slider">
      <div class="a2ui-fb-slider__track">
        <div class="a2ui-fb-slider__fill" style="width: ${Math.max(0, Math.min(100, percent))}%"></div>
      </div>
      <span class="a2ui-fb-slider__value">${escapeHtml(value)}</span>
    </div>`
  },

  'a2ui-textfield': (el) => {
    const label = el.getAttribute('label') || ''
    const text = el.getAttribute('text') || ''
    return `<div class="a2ui-fb-textfield">
      ${label ? `<label class="a2ui-fb-textfield__label">${escapeHtml(label)}</label>` : ''}
      <div class="a2ui-fb-textfield__input">${escapeHtml(text) || '&nbsp;'}</div>
    </div>`
  },

  'a2ui-checkbox': (el) => {
    const label = el.getAttribute('label') || ''
    const checked = el.getAttribute('value') === 'true'
    const checkmark = checked ? '☑' : '☐'
    return `<div class="a2ui-fb-checkbox">
      <span class="a2ui-fb-checkbox__box">${checkmark}</span>
      <span class="a2ui-fb-checkbox__label">${escapeHtml(label)}</span>
    </div>`
  },

  'a2ui-divider': (el) => {
    const axis = el.getAttribute('axis') || 'horizontal'
    return `<div class="a2ui-fb-divider a2ui-fb-divider--${axis}"></div>`
  },

  'a2ui-modal': (el) => {
    // Modal 在静态导出中只显示入口内容
    const entryPoint = el.querySelector('[slot="entry"]')
    return entryPoint ? processChildNodes(entryPoint) : processChildNodes(el)
  },

  'a2ui-list': (el) => {
    const direction = el.getAttribute('direction') || 'vertical'
    const childContent = processChildNodes(el)
    return `<div class="a2ui-fb-list a2ui-fb-list--${direction}">${childContent}</div>`
  },

  'a2ui-video': (el) => {
    const url = el.getAttribute('url') || ''
    // 视频显示为占位符
    return `<div class="a2ui-fb-video">
      <span class="a2ui-fb-video__icon">▶</span>
      <span class="a2ui-fb-video__label">Video</span>
    </div>`
  },

  'a2ui-audioplayer': (el) => {
    return `<div class="a2ui-fb-audio">
      <span class="a2ui-fb-audio__icon">🔊</span>
      <span class="a2ui-fb-audio__label">Audio Player</span>
    </div>`
  },

  // 通用处理器（用于其他 a2ui-* 元素）
  'a2ui-surface': (el) => processChildNodes(el),
  'a2ui-root': (el) => processChildNodes(el),
  'a2ui-multiplechoice': (el) => {
    const options = el.getAttribute('options')
    if (!options) return ''
    try {
      const opts = JSON.parse(options)
      return `<div class="a2ui-fb-multiplechoice">
        ${opts.map(opt => `<div class="a2ui-fb-multiplechoice__option">○ ${escapeHtml(opt.label || opt)}</div>`).join('')}
      </div>`
    } catch {
      return ''
    }
  },
  'a2ui-datetimeinput': (el) => {
    const value = el.getAttribute('value') || ''
    return `<div class="a2ui-fb-datetime">
      <span class="a2ui-fb-datetime__icon">📅</span>
      <span class="a2ui-fb-datetime__value">${escapeHtml(value) || 'Select date'}</span>
    </div>`
  }
}

/**
 * HTML 转义
 */
function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 递归处理子节点
 */
function processChildNodes(el) {
  if (!el || !el.childNodes) return ''

  return Array.from(el.childNodes).map(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Escape text content to prevent XSS
      return escapeHtml(node.textContent)
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      return convertElement(node)
    }
    return ''
  }).join('')
}

/**
 * 转换单个元素
 */
function convertElement(el) {
  const tagName = el.tagName.toLowerCase()

  // 检查是否是 A2UI 组件
  if (tagName.startsWith('a2ui-')) {
    const converter = FALLBACK_CONVERTERS[tagName]
    if (converter) {
      return converter(el)
    }
    // 未知的 A2UI 组件，尝试显示其内容
    return processChildNodes(el)
  }

  // 非 A2UI 元素，保留原始结构但处理子节点
  const childContent = processChildNodes(el)
  const attrs = Array.from(el.attributes)
    .map(attr => `${attr.name}="${escapeHtml(attr.value)}"`)
    .join(' ')

  return `<${tagName}${attrs ? ' ' + attrs : ''}>${childContent}</${tagName}>`
}

/**
 * A2UI 回退样式 CSS
 */
const A2UI_FALLBACK_CSS = `
/* A2UI Fallback Styles for Export */

/* Button */
.a2ui-fb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
}
.a2ui-fb-btn--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.a2ui-fb-btn--secondary {
  background: transparent;
  border: 2px solid #667eea;
  color: #667eea;
}
.a2ui-fb-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Text */
.a2ui-fb-text { display: block; }
.a2ui-fb-text--headline { font-size: 32px; font-weight: 700; }
.a2ui-fb-text--title { font-size: 24px; font-weight: 600; }
.a2ui-fb-text--subtitle { font-size: 18px; font-weight: 500; }
.a2ui-fb-text--body { font-size: 16px; }
.a2ui-fb-text--caption { font-size: 12px; opacity: 0.7; }
.a2ui-fb-text--label { font-size: 14px; font-weight: 500; }

/* Card */
.a2ui-fb-card {
  padding: 24px;
  border-radius: 16px;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
}
.a2ui-fb-card__title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}
.a2ui-fb-card__content { }

/* Row & Column */
.a2ui-fb-row {
  display: flex;
  flex-direction: row;
  gap: 16px;
}
.a2ui-fb-row--align-start { align-items: flex-start; }
.a2ui-fb-row--align-center { align-items: center; }
.a2ui-fb-row--align-end { align-items: flex-end; }
.a2ui-fb-row--align-stretch { align-items: stretch; }
.a2ui-fb-row--dist-start { justify-content: flex-start; }
.a2ui-fb-row--dist-center { justify-content: center; }
.a2ui-fb-row--dist-end { justify-content: flex-end; }
.a2ui-fb-row--dist-spaceBetween { justify-content: space-between; }
.a2ui-fb-row--dist-spaceAround { justify-content: space-around; }

.a2ui-fb-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.a2ui-fb-column--align-start { align-items: flex-start; }
.a2ui-fb-column--align-center { align-items: center; }
.a2ui-fb-column--align-end { align-items: flex-end; }
.a2ui-fb-column--align-stretch { align-items: stretch; }
.a2ui-fb-column--dist-start { justify-content: flex-start; }
.a2ui-fb-column--dist-center { justify-content: center; }
.a2ui-fb-column--dist-end { justify-content: flex-end; }

/* Image */
.a2ui-fb-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}
.a2ui-fb-image--cover { object-fit: cover; }
.a2ui-fb-image--contain { object-fit: contain; }
.a2ui-fb-image--fill { object-fit: fill; }

/* Icon */
.a2ui-fb-icon {
  font-size: 24px;
  display: inline-block;
}

/* Tabs */
.a2ui-fb-tabs {
  border-radius: 12px;
  overflow: hidden;
}
.a2ui-fb-tabs__header {
  display: flex;
  background: rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.a2ui-fb-tabs__tab {
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  opacity: 0.6;
  cursor: pointer;
}
.a2ui-fb-tabs__tab--active {
  opacity: 1;
  border-bottom: 2px solid #667eea;
}
.a2ui-fb-tabs__content {
  padding: 20px;
}

/* Slider */
.a2ui-fb-slider {
  display: flex;
  align-items: center;
  gap: 12px;
}
.a2ui-fb-slider__track {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.2);
  border-radius: 3px;
  overflow: hidden;
}
.a2ui-fb-slider__fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 3px;
}
.a2ui-fb-slider__value {
  font-size: 14px;
  font-weight: 500;
  min-width: 40px;
}

/* TextField */
.a2ui-fb-textfield {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.a2ui-fb-textfield__label {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.7;
}
.a2ui-fb-textfield__input {
  padding: 12px 16px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  font-size: 14px;
}

/* Checkbox */
.a2ui-fb-checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
}
.a2ui-fb-checkbox__box {
  font-size: 20px;
}
.a2ui-fb-checkbox__label {
  font-size: 14px;
}

/* Divider */
.a2ui-fb-divider {
  background: rgba(255,255,255,0.1);
}
.a2ui-fb-divider--horizontal {
  width: 100%;
  height: 1px;
  margin: 16px 0;
}
.a2ui-fb-divider--vertical {
  width: 1px;
  height: 100%;
  margin: 0 16px;
}

/* List */
.a2ui-fb-list {
  display: flex;
  gap: 12px;
}
.a2ui-fb-list--vertical {
  flex-direction: column;
}
.a2ui-fb-list--horizontal {
  flex-direction: row;
}

/* Video placeholder */
.a2ui-fb-video {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  background: rgba(0,0,0,0.3);
  border-radius: 12px;
}
.a2ui-fb-video__icon {
  font-size: 32px;
}
.a2ui-fb-video__label {
  font-size: 16px;
  opacity: 0.7;
}

/* Audio placeholder */
.a2ui-fb-audio {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  background: rgba(255,255,255,0.1);
  border-radius: 24px;
}
.a2ui-fb-audio__icon {
  font-size: 20px;
}
.a2ui-fb-audio__label {
  font-size: 14px;
}

/* Multiple Choice */
.a2ui-fb-multiplechoice {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.a2ui-fb-multiplechoice__option {
  padding: 10px 16px;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  font-size: 14px;
}

/* DateTime */
.a2ui-fb-datetime {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
}
.a2ui-fb-datetime__icon {
  font-size: 18px;
}
.a2ui-fb-datetime__value {
  font-size: 14px;
}
`

/**
 * 将 A2UI 组件转换为静态 HTML
 * @param {string} html - 原始 HTML 内容
 * @returns {string} 转换后的静态 HTML
 */
export function convertA2UIToStatic(html) {
  if (!html || typeof html !== 'string') return html

  // 检查是否包含 A2UI 组件
  if (!/<a2ui-/i.test(html)) return html

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // 移除 A2UI 运行时脚本（避免在 html2canvas 中执行）
    const a2uiScripts = doc.querySelectorAll('script[type="module"]')
    a2uiScripts.forEach(script => {
      if (script.textContent.includes('a2ui') || script.textContent.includes('A2UI')) {
        script.remove()
      }
    })

    // 查找所有 a2ui-* 元素
    const a2uiElements = doc.querySelectorAll('[class^="a2ui-"], [class*=" a2ui-"]')
    const tagSelector = Object.keys(FALLBACK_CONVERTERS).join(', ')
    const customElements = doc.querySelectorAll(tagSelector)

    // 转换自定义元素
    customElements.forEach(el => {
      const tagName = el.tagName.toLowerCase()
      const converter = FALLBACK_CONVERTERS[tagName]
      if (converter) {
        const fallbackHTML = converter(el)
        const temp = document.createElement('div')
        temp.innerHTML = fallbackHTML
        if (temp.firstElementChild) {
          el.replaceWith(temp.firstElementChild)
        } else if (temp.textContent) {
          el.replaceWith(document.createTextNode(temp.textContent))
        }
      }
    })

    // 注入 fallback CSS
    const style = doc.createElement('style')
    style.textContent = A2UI_FALLBACK_CSS
    doc.head.appendChild(style)

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML
  } catch (err) {
    console.error('[A2UI Export] Conversion failed:', err)
    return html // 返回原始 HTML 作为 fallback
  }
}

/**
 * 获取 fallback CSS（可用于其他场景）
 */
export function getFallbackCSS() {
  return A2UI_FALLBACK_CSS
}
