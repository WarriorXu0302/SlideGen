# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PPT HTML Editor is an Electron desktop application for editing and generating HTML-based presentations with AI assistance. The UI is in Chinese (zh-CN).

## Commands

```bash
npm start           # Run the Electron app in development
npm run build:mac   # Build for macOS (dmg)
npm run build:win   # Build for Windows (zip)
npm run build:all   # Build for all platforms
```

## Architecture

### Process Model (Electron)

- **main.js**: Main process - window management, native dialogs, IPC handlers, config storage (JSON in userData), file parsing (mammoth for DOCX, pdf-parse for PDF)
- **preload.js**: Secure IPC bridge exposing `window.electronAPI` to renderer
- **renderer/**: Browser context code (ES modules)

### Renderer Modules

- **app.js**: Main controller - state management, navigation, undo/redo, presentation mode. Exposes `window.appState` for cross-module access
- **parser.js**: Multi-strategy HTML parser supporting 4 formats:
  - `section-data-slide`: `<section data-slide="N">` elements
  - `iframe-srcdoc`: `<iframe srcdoc="...">` elements (preserves wrapper template)
  - `generic`: `<section>`, `div.slide`, or `div[class*="slide"]`
  - `raw`: Entire document as single slide
- **editor.js**: CodeMirror 6 source editor (loaded from esm.sh CDN) + visual inline editing via contentEditable
- **ai-panel.js**: AI generation with OpenAI-compatible streaming API, memory files (context injection), style templates, and intent detection
- **exporter.js**: Export to PPTX (image-based), editable PPTX (text extraction), PDF, PNG/JPEG using html2canvas, jsPDF, pptxgenjs
- **style-templates.js**: Color palette definitions for 8 built-in styles
- **intent-detector.js**: Keyword/pattern matching to route user input between generate vs modify

### Key Design Patterns

1. **Slide Storage**: Each slide is a standalone HTML document (1280x720px) rendered in sandboxed iframes. Thumbnails use blob URLs with IntersectionObserver for lazy loading.

2. **HTML Reconstruction**: `reconstructHTML()` rebuilds the full document from slides based on the detected format, preserving original wrapper templates for iframe-srcdoc format.

3. **State Flow**: State changes go through `applySlideContent()` which handles undo stack, dirty flag, thumbnail refresh, and preview updates.

4. **AI Streaming**: Uses fetch with streaming response body reader. Prompts include system rules for slide design (CSS requirements, forbidden patterns like title underlines).

5. **Config Persistence**: Stored in Electron's userData as config.json - includes API settings, recent files, memory files, and style preferences.

### CDN Dependencies (loaded in index.html)

- html2canvas, jsPDF, JSZip, pptxgenjs (UMD bundles)
- CodeMirror 6 (loaded dynamically from esm.sh in editor.js)
