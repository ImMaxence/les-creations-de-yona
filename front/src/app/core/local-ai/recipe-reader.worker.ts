/// <reference lib="webworker" />
import { AutoProcessor, Gemma4ForConditionalGeneration, TextStreamer } from '@huggingface/transformers';
import { RECIPE_MODEL } from './local-models';
import { setUpTransformers } from './transformers-setup';

export interface RecipeReaderRequest {
  instructions: string;
  message: string;
}

export type RecipeReaderEvent =
  | { type: 'writing'; characters: number }
  | { type: 'done'; answer: string }
  | { type: 'error'; message: string };

/** Long enough for the longest recipe: the JSON repeats every field name. */
const MAX_ANSWER_TOKENS = 8000;

const post = (event: RecipeReaderEvent) => postMessage(event);

addEventListener('message', ({ data }: MessageEvent<RecipeReaderRequest>) => {
  read(data).catch((error: unknown) => post({ type: 'error', message: String(error) }));
});

async function read({ instructions, message }: RecipeReaderRequest): Promise<void> {
  setUpTransformers();
  const { repo, revision } = RECIPE_MODEL;
  const processor = await AutoProcessor.from_pretrained(repo, { revision });
  const model = await Gemma4ForConditionalGeneration.from_pretrained(repo, { revision, dtype: 'q4f16', device: 'webgpu' });
  const prompt = processor.apply_chat_template(
    [
      { role: 'system', content: instructions },
      { role: 'user', content: [{ type: 'text', text: message }] },
    ] as never,
    { enable_thinking: false, add_generation_prompt: true } as never,
  );
  const inputs = await (processor as unknown as (...args: unknown[]) => Promise<Record<string, { dims: number[] }>>)(
    prompt,
    null,
    null,
    { add_special_tokens: false },
  );
  let characters = 0;
  const outputs = (await model.generate({
    ...inputs,
    max_new_tokens: MAX_ANSWER_TOKENS,
    do_sample: false,
    streamer: new TextStreamer(processor.tokenizer as never, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        characters += text.length;
        post({ type: 'writing', characters });
      },
    }),
  } as never)) as { slice(...ranges: unknown[]): unknown };
  const [answer] = processor.batch_decode(outputs.slice(null, [inputs['input_ids'].dims.at(-1), null]) as never, {
    skip_special_tokens: true,
  });
  post({ type: 'done', answer });
}
