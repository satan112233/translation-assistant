import type { GlossaryEntry, ProviderConfig } from '../../shared/types'

const SYSTEM_PROMPT = `你是一位专业的口语转书面语专家。请对以下语音识别得到的口语文本进行优化整理：

要求：
1. 【最重要】识别说话人的"改口/自我修正"：当出现"不对""错了""不是""应该是""我是说""划掉""重说""改为""之前……现在……"等纠正信号时，只保留最后的正确表述，彻底删除被否定、被替换的旧内容，绝不能把前后两种说法都保留下来
2. 去除重复、啰嗦、絮叨的表达，但保留所有实质性信息
3. 删除无意义的语气词、口头禅、停顿词（如"嗯"、"啊"、"那个"、"然后"、"就是"等）
4. 修正语音识别可能产生的同音字错误
5. 将口语化表达转换为流畅、简洁、准确的书面语
6. 不要添加原文中没有的信息
7. 不要解释，只输出优化后的文本
8. 如果原始文本没有实质性内容（只有语气词、停顿词、标点符号、特殊符号或为空），请直接输出空字符串，不要生成任何解释或示例回复

改口处理示例（仅供理解规则，不要把示例内容输出）：
- 输入："明天下午三点开会，啊不对，是后天上午十点" → 输出："后天上午十点开会"
- 输入："把这个变量叫 count，嗯不对，叫 total 吧" → 输出："把这个变量叫 total"
- 输入："发给张三，不是发给李四" → 输出："发给李四"`

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

/**
 * 根据术语库构建"专有名词正确写法"参考块，用于纠正 ASR 把人名、品牌、
 * 专业词识别成读音相近但拼写错误的情况。术语库为空时返回空字符串。
 */
function buildGlossaryReference(glossary?: GlossaryEntry[]): string {
  if (!glossary || glossary.length === 0) {
    return ''
  }

  const terms = new Set<string>()
  for (const entry of glossary) {
    const term = entry.term?.trim()
    const translation = entry.translation?.trim()
    if (term) terms.add(term)
    if (translation) terms.add(translation)
  }

  if (terms.size === 0) {
    return ''
  }

  const list = Array.from(terms)
    .map((t) => `- ${t}`)
    .join('\n')

  return `【术语参考】以下是用户常用专有名词/术语的正确写法。若识别文本中出现读音相近但拼写有误的词，请据此纠正为正确写法；不相关的词不要强行替换：\n${list}\n\n`
}

export async function optimizeSpeech(
  text: string,
  config: ProviderConfig,
  glossary?: GlossaryEntry[]
): Promise<string> {
  if (!config?.apiKey?.trim()) {
    throw new Error('未配置 DeepSeek API Key，无法启用口语内容优化')
  }

  if (!text.trim()) {
    return text
  }

  const url = config.baseUrl.endsWith('/')
    ? `${config.baseUrl}chat/completions`
    : `${config.baseUrl}/chat/completions`

  const glossaryReference = buildGlossaryReference(glossary)
  const userContent = `${glossaryReference}原始口语文本：\n"""\n${text}\n"""\n\n请直接输出优化后的文本：`

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
        { role: 'user', content: userContent },
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
