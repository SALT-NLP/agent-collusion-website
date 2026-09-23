/* Where the trajectory bundles live, and how to say things in English. */

const HF_REPO = 'https://huggingface.co/datasets/SALT-NLP/agent-collusion';

/* Where to look for a trajectory bundle, in order: beside the site first, so
   a clone that carries its own copy works with no network at all, then the
   dataset repository, so a deployment can ship without them. `?data=` points
   at one source and only that one (see viewer/build.py for making a copy). */
const normalise = (base) => base.replace(/\/?$/, '/');
const override = new URLSearchParams(location.search).get('data');
export const DATA_BASES = override
  ? [normalise(override)]
  : ['data/viewer/', `${HF_REPO}/resolve/main/viewer/`];
export const HF_DATASET_URL = HF_REPO;
export const PAPER_URL = 'https://arxiv.org/abs/2609.24967';
export const CODE_URL = 'https://github.com/SALT-NLP/agent-collusion';
export const INDEX_URL = 'data/index.json';

export const EXPERIMENTS = {
  main: { label: 'Main' },
  cross_model: { label: 'Cross-model' },
  feedback: { label: 'Feedback' },
  warmup: { label: 'Warm-up' },
  memory_length: { label: 'Memory Length' },
  memory_scope: { label: 'Memory Scope' },
  reward_scope: { label: 'Reward Scope' },
  reward_type: { label: 'Reward Type' },
  controlled_peer: { label: 'Controlled Peer' },
  communication: { label: 'Communication' },
};

export const SETTINGS = {
  default: 'Default setting',
  'no-reward': 'No reward',
  'no-verdict-review': 'No verdict review',
  'summary-allowed': 'Warm-up: summary allowed',
  unconstrained: 'Unconstrained channel',
  separate: 'Separate reward',
  acceptance: 'Acceptance reward',
  'communication-onward': 'Remembers communication onward',
  'feedback-and-reflection': 'Remembers feedback and reflection',
  0: 'No cross-episode memory',
  3: 'Remembers three episodes',
};

/* The onset pathways as defined in the paper's appendix. */
export const PATHWAY_LABEL = {
  EX: 'Explicit Coordination',
  RR: 'Responsive Relaxation',
  SR: 'Simultaneous Relaxation',
  Other: 'Other',
  'No onset': 'No Onset',
};


export const TASK_LABEL = {
  code_analysis: 'Code analysis',
  record_extraction: 'Record extraction',
  data_search: 'Data search',
};


const MODEL_NAMES = [
  [/claude-opus-4-6/, 'Claude Opus 4.6'],
  [/claude-sonnet-4-6/, 'Claude Sonnet 4.6'],
  [/gemini-3\.1-flash-lite|gemini-3-1-flash-lite/, 'Gemini 3.1 Flash-Lite'],
  [/gemini-3\.7-flash|gemini-3-7-flash/, 'Gemini 3.7 Flash'],
  [/gpt-5\.6-luna|gpt-5-6-luna/, 'GPT-5.6 Luna'],
  [/gpt-5\.6-terra|gpt-5-6-terra/, 'GPT-5.6 Terra'],
  [/deepseek-v4-flash/, 'DeepSeek V4 Flash'],
  [/qwen3\.8-27b|qwen-3-8-27b/, 'Qwen3.8 27B'],
  [/qwen3\.6-27b|qwen-3-6-27b/, 'Qwen3.6 27B'],
  [/gemma-4-31b-it/, 'Gemma 4 31B'],
  [/^controlled$/, 'Scripted peer'],
];

export function modelName(route) {
  if (!route) return 'Unknown';
  for (const [pattern, name] of MODEL_NAMES) if (pattern.test(route)) return name;
  return route.split('/').pop();
}

/** The family a model belongs to, used to group the filter rail. */
export function modelFamily(route) {
  const name = modelName(route);
  return name.split(' ')[0];
}

export function settingLabel(setting) {
  if (SETTINGS[setting]) return SETTINGS[setting];
  if (setting && setting.includes('--')) {
    const [messages, verdict, feedback, extra] = setting.split('--');
    /* The label already says Controlled Peer, so each part drops the word. */
    const parts = [
      messages === 'summary' ? 'summary' : 'raw-log chunks',
      `always ${verdict}s`,
      { 'full-feedback': 'full feedback', 'no-reward': 'no reward', 'no-verdict-review': 'no verdict review' }[feedback] || feedback,
    ];
    if (extra === 'observed-verdict') parts.push('verdict shown');
    return parts.join(' · ');
  }
  return modelName(setting) !== setting ? modelName(setting) : setting;
}

/** The full name of a condition, as the trajectory header and search use it:
    the same two halves the browse list stacks, joined. */
export function conditionTitle(condition) {
  const label = conditionLabel(condition);
  return label ? `${conditionModel(condition)} — ${label}` : conditionModel(condition);
}

/* What each ablation is called in the paper's figures, so a condition is
   named the same way here as in the plots it appears in. */
const PAPER_SETTING = {
  feedback: { 'no-reward': 'No Reward', 'no-verdict-review': 'No Verdict Review' },
  memory_length: { 0: 'No Memory', 3: 'Last 3 Episodes' },
  memory_scope: { 'communication-onward': 'Communication Onward', 'feedback-and-reflection': 'Feedback and Reflection' },
  reward_scope: { separate: 'Separate' },
  reward_type: { acceptance: 'Acceptance' },
  warmup: { unconstrained: 'Unconstrained Communication', 'summary-allowed': 'Summary Allowed' },
  communication: { unconstrained: 'Unconstrained Channel' },
};

/** The model, or the pair, a condition runs -- without what it varies. */
export function conditionModel(condition) {
  if (condition.experiment === 'cross_model') {
    return `${modelName(condition.alice_model)} × ${modelName(condition.bob_model)}`;
  }
  return modelName(condition.alice_model);
}

/** What an ablation changes, named as the paper names it, or null: `main` is
    the only default, and a cross-model run varies the pairing, which the
    model line already says. */
export function conditionSetting(condition) {
  if (condition.experiment === 'main' || condition.experiment === 'cross_model') return null;
  return PAPER_SETTING[condition.experiment]?.[condition.setting] || settingLabel(condition.setting);
}

/** The same, with the family in front, for places that show no family of
    their own -- the trajectory header and the search haystack. */
export function conditionLabel(condition) {
  const setting = conditionSetting(condition);
  if (!setting) return null;
  return `${EXPERIMENTS[condition.experiment]?.label || condition.experiment}: ${setting}`;
}

export function conditionGroup(condition) {
  return EXPERIMENTS[condition.experiment]?.label || condition.experiment;
}
