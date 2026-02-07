// Mock fetch before importing
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import {
  OpenAIProvider,
  MockAIProvider,
  createAIProvider,
  chunkText,
} from '../src/lib/ai-provider';

describe('ai-provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    delete process.env.AI_BASE_URL;
  });

  describe('OpenAIProvider', () => {
    it('should make correct API call', async () => {
      const provider = new OpenAIProvider('test-key', 'gpt-4', 'https://api.test.com/v1');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello world' } }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const result = await provider.complete('test prompt');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
          }),
        })
      );
      expect(result.content).toBe('Hello world');
      expect(result.usage?.totalTokens).toBe(15);
    });

    it('should use custom options', async () => {
      const provider = new OpenAIProvider('key');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });

      await provider.complete('test', { maxTokens: 500, temperature: 0.3 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.max_tokens).toBe(500);
      expect(body.temperature).toBe(0.3);
    });

    it('should use default options when none provided', async () => {
      const provider = new OpenAIProvider('key');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });

      await provider.complete('test');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.max_tokens).toBe(1000);
      expect(body.temperature).toBe(0.7);
      expect(body.model).toBe('gpt-3.5-turbo');
    });

    it('should throw on API error', async () => {
      const provider = new OpenAIProvider('key');

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(provider.complete('test')).rejects.toThrow('OpenAI API error: 401 - Unauthorized');
    });

    it('should use default base URL', async () => {
      const provider = new OpenAIProvider('key');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });

      await provider.complete('test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    });
  });

  describe('MockAIProvider', () => {
    it('should return mock response with valid JSON content', async () => {
      const provider = new MockAIProvider();
      const result = await provider.complete('test prompt');

      expect(result.content).toBeTruthy();
      const parsed = JSON.parse(result.content);
      expect(parsed.summary).toBeTruthy();
      expect(parsed.key_points).toBeInstanceOf(Array);
      expect(parsed.hooks).toBeInstanceOf(Array);
    });

    it('should return usage info', async () => {
      const provider = new MockAIProvider();
      const result = await provider.complete('test');

      expect(result.usage).toBeDefined();
      expect(result.usage!.promptTokens).toBe(100);
      expect(result.usage!.completionTokens).toBe(150);
      expect(result.usage!.totalTokens).toBe(250);
    });
  });

  describe('createAIProvider', () => {
    it('should return MockAIProvider when no API key', () => {
      const provider = createAIProvider();
      expect(provider).toBeInstanceOf(MockAIProvider);
    });

    it('should return MockAIProvider when API key is "mock"', () => {
      process.env.AI_API_KEY = 'mock';
      const provider = createAIProvider();
      expect(provider).toBeInstanceOf(MockAIProvider);
    });

    it('should return MockAIProvider when API key is "test"', () => {
      process.env.AI_API_KEY = 'test';
      const provider = createAIProvider();
      expect(provider).toBeInstanceOf(MockAIProvider);
    });

    it('should return OpenAIProvider when API key is set', () => {
      process.env.AI_API_KEY = 'sk-real-key';
      const provider = createAIProvider();
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should use custom model and base URL from env', () => {
      process.env.AI_API_KEY = 'sk-real-key';
      process.env.AI_MODEL = 'gpt-4';
      process.env.AI_BASE_URL = 'https://custom.api.com/v1';
      const provider = createAIProvider();
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe('chunkText', () => {
    it('should return single chunk for short text', () => {
      const result = chunkText('Hello world');
      expect(result).toEqual(['Hello world']);
    });

    it('should return single chunk when text equals max length', () => {
      const text = 'a'.repeat(4000);
      const result = chunkText(text, 4000);
      expect(result).toEqual([text]);
    });

    it('should split long text at sentence boundaries', () => {
      // Create text with clear sentences
      const sentence = 'This is a test sentence';
      const longText = Array(100).fill(sentence).join('. ') + '.';
      const result = chunkText(longText, 200);
      expect(result.length).toBeGreaterThan(1);
      result.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(200);
      });
    });

    it('should handle text with no sentence boundaries by splitting on words', () => {
      // A single very long "sentence" with no period/!/? separators
      const longWord = 'word ';
      const longText = longWord.repeat(1000).trim();
      const result = chunkText(longText, 50);
      expect(result.length).toBeGreaterThan(1);
    });

    it('should handle empty sentences gracefully', () => {
      const text = 'First. . . Second.';
      const result = chunkText(text, 100);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use default max chunk length of 4000', () => {
      const shortText = 'Short text.';
      const result = chunkText(shortText);
      expect(result).toEqual(['Short text.']);
    });

    it('should handle text that needs word-level splitting for oversized sentences', () => {
      // Build a text where a single sentence is longer than maxChunkLength
      const veryLongSentence = Array(500).fill('longword').join(' ') + '.';
      const result = chunkText(veryLongSentence, 100);
      expect(result.length).toBeGreaterThan(1);
    });
  });
});
