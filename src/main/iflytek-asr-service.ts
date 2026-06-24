import crypto from 'node:crypto'
import WebSocket from 'ws'
import type { ProviderConfig } from '../shared/types'

const IFLYTEK_HOST = 'iat.xf-yun.com'
const IFLYTEK_PATH = '/v1'
const IFLYTEK_URL = `wss://${IFLYTEK_HOST}${IFLYTEK_PATH}`

interface IflytekAsrConfig extends ProviderConfig {
  appId: string
  apiSecret: string
}

interface IflytekRequestFrame {
  header: {
    app_id: string
    status: number
  }
  parameter?: {
    iat: {
      domain: string
      language: string
      accent: string
      eos?: number
      dwa?: string
      result?: {
        encoding: string
        compress: string
        format: string
      }
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
    }
  }
}

interface IflytekTextResult {
  sn: number
  ls: boolean
  bg: string
  ed: string
  pgs?: 'apd' | 'rpl'
  rg?: number[]
  ws: Array<{
    bg: number
    cw: Array<{
      w: string
      sc: number
    }>
  }>
}

function buildAuthUrl(apiKey: string, apiSecret: string): string {
  const date = new Date().toUTCString()

  const signatureOrigin = `host: ${IFLYTEK_HOST}\ndate: ${date}\nGET ${IFLYTEK_PATH} HTTP/1.1`
  const signature = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64')

  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = Buffer.from(authorizationOrigin).toString('base64')

  return `${IFLYTEK_URL}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(IFLYTEK_HOST)}`
}

interface DecodedSegment {
  sn: number
  pgs?: 'apd' | 'rpl'
  rg?: number[]
  text: string
}

function parseResultSegment(response: IflytekResponse): DecodedSegment | null {
  const raw = response.payload?.result?.text
  if (!raw) {
    return null
  }
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8')
    const result = JSON.parse(decoded) as IflytekTextResult
    const text = result.ws.map((ws) => ws.cw.map((cw) => cw.w).join('')).join('')
    return { sn: result.sn, pgs: result.pgs, rg: result.rg, text }
  } catch {
    return null
  }
}

// Assemble the final transcript from segments keyed by serial number, in order.
function assembleSegments(segments: Map<number, string>): string {
  return [...segments.keys()]
    .sort((a, b) => a - b)
    .map((sn) => segments.get(sn) ?? '')
    .join('')
    .trim()
}

function getIflytekErrorMessage(code: number, originalMessage: string): string {
  const messages: Record<number, string> = {
    11201: '日调用额度已用完或未领取免费额度（licc failed）。请前往讯飞开放平台「中英识别大模型」服务页面领取免费额度或购买套餐。',
    11200: '没有调用权限（auth no license）。请确认应用已开通「中英识别大模型」服务。',
    10005: '应用授权失败（licc fail）。请检查 AppID 是否正确，以及是否已开通对应服务。',
    10010: '接口超时，请稍后重试。',
    10106: '请求参数格式错误（wrapper output data invalid）。请检查请求 JSON 字段是否完整，特别是 parameter.iat.result 字段。',
    10114: '请求参数错误，请检查音频格式是否为 16kHz 16bit 单声道 PCM。',
    10404: '服务路由未找到（no category route found）。请确认应用已开通「中英识别大模型」服务并领取额度。',
  }
  const extra = messages[code]
  return extra ? `科大讯飞 ASR 错误 ${code}：${extra}` : `科大讯飞 ASR 错误 ${code}：${originalMessage}`
}

export async function transcribeWithIflytek(
  audioBase64: string,
  config: IflytekAsrConfig
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

  console.log('[iflytek-asr] connecting with appId:', appId, 'endpoint:', IFLYTEK_URL)

  return new Promise((resolve, reject) => {
    const segments = new Map<number, string>()
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
      // First frame: header + parameter + empty audio payload
      const firstFrame: IflytekRequestFrame = {
        header: {
          app_id: appId,
          status: 0,
        },
        parameter: {
          iat: {
            domain: 'slm',
            language: 'zh_cn',
            accent: 'mandarin',
            eos: 6000,
            dwa: 'wpgs',
            result: {
              encoding: 'utf8',
              compress: 'raw',
              format: 'json',
            },
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
      console.log('[iflytek-asr] first frame sent')

      // Send audio frames in chunks
      const chunkSize = 1280
      let seq = 2
      let offset = 0

      const sendChunks = () => {
        while (offset < audioBuffer.length) {
          const end = Math.min(offset + chunkSize, audioBuffer.length)
          const chunk = audioBuffer.slice(offset, end)
          const isLast = end >= audioBuffer.length

          const frame: IflytekRequestFrame = {
            header: {
              app_id: appId,
              status: isLast ? 2 : 1,
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
        console.log('[iflytek-asr] message:', JSON.stringify(message))

        if (message.header.code !== 0) {
          isClosed = true
          clearTimeout(timeout)
          ws.close()
          const errorText = `${getIflytekErrorMessage(message.header.code, message.header.message)}\n\n原始响应：${JSON.stringify(message)}`
          reject(new Error(errorText))
          return
        }

        const segment = parseResultSegment(message)
        if (segment) {
          // The server reuses serial numbers when correcting earlier partial
          // results (`pgs: 'rpl'`). A replacement range (`rg`) tells us which
          // `sn` values this frame should overwrite.
          if (segment.pgs === 'rpl' && segment.rg && segment.rg.length >= 2) {
            const [startSn, endSn] = segment.rg
            for (let sn = startSn; sn <= endSn; sn++) {
              segments.delete(sn)
            }
          }
          segments.set(segment.sn, segment.text)
        }

        if (message.header.status === 2) {
          isClosed = true
          clearTimeout(timeout)
          ws.close()
          resolve(assembleSegments(segments))
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
        resolve(assembleSegments(segments))
      }
    })
  })
}
