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

- **`src/main/`** — Electron main process. Creates the window, manages the system tray, registers global shortcuts (`Ctrl+Alt+T` for toggle and `Ctrl+Alt+C` for cross-selection), persists settings via `electron-store`, makes all LLM API requests, runs OCR via RapidOcrOnnx, runs speech recognition via Zhipu ASR, iFlytek ASR, or offline Sherpa-onnx, and saves speech optimization records.
- **`src/preload/`** — Preload script, built as CommonJS. Exposes a typed `window.electronAPI` bridge so the renderer can invoke main-process IPC handlers safely.
- **`src/renderer/`** — React application. Manages UI state with Zustand and renders the translation interface.
- **`src/shared/`** — Shared TypeScript types used by both main and renderer.

### Key IPC Channels

The renderer communicates with the main process through these channels:

- `get-settings` / `set-settings` — Load and persist app settings (API keys, provider config, window bounds, always-on-top state, theme, popup target language, shortcuts, comparison mode, glossary, popup pinned state, voice input enabled, voice input language).
- `get-glossary` / `set-glossary` — Load and persist the terminology glossary used to guide translations.
- `get-voice-dictionary` / `set-voice-dictionary` — Load and persist the personal voice dictionary used to correct ASR mis-recognitions of proper nouns during speech optimization.
- `translate` — Send translation parameters to the main process, which calls a single LLM and returns the result.
- `translate-multi` — Send parameters for multiple configured providers; the main process calls them in parallel and returns per-provider results.
- `ocr-image` — Send a base64 image to the main process for OCR text recognition.
- `transcribe-audio` — Send a base64 WAV audio to the main process for speech-to-text via Zhipu ASR, iFlytek ASR, or Sherpa-onnx.
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

### OCR (RapidOcrOnnx)

- OCR runs locally via `RapidOcrOnnx.exe` from `resources/rapidocr/` (packaged via `extraResources`).
- Models (`ch_PP-OCRv3_det_infer.onnx`, `ch_PP-OCRv3_rec_infer.onnx`, `ch_ppocr_mobile_v2.0_cls_infer.onnx`, `ppocr_keys_v1.txt`) are bundled with the app under `resources/rapidocr/models/`.
- The `ocr-image` IPC handler receives a base64 image, writes it to a temp file, spawns `RapidOcrOnnx.exe`, and parses the result text from the generated `<image>-result.txt` file.
- Recognition supports Chinese, English, and mixed Chinese-English text, and produces punctuation naturally.

### Voice Input (Sherpa-onnx / Zhipu ASR / iFlytek ASR / DeepSeek optimization)

The voice input system uses two renderer windows when invoked outside the main app:

- **`voiceWin`** (`mode=voice`) — a hidden 1×1 window that owns the actual recording state. It loads `VoiceRecordingPanel`, which starts `MediaRecorder`, converts audio to 16kHz mono WAV, and sends it to the main process through `transcribe-audio`.
- **`recordingPopupWin`** (`mode=recording-popup`) — a visible mini popup that displays recording progress. It loads `RecordingPopup` and receives state updates from `voiceWin` via the main process.

Three global voice hotkeys share the same recording pipeline (all gated by `settings.voiceInputEnabled`); the main process tracks which one is active via `globalVoiceMode: 'transcribe' | 'edit' | 'translate'` and branches only when handling the result. The voice window and renderer recording flow are mode-agnostic.

- **`Ctrl+Alt+V`** (transcribe) toggles recording and pastes the recognized (optionally optimized) text.
- **`Ctrl+Alt+D`** (edit, "Speak to Edit") first captures the foreground app's selected text via `captureSelectedText()` (simulated Ctrl+C, shared with cross-selection), then records a spoken command. The raw command (optimization is skipped for this mode) and the selected text are sent to DeepSeek via `src/main/utils/voice-editor.ts` (`editTextWithVoice`), and the rewritten text is pasted back over the selection. Commands like "改短一点 / 更正式 / 翻译成英文 / 修正语法" are supported.
- **`Ctrl+Alt+F`** (translate) records speech, optimizes it, then auto-translates via `translateTextForVoice()` and pastes the translation. The target language is auto-detected (zh→en, en→zh, ja→zh) — no configuration. On translation failure it falls back to pasting the recognized text.

The recognized-text result is delivered to the main process via `global-voice-result`, which branches on `globalVoiceMode`. The `RecordingPopup` shows a mode-specific title ("语音输入 / 语音编辑 / 语音直译") and an edit preview; the mode/preview are injected by the main process into the `recording-popup-state` payload (`RecordingPopupState.mode` / `.editPreview`). Edit and translate only fire when the main window is NOT focused (they target external selections/apps); plain transcribe also works inside the main window.

Popup close timing depends on the mode: `transcribe` pastes the recognized text immediately, so the popup closes as soon as `global-voice-result` arrives. `translate` and `edit` need an extra LLM round-trip (translation / rewrite) before the paste, so the popup is **kept open** showing a processing state (`RecordingPopupState.processingLabel` = "翻译中..." / "改写中...") until the paste completes, then closed in the handler's `finally`. This avoids the earlier behavior where the popup vanished and the user waited with no feedback while translation ran.

For each voice hotkey:

- Inside the main window, the local `RecordingPanel` appears at the bottom-center (cancel button, sound-wave animation, confirm button).
- Outside the main window, `createRecordingPopupWindow()` creates a transparent `RecordingPopup` at a fixed spot — horizontally centered and near the bottom (just above the taskbar) of whichever monitor the cursor is on. The popup renders the same rounded-2xl "pill" component used by the in-app `RecordingPanel` (circular cancel/confirm buttons, live `SoundWave`, and duration label) so the visual experience is consistent inside and outside the app.

`settings.voiceInputProvider` selects the recognition backend:

