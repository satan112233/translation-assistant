import { app } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const RAPIDOCR_TIMEOUT_MS = 30_000

let activeRapidOcrProcess: ReturnType<typeof spawn> | null = null

function getResourcesRapidOcrDir(): string {
  const appRoot = process.env.APP_ROOT || path.resolve(new URL(import.meta.url).pathname, '../../..')
  return app.isPackaged
    ? path.join(process.resourcesPath, 'rapidocr')
    : path.join(appRoot, 'resources', 'rapidocr')
}

function getRapidOcrExePath(): string {
  return path.join(getResourcesRapidOcrDir(), 'RapidOcrOnnx.exe')
}

function getModelsDir(): string {
  return path.join(getResourcesRapidOcrDir(), 'models')
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

function parseResultFile(resultPath: string): string {
  const content = readFileSync(resultPath, 'utf-8')
  const marker = '=====End detect====='
  const idx = content.indexOf(marker)
  if (idx === -1) return ''
  return content.slice(idx + marker.length).trim()
}

function runRapidOcr(exePath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    activeRapidOcrProcess = spawn(exePath, args, { windowsHide: true })
    let stderr = ''
    const timeout = setTimeout(() => {
      if (activeRapidOcrProcess && !activeRapidOcrProcess.killed) {
        activeRapidOcrProcess.kill()
      }
      reject(new Error('OCR 识别超时，请重试'))
    }, RAPIDOCR_TIMEOUT_MS)

    activeRapidOcrProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    activeRapidOcrProcess.on('close', (code) => {
      activeRapidOcrProcess = null
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(stderr.trim() || `RapidOcrOnnx 退出码 ${code}`))
        return
      }
      resolve('')
    })

    activeRapidOcrProcess.on('error', (err) => {
      activeRapidOcrProcess = null
      clearTimeout(timeout)
      reject(err)
    })
  })
}

export async function recognizeImage(imageBase64: string): Promise<string> {
  const exePath = getRapidOcrExePath()
  if (!existsSync(exePath)) {
    throw new Error(
      `未找到 OCR 组件：${exePath}。请将 RapidOcrOnnx.exe 及其依赖放到 resources/rapidocr/ 后重试。`
    )
  }

  const modelsDir = getModelsDir()
  const tempDir = app.getPath('temp')
  const timestamp = Date.now()
  const imagePath = path.join(tempDir, `ta-ocr-${timestamp}.png`)
  const resultPath = `${imagePath}-result.txt`

  try {
    writeFileSync(imagePath, Buffer.from(imageBase64, 'base64'))

    const args = [
      '--models', modelsDir,
      '--det', path.join(modelsDir, 'ch_PP-OCRv3_det_infer.onnx'),
      '--cls', path.join(modelsDir, 'ch_ppocr_mobile_v2.0_cls_infer.onnx'),
      '--rec', path.join(modelsDir, 'ch_PP-OCRv3_rec_infer.onnx'),
      '--keys', path.join(modelsDir, 'ppocr_keys_v1.txt'),
      '--image', imagePath,
      '--numThread', '4',
      '--padding', '50',
      '--maxSideLen', '1024',
      '--boxScoreThresh', '0.5',
      '--boxThresh', '0.3',
      '--unClipRatio', '1.6',
      '--doAngle', '1',
      '--mostAngle', '1',
      '--GPU', '-1',
    ]

    console.log('[rapidocr] starting OCR...')
    await runRapidOcr(exePath, args)

    if (!existsSync(resultPath)) {
      throw new Error('OCR 未返回结果文件')
    }

    const text = parseResultFile(resultPath)
    console.log('[rapidocr] OCR result:', text.slice(0, 100))
    return text
  } finally {
    cleanupTempFiles(imagePath, resultPath)
  }
}

export function terminateActiveRapidOcrProcess(): void {
  if (activeRapidOcrProcess && !activeRapidOcrProcess.killed) {
    activeRapidOcrProcess.kill()
    activeRapidOcrProcess = null
  }
}
