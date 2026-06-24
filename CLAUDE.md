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

- **`src/main/`** — Electron main process. Creates the window, manages the system tray, registers global shortcuts (`Ctrl+Shift+T` and `Ctrl+Shift+C` for cross-selection), persists settings via `electron-store`, makes all LLM API requests, runs OCR via `tesseract.js`, runs speech recognition via Zhipu ASR, iFlytek ASR, or offline `whisper.cpp`, saves speech optimization records, and polls clipboard when clipboard monitoring is enabled.
- **`src/preload/`** — Preload script, built as CommonJS. Exposes a typed `window.electronAPI` bridge so the renderer can invoke main-process IPC handlers safely.
- **`src/renderer/`** — React application. Manages UI state with Zustand and renders the translation interface.
- **`src/shared/`** — Shared TypeScript types used by both main and renderer.

### Key IPC Channels

The renderer communicates with the main process through these channels:

- `get-settings` / `set-settings` — Load and persist app settings (API keys, provider config, window bounds, always-on-top state, theme, popup target language, clipboard monitor, shortcuts, comparison mode, glossary, popup pinned state, auto-copy result, voice input enabled, voice input language).
- `get-glossary` / `set-glossary` — Load and persist the terminology glossary used to guide translations.
- `translate` — Send translation parameters to the main process, which calls a single LLM and returns the result.
- `translate-multi` — Send parameters for multiple configured providers; the main process calls them in parallel and returns per-provider results.
- `ocr-image` — Send a base64 image to the main process for OCR text recognition.
- `transcribe-audio` — Send a base64 WAV audio to the main process for speech-to-text via Zhipu ASR, iFlytek ASR, or whisper.cpp.
- `global-voice-result` — Sent by the hidden `voiceWin` to the main process with the final transcribed (and optionally optimized) text; the main process closes the recording popup and pastes the text into the original foreground window.
- `stop-global-recording-manual` / `cancel-global-voice` — Sent by `RecordingPopup` when the user clicks confirm/cancel; the main process forwards `start-global-recording` / `stop-global-recording` / `cancel-global-recording` to `voiceWin`.
- `recording-state` / `recording-popup-state` / `recording-popup-ready` — State synchronization between `voiceWin`, the main process, and `recordingPopupWin`.
- `read-text-file` / `save-text-file` — Read a dragged `.txt` / `.md` file or save translation result to disk.
- `get-history` / `add-history` / `clear-history` / `delete-history-item` — Translation history management.
- `get-speech-optimizations` / `add-speech-optimization` / `clear-speech-optimizations` / `delete-speech-optimization-item` — Speech optimization record management (raw vs optimized ASR text).
- `get-favorites` / `add-favorite` / `delete-favorite` / `update-favorite-note` — Favorites / vocabulary book management.
- `window-minimize` / `window-close` / `window-set-always-on-top` — Window controls.

### Translation Flow

1. User types or changes language selection in `TranslationPanel`.
2. If sourceLang is 'auto', a language detection effect may auto-switch targetLang based on input text (zh→en, en→zh, ja→zh).
3. A debounced effect calls `translate()` in the `useTranslationStore`.
4. The store checks `settings.comparisonMode` and the number of configured providers (providers with a non-empty `apiKey`).
   - In single-provider mode, it builds a `TranslateRequest` and calls `window.electronAPI.translate()`.
   - In comparison mode (≥2 configured providers), it builds a `MultiTranslateRequest` and calls `window.electronAPI.translateMulti()`.
5. The main process receives the request, constructs one or more `OpenAICompatibleProvider` instances, builds the system/user prompts, and calls each provider's `/chat/completions` endpoint.
6. The provider parses the JSON response and returns `TranslationResult` back to the renderer.
7. The renderer displays a single result or a card for each provider, depending on the mode.

### Provider System

Providers live in `src/main/providers/`. `OpenAICompatibleProvider` is the only implementation. It expects a `baseUrl`, `apiKey`, and `model`, and calls `{baseUrl}/chat/completions`. Default configs and labels for all providers are in `src/main/providers/index.ts`. To add a new provider, add its default config and label there and update the default settings in `src/main/index.ts`.

