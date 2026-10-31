// Runs the embedding model off the main thread. The model ships inside the app (models/), so there is no download.
import { parentPort, workerData } from 'node:worker_threads';
import { env, pipeline } from '@huggingface/transformers';

env.allowRemoteModels = false;
env.localModelPath = workerData.modelsDir;

const model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
parentPort!.postMessage({ ready: true });
parentPort!.on('message', async ({ id, texts }: { id: number; texts: string[] }) => {
  try {
    const out = await model(texts, { pooling: 'mean', normalize: true });
    parentPort!.postMessage({ id, vecs: out.tolist() });
  } catch (e) {
    parentPort!.postMessage({ id, error: String(e) });
  }
});
