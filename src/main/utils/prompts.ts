import type { LanguageCode, TranslateParams } from '../../shared/types'

const LANGUAGE_NAMES: Record<LanguageCode | 'auto', string> = {
  auto: '自动检测的语言',
  zh: '中文',
  en: '英语',
  ja: '日语',
}

const LANGUAGE_PAIR_INSTRUCTIONS: Record<string, string> = {
  'zh-ja': '注意日语的语序和助词使用，默认使用礼貌体（です/ます）。',
  'ja-zh': '将日语敬体自然转换为中文，不必逐字保留敬语痕迹。',
  'zh-en': '避免中式英语，使用地道、自然的英文表达。',
  'en-zh': '根据英文语境选择合适的中文语气和词汇，保持自然流畅。',
  'en-ja': '注意片假名外来语和日语表达习惯，默认使用礼貌体。',
  'ja-en': '将日语自然转换为英文，保持原意和语气。',
}

export function buildSystemPrompt(sourceLang: 'auto' | LanguageCode, targetLang: LanguageCode): string {
  const pairKey = `${sourceLang === 'auto' ? 'auto' : sourceLang}-${targetLang}`
  const pairInstruction = LANGUAGE_PAIR_INSTRUCTIONS[pairKey] || ''

  return `你是一个专业的中英日三语翻译助手，擅长准确、自然地进行语言转换。

请遵守以下规则：
1. 只输出翻译结果，不要解释、不要评论、不要复述原文。
2. 翻译要忠实原意，同时符合目标语言的表达习惯，避免直译。
3. 根据语境判断正式程度、语气风格，选择最合适的译法。
4. 专有名词（人名、地名、品牌、作品名）可保留原语言，必要时补充通用译名。
5. 如果是日语翻译，默认使用礼貌体（です/ます），除非原文明显是口语或简体。
6. 日文结果请提供罗马音读音；英文结果如涉及难词，可提供音标。
${pairInstruction ? `7. ${pairInstruction}` : ''}

输出必须是以下 JSON 格式，不要包含 markdown 代码块标记，确保是合法 JSON：
{
  "translatedText": "翻译后的文本",
  "pronunciation": "读音或音标（没有则留空字符串）",
  "alternatives": ["备选译法1", "备选译法2"],
  "detectedSourceLang": "检测到的源语言代码：zh/en/ja"
}`
}

export function buildUserPrompt(params: TranslateParams): string {
  const sourceName = params.sourceLang === 'auto'
    ? '自动检测的语言'
    : LANGUAGE_NAMES[params.sourceLang]
  const targetName = LANGUAGE_NAMES[params.targetLang]

  return `请将以下文本从 ${sourceName} 翻译为 ${targetName}。

原文：
"""
${params.text}
"""`
}
