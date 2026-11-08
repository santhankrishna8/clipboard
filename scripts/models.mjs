// Downloads the speech-to-text model (Whisper base.en, 8-bit, about 80 MB) into models/, once, at build time.
// The installer carries it, so the app itself never downloads anything and audio never leaves the laptop.
//   npm run models            (npm run dist and npm run pack call it for you)
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MODEL = 'Xenova/whisper-base.en';
const FILES = [
  'config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx',
];
const dir = join(import.meta.dirname, '..', 'models', ...MODEL.split('/'));

for (const f of FILES) {
  const to = join(dir, f);
  if (existsSync(to) && statSync(to).size > 0) continue;
  mkdirSync(dirname(to), { recursive: true });
  const url = `https://huggingface.co/${MODEL}/resolve/main/${f}`;
  process.stdout.write(`${MODEL}/${f} … `);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(to + '.part'));
  renameSync(to + '.part', to); // a cut-off download never looks finished
  console.log(`${(statSync(to).size / 1048576).toFixed(1)} MB`);
}
console.log(`Speech model ready in models/${MODEL}`);
