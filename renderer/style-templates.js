/**
 * style-templates.js — PPT style templates
 * Color palettes inspired by skills/theme-factory and pptx skill design guidelines
 */

export const STYLE_TEMPLATES = [
  {
    id: 'business',
    name: '商务专业',
    emoji: '💼',
    description: '深蓝系，沉稳有力',
    colors: {
      primary: '#1E2761',    // navy
      secondary: '#CADCFC',  // ice blue
      accent: '#F59E0B',     // amber
      background: '#0F1728',
      text: '#F0F4FF',
      textMuted: '#8A9BB5'
    },
    fonts: { title: 'bold', body: 'normal', titleSize: '48px', bodySize: '19px' },
    layout: 'formal',
    promptHint: '商务深蓝风格，navy蓝主色配冰蓝辅色，琥珀色强调，沉稳专业，封面深色，内容页浅色交替'
  },
  {
    id: 'tech',
    name: '科技电光',
    emoji: '⚡',
    description: '纯黑底，电光蓝青',
    colors: {
      primary: '#0066FF',    // electric blue
      secondary: '#00FFFF',  // neon cyan
      accent: '#FF6B35',
      background: '#1E1E1E',
      text: '#FFFFFF',
      textMuted: '#9DA8B7'
    },
    fonts: { title: 'bold', body: 'normal', titleSize: '52px', bodySize: '18px' },
    layout: 'tech',
    promptHint: '科技感风格，纯黑背景，电光蓝和霓虹青配色，高对比度，数据可视化元素，禁止使用标题装饰线'
  },
  {
    id: 'coral-energy',
    name: '活力珊瑚',
    emoji: '🔥',
    description: '珊瑚红+金色，充满活力',
    colors: {
      primary: '#F96167',    // coral
      secondary: '#F9E795',  // gold
      accent: '#2F3C7E',     // navy
      background: '#1A1025',
      text: '#FFF5F5',
      textMuted: '#D4A0A0'
    },
    fonts: { title: 'bold', body: 'normal', titleSize: '50px', bodySize: '19px' },
    layout: 'creative',
    promptHint: '活力珊瑚风格，珊瑚红主色、金色辅色、海军蓝点缀，鲜艳大胆，适合营销和创意内容'
  },
  {
    id: 'clean',
    name: '简约白',
    emoji: '✨',
    description: '白底，炭灰+深蓝',
    colors: {
      primary: '#36454F',    // charcoal
      secondary: '#708090',  // slate
      accent: '#0066CC',
      background: '#FFFFFF',
      text: '#1A1A2E',
      textMuted: '#6B7280'
    },
    fonts: { title: 'bold', body: 'normal', titleSize: '44px', bodySize: '18px' },
    layout: 'minimal',
    promptHint: '简约清新风格，白色背景，炭灰和石板色为主，大量留白，线条简洁，适合数据报告和商业提案'
  },
  {
    id: 'midnight-galaxy',
    name: '午夜星系',
    emoji: '🌌',
    description: '深紫+宇宙蓝，戏剧感',
    colors: {
      primary: '#4A4E8F',    // cosmic blue
      secondary: '#A490C2',  // lavender
      accent: '#E6E6FA',     // silver
      background: '#2B1E3E',
      text: '#E6E6FA',
      textMuted: '#8A7BAA'
    },
    fonts: { title: 'bold', body: 'light', titleSize: '50px', bodySize: '19px' },
    layout: 'dark-elegant',
    promptHint: '午夜星系风格，深紫背景，宇宙蓝和薰衣草色，银色文字，戏剧性高端感，适合娱乐和创意行业'
  },
  {
    id: 'teal-trust',
    name: '蓝绿信任',
    emoji: '🌊',
    description: '青蓝系，清爽专业',
    colors: {
      primary: '#028090',    // teal
      secondary: '#00A896',  // seafoam
      accent: '#02C39A',     // mint
      background: '#FAFAFA',
      text: '#1A2E35',
      textMuted: '#607B80'
    },
    fonts: { title: 'bold', body: 'normal', titleSize: '44px', bodySize: '18px' },
    layout: 'clean',
    promptHint: '蓝绿信任风格，浅白背景，青蓝渐变色系，清爽专业，适合医疗、环保、教育类主题'
  },
  {
    id: 'terracotta',
    name: '暖砖大地',
    emoji: '🌵',
    description: '赤土色+沙色，温暖自然',
    colors: {
      primary: '#B85042',    // terracotta
      secondary: '#E7E8D1',  // sand
      accent: '#A7BEAE',     // sage
      background: '#2A1A17',
      text: '#F5EDE8',
      textMuted: '#C4A89A'
    },
    fonts: { title: 'bold', body: 'normal', titleSize: '46px', bodySize: '18px' },
    layout: 'warm',
    promptHint: '暖砖大地风格，赤土主色、沙色辅色、鼠尾草绿点缀，温暖自然感，适合文化、旅游、食品类'
  },
  {
    id: 'academic',
    name: '学术报告',
    emoji: '📚',
    description: '深蓝严谨，数据友好',
    colors: {
      primary: '#065A82',    // deep blue
      secondary: '#1C7293',  // teal
      accent: '#21295C',     // midnight
      background: '#F8FAFF',
      text: '#1A2535',
      textMuted: '#5A6B7A'
    },
    fonts: { title: 'bold', body: 'normal', titleSize: '40px', bodySize: '17px' },
    layout: 'academic',
    promptHint: '学术报告风格，深海蓝色系，浅白背景，严谨布局，强调数据图表和引用，章节标题清晰'
  }
]

export function getTemplateById(id) {
  return STYLE_TEMPLATES.find(t => t.id === id) || null
}

export function buildStylePrompt(templateId, customParams = {}) {
  const template = getTemplateById(templateId)
  if (!template) return ''

  let prompt = `\n\n风格要求：${template.promptHint}`

  if (customParams.colorTemp !== undefined) {
    const v = customParams.colorTemp
    if (v < 35) prompt += `，整体偏冷色调`
    else if (v > 65) prompt += `，整体偏暖色调`
  }
  if (customParams.contrast !== undefined) {
    const v = customParams.contrast
    if (v > 70) prompt += `，高对比度处理`
    else if (v < 30) prompt += `，柔和低对比度`
  }
  if (customParams.density !== undefined) {
    const v = customParams.density
    if (v > 70) prompt += `，内容丰富密集，多用图表和数据`
    else if (v < 30) prompt += `，极简留白，每页核心要素不超过3个`
  }

  return prompt
}
