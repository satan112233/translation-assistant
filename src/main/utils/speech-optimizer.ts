import type { ProviderConfig } from '../../shared/types'

const SYSTEM_PROMPT = `你是一位专业的口语转书面语专家。请对以下语音识别得到的口语文本进行优化整理：

要求：
1. 如果说话人中途自我修正（如出现"不对""错了""改为""应该是""之前……现在……""对了"等），以最后的正确表述为准，替换或删除之前错误/过时的内容
2. 去除重复、啰嗦、絮叨的表达，但保留所有实质性信息
3. 删除无意义的语气词、口头禅、停顿词（如"嗯"、"啊"、"那个"、"然后"、"就是"等）
4. 修正语音识别可能产生的同音字错误
5. 将口语化表达转换为流畅、简洁、准确的书面语
6. 不要添加原文中没有的信息
7. 不要解释，只输出优化后的文本
8. 如果原始文本没有实质性内容（只有语气词、停顿词、标点符号、特殊符号或为空），请直接输出空字符串，不要生成任何解释或示例回复`

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
  }
}

export async function optimizeSpeech(text: string, config: ProviderConfig): Promise<string> {
  if (!config?.apiKey?.trim()) {
    throw new Error('未配置 DeepSeek API Key，无法启用口语内容优化')
  }

  if (!text.trim()) {
    return text
  }

  const url = config.baseUrl.endsWith('/')
    ? `${config.baseUrl}chat/completions`
    : `${config.baseUrl}/chat/completions`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `原始口语文本：\n"""\n${text}\n"""\n\n请直接输出优化后的文本：` },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  })

  const data = (await response.json()) as ChatCompletionResponse

  if (!response.ok) {
    throw new Error(`口语优化请求失败：${data.error?.message || response.statusText || response.status}`)
  }

  const optimized = data.choices?.[0]?.message?.content?.trim()
  if (!optimized) {
    throw new Error('口语优化返回结果为空')
  }

  return optimized
}
