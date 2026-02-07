import { buildGenerateAssetPrompt, GENERATE_ASSET_PROMPT, SUPPORTED_CHANNELS } from '../src/prompts/generate-assets';
import { buildSummarizePrompt, SUMMARIZE_PROMPT } from '../src/prompts/summarize';

describe('prompts/generate-assets', () => {
  describe('GENERATE_ASSET_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(typeof GENERATE_ASSET_PROMPT).toBe('string');
      expect(GENERATE_ASSET_PROMPT.length).toBeGreaterThan(0);
    });
  });

  describe('SUPPORTED_CHANNELS', () => {
    it('should include expected platforms', () => {
      expect(SUPPORTED_CHANNELS).toContain('twitter');
      expect(SUPPORTED_CHANNELS).toContain('linkedin');
      expect(SUPPORTED_CHANNELS).toContain('facebook');
      expect(SUPPORTED_CHANNELS).toContain('instagram');
      expect(SUPPORTED_CHANNELS).toContain('blog');
      expect(SUPPORTED_CHANNELS).toContain('email');
    });
  });

  describe('buildGenerateAssetPrompt', () => {
    it('should replace channel placeholder', () => {
      const result = buildGenerateAssetPrompt('twitter', 'Summary text', ['Point 1'], ['Hook 1']);
      expect(result).toContain('twitter');
      expect(result).not.toContain('{channel}');
    });

    it('should replace summary placeholder', () => {
      const result = buildGenerateAssetPrompt('blog', 'My great summary', [], []);
      expect(result).toContain('My great summary');
    });

    it('should format key points as numbered list', () => {
      const result = buildGenerateAssetPrompt('email', 'Summary', ['First', 'Second', 'Third'], []);
      expect(result).toContain('1. First');
      expect(result).toContain('2. Second');
      expect(result).toContain('3. Third');
    });

    it('should format hooks as numbered list', () => {
      const result = buildGenerateAssetPrompt('instagram', 'Summary', [], ['HookA', 'HookB']);
      expect(result).toContain('1. HookA');
      expect(result).toContain('2. HookB');
    });
  });
});

describe('prompts/summarize', () => {
  describe('SUMMARIZE_PROMPT', () => {
    it('should be a non-empty string with text placeholder', () => {
      expect(typeof SUMMARIZE_PROMPT).toBe('string');
      expect(SUMMARIZE_PROMPT).toContain('{text}');
    });
  });

  describe('buildSummarizePrompt', () => {
    it('should replace text placeholder', () => {
      const result = buildSummarizePrompt('This is my input text');
      expect(result).toContain('This is my input text');
      expect(result).not.toContain('{text}');
    });
  });
});