### Settings Persistence

Settings are stored with `electron-store` in the main process. On first load, the renderer merges stored settings with `DEFAULT_PROVIDER_CONFIGS` so new providers can be introduced without losing saved API keys.

### OCR (tesseract.js)

- The main process creates a tesseract worker at app startup (`initOcrWorker`) for fast first-use response.
- The worker loads `chi_sim+eng+jpn` language packs from CDN on first run (~5-6MB). Subsequent OCR requests reuse the worker.
- The `ocr-image` IPC handler receives a base64 image and returns recognized text.

### Voice Input (whisper.cpp / Zhipu ASR / iFlytek ASR / DeepSeek optimization)

The voice input system uses two renderer windows when invoked outside the main app:

- **`voiceWin`** (`mode=voice`) — a hidden 1×1 window that owns the actual recording state. It loads `VoiceRecordingPanel`, which starts `MediaRecorder`, converts audio to 16kHz mono WAV, and sends it to the main process through `transcribe-audio`.
- **`recordingPopupWin`** (`mode=recording-popup`) — a visible mini popup that displays recording progress. It loads `RecordingPopup` and receives state updates from `voiceWin` via the main process.

Pressing the configured **voice input shortcut** (default `Ctrl+Alt+V`) toggles recording:

- Inside the main window, the local `RecordingPanel` appears at the bottom-center (cancel button, sound-wave animation, confirm button).
- Outside the main window, `createRecordingPopupWindow()` creates a `RecordingPopup` near the cursor. The popup is styled like `PopupPanel` (title bar + content area) and shows recording / transcribing states.

`settings.voiceInputProvider` selects the recognition backend:

- `'zhipu'` (default when Zhipu API key is configured): sends audio to Zhipu AI's `glm-asr-2512` ASR endpoint.
- `'iflytek'`: sends audio to iFlytek's Chinese-English ASR WebSocket endpoint (`wss://iat.xf-yun.com/v1`). Supports Chinese and English. Requires `appId`, `apiKey`, and `apiSecret` from the iFlytek console.
- `'local'`: the main process writes the WAV to a temp file, calls `whisper-cli.exe` from `resources/whisper/` (packaged via `extraResources`), and returns the transcribed text.

When `settings.voiceInputOptimize` is enabled, the raw ASR text is sent to DeepSeek via `src/main/utils/speech-optimizer.ts` to remove filler words, repetitions, and oral clutter, producing concise written text before it is returned to the renderer. The optimizer prompt explicitly handles **self-correction** (when the speaker changes their mind mid-sentence, e.g. "三点……不对，是十点", only the final intent is kept). `optimizeSpeech(text, config, glossary?)` also accepts the terminology glossary (`settings.glossary`): the glossary terms are injected as a "correct spelling reference" so the optimizer fixes ASR mis-recognitions of proper nouns, brand names, and technical terms. The pair `{ rawText, optimizedText }` is saved to `store.get('speechOptimizations')` (max 20 records) so users can review the before/after in the `SpeechOptimizationPanel` accessible from the left sidebar.

The `ggml-base-q8_0.gguf` model (~75MB) is downloaded on first use for local mode to `app.getPath('userData')/whisper/models/`.

Voice input can be enabled/disabled, the provider chosen, optimization toggled, and its language hint configured in `SettingsPanel`.

### Voice Input State Sync

Because `voiceWin` and `recordingPopupWin` are separate renderer processes with separate Zustand stores, recording state is synchronized through the main process:

- `VoiceRecordingPanel` sends `recording-state` to the main process whenever `isRecording`, `isTranscribing`, or `recordingDuration` changes.
- The main process stores the latest state in `pendingRecordingState` and forwards it to `recordingPopupWin` via `recording-popup-state`.
- `RecordingPopup` registers a listener for `recording-popup-state` and calls `recordingPopupReady()` after mounting so the main process can push the pending state immediately.

### Cancel vs. Confirm

Voice recording distinguishes between **cancel** and **confirm/complete**:

- **Cancel** (`cancelRecording()`): stops the recorder, discards captured audio, and skips transcription/optimization/paste. Used by the cancel button in `RecordingPanel`/`RecordingPopup` and the close button in `RecordingPopup`.
- **Confirm/Complete** (`stopRecording()`): stops the recorder and proceeds to transcribe → optimize → paste the result.

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
- Document translation: drag a `.txt` or `.md` file onto the input area to read its contents and trigger translation automatically. The renderer uses `window.electronAPI.getFilePath()` (via `electron.webUtils.getPathForFile`) to obtain the real file path, then asks the main process to read the file.
- Customizable global shortcuts: `SettingsModal` exposes inputs for the two global shortcuts. Values are converted to Electron accelerator strings and persisted in `settings.shortcuts`; the main process re-registers shortcuts whenever they change.
- Multi-model comparison translation: when `settings.comparisonMode` is enabled and at least two providers have API keys, the store calls `translate-multi`. The main process uses `Promise.allSettled()` so a failure in one provider does not affect the others.
- Terminology glossary: users can add terms and their preferred translations in `GlossaryPanel`. The main process injects the glossary into the translation prompt so the model follows the specified terms.
- Left sidebar navigation: `MainLayout` renders `Sidebar` plus the active content view (`TranslationPanel`, `GlossaryPanel`, `FavoritesPanel`, `HistoryPanel`, `SpeechOptimizationPanel`, or `SettingsPanel`). `useUIStore` tracks `activeView` and `sidebarCollapsed`.
- Sidebar collapse: `Sidebar` can be collapsed to icon-only mode via the toggle button in its header. The collapsed state is stored in `useUIStore` (not persisted to disk).
- Transcription errors (e.g., ASR provider failures or microphone permission issues) are surfaced through `useRecordingStore.transcriptionError` and rendered in `ErrorDialog` from `MainLayout`. The dialog shows the error message and a copy button so users can easily share the raw error text.

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
- Sidebar / navigation: `src/renderer/components/Sidebar.tsx`
- Main layout / view switcher: `src/renderer/components/MainLayout.tsx`
- Shortcut input component: `src/renderer/components/ShortcutInput.tsx`
- Confirm dialog: `src/renderer/components/ConfirmDialog.tsx`
- Error dialog: `src/renderer/components/ErrorDialog.tsx`
- Popup panel (cross-selection): `src/renderer/components/PopupPanel.tsx`
- Recording panel (in-app): `src/renderer/components/RecordingPanel.tsx`
- Recording popup (external): `src/renderer/components/RecordingPopup.tsx`
- Speech optimization panel: `src/renderer/components/SpeechOptimizationPanel.tsx`
- Voice recorder: `src/renderer/components/VoiceRecorder.tsx`
- Whisper service: `src/main/whisper-service.ts`
- Zhipu ASR service: `src/main/zhipu-asr-service.ts`
- iFlytek ASR service: `src/main/iflytek-asr-service.ts`
- History panel: `src/renderer/components/HistoryPanel.tsx`
- Favorites panel: `src/renderer/components/FavoritesPanel.tsx`
- Glossary / terminology panel: `src/renderer/components/GlossaryPanel.tsx`

## Packaging

`electron-builder` is configured implicitly through the `dist` script. The `main` field in `package.json` points to `dist-electron/main/index.js` for packaged builds.

## Development & Release Workflow

Whenever a new requirement is implemented or a bug is fixed, the following must be done before considering the change complete:

1. **Bump the version in `package.json`** following SemVer:
   - Breaking changes → major
   - New features / significant changes → minor
   - Bug fixes / small adjustments / process changes → patch
2. **Update project memory** (`C:\Users\34762\.claude\projects\D--workspace-my-work-translation-assistant\memory\`) with the new version, completed features, and any changed constraints.
3. **Update `README.md`** if the change affects user-facing features, installation, running, building, or shortcuts.
4. **Update `CLAUDE.md`** if the change affects architecture, IPC, settings, build config, file locations, or important implementation details.
5. **Commit and push** the changes to the `master` branch on GitHub:
   ```bash
   git add .
   git commit -m "vX.Y.Z: 改动摘要"
   git push origin master
   ```

This ensures the version number, documentation, project memory, and remote repository all stay in sync.
