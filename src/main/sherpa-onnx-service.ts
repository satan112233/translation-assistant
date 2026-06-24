import { app } from 'electron'
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import * as tar from 'tar'
import type { TranscribeAudioRequest, TranscribeAudioResult } from '../shared/types'

const MODEL_NAME = 'sherpa-onnx-paraformer-zh-small-2024-03-09'
const MODEL_ARCHIVE = `${MODEL_NAME}.tar.bz2`
const MODEL_URLS = [
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${MODEL_ARCHIVE}`,
  `https://ghfast.top/https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${MODEL_ARCHIVE}`,
]
const SHERPA_TIMEOUT_MS = 60_000

let activeSherpaProcess: ReturnType<typeof spawn> | null = null

function getResourcesSherpaDir(): string {
  const appRoot = process.env.APP_ROOT || path.resolve(new URL(import.meta.url).pathname, '../../..')
  return app.isPackaged
    ? path.join(process.resourcesPath, 'sherpa-onnx')
    : path.join(appRoot, 'resources', 'sherpa-onnx')
}

function getSherpaOfflinePath(): string {
  return path.join(getResourcesSherpaDir(), 'sherpa-onnx-offline.exe')
}

function getModelBaseDir(): string {
  return path.join(app.getPath('userData'), 'sherpa-onnx')
}

function getModelDir(): string {
  return path.join(getModelBaseDir(), MODEL_NAME)
}

