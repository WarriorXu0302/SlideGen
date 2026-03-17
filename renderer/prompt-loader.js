/**
 * prompt-loader.js — File-based prompt management
 *
 * Loads system prompts from renderer/prompts/*.md using fetch().
 * Supports {{variable}} interpolation.
 * All prompts are cached in memory after first load.
 *
 * Inspired by OpenMAIC lib/generation/prompts/loader.ts
 */

/** @type {Map<string, string>} */
const promptCache = new Map()

/**
 * Load a prompt from renderer/prompts/{name}.md.
 * Uses import.meta.url so the path resolves correctly in both
 * development (file://) and packaged (asar) Electron builds.
 *
 * @param {string} name  — prompt filename without extension
 * @returns {Promise<string>}
 */
export async function loadPrompt(name) {
  if (promptCache.has(name)) return promptCache.get(name)

  const url = new URL(`./prompts/${name}.md`, import.meta.url)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load prompt "${name}": ${response.status} ${response.statusText}`)
  }

  const text = (await response.text()).trim()
  promptCache.set(name, text)
  return text
}

/**
 * Interpolate {{variable}} placeholders in a template string.
 *
 * @param {string} template
 * @param {Record<string, string | number>} vars
 * @returns {string}
 */
export function interpolate(template, vars = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const val = vars[key]
    return val !== undefined ? String(val) : match
  })
}

/**
 * Load a prompt and apply variable interpolation in one step.
 *
 * @param {string} name
 * @param {Record<string, string | number>} [vars]
 * @returns {Promise<string>}
 */
export async function buildPrompt(name, vars = {}) {
  const template = await loadPrompt(name)
  return interpolate(template, vars)
}

/**
 * Preload all prompts into cache (call once during app init to avoid
 * first-use latency).
 *
 * @param {string[]} names
 */
export async function preloadPrompts(names) {
  await Promise.all(names.map(n => loadPrompt(n).catch(() => {})))
}

/** Clear the prompt cache (useful during development hot-reload). */
export function clearPromptCache() {
  promptCache.clear()
}
