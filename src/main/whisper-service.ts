import { app } from 'electron'
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import type { LanguageCode, TranscribeAudioRequest, TranscribeAudioResult } from '../shared/types'

const MODEL_NAME = 'ggml-base-q8_0.gguf'
const MODEL_URLS = [
  `https://huggingface.co/ggml-org/whisper.cpp/resolve/main/${MODEL_NAME}`,
  `https://hf-mirror.com/ggml-org/whisper.cpp/resolve/main/${MODEL_NAME}`,
]
const WHISPER_TIMEOUT_MS = 30_000

let activeWhisperProcess: ReturnType<typeof spawn> | null = null

function getResourcesWhisperDir(): string {
  // In packaged builds, extra resources are placed under process.resourcesPath.
  // In dev, they live at the project root under resources/.
  const appRoot = process.env.APP_ROOT || path.resolve(new URL(import.meta.url).pathname, '../../..')
  return app.isPackaged
    ? path.join(process.resourcesPath, 'whisper')
    : path.join(appRoot, 'resources', 'whisper')
}

function getWhisperCliPath(): string {
  return path.join(getResourcesWhisperDir(), 'whisper-cli.exe')
}

function getModelDir(): string {
  return path.join(app.getPath('userData'), 'whisper', 'models')
}

function getModelPath(): string {
  return path.join(getModelDir(), MODEL_NAME)
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    https
      .get(
        url,
        {
          timeout: 60_000,
          headers: {
            'User-Agent': 'translation-assistant/1.0',
          },
        },
        (response) => {
          if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 307 || response.statusCode === 308) {
            const location = response.headers.location
            if (!location) {
              reject(new Error('模型下载重定向缺少 Location'))
              return
            }
            file.close()
            const redirectUrl = new URL(location, url).toString()
            console.log('[whisper] following redirect to', redirectUrl)
            downloadFile(redirectUrl, dest).then(resolve).catch(reject)
            return
          }
          if (response.statusCode !== 200) {
            reject(new Error(`模型下载失败，HTTP ${response.statusCode}`))
            return
          }

          const total = parseInt(response.headers['content-length'] || '0', 10)
          let downloaded = 0
          let lastLoggedPercent = -1

          response.on('data', (chunk: Buffer) => {
            downloaded += chunk.length
            if (total > 0) {
              const percent = Math.floor((downloaded / total) * 100)
              if (percent !== lastLoggedPercent && percent % 10 === 0) {
                lastLoggedPercent = percent
                console.log(`[whisper] downloading model ${percent}%`)
              }
            }
          })
          response.pipe(file)
          file.on('finish', () => {
            file.close(() => resolve())
          })
        }
      )
      .on('error', (err) => {
        file.close()
        reject(err)
      })
  })
}

async function ensureModel(): Promise<string> {
  const modelPath = getModelPath()
  if (existsSync(modelPath)) {
    return modelPath
  }

  console.log('[whisper] model not found, downloading...')
  ensureDir(getModelDir())

  let lastError: Error | undefined
  for (const url of MODEL_URLS) {
    try {
      console.log('[whisper] trying download from', url)
      await downloadFile(url, modelPath)
      console.log('[whisper] model downloaded to', modelPath)
      return modelPath
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[whisper] failed to download from ${url}:`, lastError.message)
      if (existsSync(modelPath)) {
        rmSync(modelPath, { force: true })
      }
    }
  }

  throw new Error(
    `模型下载失败：${lastError?.message || '所有镜像源均不可用'}。请手动下载 ${MODEL_NAME}（约 75MB）放到 ${getModelDir()}`
  )
}

function toWhisperLanguage(language: 'auto' | LanguageCode | undefined): string {
  if (language === 'zh') return 'zh'
  if (language === 'en') return 'en'
  if (language === 'ja') return 'ja'
  return 'auto'
}

function runWhisper(whisperPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputFilePrefix = args[args.indexOf('-of') + 1]
    const outputTxtPath = `${outputFilePrefix}.txt`

    activeWhisperProcess = spawn(whisperPath, args, { windowsHide: true })
    let stderr = ''
    const timeout = setTimeout(() => {
      if (activeWhisperProcess && !activeWhisperProcess.killed) {
        activeWhisperProcess.kill()
      }
      reject(new Error('语音识别超时，请重试'))
    }, WHISPER_TIMEOUT_MS)

    activeWhisperProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    activeWhisperProcess.on('close', (code) => {
      activeWhisperProcess = null
      clearTimeout(timeout)

      if (code !== 0) {
        reject(new Error(stderr.trim() || `whisper-cli 退出码 ${code}`))
        return
      }

      try {
        const text = readFileSync(outputTxtPath, 'utf-8').trim()
        resolve(text)
      } catch (error) {
        reject(new Error('读取识别结果失败'))
      }
    })

    activeWhisperProcess.on('error', (err) => {
      activeWhisperProcess = null
      clearTimeout(timeout)
      reject(err)
    })
  })
}

function cleanupTempFiles(...files: string[]): void {
  for (const file of files) {
    try {
      rmSync(file, { force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function transcribeAudio(request: TranscribeAudioRequest): Promise<TranscribeAudioResult> {
  const whisperPath = getWhisperCliPath()
  if (!existsSync(whisperPath)) {
    throw new Error(
      `未找到语音识别组件：${whisperPath}。请放置 whisper-cli.exe 到该路径后重试。`
    )
  }

  const modelPath = await ensureModel()
  const tempDir = app.getPath('temp')
  const timestamp = Date.now()
  const wavPath = path.join(tempDir, `ta-recording-${timestamp}.wav`)
  const outPrefix = path.join(tempDir, `ta-whisper-out-${timestamp}`)

  try {
    writeFileSync(wavPath, Buffer.from(request.audioBase64, 'base64'))

    const args = [
      '-m', modelPath,
      '-f', wavPath,
      '-l', toWhisperLanguage(request.language),
      '--no-timestamps',
      '-otxt',
      '-of', outPrefix,
    ]

    console.log('[whisper] starting transcription...')
    const text = await runWhisper(whisperPath, args)
    console.log('[whisper] transcription result:', text.slice(0, 50))

    if (!text) {
      throw new Error('未检测到语音，请靠近麦克风重试')
    }

    return { text }
  } finally {
    cleanupTempFiles(wavPath, `${outPrefix}.txt`)
  }
}

export function terminateActiveWhisperProcess(): void {
  if (activeWhisperProcess && !activeWhisperProcess.killed) {
    activeWhisperProcess.kill()
    activeWhisperProcess = null
  }
}
