import { aiAssistantOf } from './ai-visits';

describe('aiAssistantOf', () => {
  it('knows the assistant by the page the visitor left, subdomains included', () => {
    expect(aiAssistantOf('https://chatgpt.com/', null)).toBe('CHATGPT');
    expect(aiAssistantOf('https://www.perplexity.ai/search/tarte', null)).toBe('PERPLEXITY');
    expect(aiAssistantOf('https://gemini.google.com/app', null)).toBe('GEMINI');
  });

  it('falls back on the tag of the link when the browser hides where the visitor came from', () => {
    expect(aiAssistantOf('', 'chatgpt.com')).toBe('CHATGPT');
    expect(aiAssistantOf('', 'Perplexity')).toBe('PERPLEXITY');
  });

  it('ignores search engines, social networks and look-alike sites', () => {
    expect(aiAssistantOf('https://www.google.com/', null)).toBeNull();
    expect(aiAssistantOf('https://notchatgpt.com/', null)).toBeNull();
    expect(aiAssistantOf('', 'newsletter')).toBeNull();
    expect(aiAssistantOf('pas une adresse', null)).toBeNull();
  });
});