- `'zhipu'` (default when Zhipu API key is configured): sends audio to Zhipu AI's `glm-asr-2512` ASR endpoint.
- `'iflytek'`: sends audio to iFlytek's Chinese-English ASR WebSocket endpoint (`wss://iat.xf-yun.com/v1`). Supports Chinese and English. Requires `appId`, `apiKey`, and `apiSecret` from the iFlytek console.
- `'sherpa'`: the main process calls `sherpa-onnx-offline.exe` from `resources/sherpa-onnx/` using the SenseVoice INT8 model. The model is downloaded from the k2-fsa/sherpa-onnx GitHub release on first use, or can be bundled under `resources/sherpa-onnx/<model-name>/`.

The SenseVoice model (`sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17`, ~160MB) is downloaded on first use for `sherpa` mode to `app.getPath('userData')/sherpa-onnx/`. The downloader uses the official GitHub Release source first and falls back to the `ghfast.top` proxy if the primary source is unreachable; users can also manually place the model directory in that location.

When `settings.voiceInputOptimize` is enabled, the raw ASR text is sent to DeepSeek via `src/main/utils/speech-optimizer.ts` to remove filler words and unnecessary repetitions, polish phrasing for clarity and flow, and produce natural text that still sounds like the user before it is returned to the renderer. The optimizer prompt explicitly handles **self-correction** (when the speaker changes their mind mid-sentence, e.g. "三点……不对，是十点", only the final intent is kept), **punctuation voice commands** (spoken "逗号/句号/换行/新段落" become real punctuation and line breaks), and **auto-formatting** (enumerated points become a list, distinct topics are split into paragraphs). `optimizeSpeech(text, config, glossary?, dictionary?)` also accepts the terminology glossary (`settings.glossary`) and the dedicated voice dictionary (`settings.voiceDictionary`): their words are injected as a "correct spelling reference" so the optimizer fixes ASR mis-recognitions of proper nouns, brand names, and technical terms. The pair `{ rawText, optimizedText }` is saved to `store.get('speechOptimizations')` (max 20 records) so users can review the before/after in the `SpeechOptimizationPanel` accessible from the left sidebar.

The **voice dictionary** (`settings.voiceDictionary`, type `VoiceDictionaryEntry[]` with `{ id, word, note? }`) is a personal vocabulary list dedicated to ASR correction (people's names, acronyms, project codenames) — distinct from the translation glossary. It is managed in `VoiceDictionaryPanel` (left sidebar, "语音词典") and persisted via the `get-voice-dictionary` / `set-voice-dictionary` IPC channels.

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
- Left sidebar navigation: `MainLayout` renders `Sidebar` plus the active content view. The sidebar holds only the "destination" views — `TranslationPanel`, `GlossaryPanel`, `VoiceDictionaryPanel` — with `SettingsPanel` pinned to the bottom (separated by a top border). `useUIStore.activeView` is typed `'translate' | 'glossary' | 'voice-dictionary' | 'settings'`.
- Records toolbar + drawer: the three review-only "records" views — translation history, favorites, and speech-optimization records — are NOT in the sidebar. They are opened from icon buttons in the `TitleBar` (right side, before the theme toggle) and rendered in a right-side slide-over `Drawer` that overlays the workspace. `useUIStore.openDrawer` (type `DrawerView = 'history' | 'favorites' | 'speech-optimization' | null`) controls it; `Drawer` handles slide in/out animation, backdrop-click and Esc to close. `HistoryPanel` / `FavoritesPanel` / `SpeechOptimizationPanel` take an optional `onClose` prop (renders a close button in their header and closes the drawer after an item is picked).
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
- Records drawer (history / favorites / speech-optimization slide-over): `src/renderer/components/Drawer.tsx`
- Main layout / view switcher: `src/renderer/components/MainLayout.tsx`
- Shortcut input component: `src/renderer/components/ShortcutInput.tsx`
- Confirm dialog: `src/renderer/components/ConfirmDialog.tsx`
- Error dialog: `src/renderer/components/ErrorDialog.tsx`
- Popup panel (cross-selection): `src/renderer/components/PopupPanel.tsx`
- Recording panel (in-app): `src/renderer/components/RecordingPanel.tsx`
- Recording popup (external): `src/renderer/components/RecordingPopup.tsx`
- Speech optimization panel: `src/renderer/components/SpeechOptimizationPanel.tsx`
- Voice recorder: `src/renderer/components/VoiceRecorder.tsx`
- Voice editor (Speak to Edit): `src/main/utils/voice-editor.ts`
- RapidOcrOnnx service: `src/main/rapidocr-service.ts`
- Zhipu ASR service: `src/main/zhipu-asr-service.ts`
- iFlytek ASR service: `src/main/iflytek-asr-service.ts`
- History panel: `src/renderer/components/HistoryPanel.tsx`
- Favorites panel: `src/renderer/components/FavoritesPanel.tsx`
- Glossary / terminology panel: `src/renderer/components/GlossaryPanel.tsx`
- Voice dictionary panel: `src/renderer/components/VoiceDictionaryPanel.tsx`

## Packaging

`electron-builder` is configured through the `build` field in `package.json` and the `dist` script. The `main` field points to `dist-electron/main/index.js` for packaged builds.

Key packaging settings:
- `files` explicitly includes `dist/**/*` and `dist-electron/**/*` because `dist` is listed in `.gitignore` and would otherwise be excluded by electron-builder, causing the production app to load the source `index.html` and show a blank window.
- `directories.output` is set to `release` so that electron-builder's output (`win-unpacked`, installer `.exe`, etc.) does not contaminate the renderer build directory (`dist`).
- Sherpa-onnx and RapidOcrOnnx binaries/models are bundled via `extraResources`.

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
