import { chunkText, createAIProvider, MockAIProvider, OpenAIProvider } from '../src/lib/ai-provider';
import { buildGenerateAssetPrompt, SUPPORTED_CHANNELS } from '../src/prompts/generate-assets';
import { buildSummarizePrompt, SUMMARIZE_PROMPT } from '../src/prompts/summarize';
import { calculateEngagementRate, fetchMetricsFromPlatform } from '../src/lib/social-metrics';

// ─── chunkText ──────────────────────────────────────────────────────────────

describe('chunkText', () => {
  it('should return single chunk for short text', () => {
    const result = chunkText('Short text.', 4000);
    expect(result).toEqual(['Short text.']);
  });

  it('should return single chunk when text equals max length', () => {
    const text = 'a'.repeat(4000);
    const result = chunkText(text, 4000);
    expect(result).toEqual([text]);
  });

  it('should split text on sentence boundaries', () => {
    const sentence1 = 'First sentence here';
    const sentence2 = 'Second sentence here';
    const text = `${sentence1}. ${sentence2}.`;
    // Use a small max to force splitting
    const result = chunkText(text, 25);
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Each chunk should be non-empty
    result.forEach((chunk) => expect(chunk.trim().length).toBeGreaterThan(0));
  });

  it('should split very long sentences by words', () => {
    // Create a sentence with no periods that exceeds max
    const longSentence = Array(20).fill('word').join(' ');
    const result = chunkText(longSentence, 30);
    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(30));
  });

  it('should handle empty string', () => {
    const result = chunkText('', 4000);
    expect(result).toEqual(['']);
  });

  it('should handle text with multiple sentence-ending punctuation', () => {
    const text = 'Hello! How are you? I am fine. Great!';
    const result = chunkText(text, 4000);
    expect(result.length).toBe(1);
  });

  it('should use default maxChunkLength of 4000', () => {
    const shortText = 'Short.';
    const result = chunkText(shortText);
    expect(result).toEqual(['Short.']);
  });
});

// ─── createAIProvider ───────────────────────────────────────────────────────

describe('createAIProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return MockAIProvider when AI_API_KEY is empty', () => {
    process.env.AI_API_KEY = '';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('should return MockAIProvider when AI_API_KEY is "mock"', () => {
    process.env.AI_API_KEY = 'mock';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('should return MockAIProvider when AI_API_KEY is "test"', () => {
    process.env.AI_API_KEY = 'test';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('should return OpenAIProvider with real API key', () => {
    process.env.AI_API_KEY = 'sk-real-key-123';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('should return MockAIProvider when AI_API_KEY is not set', () => {
    delete process.env.AI_API_KEY;
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(MockAIProvider);
  });
});

// ─── MockAIProvider ─────────────────────────────────────────────────────────

describe('MockAIProvider', () => {
  it('should return valid JSON with expected fields', async () => {
    const provider = new MockAIProvider();
    const response = await provider.complete('Test prompt');

    const parsed = JSON.parse(response.content);
    expect(parsed).toHaveProperty('summary');
    expect(parsed).toHaveProperty('key_points');
    expect(parsed).toHaveProperty('hooks');
    expect(Array.isArray(parsed.key_points)).toBe(true);
    expect(Array.isArray(parsed.hooks)).toBe(true);
  });

  it('should include usage stats', async () => {
    const provider = new MockAIProvider();
    const response = await provider.complete('Test prompt');

    expect(response.usage).toBeDefined();
    expect(response.usage!.promptTokens).toBe(100);
    expect(response.usage!.completionTokens).toBe(150);
    expect(response.usage!.totalTokens).toBe(250);
  });
});

// ─── OpenAIProvider.complete() ───────────────────────────────────────────────

describe('OpenAIProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should call fetch with correct request shape and return parsed response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'AI generated text' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
    }) as jest.Mock;
    global.fetch = mockFetch;

    const provider = new OpenAIProvider('sk-test-key', 'gpt-4o', 'https://api.example.com/v1');
    const result = await provider.complete('Hello', { maxTokens: 500, temperature: 0.5 });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test-key',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 500,
        temperature: 0.5,
      }),
    });

    expect(result).toEqual({
      content: 'AI generated text',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
  });

  it('should use defaults for maxTokens and temperature when options omitted', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        }),
    }) as jest.Mock;
    global.fetch = mockFetch;

    const provider = new OpenAIProvider('sk-key');
    await provider.complete('Prompt');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(1000);
    expect(body.temperature).toBe(0.7);
    expect(body.model).toBe('gpt-3.5-turbo');
  });

  it('should throw on non-ok API response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limit exceeded'),
    }) as jest.Mock;
    global.fetch = mockFetch;

    const provider = new OpenAIProvider('sk-key');

    await expect(provider.complete('Test')).rejects.toThrow(
      'OpenAI API error: 429 - Rate limit exceeded'
    );
  });
});

