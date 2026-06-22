import type { GlossaryEntry, LanguageCode, ProviderConfig, TranslateParams, TranslationProvider, TranslationResult } from '../../shared/types'
import { buildSystemPrompt, buildUserPrompt } from '../utils/prompts'

interface OpenAICompatibleResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

export class OpenAICompatibleProvider implements TranslationProvider {
  name: string
  private config: ProviderConfig

  constructor(
    name: string,
    config: ProviderConfig,
  ) {
    this.name = name
    this.config = config
  }

  async translate(params: TranslateParams, glossary?: GlossaryEntry[]): Promise<TranslationResult> {
    if (!this.config.apiKey) {
      throw new Error(`${this.name} 的 API Key 未配置，请先在设置中填写。`)
    }

    const sourceLang = params.sourceLang
    const targetLang = params.targetLang

    const baseUrl = this.config.baseUrl.replace(/\/$/, '')
    const requestUrl = `${baseUrl}/chat/completions`
    console.log(`[provider] requesting ${requestUrl}`)
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: buildSystemPrompt(sourceLang, targetLang, glossary) },
          { role: 'user', content: buildUserPrompt(params) },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`请求失败 (${response.status}): ${errorText}`)
    }

    const data = (await response.json()) as OpenAICompatibleResponse
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('API 返回结果为空')
    }

    return this.parseResult(content)
  }

  private parseResult(content: string): TranslationResult {
    try {
      const cleaned = content.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')
      const parsed = JSON.parse(cleaned) as {
        translatedText?: string
        pronunciation?: string
        alternatives?: string[]
        detectedSourceLang?: string
      }

      return {
        translatedText: parsed.translatedText || '',
        pronunciation: parsed.pronunciation,
        alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 3) : [],
        detectedSourceLang: parsed.detectedSourceLang as LanguageCode | undefined,
      }
    } catch {
      // If JSON parsing fails, return the raw content as translation
      return {
        translatedText: content,
      }
    }
  }
}
