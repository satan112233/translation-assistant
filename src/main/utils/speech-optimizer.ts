import type { GlossaryEntry, ProviderConfig, VoiceDictionaryEntry } from '../../shared/types'

const SYSTEM_PROMPT = `你是一位智能的语音输入助手。请对以下语音识别得到的口语文本进行整理，让结果自然、清晰、流畅，读起来像用户精心表达的内容一样。

处理原则：
1. 【最重要】识别说话人的"改口/自我修正"：当出现"不对""错了""不是""应该是""我是说""划掉""重说""改为""之前……现在……"等纠正信号时，只保留最后的正确表述，彻底删除被否定、被替换的旧内容，绝不能把前后两种说法都保留下来
2. 移除无意义的填充词、口头禅、停顿词（如"嗯"、"啊"、"那个"、"然后"、"就是"、"你知道吗"等），但不要改变用户的自然语气和表达方式
3. 检测并移除不必要的重复词语，保留用户为了强调而故意重复的内容
4. 修正语音识别可能产生的同音字、相近音错误
5. 理解用户话语背后的真实意图，优化措辞以提高清晰度和流畅性，但不要改变原意，不要丢失信息，也不要过度改写为刻板的"书面语"
6. 将说出的标点/换行口令转换为真正的符号："逗号""句号""问号""感叹号""冒号""分号""顿号""引号"等转成对应标点；"换行""回车"转成换行；"新段落""另起一段"转成空行分段
7. 自动将口述的列表、步骤、要点整理成清晰、结构化的文本
8. 不要添加原文中没有的信息
9. 不要解释，只输出整理后的文本
10. 如果原始文本没有实质性内容（只有语气词、停顿词、标点符号、特殊符号或为空），请直接输出空字符串，不要生成任何解释或示例回复

改口处理示例（仅供理解规则，不要把示例内容输出）：
- 输入："明天下午三点开会，啊不对，是后天上午十点" → 输出："后天上午十点开会"
- 输入："把这个变量叫 count，嗯不对，叫 total 吧" → 输出："把这个变量叫 total"
- 输入："发给张三，不是发给李四" → 输出："发给李四"

标点与格式化示例（仅供理解规则，不要把示例内容输出）：
- 输入："你好逗号今天天气不错句号" → 输出："你好，今天天气不错。"
- 输入："计划如下第一调研第二设计第三开发" → 输出："计划如下：\n1. 调研\n2. 设计\n3. 开发"`

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
 * 根据术语库和语音个人词典构建"专有名词正确写法"参考块，用于纠正 ASR 把人名、
 * 品牌、专业词识别成读音相近但拼写错误的情况。两者都为空时返回空字符串。
 */
function buildGlossaryReference(
  glossary?: GlossaryEntry[],
  dictionary?: VoiceDictionaryEntry[]
): string {
  const terms = new Set<string>()

  for (const entry of glossary ?? []) {
    const term = entry.term?.trim()
    const translation = entry.translation?.trim()
    if (term) terms.add(term)
    if (translation) terms.add(translation)
  }

  for (const entry of dictionary ?? []) {
    const word = entry.word?.trim()
    if (word) terms.add(word)
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
  glossary?: GlossaryEntry[],
  dictionary?: VoiceDictionaryEntry[]
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

  const glossaryReference = buildGlossaryReference(glossary, dictionary)
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
