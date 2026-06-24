import crypto from 'node:crypto'
import WebSocket from 'ws'
import type { LanguageCode, ProviderConfig } from '../shared/types'

const IFLYTEK_HOST = 'iat.cn-huabei-1.xf-yun.com'
const IFLYTEK_PATH = '/v1'
const IFLYTEK_URL = `wss://${IFLYTEK_HOST}${IFLYTEK_PATH}`

interface IflytekAsrConfig extends ProviderConfig {
  appId: string
  apiSecret: string
}

interface IflytekFrame {
  header: {
    app_id: string
    status: number
    uid?: string
  }
  parameter?: {
    iat: {
      domain: string
      language: string
      accent: string
      eos?: number
      dwa?: string
      ln?: string
    }
  }
  payload?: {
    audio: {
      encoding: string
      sample_rate: number
      channels: number
      bit_depth: number
      seq: number
      status: number
      audio: string
    }
  }
}

interface IflytekResponse {
  header: {
    code: number
    message: string
    status: number
    sid: string
  }
  payload?: {
    result?: {
      compress: string
      encoding: string
      format: string
      seq: number
      status: number
      text: string
      ws?: Array<{
        cw: Array<{
          w: string
        }>
      }>
    }
  }
}

function buildAuthUrl(apiKey: string, apiSecret: string): string {
  const date = new Date().toUTCString()

  const signatureOrigin = `host: ${IFLYTEK_HOST}\ndate: ${date}\nGET ${IFLYTEK_PATH} HTTP/1.1`
  const signature = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64')

  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = Buffer.from(authorizationOrigin).toString('base64')

  return `${IFLYTEK_URL}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(IFLYTEK_HOST)}`
}

function languageToIflytekLn(language: 'auto' | LanguageCode | undefined): string | undefined {
  if (language === 'auto' || !language) {
    // Allow auto-detection across the three supported languages
    return 'zh|en|ja'
  }
  return language
}

function parseResponseText(response: IflytekResponse): string {
  if (!response.payload?.result?.ws) {
    return ''
  }
  return response.payload.result.ws
    .map((ws) => ws.cw.map((cw) => cw.w).join(''))
    .join('')
}

export async function transcribeWithIflytek(
  audioBase64: string,
  config: IflytekAsrConfig,
  language?: 'auto' | LanguageCode
): Promise<string> {
  const { appId, apiKey, apiSecret } = config

  if (!appId.trim() || !apiKey.trim() || !apiSecret.trim()) {
    throw new Error('未配置科大讯飞 AppID、APIKey 或 APISecret，请在设置中填写')
  }

  const audioBuffer = Buffer.from(audioBase64, 'base64')
  if (audioBuffer.length === 0) {
    throw new Error('音频数据为空')
  }

  const authUrl = buildAuthUrl(apiKey, apiSecret)
  const sessionUid = crypto.randomUUID().replace(/-/g, '')
  const ln = languageToIflytekLn(language)

  return new Promise((resolve, reject) => {
    let fullText = ''
    let isClosed = false

    const ws = new WebSocket(authUrl)

    const timeout = setTimeout(() => {
      if (!isClosed) {
        isClosed = true
        ws.terminate()
        reject(new Error('科大讯飞 ASR 请求超时'))
      }
    }, 30000)

    ws.on('open', () => {
      // First frame: header + parameter, no audio data
      const firstFrame: IflytekFrame = {
        header: {
          app_id: appId,
          status: 0,
          uid: sessionUid,
        },
        parameter: {
          iat: {
            domain: 'slm',
            language: 'mul_cn',
            accent: 'mandarin',
            eos: 6000,
            dwa: 'wpgs',
            ...(ln ? { ln } : {}),
          },
        },
        payload: {
          audio: {
            encoding: 'raw',
            sample_rate: 16000,
            channels: 1,
            bit_depth: 16,
            seq: 1,
            status: 0,
            audio: '',
          },
        },
      }
      ws.send(JSON.stringify(firstFrame))

      // Send audio frames in chunks
      const chunkSize = 1280
      let seq = 2
      let offset = 0

      const sendChunks = () => {
        while (offset < audioBuffer.length) {
          const end = Math.min(offset + chunkSize, audioBuffer.length)
          const chunk = audioBuffer.slice(offset, end)
          const isLast = end >= audioBuffer.length

          const frame: IflytekFrame = {
            header: {
              app_id: appId,
              status: isLast ? 2 : 1,
              uid: sessionUid,
            },
            payload: {
              audio: {
                encoding: 'raw',
                sample_rate: 16000,
                channels: 1,
                bit_depth: 16,
                seq: seq++,
                status: isLast ? 2 : 1,
                audio: chunk.toString('base64'),
              },
            },
          }
          ws.send(JSON.stringify(frame))
          offset = end

          if (isLast) {
            break
          }
        }
      }

      // Small delay to let the server process the first frame before audio
      setTimeout(sendChunks, 50)
    })

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as IflytekResponse

        if (message.header.code !== 0) {
          isClosed = true
          clearTimeout(timeout)
          ws.close()
          reject(new Error(`科大讯飞 ASR 错误：${message.header.code} ${message.header.message}`))
          return
        }

        const text = parseResponseText(message)
        if (text) {
          fullText += text
        }

        if (message.header.status === 2) {
          isClosed = true
          clearTimeout(timeout)
          ws.close()
          resolve(fullText.trim())
        }
      } catch (error) {
        isClosed = true
        clearTimeout(timeout)
        ws.terminate()
        reject(new Error(`解析科大讯飞 ASR 响应失败：${error instanceof Error ? error.message : String(error)}`))
      }
    })

    ws.on('error', (error) => {
      if (!isClosed) {
        isClosed = true
        clearTimeout(timeout)
        reject(new Error(`科大讯飞 ASR 连接错误：${error.message}`))
      }
    })

    ws.on('close', () => {
      if (!isClosed) {
        isClosed = true
        clearTimeout(timeout)
        resolve(fullText.trim())
      }
    })
  })
}
