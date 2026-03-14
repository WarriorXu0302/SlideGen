/**
 * intent-detector.js — Detect user intent to route between generate and modify
 */

const MODIFY_KEYWORDS = [
  '修改', '更改', '改变', '调整', '修复', '替换', '删除', '移除', '添加到',
  '把', '将', '让它', '让这', '使其', '变成', '改成', '改为',
  '更大', '更小', '更亮', '更暗', '更简洁',
  '颜色', '字体', '字号', '背景', '布局', '对齐',
  '换成', '改用', '重新排', '移到', '放到',
  'change', 'modify', 'update', 'fix', 'replace', 'remove', 'delete', 'add',
  'make it', 'turn it', 'set the', 'resize', 'recolor', 'restyle'
]

const GENERATE_KEYWORDS = [
  '生成', '创建', '新建', '制作', '写一个', '做一个', '帮我做',
  '关于', '主题是', '介绍', '讲解', '演示',
  'generate', 'create', 'make', 'build', 'write', 'design', 'produce'
]

const CONTEXT_MODIFY_PATTERNS = [
  /把[^，。,\.]+改/,
  /将[^，。,\.]+改/,
  /把[^，。,\.]+换/,
  /(?:这|这个)[^，。,\.]*[改换调整]/,
  /标题[^，。,\.]*[改换]/,
  /颜色[^，。,\.]*[改换调整]/,
  /字体[^，。,\.]*[改换调整]/
]

/**
 * Detect if user input is a modification instruction or a generation request.
 * Returns: { intent: 'modify' | 'generate' | 'unclear', confidence: 0-1, suggestion: string }
 */
export function detectIntent(input, hasExistingSlides = false) {
  if (!input || !input.trim()) {
    return { intent: 'unclear', confidence: 0, suggestion: '' }
  }

  const text = input.trim().toLowerCase()
  let modifyScore = 0
  let generateScore = 0

  // Check modify keywords
  for (const kw of MODIFY_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) modifyScore += 1
  }

  // Check generate keywords
  for (const kw of GENERATE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) generateScore += 1
  }

  // Check modify patterns (stronger signal)
  // Note: patterns contain Chinese chars which are case-insensitive,
  // but we test against original input to preserve pattern matching accuracy
  for (const pattern of CONTEXT_MODIFY_PATTERNS) {
    if (pattern.test(input)) modifyScore += 2
  }

  // If there are existing slides, lean toward modify for ambiguous cases
  if (hasExistingSlides && modifyScore > 0) modifyScore += 0.5

  // Short imperative phrases without a topic lean toward modify
  if (input.length < 30 && modifyScore > 0) modifyScore += 0.5

  // Longer inputs with a clear subject lean toward generate
  if (input.length > 50 && generateScore > 0) generateScore += 0.5

  const total = modifyScore + generateScore
  if (total === 0) {
    // No clear signal: if slides exist, lean toward modify; otherwise generate
    return {
      intent: hasExistingSlides ? 'modify' : 'generate',
      confidence: 0.4,
      suggestion: hasExistingSlides
        ? '检测到您可能想修改当前幻灯片'
        : '检测到您可能想生成新的PPT'
    }
  }

  const modifyConf = modifyScore / total
  const generateConf = generateScore / total

  if (modifyConf >= 0.6) {
    return {
      intent: 'modify',
      confidence: Math.min(modifyConf, 0.95),
      suggestion: '建议使用"修改当前页"功能'
    }
  } else if (generateConf >= 0.6) {
    return {
      intent: 'generate',
      confidence: Math.min(generateConf, 0.95),
      suggestion: '建议使用"全新生成"功能'
    }
  }

  return {
    intent: 'unclear',
    confidence: 0.5,
    suggestion: '您可以选择生成或修改功能'
  }
}

/**
 * Extract topic from a generate-intent input.
 * Strips common filler words to get the core subject.
 */
export function extractTopic(input) {
  const fillers = ['帮我做一个', '帮我生成', '生成一个', '创建一个', '制作一个', '写一个', '做一个关于', '关于']
  let topic = input.trim()
  for (const filler of fillers) {
    if (topic.startsWith(filler)) {
      topic = topic.slice(filler.length).trim()
      break
    }
  }
  return topic
}
