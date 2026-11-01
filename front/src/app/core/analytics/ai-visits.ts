import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Api } from '../api/generated/api';
import { RecordAiVisit$Params, recordAiVisit } from '../api/generated/fn/stats/record-ai-visit';

export type AiAssistant = RecordAiVisit$Params['assistant'];

/** This visit was already looked at: the following pages of the tab count nothing more. */
const STORAGE_KEY = 'yona-ai-visit';

/** Sites of the AI assistants, and their subdomains (www.perplexity.ai). */
const ASSISTANT_HOSTS: Record<string, AiAssistant> = {
  'chatgpt.com': 'CHATGPT',
  'chat.openai.com': 'CHATGPT',
  'perplexity.ai': 'PERPLEXITY',
  'gemini.google.com': 'GEMINI',
  'bard.google.com': 'GEMINI',
  'copilot.microsoft.com': 'COPILOT',
  'copilot.cloud.microsoft': 'COPILOT',
  'claude.ai': 'CLAUDE',
  'chat.mistral.ai': 'MISTRAL',
  'chat.deepseek.com': 'DEEPSEEK',
  'grok.com': 'GROK',
};

/** Tags some assistants add to their links (?utm_source=chatgpt.com), when the browser hides where the visitor came from. */
const ASSISTANT_SOURCES: Record<string, AiAssistant> = {
  chatgpt: 'CHATGPT',
  perplexity: 'PERPLEXITY',
  gemini: 'GEMINI',
  copilot: 'COPILOT',
  claude: 'CLAUDE',
  mistral: 'MISTRAL',
  deepseek: 'DEEPSEEK',
  grok: 'GROK',
};

/** The assistant a visitor comes from: the page they left (referrer), otherwise the link's utm_source. */
export function aiAssistantOf(referrer: string, utmSource: string | null): AiAssistant | null {
  let host = '';
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase() : '';
  } catch {
    // Not an address: nothing to learn from it
  }
  const known = Object.keys(ASSISTANT_HOSTS).find((site) => host === site || host.endsWith(`.${site}`));
  if (known) {
    return ASSISTANT_HOSTS[known]!;
  }
  // "chatgpt.com", "perplexity", "copilot.com": its first word
  const source = utmSource?.trim().toLowerCase().split(/[.\s]/)[0] ?? '';
  return ASSISTANT_SOURCES[source] ?? null;
}

/**
 * Visits coming from an AI assistant (a link in an answer of ChatGPT, Perplexity…), for the
 * back-office statistics: how often the site is cited. Told to the API once per visit, with the
 * assistant's name only: nothing about the visitor, no cookie, so no consent needed. Browsers driven
 * by a program are not counted; the API leaves out the admins' own visits.
 */
@Injectable({ providedIn: 'root' })
export class AiVisits {
  private readonly api = inject(Api);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  count(): void {
    const window = this.document.defaultView;
    if (!this.isBrowser || !window || window.navigator.webdriver || seen()) {
      return;
    }
    const assistant = aiAssistantOf(
      this.document.referrer,
      new URLSearchParams(window.location.search).get('utm_source'),
    );
    if (assistant) {
      // Offline, or the API out of reach: the visit is not counted, nothing to tell the visitor
      this.api.invoke(recordAiVisit, { assistant }).catch(() => undefined);
    }
  }
}

/** Looked at once per tab: true from the second call on. */
function seen(): boolean {
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) {
      return true;
    }
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Storage blocked (private browsing): looked at again on each full load of the site
  }
  return false;
}
