/**
 * a2ui-loader.js — A2UI 轻量级组件实现
 *
 * 使用原生 Web Components 实现 A2UI 核心组件，无需外部依赖。
 * 这些组件在 iframe 内自动注册和渲染。
 */

// A2UI 组件标签列表
const A2UI_TAGS = [
  'a2ui-button',
  'a2ui-text',
  'a2ui-card',
  'a2ui-row',
  'a2ui-column',
  'a2ui-tabs',
  'a2ui-tab',
  'a2ui-slider'
]

// 生成检测正则
const A2UI_TAG_REGEX = /<a2ui-\w+/i

/**
 * 检测 HTML 是否包含 A2UI 组件
 */
export function hasA2UIComponents(html) {
  if (!html || typeof html !== 'string') return false
  return A2UI_TAG_REGEX.test(html)
}

/**
 * 轻量级 A2UI 组件定义（纯 JavaScript，无外部依赖）
 * 注意：所有用户输入都经过严格验证，防止 CSS 注入
 */
const A2UI_COMPONENTS_SCRIPT = `
<script>
(function() {
  // 防止重复注册
  if (window.__a2uiRegistered) return;
  window.__a2uiRegistered = true;

  // ═══════════════════════════════════════════════════════════════════════════
  // 安全工具函数
  // ═══════════════════════════════════════════════════════════════════════════

  // 验证 CSS 尺寸值（只允许数字+单位格式）
  function sanitizeSize(value, defaultValue) {
    if (!value) return defaultValue;
    // 只允许数字开头，后跟可选的单位
    const match = String(value).match(/^(\\d+(?:\\.\\d+)?)(px|em|rem|%|vh|vw)?$/);
    if (match) {
      return match[1] + (match[2] || 'px');
    }
    return defaultValue;
  }

  // 验证数字
  function sanitizeNumber(value, defaultValue, min, max) {
    const num = parseFloat(value);
    if (isNaN(num)) return defaultValue;
    if (min !== undefined && num < min) return min;
    if (max !== undefined && num > max) return max;
    return num;
  }

  // 转义 HTML 特殊字符
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A2UI Button
  // ═══════════════════════════════════════════════════════════════════════════
  class A2UIButton extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._clickHandler = null;
    }
    connectedCallback() {
      this.render();
    }
    static get observedAttributes() { return ['label', 'variant', 'disabled']; }
    attributeChangedCallback() { if (this.shadowRoot) this.render(); }
    render() {
      const label = escapeHtml(this.getAttribute('label') || this.textContent || 'Button');
      const variant = this.getAttribute('variant');
      const disabled = this.hasAttribute('disabled');

      // 预定义的安全颜色映射
      const colors = {
        primary: { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'transparent' },
        secondary: { bg: 'transparent', color: '#667eea', border: '#667eea' },
        default: { bg: 'rgba(255,255,255,0.1)', color: '#fff', border: 'rgba(255,255,255,0.3)' }
      };
      const c = colors[variant] || colors.primary;

      this.shadowRoot.innerHTML = \`
        <style>
          :host { display: inline-block; }
          button {
            padding: 12px 28px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            border: 2px solid \${c.border};
            background: \${c.bg};
            color: \${c.color};
            transition: all 0.2s ease;
            font-family: inherit;
          }
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102,126,234,0.4);
            filter: brightness(1.1);
          }
          button:active { transform: translateY(0); }
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }
        </style>
        <button \${disabled ? 'disabled' : ''}>\${label}</button>
      \`;

      // Set up click handler with cleanup to prevent duplicates
      const btn = this.shadowRoot.querySelector('button');
      if (this._clickHandler) {
        btn.removeEventListener('click', this._clickHandler);
      }
      this._clickHandler = () => {
        this.dispatchEvent(new CustomEvent('a2ui-click', { bubbles: true, detail: { label: this.getAttribute('label') } }));
      };
      btn.addEventListener('click', this._clickHandler);
    }
  }
  if (!customElements.get('a2ui-button')) {
    customElements.define('a2ui-button', A2UIButton);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A2UI Card
  // ═══════════════════════════════════════════════════════════════════════════
  class A2UICard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() { this.render(); }
    static get observedAttributes() { return ['title']; }
    attributeChangedCallback() { if (this.shadowRoot) this.render(); }
    render() {
      const title = escapeHtml(this.getAttribute('title') || '');
      this.shadowRoot.innerHTML = \`
        <style>
          :host {
            display: block;
            background: rgba(255,255,255,0.08);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 16px;
            padding: 24px;
            transition: all 0.3s ease;
          }
          :host(:hover) {
            background: rgba(255,255,255,0.12);
            border-color: rgba(255,255,255,0.25);
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.3);
          }
          .card-title {
            font-size: 18px;
            font-weight: 600;
            color: #fff;
            margin-bottom: 12px;
          }
          .card-content {
            color: rgba(255,255,255,0.8);
            font-size: 14px;
            line-height: 1.6;
          }
        </style>
        \${title ? '<div class="card-title">' + title + '</div>' : ''}
        <div class="card-content"><slot></slot></div>
      \`;
    }
  }
  if (!customElements.get('a2ui-card')) {
    customElements.define('a2ui-card', A2UICard);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A2UI Row
  // ═══════════════════════════════════════════════════════════════════════════
  class A2UIRow extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() { this.render(); }
    render() {
      const gap = sanitizeSize(this.getAttribute('gap'), '16px');
      const align = this.getAttribute('alignment') || 'stretch';
      const dist = this.getAttribute('distribution') || 'start';

      // 安全的对齐方式映射
      const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
      const distMap = { start: 'flex-start', center: 'center', end: 'flex-end', spaceBetween: 'space-between', spaceAround: 'space-around' };
      const safeAlign = alignMap[align] || 'stretch';
      const safeDist = distMap[dist] || 'flex-start';

      this.shadowRoot.innerHTML = \`
        <style>
          :host {
            display: flex;
            flex-direction: row;
            gap: \${gap};
            align-items: \${safeAlign};
            justify-content: \${safeDist};
          }
        </style>
        <slot></slot>
      \`;
    }
  }
  if (!customElements.get('a2ui-row')) {
    customElements.define('a2ui-row', A2UIRow);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A2UI Column
  // ═══════════════════════════════════════════════════════════════════════════
  class A2UIColumn extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() { this.render(); }
    render() {
      const gap = sanitizeSize(this.getAttribute('gap'), '16px');
      const align = this.getAttribute('alignment') || 'stretch';

      // 安全的对齐方式映射
      const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
      const safeAlign = alignMap[align] || 'stretch';

      this.shadowRoot.innerHTML = \`
        <style>
          :host {
            display: flex;
            flex-direction: column;
            gap: \${gap};
            align-items: \${safeAlign};
          }
        </style>
        <slot></slot>
      \`;
    }
  }
  if (!customElements.get('a2ui-column')) {
    customElements.define('a2ui-column', A2UIColumn);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A2UI Slider
  // ═══════════════════════════════════════════════════════════════════════════
  class A2UISlider extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._inputHandler = null;
    }
    connectedCallback() { this.render(); }
    static get observedAttributes() { return ['value', 'minValue', 'maxValue']; }
    attributeChangedCallback() { if (this.shadowRoot.querySelector('input')) this.render(); }

    setupEvents() {
      const input = this.shadowRoot.querySelector('input');
      if (!input) return;

      // Remove existing listener to prevent duplicates
      if (this._inputHandler) {
        input.removeEventListener('input', this._inputHandler);
      }

      this._inputHandler = (e) => {
        this.setAttribute('value', e.target.value);
        this.dispatchEvent(new CustomEvent('a2ui-change', { bubbles: true, detail: { value: e.target.value } }));
      };
      input.addEventListener('input', this._inputHandler);
    }

    render() {
      const min = sanitizeNumber(this.getAttribute('minValue'), 0, -1000000, 1000000);
      const max = sanitizeNumber(this.getAttribute('maxValue'), 100, -1000000, 1000000);
      const value = sanitizeNumber(this.getAttribute('value'), 50, min, max);
      // Prevent divide by zero
      const range = max - min;
      const percent = range !== 0 ? Math.max(0, Math.min(100, ((value - min) / range) * 100)) : 0;

      this.shadowRoot.innerHTML = \`
        <style>
          :host {
            display: flex;
            align-items: center;
            gap: 16px;
            width: 100%;
          }
          input[type="range"] {
            flex: 1;
            height: 6px;
            -webkit-appearance: none;
            background: linear-gradient(to right, #667eea 0%, #667eea \${percent}%, rgba(255,255,255,0.2) \${percent}%, rgba(255,255,255,0.2) 100%);
            border-radius: 3px;
            cursor: pointer;
          }
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 20px;
            height: 20px;
            background: #fff;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: transform 0.15s;
          }
          input[type="range"]::-webkit-slider-thumb:hover {
            transform: scale(1.2);
          }
          .value {
            min-width: 40px;
            text-align: right;
            font-size: 14px;
            font-weight: 600;
            color: #fff;
          }
        </style>
        <input type="range" min="\${min}" max="\${max}" value="\${value}">
        <span class="value">\${Math.round(value)}</span>
      \`;
      this.setupEvents();
    }
  }
  if (!customElements.get('a2ui-slider')) {
    customElements.define('a2ui-slider', A2UISlider);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A2UI Tabs
  // ═══════════════════════════════════════════════════════════════════════════
  class A2UITabs extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._activeIndex = 0;
    }
    connectedCallback() {
      setTimeout(() => this.render(), 0); // Wait for children
    }
    render() {
      const tabs = Array.from(this.querySelectorAll('a2ui-tab'));
      if (tabs.length === 0) return;

      const headers = tabs.map((tab, i) => {
        const title = escapeHtml(tab.getAttribute('title') || 'Tab ' + (i + 1));
        const active = i === this._activeIndex ? 'active' : '';
        return '<button class="tab-btn ' + active + '" data-index="' + i + '">' + title + '</button>';
      }).join('');

      this.shadowRoot.innerHTML = \`
        <style>
          :host { display: block; }
          .tabs-header {
            display: flex;
            gap: 4px;
            background: rgba(255,255,255,0.05);
            padding: 4px;
            border-radius: 12px;
            margin-bottom: 16px;
          }
          .tab-btn {
            flex: 1;
            padding: 12px 20px;
            border: none;
            background: transparent;
            color: rgba(255,255,255,0.6);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border-radius: 8px;
            transition: all 0.2s;
          }
          .tab-btn:hover {
            color: rgba(255,255,255,0.9);
            background: rgba(255,255,255,0.05);
          }
          .tab-btn.active {
            background: rgba(102,126,234,0.3);
            color: #fff;
          }
          .tabs-content { color: #fff; }
        </style>
        <div class="tabs-header">\${headers}</div>
        <div class="tabs-content"><slot></slot></div>
      \`;

      // Hide inactive tabs
      tabs.forEach((tab, i) => {
        tab.style.display = i === this._activeIndex ? 'block' : 'none';
      });

      // Tab click events
      this.shadowRoot.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this._activeIndex = parseInt(btn.dataset.index);
          this.render();
        });
      });
    }
  }
  if (!customElements.get('a2ui-tabs')) {
    customElements.define('a2ui-tabs', A2UITabs);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A2UI Tab (child of Tabs)
  // ═══════════════════════════════════════════════════════════════════════════
  class A2UITab extends HTMLElement {
    constructor() { super(); }
    connectedCallback() {
      this.style.display = 'none'; // Hidden by default, parent controls visibility
    }
  }
  if (!customElements.get('a2ui-tab')) {
    customElements.define('a2ui-tab', A2UITab);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A2UI Text
  // ═══════════════════════════════════════════════════════════════════════════
  class A2UIText extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() { this.render(); }
    static get observedAttributes() { return ['text', 'usageHint']; }
    attributeChangedCallback() { if (this.shadowRoot) this.render(); }
    render() {
      const text = escapeHtml(this.getAttribute('text') || this.textContent || '');
      const hint = this.getAttribute('usageHint') || 'body';

      // 预定义的安全样式映射
      const styles = {
        headline: 'font-size: 48px; font-weight: 800; color: #fff;',
        title: 'font-size: 32px; font-weight: 700; color: #fff;',
        subtitle: 'font-size: 20px; font-weight: 500; color: rgba(255,255,255,0.8);',
        body: 'font-size: 16px; color: rgba(255,255,255,0.9); line-height: 1.6;',
        caption: 'font-size: 12px; color: rgba(255,255,255,0.5);',
        label: 'font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 1px;'
      };
      const safeStyle = styles[hint] || styles.body;

      this.shadowRoot.innerHTML = \`
        <style>
          :host { display: block; \${safeStyle} }
        </style>
        \${text}
      \`;
    }
  }
  if (!customElements.get('a2ui-text')) {
    customElements.define('a2ui-text', A2UIText);
  }

  console.log('[A2UI] Lightweight components registered successfully');
  window.dispatchEvent(new CustomEvent('a2ui-ready'));
})();
</script>
`;

/**
 * 注入 A2UI 运行时到 HTML
 */
export function injectA2UIRuntime(html, options = {}) {
  if (!hasA2UIComponents(html)) return html

  // 检查是否有 </head> 标签
  if (html.includes('</head>')) {
    return html.replace('</head>', `${A2UI_COMPONENTS_SCRIPT}\n</head>`)
  }

  // 如果没有 head 标签，在 body 开始处注入
  if (html.includes('<body')) {
    return html.replace(/<body[^>]*>/, (match) => `${match}\n${A2UI_COMPONENTS_SCRIPT}`)
  }

  // 最后备选：在开头注入
  return A2UI_COMPONENTS_SCRIPT + html
}

/**
 * 预加载（现在是空操作，因为组件是内联的）
 */
export function preloadA2UI() {
  // No-op: components are self-contained
}

/**
 * 获取支持的 A2UI 组件列表
 */
export function getSupportedComponents() {
  return [...A2UI_TAGS]
}

/**
 * 检查特定组件是否被支持
 */
export function isComponentSupported(tagName) {
  return A2UI_TAGS.includes(tagName.toLowerCase())
}
