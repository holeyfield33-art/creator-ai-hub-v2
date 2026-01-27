export const GENERATE_ASSET_PROMPT = `You are a creative content writer specializing in {channel} content. 

Based on the following campaign summary and key points, create engaging {channel} content:

Summary:
{summary}

Key Points:
{keyPoints}

Content Hooks:
{hooks}

Channel: {channel}
Requirements:
- Write compelling, platform-appropriate content
- Use the tone and style suitable for {channel}
- Keep it concise and engaging
- Include a clear call-to-action if appropriate

Respond with just the content text, no additional formatting or explanation.`

export function buildGenerateAssetPrompt(
  channel: string,
  summary: string,
  keyPoints: string[],
  hooks: string[]
): string {
  return GENERATE_ASSET_PROMPT
    .replace(/{channel}/g, channel)
    .replace('{summary}', summary)
    .replace('{keyPoints}', keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n'))
    .replace('{hooks}', hooks.map((h, i) => `${i + 1}. ${h}`).join('\n'))
}

export const SUPPORTED_CHANNELS = [
  'twitter',
  'linkedin',
  'facebook',
  'instagram',
  'blog',
  'email',
] as const

export type Channel = typeof SUPPORTED_CHANNELS[number]
