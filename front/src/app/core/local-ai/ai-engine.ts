import { AiStage } from './local-ai-format';
import { RecipeReaderProgress } from './read-recipe-locally';

/** Who reads or writes: Gemini (Google, free) or Claude (Anthropic, paid), online; or the model running in this browser. */
export type AiEngine = 'gemini' | 'claude' | 'local';

const ENGINES: readonly AiEngine[] = ['gemini', 'claude', 'local'];

/** One choice for the recipes and the articles: the same person, on the same computer. */
const ENGINE_KEY = 'yona-recipe-ai-engine';

export function storedEngine(): AiEngine {
  try {
    const stored = localStorage.getItem(ENGINE_KEY);
    return ENGINES.find((engine) => engine === stored) ?? 'gemini';
  } catch {
    return 'gemini';
  }
}

export function storeEngine(engine: AiEngine): void {
  try {
    localStorage.setItem(ENGINE_KEY, engine);
  } catch {
    // Storage disabled: the choice lasts until the page is left
  }
}

/** What can be used now: an AI out of service, or the local one on a phone, hands over to the next that can. */
export interface Usable {
  gemini: boolean;
  claude: boolean;
  onPhone: boolean;
}

/** The engine chosen if it can work; otherwise Gemini, Claude, then the local model, the first that can. */
export function engineInUse(chosen: AiEngine, usable: Usable): AiEngine {
  const works = (engine: AiEngine) => (engine === 'local' ? !usable.onPhone : usable[engine]);
  return works(chosen) ? chosen : (ENGINES.find(works) ?? 'gemini');
}

/** "claude-haiku-5-5" → "Claude Haiku 5.5": the model configured, as people name it. */
export function claudeName(model: string | null | undefined): string {
  const parts = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(model ?? '');
  if (!parts) {
    return 'Claude';
  }
  const family = parts[1]!.charAt(0).toUpperCase() + parts[1]!.slice(1);
  return `Claude ${family} ${parts[2]}${parts[3] ? '.' + parts[3] : ''}`;
}

/** The words of the last two lines: what the model reads, then what it writes. */
export interface LocalWork {
  reading: string;
  readingDetail: string;
  writing: string;
  /** Before it writes; while it does, the characters written. */
  writingDetail: string;
}

/** What the model of the browser is doing, in the order it happens. */
export function localStages(progress: RecipeReaderProgress, work: LocalWork): AiStage[] {
  const filesDone = progress.type !== 'files' || progress.share >= 1;
  const current = progress.type === 'writing' ? 3 : progress.type === 'reading' ? 2 : filesDone ? 1 : 0;
  const state = (stage: number): AiStage['state'] => (stage < current ? 'done' : stage === current ? 'running' : 'waiting');
  return [
    {
      label: 'Ouverture du modèle',
      detail: progress.type === 'files' && !filesDone ? `Lecture des fichiers sur le disque, ${Math.round(progress.share * 100)} %` : 'Lecture des fichiers sur le disque',
      state: state(0),
    },
    { label: 'Installation dans la carte graphique', detail: 'Le plus long au démarrage : de quelques secondes à quelques minutes', state: state(1) },
    { label: work.reading, detail: work.readingDetail, state: state(2) },
    {
      label: work.writing,
      detail: progress.type === 'writing' ? `${progress.characters} caractères écrits` : work.writingDetail,
      state: state(3),
    },
  ];
}
