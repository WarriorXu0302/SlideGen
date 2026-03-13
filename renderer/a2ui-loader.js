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
 */
const A2UI_COMPONENTS_SCRIPT = `
<script>
(function() {
  // 防止重复注册
  if (window.__a2uiRegistered) return;
  window.__a2uiRegistered = true;

  // ═══════════════════════════════════════════════════════════════════════════
  // A2UI Button
  // ═══════════════════════════════════════════════════════════════════════════
  class A2UIButton extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
      this.render();
      this.shadowRoot.querySelector('button').addEventListener('click', (e) => {
        this.dispatchEvent(new CustomEvent('a2ui-click', { bubbles: true, detail: { label: this.getAttribute('label') } }));
      });
    }
    static get observedAttributes() { return ['label', 'variant', 'disabled']; }
    attributeChangedCallback() { if (this.shadowRoot) this.render(); }
    render() {
      const label = this.getAttribute('label') || this.textContent || 'Button';
      const variant = this.getAttribute('variant') || 'primary';
      const disabled = this.hasAttribute('disabled');

      const colors = {
        primary: { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'transparent' },
        secondary: { bg: 'transparent', color: '#667eea', border: '#667eea' },
        default: { bg: 'rgba(255,255,255,0.1)', color: '#fff', border: 'rgba(255,255,255,0.3)' }
      };
      const c = colors[variant] || colors.default;

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
          button:active {
            transform: translateY(0);
          }
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }
        </style>
        <button \${disabled ? 'disabled' : ''}>\${label}</button>
      \`;
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
      const title = this.getAttribute('title') || '';
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
      const gap = this.getAttribute('gap') || '16px';
      const align = this.getAttribute('alignment') || 'stretch';
      const dist = this.getAttribute('distribution') || 'start';
      const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
      const distMap = { start: 'flex-start', center: 'center', end: 'flex-end', spaceBetween: 'space-between', spaceAround: 'space-around' };

      this.shadowRoot.innerHTML = \`
        <style>
          :host {
            display: flex;
            flex-direction: row;
            gap: \${gap};
            align-items: \${alignMap[align] || align};
            justify-content: \${distMap[dist] || dist};
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
      const gap = this.getAttribute('gap') || '16px';
      const align = this.getAttribute('alignment') || 'stretch';

      this.shadowRoot.innerHTML = \`
        <style>
          :host {
            display: flex;
            flex-direction: column;
            gap: \${gap};
            align-items: \${align === 'center' ? 'center' : align === 'end' ? 'flex-end' : 'stretch'};
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
    }
    connectedCallback() { this.render(); this.setupEvents(); }
    static get observedAttributes() { return ['value', 'minValue', 'maxValue']; }
    attributeChangedCallback() { if (this.shadowRoot.querySelector('input')) this.render(); }

    setupEvents() {
      const input = this.shadowRoot.querySelector('input');
      if (input) {
        input.addEventListener('input', (e) => {
          this.setAttribute('value', e.target.value);
          this.dispatchEvent(new CustomEvent('a2ui-change', { bubbles: true, detail: { value: e.target.value } }));
        });
      }
    }

    render() {
      const value = parseFloat(this.getAttribute('value')) || 50;
      const min = parseFloat(this.getAttribute('minValue')) || 0;
      const max = parseFloat(this.getAttribute('maxValue')) || 100;
      const percent = ((value - min) / (max - min)) * 100;

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
        const title = tab.getAttribute('title') || 'Tab ' + (i + 1);
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
          .tabs-content {
            color: #fff;
          }
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
    constructor() {
      super();
    }
    connectedCallback() {
      this.style.display = 'none'; // Hidden by default, parent controls visibility
    }
  }
  if (!customElements.get('a2ui-tab')) {
    customElements.define('a2ui-tab', A2UITab);
  }

  // ══════════════════════════════════════��════════════════════════════════════
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
      const text = this.getAttribute('text') || this.textContent || '';
      const hint = this.getAttribute('usageHint') || 'body';

      const styles = {
        headline: 'font-size: 48px; font-weight: 800; color: #fff;',
        title: 'font-size: 32px; font-weight: 700; color: #fff;',
        subtitle: 'font-size: 20px; font-weight: 500; color: rgba(255,255,255,0.8);',
        body: 'font-size: 16px; color: rgba(255,255,255,0.9); line-height: 1.6;',
        caption: 'font-size: 12px; color: rgba(255,255,255,0.5);',
        label: 'font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 1px;'
      };

      this.shadowRoot.innerHTML = \`
        <style>
          :host { display: block; \${styles[hint] || styles.body} }
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
