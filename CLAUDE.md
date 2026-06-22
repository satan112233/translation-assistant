# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Windows desktop translation assistant built with Electron, Vite, React, and TypeScript. It supports multiple OpenAI-compatible LLM providers (DeepSeek, OpenAI, Gemini, Zhipu AI) for translations between Chinese, English, and Japanese.

## Common Commands

- `npm run dev` — Start the Electron app in development mode.
- `npm run build` — Type-check and build the production renderer and Electron main/preload bundles.
- `npm run typecheck` — Run TypeScript checks for both renderer and main process configs.
- `npm run preview` — Preview the production build with Electron.
- `npm run dist` — Build and package the app into a Windows installer.

There are currently no test scripts configured.

## Architecture

The project is structured around three Electron processes:

- **`src/main/`** — Electron main process. Creates the window, manages the system tray, registers global shortcuts (`Ctrl+Shift+T`), persists settings via `electron-store`, makes all LLM API requests, runs OCR via `tesseract.js`, and polls clipboard when clipboard monitoring is enabled.
- **`src/preload/`** — Preload script, built as CommonJS. Exposes a typed `window.electronAPI` bridge so the renderer can invoke main-process IPC handlers safely.
- **`src/renderer/`** — React application. Manages UI state with Zustand and renders the translation interface.
- **`src/shared/`** — Shared TypeScript types used by both main and renderer.

### Key IPC Channels

The renderer communicates with the main process through these channels:

- `get-settings` / `set-settings` — Load and persist app settings (API keys, provider config, window bounds, always-on-top state, theme, popup target language, clipboard monitor).
- `translate` — Send translation parameters to the main process, which calls the LLM and returns the result.
- `ocr-image` — Send a base64 image to the main process for OCR text recognition.
- `get-history` / `add-history` / `clear-history` / `delete-history-item` — Translation history management.
- `get-favorites` / `add-favorite` / `delete-favorite` / `update-favorite-note` — Favorites / vocabulary book management.
- `window-minimize` / `window-close` / `window-set-always-on-top` — Window controls.

### Translation Flow

1. User types or changes language selection in `TranslationPanel`.
2. If sourceLang is 'auto', a language detection effect may auto-switch targetLang based on input text (zh→en, en→zh, ja→zh).
3. A debounced effect calls `translate()` in the `useTranslationStore`.
4. The store builds a `TranslateRequest` and calls `window.electronAPI.translate()`.
5. The main process receives the request, constructs an `OpenAICompatibleProvider`, builds the system/user prompts, and calls the provider's `/chat/completions` endpoint.
6. The provider parses the JSON response and returns `TranslationResult` back to the renderer.

### Provider System

Providers live in `src/main/providers/`. `OpenAICompatibleProvider` is the only implementation. It expects a `baseUrl`, `apiKey`, and `model`, and calls `{baseUrl}/chat/completions`. Default configs and labels for all providers are in `src/main/providers/index.ts`. To add a new provider, add its default config and label there and update the default settings in `src/main/index.ts`.

### Settings Persistence

Settings are stored with `electron-store` in the main process. On first load, the renderer merges stored settings with `DEFAULT_PROVIDER_CONFIGS` so new providers can be introduced without losing saved API keys.

### OCR (tesseract.js)

- The main process creates a tesseract worker at app startup (`initOcrWorker`) for fast first-use response.
- The worker loads `chi_sim+eng+jpn` language packs from CDN on first run (~5-6MB). Subsequent OCR requests reuse the worker.
- The `ocr-image` IPC handler receives a base64 image and returns recognized text.

### Clipboard Monitor

- When enabled via `settings.clipboardMonitor`, the main process polls the clipboard every 500ms.
- On detecting new text (≥2 chars), it spawns a popup window for translation.
- Monitoring is automatically suppressed while the main window is focused to avoid interrupting the user.

## Important Implementation Details

- The window is frameless (`frame: false`). Dragging is enabled by the `.app-drag-region` class on the title bar, which sets `-webkit-app-region: drag`. Buttons inside it use `-webkit-app-region: no-drag`.
- The preload script must be built as CommonJS (`formats: ['cjs']` in `electron.vite.config.ts`). An ESM preload will fail with `Cannot use import statement outside a module` under Electron's sandbox.
- In development, the main process reads the dev server URL from `process.env.ELECTRON_RENDERER_URL`, which `electron-vite` v5 sets when spawning Electron. `VITE_DEV_SERVER_URL` is not used in this version.
- The renderer never calls the LLM API directly; all network requests go through the main process to avoid CORS.
- `__APP_VERSION__` is injected at build time from `package.json` via `electron.vite.config.ts` and displayed in the title bar.
- Theme switching uses Tailwind's `darkMode: 'class'` strategy. The `useTheme` hook in `src/renderer/hooks/useTheme.ts` toggles the `.dark` class on `<html>` and listens to OS color-scheme changes in `system` mode.
- Cross-selection translation uses `koffi` to call Windows `user32.dll` APIs and simulate `Ctrl+C` on the foreground window.
- Auto target language switching: in `TranslationPanel` and `PopupPanel`, when `sourceLang === 'auto'`, the `detectInputLanguage()` function scans input text and sets `targetLang` to avoid same-language translation (zh→en, en→zh, ja→zh).

## TypeScript Configuration

- `tsconfig.app.json` covers `src/renderer` and `src/shared` with DOM types.
- `tsconfig.node.json` covers `src/main`, `src/preload`, `src/shared`, and `electron.vite.config.ts` with Node types.
- Both configs enable `verbatimModuleSyntax` and `erasableSyntaxOnly`, so avoid TypeScript parameter properties and other features requiring runtime emission.

## File Locations

- Main entry: `src/main/index.ts`
- Preload entry: `src/preload/index.ts`
- Renderer entry: `src/renderer/main.tsx`
- Build config: `electron.vite.config.ts`
- Shared types: `src/shared/types/index.ts`
- Provider implementation: `src/main/providers/openaiCompatible.ts`
- Provider configs & labels: `src/main/providers/index.ts`
- Prompts: `src/main/utils/prompts.ts`
- Theme hook: `src/renderer/hooks/useTheme.ts`
- Settings UI: `src/renderer/components/SettingsModal.tsx`
- Translation UI: `src/renderer/components/TranslationPanel.tsx`
- Confirm dialog: `src/renderer/components/ConfirmDialog.tsx`
- Popup panel (cross-selection): `src/renderer/components/PopupPanel.tsx`
- History panel: `src/renderer/components/HistoryPanel.tsx`
- Favorites panel: `src/renderer/components/FavoritesPanel.tsx`

## Packaging

`electron-builder` is configured implicitly through the `dist` script. The `main` field in `package.json` points to `dist-electron/main/index.js` for packaged builds.