function getArchivePath(): string {
  return path.join(getModelBaseDir(), MODEL_ARCHIVE)
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingSize = existsSync(dest) ? statSync(dest).size : 0
    const file = createWriteStream(dest, { flags: existingSize > 0 ? 'a' : 'w' })
    const headers: Record<string, string> = {
      'User-Agent': 'translation-assistant/1.0',
    }
    if (existingSize > 0) {
      headers['Range'] = `bytes=${existingSize}-`
      console.log(`[sherpa] resuming download from byte ${existingSize}`)
    }

    https
      .get(
        url,
        {
          timeout: 120_000,
          headers,
        },
        (response) => {
          if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 307 || response.statusCode === 308) {
            const location = response.headers.location
            if (!location) {
              file.close()
              reject(new Error('模型下载重定向缺少 Location'))
              return
            }
            file.close()
            const redirectUrl = new URL(location, url).toString()
            console.log('[sherpa] following redirect to', redirectUrl)
            downloadFile(redirectUrl, dest).then(resolve).catch(reject)
            return
          }
          if (response.statusCode !== 200 && response.statusCode !== 206) {
            file.close()
            reject(new Error(`模型下载失败，HTTP ${response.statusCode}`))
            return
          }

          // Server did not honor Range header; restart from beginning.
          if (existingSize > 0 && response.statusCode !== 206) {
            console.log('[sherpa] server does not support resume, restarting download')
            file.close()
            rmSync(dest, { force: true })
            downloadFile(url, dest).then(resolve).catch(reject)
            return
          }

          const total = parseInt(response.headers['content-length'] || '0', 10)
          const alreadyDownloaded = response.statusCode === 206 ? existingSize : 0
          let downloaded = 0
          let lastLoggedPercent = -1

          response.on('data', (chunk: Buffer) => {
            downloaded += chunk.length
            if (total > 0) {
              const percent = Math.floor(((alreadyDownloaded + downloaded) / (alreadyDownloaded + total)) * 100)
              if (percent !== lastLoggedPercent && percent % 10 === 0) {
                lastLoggedPercent = percent
                console.log(`[sherpa] downloading model ${percent}%`)
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

async function extractTarBz2(archivePath: string, destDir: string): Promise<void> {
  ensureDir(destDir)
  await tar.extract({
    file: archivePath,
    cwd: destDir,
  })
}

async function ensureModel(): Promise<string> {
  const modelDir = getModelDir()
  if (existsSync(modelDir) && readdirSync(modelDir).length > 0) {
    return modelDir
  }

  // Check if model is bundled with the app
  const bundledModelDir = path.join(getResourcesSherpaDir(), MODEL_NAME)
  if (existsSync(bundledModelDir) && readdirSync(bundledModelDir).length > 0) {
    console.log('[sherpa] using bundled model at', bundledModelDir)
    return bundledModelDir
  }

  console.log('[sherpa] model not found, downloading...')
  ensureDir(getModelBaseDir())

  const archivePath = getArchivePath()
  let lastError: Error | undefined

  for (const url of MODEL_URLS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[sherpa] trying download from ${url} (attempt ${attempt}/3)`)
        await downloadFile(url, archivePath)
        console.log('[sherpa] extracting model archive...')
        await extractTarBz2(archivePath, getModelBaseDir())
        rmSync(archivePath, { force: true })
        console.log('[sherpa] model ready at', modelDir)
        return modelDir
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(`[sherpa] attempt ${attempt} failed:`, lastError.message)
        // Keep partial download file so the next attempt can resume.
        // Only clean it up on the final attempt or if extraction failed
        // (archive may be corrupted).
        if (attempt < 3 && !lastError.message.includes('解压')) {
          await new Promise((r) => setTimeout(r, 2000 * attempt))
          continue
        }
        if (existsSync(archivePath)) {
          rmSync(archivePath, { force: true })
        }
      }
    }
  }

  throw new Error(
    `模型下载失败：${lastError?.message || '所有下载源均不可用'}。请手动下载 ${MODEL_ARCHIVE}（约 79MB）并解压到 ${getModelBaseDir()}`
  )
}

function findModelFiles(modelDir: string): { tokens: string; paraformer: string } {
  const files = readdirSync(modelDir)
  const tokens = files.find((f) => f === 'tokens.txt')
  const paraformer = files.find((f) => f.startsWith('model') && f.endsWith('.onnx'))
  if (!tokens || !paraformer) {
    throw new Error(`模型目录 ${modelDir} 中缺少 tokens.txt 或 model*.onnx 文件`)
  }
  return {
    tokens: path.join(modelDir, tokens),
    paraformer: path.join(modelDir, paraformer),
  }
}

function runSherpa(sherpaPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    activeSherpaProcess = spawn(sherpaPath, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''

    const timeout = setTimeout(() => {
      if (activeSherpaProcess && !activeSherpaProcess.killed) {
        activeSherpaProcess.kill()
      }
      reject(new Error('语音识别超时，请重试'))
    }, SHERPA_TIMEOUT_MS)

    activeSherpaProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    activeSherpaProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    activeSherpaProcess.on('close', (code) => {
      activeSherpaProcess = null
      clearTimeout(timeout)

      if (code !== 0) {
        reject(new Error(stderr.trim() || `sherpa-onnx-offline 退出码 ${code}`))
        return
      }

      const text = stdout.trim()
      if (!text) {
        reject(new Error('语音识别未返回文本'))
        return
      }

      resolve(text)
    })

    activeSherpaProcess.on('error', (err) => {
      activeSherpaProcess = null
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
  const sherpaPath = getSherpaOfflinePath()
  if (!existsSync(sherpaPath)) {
    throw new Error(
      `未找到 Sherpa-onnx 识别组件：${sherpaPath}。请将 sherpa-onnx-offline.exe 及其依赖 DLL 放到 resources/sherpa-onnx/ 后重试。`
    )
  }

  const modelDir = await ensureModel()
  const { tokens, paraformer } = findModelFiles(modelDir)

  const tempDir = app.getPath('temp')
  const timestamp = Date.now()
  const wavPath = path.join(tempDir, `ta-sherpa-recording-${timestamp}.wav`)

  try {
    writeFileSync(wavPath, Buffer.from(request.audioBase64, 'base64'))

    const args = [
      '--tokens', tokens,
      '--paraformer', paraformer,
      '--model-type', 'paraformer',
      '--num-threads', '4',
      '--debug', '0',
      wavPath,
    ]

    console.log('[sherpa] starting transcription...')
    const text = await runSherpa(sherpaPath, args)
    console.log('[sherpa] transcription result:', text.slice(0, 50))

    if (!text) {
      throw new Error('未检测到语音，请靠近麦克风重试')
    }

    return { text }
  } finally {
    cleanupTempFiles(wavPath)
  }
}

export function terminateActiveSherpaProcess(): void {
  if (activeSherpaProcess && !activeSherpaProcess.killed) {
    activeSherpaProcess.kill()
    activeSherpaProcess = null
  }
}