// ─── buildGenerateAssetPrompt ───────────────────────────────────────────────

describe('buildGenerateAssetPrompt', () => {
  it('should replace all {channel} placeholders', () => {
    const result = buildGenerateAssetPrompt('twitter', 'Summary', ['Point 1'], ['Hook 1']);
    // Count occurrences - should have no remaining {channel}
    expect(result).not.toContain('{channel}');
    expect(result).toContain('twitter');
  });

  it('should format key points as numbered list', () => {
    const result = buildGenerateAssetPrompt('linkedin', 'Summary', ['Alpha', 'Beta'], []);
    expect(result).toContain('1. Alpha');
    expect(result).toContain('2. Beta');
  });

  it('should format hooks as numbered list', () => {
    const result = buildGenerateAssetPrompt('facebook', 'Summary', [], ['Hook A', 'Hook B']);
    expect(result).toContain('1. Hook A');
    expect(result).toContain('2. Hook B');
  });

  it('should include the summary text', () => {
    const result = buildGenerateAssetPrompt('blog', 'My campaign summary', [], []);
    expect(result).toContain('My campaign summary');
  });
});

// ─── SUPPORTED_CHANNELS ────────────────────────────────────────────────────

describe('SUPPORTED_CHANNELS', () => {
  it('should contain expected channels', () => {
    expect(SUPPORTED_CHANNELS).toContain('twitter');
    expect(SUPPORTED_CHANNELS).toContain('linkedin');
    expect(SUPPORTED_CHANNELS).toContain('facebook');
    expect(SUPPORTED_CHANNELS).toContain('instagram');
    expect(SUPPORTED_CHANNELS).toContain('blog');
    expect(SUPPORTED_CHANNELS).toContain('email');
  });
});

// ─── buildSummarizePrompt ──────────────────────────────────────────────────

describe('buildSummarizePrompt', () => {
  it('should insert text into the template', () => {
    const result = buildSummarizePrompt('Hello world content');
    expect(result).toContain('Hello world content');
    expect(result).not.toContain('{text}');
  });

  it('should preserve JSON format instructions', () => {
    const result = buildSummarizePrompt('test');
    expect(result).toContain('"summary"');
    expect(result).toContain('"key_points"');
    expect(result).toContain('"hooks"');
  });
});

// ─── calculateEngagementRate ────────────────────────────────────────────────

describe('calculateEngagementRate', () => {
  it('should return 0 when impressions are 0', () => {
    const rate = calculateEngagementRate({
      impressions: 0,
      engagements: 10,
      likes: 5,
      shares: 3,
      comments: 2,
      clicks: 0,
    });
    expect(rate).toBe(0);
  });

  it('should calculate percentage correctly', () => {
    const rate = calculateEngagementRate({
      impressions: 1000,
      engagements: 50,
      likes: 30,
      shares: 10,
      comments: 10,
      clicks: 5,
    });
    expect(rate).toBe(5);
  });

  it('should handle large numbers', () => {
    const rate = calculateEngagementRate({
      impressions: 1000000,
      engagements: 25000,
      likes: 15000,
      shares: 5000,
      comments: 5000,
      clicks: 2000,
    });
    expect(rate).toBe(2.5);
  });
});

// ─── fetchMetricsFromPlatform ───────────────────────────────────────────────

describe('fetchMetricsFromPlatform', () => {
  it('should dispatch to Twitter fetcher for "x"', async () => {
    const metrics = await fetchMetricsFromPlatform('x', 'post-123', 'token');
    expect(metrics).toHaveProperty('impressions');
    expect(metrics).toHaveProperty('engagements');
    expect(metrics).toHaveProperty('likes');
    expect(metrics).toHaveProperty('shares');
    expect(metrics).toHaveProperty('comments');
    expect(metrics).toHaveProperty('clicks');
  });

  it('should dispatch to Twitter fetcher for "twitter"', async () => {
    const metrics = await fetchMetricsFromPlatform('twitter', 'post-123', 'token');
    expect(metrics.impressions).toBeGreaterThanOrEqual(0);
  });

  it('should dispatch to LinkedIn fetcher for "linkedin"', async () => {
    const metrics = await fetchMetricsFromPlatform('linkedin', 'post-123', 'token');
    expect(metrics.impressions).toBeGreaterThanOrEqual(0);
  });

  it('should throw for unsupported platform', async () => {
    await expect(
      fetchMetricsFromPlatform('tiktok', 'post-123', 'token')
    ).rejects.toThrow('Unsupported platform: tiktok');
  });
});
