import { app } from 'electron'
import { rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ZHIPU_ASR_URL = 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions'
const ZHIPU_ASR_MODEL = 'glm-asr-2512'

interface ZhipuAsrResponse {
  text?: string
  message?: string
}

export async function transcribeWithZhipu(audioBase64: string, apiKey: string): Promise<string> {
  if (!apiKey.trim()) {
    throw new Error('未配置智谱 AI API Key，请在设置中填写')
  }

  const buffer = Buffer.from(audioBase64, 'base64')
  if (buffer.length === 0) {
    throw new Error('音频数据为空')
  }

  const tempPath = path.join(app.getPath('temp'), `ta-zhipu-asr-${Date.now()}.wav`)
  writeFileSync(tempPath, buffer)

  try {
    const formData = new FormData()
    formData.append('model', ZHIPU_ASR_MODEL)
    formData.append('stream', 'false')
    formData.append('file', new Blob([buffer]), 'audio.wav')

    const response = await fetch(ZHIPU_ASR_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    const data = (await response.json()) as ZhipuAsrResponse

    if (!response.ok) {
      throw new Error(`智谱 ASR 请求失败：${response.status} ${data.message || ''}`)
    }

    const text = data.text?.trim() || ''
    if (!text) {
      throw new Error('未识别到语音内容')
    }

    return text
  } finally {
    try {
      rmSync(tempPath, { force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}
