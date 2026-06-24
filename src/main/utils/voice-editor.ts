import type { ProviderConfig } from '../../shared/types'

const SYSTEM_PROMPT = `你是一个文本编辑助手。用户选中了一段文本，并通过语音给出了一条编辑指令。请严格按照指令对原文进行修改，然后只输出修改后的文本。

要求：
1. 准确理解并执行编辑指令，常见指令包括："改短一点 / 精简""扩写 / 更详细""更正式 / 更专业""更口语 / 更随意""修正语法和拼写""换种说法 / 改写""翻译成英文 / 中文 / 日文"等
2. 只对原文做指令要求的改动，不要擅自添加指令之外的内容
3. 保持原文的核心意思和关键信息（除非指令明确要求改变）
4. 不要解释，不要加引号，不要输出"修改后："之类的前缀，只输出最终文本
5. 如果指令是翻译，直接输出译文`

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
 * 按语音指令改写选中的文本。selectedText 为用户选中的原文，command 为语音识别得到的编辑指令。
 */
export async function editTextWithVoice(
  selectedText: string,
  command: string,
  config: ProviderConfig
): Promise<string> {
  if (!config?.apiKey?.trim()) {
    throw new Error('未配置 DeepSeek API Key，无法启用语音编辑')
  }

  if (!selectedText.trim() || !command.trim()) {
    return selectedText
  }

  const url = config.baseUrl.endsWith('/')
    ? `${config.baseUrl}chat/completions`
    : `${config.baseUrl}/chat/completions`

  const userContent = `原文：\n"""\n${selectedText}\n"""\n\n编辑指令：${command}\n\n请直接输出修改后的文本：`

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
    throw new Error(`语音编辑请求失败：${data.error?.message || response.statusText || response.status}`)
  }

  const edited = data.choices?.[0]?.message?.content?.trim()
  if (!edited) {
    throw new Error('语音编辑返回结果为空')
  }

  return edited
}
