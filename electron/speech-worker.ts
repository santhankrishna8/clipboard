// Runs Whisper (speech to text) off the main thread. The model ships inside the app (models/), so there is no download
// and no audio ever leaves the laptop.
import { parentPort, workerData } from 'node:worker_threads';
import { env, pipeline } from '@huggingface/transformers';

env.allowRemoteModels = false;
env.localModelPath = workerData.modelsDir;

const asr = await pipeline('automatic-speech-recognition', workerData.model, { dtype: 'q8' });
parentPort!.postMessage({ ready: true });
parentPort!.on('message', async ({ id, audio }: { id: number; audio: Float32Array }) => {
  try {
    // Long dictations are cut into overlapping 30-second windows, which is what Whisper was trained on.
    const out = (await asr(audio, audio.length > 16_000 * 30 ? { chunk_length_s: 30, stride_length_s: 5 } : {})) as { text: string } | { text: string }[];
    parentPort!.postMessage({ id, text: (Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text).trim() });
  } catch (e) {
    parentPort!.postMessage({ id, error: String(e) });
  }
});
