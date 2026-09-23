/* Loads the browse index once, then fetches trajectory bundles on demand. */

import { DATA_BASES, INDEX_URL, conditionTitle, conditionGroup, conditionModel, conditionLabel, conditionSetting, modelName } from './config.js';

let indexPromise = null;
export function loadIndex() {
  if (!indexPromise) indexPromise = fetchIndex();
  return indexPromise;
}

async function fetchIndex() {
  const response = await fetch(INDEX_URL);
  if (!response.ok) throw new Error(`Could not load ${INDEX_URL} (${response.status})`);
  const raw = await response.json();

  /* Families the browse pages leave out. The release still carries them;
     this is only what the viewer puts on screen. */
  const hidden = new Set(['controlled_peer', 'communication']);

  const all = raw.conditions.map((condition, i) => ({
    ...condition,
    order: i,
    title: conditionTitle(condition),
    model: conditionModel(condition),
    settingText: conditionSetting(condition),
    group: conditionGroup(condition),
    aliceName: modelName(condition.alice_model),
    bobName: modelName(condition.bob_model),
  }));
  const conditions = all.filter((condition) => !hidden.has(condition.experiment));

  const runs = raw.runs.map((run) => {
    const condition = all[run.c];
    const episodes = [];
    for (let i = 0; i < run.n; i += 1) {
      episodes.push({
        index: i,
        warmup: run.wu[i] === '1',
        evaluation: run.wu[i] === '1' ? null : i - run.w + 1,
        alice: run.va[i],
        bob: run.vb[i],
        aliceCorrect: run.ta[i] === '1',
        bobCorrect: run.tb[i] === '1',
        bothAccept: run.va[i] === 'a' && run.vb[i] === 'a',
        agreement: run.ag[i] === 'y',
        aliceRelax: run.xa[i] === 'y',
        bobRelax: run.xb[i] === 'y',
        task: raw.task_codes[run.tt[i]] || null,
      });
    }
    return {
      id: run.id,
      condition,
      sequence: run.s,
      warmup: run.w,
      episodes,
      onset: run.on ?? null,
      pathway: run.p ?? null,
      converged: run.cc ?? null,
    };
  });

  const shown = runs.filter((run) => !hidden.has(run.condition.experiment));
  const byId = new Map(shown.map((run) => [run.id, run]));
  const tasks = new Map(raw.tasks.map((task) => [task.id, task]));
  return { conditions, runs: shown, byId, tasks, pathways: raw.pathways };
}

/* ------------------------------------------------------------- filtering */

export const emptyFilters = () => ({
  experiments: new Set(),
  models: new Set(),
  pathways: new Set(),
  converged: new Set(),
});

export function filterRuns(runs, filters) {
  return runs.filter((run) => {
    if (filters.experiments.size && !filters.experiments.has(run.condition.experiment)) return false;
    if (filters.models.size
      && !filters.models.has(run.condition.aliceName)
      && !filters.models.has(run.condition.bobName)) return false;
    if (filters.pathways.size && !filters.pathways.has(run.pathway ?? 'n/a')) return false;
    if (filters.converged.size && !filters.converged.has(convergedKey(run))) return false;
    return true;
  });
}

/** null means collusion is not defined for that experiment family. */
export const convergedKey = (run) => (run.converged === true ? 'yes' : run.converged === false ? 'no' : 'n/a');

export const SORTS = {
  condition: { label: 'Default order', fn: (a, b) => a.condition.order - b.condition.order || a.sequence - b.sequence },
  'onset-asc': { label: 'Earliest collusion first', fn: (a, b) => (a.onset ?? 99) - (b.onset ?? 99) || a.condition.order - b.condition.order },
  'onset-desc': { label: 'Latest collusion first', fn: (a, b) => (b.onset ?? -1) - (a.onset ?? -1) || a.condition.order - b.condition.order },
};

/* ------------------------------------------------- trajectory bundles */

const bundles = new Map();

const bundlePath = (run) => `${run.condition.id}/rep${String(run.sequence).padStart(3, '0')}.json.gz`;

/** Where the bundle is expected; the error box shows this one. */
export const bundleUrl = (run) => `${DATA_BASES[0]}${bundlePath(run)}`;

/* Whichever source answered last time is tried first from then on, so only
   the first trajectory of a session can pay for a miss. */
let answered = null;

export function loadTrajectory(run) {
  if (!bundles.has(run.id)) bundles.set(run.id, fetchTrajectory(run).catch((error) => {
    bundles.delete(run.id);
    throw error;
  }));
  return bundles.get(run.id);
}

async function fetchTrajectory(run) {
  const order = answered ? [answered, ...DATA_BASES.filter((b) => b !== answered)] : DATA_BASES;
  let failure;
  for (const base of order) {
    try {
      const bundle = await fetchBundle(`${base}${bundlePath(run)}`);
      answered = base;
      return bundle;
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

async function fetchBundle(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw Object.assign(new Error(`The trajectory bundle could not be fetched (HTTP ${response.status}).`), { url });
  }
  /* Hugging Face serves .gz with its own content type rather than a transfer
     encoding, so the browser hands us the compressed bytes to unpack. */
  const encoding = (response.headers.get('content-encoding') || '').toLowerCase();
  const alreadyPlain = encoding.includes('gzip') || url.endsWith('.json');
  if (alreadyPlain) return response.json();
  if (typeof DecompressionStream !== 'function') {
    throw Object.assign(new Error('This browser cannot unpack gzip in the page. Try a current Chrome, Safari or Firefox.'), { url });
  }
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}

/** Warm the cache for a trajectory the visitor is likely to open next. */
export function prefetchTrajectory(run) {
  if (!bundles.has(run.id)) loadTrajectory(run).catch(() => {});
}
