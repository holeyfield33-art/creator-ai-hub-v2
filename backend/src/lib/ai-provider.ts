// AI Provider interface for pluggable AI backends

export interface AIResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface AIProvider {
  complete(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<AIResponse>
}

// OpenAI-compatible provider
export class OpenAIProvider implements AIProvider {
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor(apiKey: string, model: string = 'gpt-3.5-turbo', baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.model = model
  }

  async complete(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<AIResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: options?.maxTokens || 1000,
        temperature: options?.temperature || 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data: any = await response.json()
    
    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    }
  }
}

// Mock provider for testing without API key
export class MockAIProvider implements AIProvider {
  async complete(prompt: string): Promise<AIResponse> {
    console.log('[MockAI] Generating mock response for prompt length:', prompt.length)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Return mock structured response
    return {
      content: JSON.stringify({
        summary: 'This is a mock summary of the provided content. It demonstrates the AI analysis functionality without requiring an actual API key.',
        key_points: [
          'Mock key point 1: Main idea extracted from content',
          'Mock key point 2: Supporting detail or theme',
          'Mock key point 3: Concluding insight or takeaway',
        ],
        hooks: [
          'Mock hook 1: Compelling angle for audience engagement',
          'Mock hook 2: Interesting perspective or controversy',
          'Mock hook 3: Actionable insight or surprising fact',
        ],
      }),
      usage: {
        promptTokens: 100,
        completionTokens: 150,
        totalTokens: 250,
      },
    }
  }
}

// Factory function to create AI provider based on configuration
export function createAIProvider(): AIProvider {
  const apiKey = process.env.AI_API_KEY || ''
  
  if (!apiKey || apiKey === 'mock' || apiKey === 'test') {
    console.log('⚠️  Using Mock AI Provider (no API key configured)')
    return new MockAIProvider()
  }
  
  const model = process.env.AI_MODEL || 'gpt-3.5-turbo'
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1'
  
  console.log(`✅ Using OpenAI Provider (model: ${model})`)
  return new OpenAIProvider(apiKey, model, baseUrl)
}

// Utility function to chunk text if it's too long
export function chunkText(text: string, maxChunkLength: number = 4000): string[] {
  if (text.length <= maxChunkLength) {
    return [text]
  }

  const chunks: string[] = []
  const sentences = text.split(/[.!?]+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue

    if ((currentChunk + trimmedSentence).length > maxChunkLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      
      // If single sentence is too long, split by words
      if (trimmedSentence.length > maxChunkLength) {
        const words = trimmedSentence.split(' ')
        for (const word of words) {
          if ((currentChunk + ' ' + word).length > maxChunkLength) {
            if (currentChunk) {
              chunks.push(currentChunk.trim())
            }
            currentChunk = word
          } else {
            currentChunk += ' ' + word
          }
        }
      } else {
        currentChunk = trimmedSentence
      }
    } else {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}
