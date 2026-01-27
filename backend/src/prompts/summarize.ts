export const SUMMARIZE_PROMPT = `You are an expert content analyst. Analyze the following text and provide:

1. A concise 2-3 sentence summary
2. Key points (3-5 bullet points highlighting main ideas)
3. Content hooks (3-5 compelling angles or interesting aspects that could engage an audience)

Text to analyze:
---
{text}
---

Respond in JSON format:
{
  "summary": "2-3 sentence summary here",
  "key_points": ["point 1", "point 2", "point 3"],
  "hooks": ["hook 1", "hook 2", "hook 3"]
}
`

export function buildSummarizePrompt(text: string): string {
  return SUMMARIZE_PROMPT.replace('{text}', text)
}
