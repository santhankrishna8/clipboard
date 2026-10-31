// Retrieval eval for clipboard search: does the right item come back, and what does each half of hybrid search add?
//   npm run eval        (plain Node; first run loads the bundled model, nothing is downloaded)
// 24 realistic clipboard items, each asked two ways: a paraphrase that shares no words with it, and an exact fragment.
// The cut-off (FLOOR) and the keyword rules came from Ask Your Docs; treat the numbers as an in-sample check on
// synthetic data, not a benchmark.
import { join } from 'node:path';
import { Embedder, find, hybrid, type Entry } from '../electron/search.ts';

// [item, paraphrase query (no shared words), exact fragment query]
const DATA: [string, string, string][] = [
  ['Flight 6E 2145 Hyderabad to Bengaluru 14 Nov 06:40 PNR K4X9QZ', 'when does my plane leave for Bangalore', 'K4X9QZ'],
  ['Rent for November UPI ID asha.rao@okexample amount 18,500', 'how much do I pay the landlord every month', 'okexample'],
  ['SELECT customer_id, SUM(amount) FROM payments GROUP BY customer_id', 'database query to total what each buyer paid', 'customer_id'],
  ['Wi-Fi password for the guest network: lemon-orchid-4417', 'internet login for visitors', 'lemon-orchid-4417'],
  ['Meeting moved to Thursday 4 pm in conference room B, bring the signed purchase order', 'when is the get-together with the vendor', 'conference room B'],
  ['Electricity bill number 1104 2237 9086 due 18 Nov, pay before 5 pm to avoid the late fee', 'when do I have to settle the power charges', '1104 2237 9086'],
  ['Dear hiring team, I am writing to apply for the Software Engineer role on your careers page', 'cover letter for a job application', 'Software Engineer role'],
  ['Order #88213 delivered. Return window closes on 2 November', 'until when can I send the package back', '88213'],
  ['Pick up the parcel from the society office, flat 304, before 8 pm', 'collect my delivery from the building reception', 'flat 304'],
  ['npm install @huggingface/transformers koffi', 'command to add the machine learning library', 'koffi'],
  ['https://www.irctc.co.in/nget/train-search', 'link to book railway tickets', 'irctc'],
  ['https://www.incometax.gov.in/iec/foportal', 'website to file my tax return', 'incometax'],
  ['14, 2nd Cross, Jayanagar 4th Block, Bengaluru 560011', 'my home address', '560011'],
  ['Reminder: renew the driving licence before it expires, take two passport photos', 'what to bring when renewing my licence', 'passport photos'],
  ['Hi Priya, sharing the rent receipt for October. Please confirm once received.', 'message to a friend about the payment slip', 'Priya'],
  ['Doctor appointment Dr. Mehta cardiology 3 Dec 11:30 am Apollo clinic', 'when do I see the heart specialist', 'Dr. Mehta'],
  ['Gym membership renewal 4,999 rupees valid till March', 'how much is my fitness club fee', '4,999'],
  ['Birthday party for Rohan on Saturday 7 pm at the terrace restaurant', 'kid celebration this weekend', 'Rohan'],
  ['git checkout -b feature/login-timeout && git push -u origin feature/login-timeout', 'commands to start a new branch and publish it', 'login-timeout'],
  ['Passport application fee 1,500 rupees, pay at the Seva Kendra', 'how much does the travel document cost', 'Seva Kendra'],
  ['Insurance claim number HC-2026-77413, hospital discharge summary attached', 'reference for my medical reimbursement', 'HC-2026-77413'],
  ['Recipe: 2 cups basmati rice, 1 tsp cumin, 4 cups water, simmer 15 minutes', 'how to cook the grain', 'basmati'],
  ['Landlord Mr. Kiran Shetty phone 98450 12345', 'who owns my flat, contact number', 'Kiran Shetty'],
  ['Sprint demo on Friday at 11 am, share the dashboard link before', 'when do we present our work to the team', 'Sprint demo'],
];

const emb = await new Promise<Embedder>((ok) => {
  const e: Embedder = new Embedder(join(import.meta.dirname, '..', 'models'), (s) => s === 'ready' && ok(e));
});
const vecs = await emb.embed(DATA.map(([t]) => t));
const entries: Entry[] = DATA.map(([text], i) => ({ id: String(i), text, vec: vecs[i] }));
const qv = async (qs: string[]) => await emb.embed(qs);
const para = await qv(DATA.map(([, q]) => q));
const exact = await qv(DATA.map(([, , q]) => q));

type Ranker = (q: string, v: Float32Array) => string[];
const rankers: Record<string, Ranker> = {
  'keywords only': (q) => find(entries, { text: q }).map((h) => h.id),
  'meaning only': (_, v) => hybrid(entries, { text: '', vec: v }).map((h) => h.id),
  'hybrid (Clipvault)': (q, v) => find(entries, { text: q, vec: v }).map((h) => h.id),
};
function score(pick: (i: number) => [string, Float32Array]) {
  const out: Record<string, { h1: number; h3: number; mrr: number }> = {};
  for (const [name, rank] of Object.entries(rankers)) {
    let h1 = 0, h3 = 0, mrr = 0;
    DATA.forEach((_, i) => {
      const [q, v] = pick(i);
      const r = rank(q, v).indexOf(String(i)) + 1;
      if (r === 1) h1++;
      if (r >= 1 && r <= 3) h3++;
      if (r) mrr += 1 / r;
    });
    out[name] = { h1: h1 / DATA.length, h3: h3 / DATA.length, mrr: mrr / DATA.length };
  }
  return out;
}
const pct = (x: number) => (x * 100).toFixed(0).padStart(3) + '%';
for (const [title, pick] of [['paraphrased questions (no shared words)', (i: number): [string, Float32Array] => [DATA[i][1], para[i]]], ['exact fragments', (i: number): [string, Float32Array] => [DATA[i][2], exact[i]]]] as const) {
  console.log(`\n${title}, ${DATA.length} queries`);
  console.log('search'.padEnd(20), 'hit@1', 'hit@3', ' MRR');
  for (const [name, s] of Object.entries(score(pick))) console.log(name.padEnd(20), pct(s.h1), ' ', pct(s.h3), ' ', s.mrr.toFixed(2));
}
// junk queries must come back empty rather than showing the nearest item
const junk = await qv(['quantum chromodynamics lagrangian', 'zebra crossing in antarctica']);
const junkHits = ['quantum chromodynamics lagrangian', 'zebra crossing in antarctica'].map((q, i) => find(entries, { text: q, vec: junk[i] }).length);
console.log('\nunrelated queries returning anything (want 0):', junkHits.join(', '));
emb.stop();
