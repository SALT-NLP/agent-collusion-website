/* One trajectory: ten episodes of task work, conversation, verdicts and
   private reflection, for a fixed pair of agents. */

import { h, frag, clear, icon, qs, qsa, nf, plural, reveal, reducedMotion, stagger } from './dom.js';
import { loadTrajectory, bundleUrl } from './store.js';
import { prose, code, disclosure, toolStep, markdown, highlightQuotes } from './format.js';
import { modelName, PATHWAY_LABEL, TASK_LABEL, HF_DATASET_URL } from './config.js';

const PHASES = [
  { id: 'task', label: 'Task' },
  { id: 'communication', label: 'Communication' },
  { id: 'verdict', label: 'Verdict' },
  { id: 'reflection', label: 'Feedback & Reflection' },
];

const NAMES = { alice: 'Alice', bob: 'Bob' };

export async function renderTrajectory(host, route) {
  const { run } = route;
  clear(host);
  /* No entry animation on the shell: the back arrow and the title sit
     exactly where the condition page left them, and re-playing them made
     the header flash on a step that visually changes nothing there. */
  const shell = h('div', { class: 'wrap traj' });
  host.append(shell);

  /* Back goes up one level -- to the other forty-nine runs of this same
     condition -- rather than all the way out to Explore. */
  shell.append(h('div', { class: 'crumbs' },
    h('a', {
      class: 'back-link', href: `#/c/${run.condition.id}`,
      title: `Back to ${run.condition.model}`, 'aria-label': 'Back to this condition',
    }, icon('arrow')),
    h('span', { class: 'mono', text: `sequence ${run.sequence}` })));

  const loading = h('div', { class: 'loading' },
    h('div', { class: 'spinner' }, h('i'), h('i')),
    h('p', { text: 'Loading…' }),
    h('div', { class: 'progress-line' }, h('i')),
  );
  shell.append(loading);

  let bundle;
  try {
    bundle = await loadTrajectory(run);
  } catch (error) {
    loading.replaceWith(bundleError(run, error));
    return;
  }
  loading.remove();

  const state = {
    run,
    bundle,
    episode: clampEpisode(route.episode ?? firstInterestingEpisode(run), bundle),
    phase: route.phase || 'task',
    channel: channelProfile(bundle),
  };

  shell.append(header(state));
  const rail = h('section', { class: 'rail-wrap' });
  shell.append(rail);
  const nav = phaseNav(state);
  shell.append(nav);
  const body = h('div', { id: 'phase-body', class: 'view-swap' });
  shell.append(body);

  const channelLine = qs('.traj-channel', shell);
  const paint = () => {
    /* A warm-up episode runs under different rules from the ten that follow,
       so this line belongs to the episode on screen, not to the run. */
    channelLine.textContent = channelFacts(state);
    channelLine.hidden = !channelLine.textContent;
    drawRail(rail, state, (index) => { state.episode = index; paint(); syncHash(state); });
    drawPhases(body, state);
    wireScrollSpy(nav, body);
    reveal(shell);
  };
  paint();

  const onKey = (event) => {
    if (event.target.matches('input, textarea, select')) return;
    if (event.key === 'ArrowRight' || event.key === 'j') step(1);
    else if (event.key === 'ArrowLeft' || event.key === 'k') step(-1);
    else return;
    event.preventDefault();
  };
  const step = (delta) => {
    const next = clampEpisode(state.episode + delta, bundle);
    if (next === state.episode) return;
    state.episode = next;
    paint();
    syncHash(state);
  };
  document.addEventListener('keydown', onKey);
  host.addEventListener('view:teardown', () => document.removeEventListener('keydown', onKey), { once: true });
}

const clampEpisode = (index, bundle) => Math.max(0, Math.min(bundle.episodes.length - 1, index || 0));

/** Open on the episode where the pair first agreed, if there was one. */
function firstInterestingEpisode(run) {
  if (run.onset != null) return run.warmup + run.onset - 1;
  const flagged = run.episodes.findIndex((e) => e.agreement || e.aliceRelax || e.bobRelax);
  return flagged >= 0 ? flagged : 0;
}

function syncHash(state) {
  const next = `#/t/${state.run.id}/${state.episode + 1}`;
  if (location.hash !== next) history.replaceState(null, '', next);
}

function bundleError(run, error) {
  return h('div', { class: 'errorbox' },
    h('h3', { text: 'Could not load this trajectory' }),
    h('p', { text: error.message }),
    h('p', null, h('code', { text: bundleUrl(run) })),
    h('p', null, h('a', { class: 'btn', href: HF_DATASET_URL, target: '_blank', rel: 'noopener' }, 'Open the dataset', icon('link'))),
  );
}

/* ------------------------------------------------------------------ head */

function header(state) {
  const { run, bundle } = state;
  const condition = run.condition;
  const settings = bundle.settings || {};
  const scripted = Boolean(settings.controlled_bob_messages);

  /* On a shared model the title already names them, and every message is
     signed, so "Alice Bob" under the title says nothing. A cross-model pair
     still needs the line, because the title does not say who is who. */
  return h('header', null,
    h('h1', null, condition.title, ...trajectoryTags(run)),
    headerAgents(bundle, scripted, condition.model),
    h('p', { class: 'traj-channel', text: channelFacts(state) }),
  );
}

function headerAgents(bundle, scripted, titleModel) {
  const lines = ['alice', 'bob'].map((agent) => ({
    agent,
    detail: agentDetail(agent, bundle, scripted, titleModel),
  }));
  if (lines.every((line) => !line.detail)) return null;
  return h('div', { class: 'traj-agents' }, lines.map(({ agent, detail }) =>
    h('span', { class: `agent-line agent-line--${agent}` },
      h('b', { text: NAMES[agent] }), detail)));
}

function trajectoryTags(run) {
  const tags = [];
  if (run.pathway && run.pathway !== 'No onset') {
    tags.push(h('span', { class: 'traj-tag', text: PATHWAY_LABEL[run.pathway] || run.pathway }));
  }
  if (run.converged === true) tags.push(h('span', { class: 'traj-tag is-on', text: 'Converged' }));
  else if (run.converged === false) tags.push(h('span', { class: 'traj-tag', text: 'Not Converged' }));
  return tags;
}

function agentIdentity(agent) {
  return h('span', { class: `agent-line agent-line--${agent}` },
    h('b', { text: NAMES[agent] }));
}

/* The title already names a shared model. A cross-model pair still needs
   each side labelled, because the title does not say who is Alice. */
function agentDetail(agent, bundle, scripted, titleModel) {
  if (agent === 'bob' && scripted) return h('span', { class: 'dim', text: 'scripted peer' });
  const models = bundle.models || {};
  const efforts = bundle.reasoning_efforts || {};
  const mine = modelName(models[agent]);
  const theirs = modelName(models[agent === 'alice' ? 'bob' : 'alice']);
  const effort = efforts[agent];
  const namedByTitle = mine === theirs || mine === titleModel;
  if (namedByTitle) {
    if (efforts.alice === efforts.bob) return null;
    return effort ? h('span', { class: 'dim', text: `${effort} effort` }) : null;
  }
  return h('span', { class: 'dim', text: `${mine}${effort ? ` · ${effort} effort` : ''}` });
}

/** Limit and verdict policy, when every evaluation episode shares them. A
    warm-up episode may run under different ones -- that is what the warm-up
    varies -- and the per-episode Channel card still reports its own. */
function channelProfile(bundle) {
  const settings = bundle.settings || {};
  const episodes = (bundle.episodes || []).filter((episode) => !episode.is_warmup);
  const limits = episodes.map((episode) => episodeLimit(episode, settings));
  const policies = episodes.map((episode) => episode.verdict_policy || null);
  const uniform = (values) => values.every((value) => value === values[0]);
  return {
    limit: uniform(limits) ? limits[0] ?? null : undefined,
    policy: uniform(policies) ? policies[0] : undefined,
  };
}

/** What the protocol asks of the episode on screen. A warm-up episode drops
    whichever of the two its condition suspended -- the unconstrained warm-up
    its character limit, the summary-allowed one its raw-log requirement --
    and the ten evaluation episodes carry both. */
function channelFacts(state) {
  const { channel, bundle } = state;
  const episode = bundle.episodes[state.episode] || {};
  const parts = [];
  if (channel.limit && episodeLimit(episode, bundle.settings || {}) === channel.limit) {
    parts.push(`${nf.format(channel.limit)} character limit`);
  }
  if (channel.policy && episode.verdict_policy === channel.policy) {
    parts.push(`${channel.policy} verdict policy`);
  }
  return parts.join(' · ');
}

/** The channel limit only binds in episodes whose throttle policy is on. */
function episodeLimit(episode, settings) {
  if (episode.throttle_policy === 'no-throttle') return null;
  return settings.char_limit ?? null;
}

/* ------------------------------------------------------------ the rail */

function drawRail(host, state, onPick) {
  clear(host);
  const { bundle, run } = state;
  const rail = h('div', { class: 'rail' });
  bundle.episodes.forEach((episode, index) => {
    const label = episode.is_warmup ? 'warm-up' : `Episode ${episode.evaluation_episode ?? index + 1}`;
    const onset = run.onset != null && episode.evaluation_episode === run.onset;
    const button = h('button', {
      class: `ep-btn${index === state.episode ? ' is-active' : ''}${episode.is_warmup ? ' is-warmup' : ''}${onset ? ' is-onset' : ''}`,
      type: 'button',
      'aria-current': index === state.episode ? 'true' : null,
      title: [
        `${label} · ${TASK_LABEL[episode.task_type] || episode.task_type}`,
        onset ? `Onset${run.pathway ? ` · ${PATHWAY_LABEL[run.pathway] || run.pathway}` : ''}` : null,
      ].filter(Boolean).join('\n'),
      onclick: () => onPick(index),
    },
      h('span', { class: 'ep-n', text: label }),
      h('span', { class: 'ep-verdicts' },
        verdictTag('alice', episode.alice?.verdict),
        verdictTag('bob', episode.bob?.verdict),
      ),
    );
    rail.append(button);
  });
  host.append(rail);
  /* Centre the active episode inside the rail without moving the page. */
  const active = rail.children[state.episode];
  if (active) {
    requestAnimationFrame(() => {
      const target = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
      rail.scrollTo({ left: Math.max(0, target), behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
  }
}


/* Alice's verdict then Bob's, written out: two unlabelled dots said neither
   which agent nor which way, and the rail has room for the word. */
function verdictTag(agent, verdict) {
  return h('span', {
    class: `ep-v ep-v--${verdict || 'none'}`,
    title: `${NAMES[agent]} ${verdict || '—'}`,
    text: verdict === 'accept' ? 'ACC' : verdict === 'reject' ? 'REJ' : '—',
  });
}

/* -------------------------------------------------------------- phase nav */

function phaseNav(state) {
  const nav = h('nav', { class: 'phase-nav', 'aria-label': 'Episode phases' });
  const seg = h('div', { class: 'seg' });
  const indicator = h('div', { class: 'seg-ind' });
  seg.append(indicator);
  PHASES.forEach((phase) => {
    seg.append(h('button', {
      type: 'button', dataset: { phase: phase.id },
      onclick: () => {
        const section = qs(`#phase-${phase.id}`);
        /* Jumping to a phase opens it; landing on a closed title says little. */
        const fold = section?.querySelector('.phase-fold');
        if (fold) fold.open = true;
        section?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      },
    }, h('i', { class: 'seg-i' }), phase.label));
  });
  nav.append(seg);
  return nav;
}

function wireScrollSpy(nav, body) {
  const buttons = qsa('.seg button', nav);
  const indicator = qs('.seg-ind', nav);
  const place = (button) => {
    indicator.style.width = `${button.offsetWidth}px`;
    indicator.style.transform = `translateX(${button.offsetLeft}px)`;
  };
  const setActive = (id) => {
    buttons.forEach((button) => {
      const on = button.dataset.phase === id;
      button.classList.toggle('is-active', on);
      if (on) place(button);
    });
  };
  setActive(PHASES[0].id);
  requestAnimationFrame(() => setActive(qs('.seg button.is-active', nav)?.dataset.phase || PHASES[0].id));

  if (nav._spy) nav._spy.disconnect();
  nav._spy = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible[0]) setActive(visible[0].target.dataset.phase);
  }, { rootMargin: '-120px 0px -62% 0px' });
  qsa('.phase', body).forEach((section) => nav._spy.observe(section));
}

/* ---------------------------------------------------------- phase bodies */

function drawPhases(host, state) {
  clear(host);
  const episode = state.bundle.episodes[state.episode];
  const wrap = h('div', { class: 'ep-swap' });
  wrap.append(
    phaseSection(PHASES[0], taskPhase(episode, state)),
    phaseSection(PHASES[1], communicationPhase(episode, state)),
    phaseSection(PHASES[2], verdictPhase(episode, state)),
    phaseSection(PHASES[3], reflectionPhase(episode, state)),
  );
  host.append(wrap);
}

/* What the pair said to each other, and what each wrote privately after, are
   what the page is for; the task work and the verdicts are the evidence
   behind them, so those two open on demand. */
const OPEN_PHASES = new Set(['communication', 'verdict', 'reflection']);

function phaseSection(phase, content) {
  const fold = h('details', { class: 'phase-fold', open: OPEN_PHASES.has(phase.id) },
    h('summary', { class: 'phase-title' },
      h('h2', { text: phase.label }),
      icon('caret', 'caret')),
  );
  fold.append(content);
  return h('section', { class: 'phase', id: `phase-${phase.id}`, dataset: { phase: phase.id } }, fold);
}

/* --- 1. task ------------------------------------------------------------ */

function taskPhase(episode, state) {
  return h('div', { class: 'duo' },
    agentTaskPanel('alice', episode, state),
    agentTaskPanel('bob', episode, state),
  );
}

function agentTaskPanel(agent, episode, state) {
  const record = episode[agent] || {};
  const scripted = agent === 'bob' && Boolean(state.bundle.settings?.controlled_bob_messages);
  const panel = h('section', { class: `agent-panel agent-panel--${agent}` });

  panel.append(h('header', { class: 'agent-head' },
    agentIdentity(agent),
    h('span', { class: 'spacer' }),
    record.task_correct === true ? badge('pass', 'Correct') : record.task_correct === false ? badge('fail', 'Incorrect') : null,
  ));

  const body = h('div', { class: 'agent-body' });
  body.append(h('div', { class: 'taskbar' },
    h('span', { class: 'tid', text: record.display_id ? `Task ${record.display_id}` : record.task_id || '' }),
    h('span', { text: '·' }),
    h('span', { text: TASK_LABEL[episode.task_type] || episode.task_type }),
  ));
  if (record.task_prompt) {
    body.append(disclosure('Task prompt', () => prose(stripHeader(record.task_prompt))));
  }

  /* The trajectory shows what each agent did and said, not what it thought,
     so a thinking turn is not part of the stream. */
  const steps = (record.steps || []).filter((step) => step.kind !== 'thinking');
  if (!steps.length) {
    body.append(h('p', { class: 'no-data', text: scripted ? 'Scripted peer — replayed from cache' : 'No tool activity recorded' }));
  } else {
    const stream = h('div', { class: 'stream' });
    const finalSave = steps.findLastIndex((step) => step.name === 'save_final_answer');
    steps.forEach((step, index) => {
      const node = streamStep(step, state.bundle.blobs);
      if (index === finalSave && record.answer) {
        const card = node.querySelector('.toolcard');
        card?.append(answerContent(record, episode.task_type));
      }
      stream.append(node);
    });
    body.append(stagger(stream, 38));
  }

  if (record.answer && !steps.some((step) => step.name === 'save_final_answer')) {
    const fallback = h('div', { class: 'toolcard' },
      h('div', { class: 'toolcard-head' }, h('span', { class: 'toolcard-name', text: 'Final answer' })),
      answerContent(record, episode.task_type));
    body.append(h('div', { class: 'step' }, h('span', { class: 'step-icon' }, icon('save')), fallback));
  }
  panel.append(body);
  return panel;
}

const stripHeader = (text) => text.replace(/^## Episode \d+: task phase\s*\n+/, '');

function streamStep(step, blobs) {
  if (step.kind === 'say') {
    return h('div', { class: 'step step--say' },
      h('span', { class: 'step-icon' }, icon('speech')),
      prose(step.text, { className: 'say' }));
  }
  return h('div', { class: 'step step--tool' },
    h('span', { class: 'step-icon' }, icon(toolIcon(step.name))),
    toolStep(step, blobs));
}

const toolIcon = (name) => ({
  inspect_database: 'db', query_database: 'db', read_code: 'code', read_source: 'book',
  write_test_file: 'doc', run_tests: 'spark', save_final_answer: 'save',
  resolve_records: 'layers', get_log: 'clock',
}[name] || 'tool');

function badge(kind, text) {
  return h('span', { class: `badge badge--${kind}` }, icon(kind === 'pass' ? 'check' : 'cross'), text);
}

function answerContent(record, taskType) {
  const body = h('div', { class: 'toolcard-body answer-body' });
  body.append(renderAnswer(record.answer, taskType));
  if (record.answer_reasoning) {
    body.append(disclosure('Reasoning', () => prose(record.answer_reasoning)));
  }
  return body;
}

function renderAnswer(answer, taskType) {
  /* The token the agent saved, shown as saved: restating `bug` as "bug found"
     and colouring it like a verdict said more than the answer does, and only
     the literal `ok` ever came out green, so `no_bug` read as a failure. */
  if (taskType === 'code_analysis') {
    return h('div', { class: 'kvlist' }, h('span', { class: 'kv' }, h('span', { text: String(answer).trim() })));
  }
  let parsed = null;
  try { parsed = JSON.parse(answer); } catch { parsed = null; }

  if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === 'string') {
    return frag(
      h('div', { class: 'kvlist' }, parsed.slice(0, 40).map((id) => h('span', { class: 'kv' }, h('span', { text: id })))),
      parsed.length > 40 ? h('p', { class: 'table-note', text: `+${parsed.length - 40} more` }) : null,
      h('p', { class: 'table-note', text: plural(parsed.length, 'record') }),
    );
  }
  if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === 'object') {
    const columns = Array.from(new Set(parsed.flatMap((row) => Object.keys(row))));
    /* A one-column answer is a list of identifiers; chips read better than a table. */
    if (columns.length === 1) {
      const ids = parsed.map((row) => String(row[columns[0]]));
      return frag(
        h('div', { class: 'kvlist' }, ids.slice(0, 48).map((id) => h('span', { class: 'kv' }, h('span', { text: id })))),
        ids.length > 48 ? h('p', { class: 'table-note', text: `+${ids.length - 48} more` }) : null,
        h('p', { class: 'table-note', text: plural(ids.length, columns[0].replace(/_/g, ' ')) }),
      );
    }
    return frag(
      h('div', { class: 'datatable' }, h('table', null,
        h('thead', null, h('tr', null, columns.map((c) => h('th', { text: c })))),
        h('tbody', null, parsed.slice(0, 60).map((row) => h('tr', null, columns.map((c) => h('td', { text: row[c] == null ? '—' : String(row[c]) }))))),
      )),
      h('p', { class: 'table-note', text: `${plural(parsed.length, 'row')}${parsed.length > 60 ? ', 60 shown' : ''}` }),
    );
  }
  return prose(String(answer), { className: 'prose-block' });
}

/* --- 2. communication --------------------------------------------------- */

function communicationPhase(episode, state) {
  const settings = state.bundle.settings || {};
  const limit = episodeLimit(episode, settings);
  const chat = h('div', { class: 'chat', id: 'chat' });
  const quotes = episode.agreement?.quotes || [];

  if (!episode.chat?.length) {
    chat.append(h('p', { class: 'no-data', text: 'No messages delivered' }));
  } else {
    let round = -1;
    episode.chat.forEach((message) => {
      if (message.round !== round) {
        round = message.round;
        chat.append(h('div', { class: 'round-rule', text: `Round ${round + 1} of ${settings.max_rounds ?? episode.max_rounds ?? 5}` }));
      }
      chat.append(bubble(message, limit, quotes, episode));
    });
  }

  playOnFirstView(chat);
  const side = h('aside', { class: 'chat-side' }, judgeSignal('Agreement Signal', episode.agreement), commFacts(episode, state));
  return h('div', { class: 'chat-shell' }, chat, side);
}

/** The thread arrives as the reader reaches it: each round marker, then the
    messages it opens, one at a time. Rows further down wait until they are
    scrolled to. */
function playOnFirstView(chat) {
  if (reducedMotion() || !('IntersectionObserver' in window)) return;
  const queue = qsa('.bubble-row, .round-rule', chat);
  if (!queue.length) return;

  /* Hidden from the start so the reveal does not flash; the rows are below
     the fold when the page is built. */
  chat.classList.add('is-replaying');

  let shown = 0;
  let reached = -1;
  let running = false;

  const step = () => {
    /* A reader who jumped into the middle should not wait out a replay of the
       part they skipped, so anything well behind them is simply there. */
    while (reached - shown > 2) { queue[shown].classList.add('played'); shown += 1; }
    if (shown > reached) {
      running = false;
      if (shown >= queue.length) chat.classList.remove('is-replaying');
      return;
    }
    const row = queue[shown];
    row.classList.add('played');
    shown += 1;
    setTimeout(step, Math.min(900, 240 + row.textContent.length * 1.4));
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reached = Math.max(reached, queue.indexOf(entry.target));
      observer.unobserve(entry.target);
    }
    if (!running) { running = true; step(); }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });

  queue.forEach((row) => observer.observe(row));
}

function bubble(message, limit, quotes, episode) {
  const agent = message.sender === 'alice' ? 'alice' : 'bob';
  const text = message.content ?? '';
  /* The text sits in its own box so a long message can be clipped without
     also clipping the bubble's tail, which hangs outside the bubble. */
  const body = h('div', { class: 'bubble' }, h('div', { class: 'bubble-text', text }));
  if (quotes.length) highlightQuotes(body, quotes);
  if (text.length > 1400) body.classList.add('is-long');

  /* Who spoke, what kind of message it was and how much of the budget it
     spent go above the bubble on one centred line; the reasoning behind it
     goes below, where opening it pushes nothing else around. */
  const col = h('div', { class: 'bubble-col' },
    h('div', { class: 'bubble-meta' },
      agentIdentity(agent),
      messageKind(message),
      charMeter(text.length, limit),
    ),
    body);
  if (text.length > 1400) {
    const toggle = h('button', { class: 'clamp-btn', type: 'button', text: 'Show more' });
    toggle.addEventListener('click', () => {
      const long = body.classList.toggle('is-long');
      toggle.textContent = long ? 'Show more' : 'Show less';
    });
    col.append(toggle);
  }

  return h('div', { class: `bubble-row from-${agent}` }, col);
}

/* "round 1/5" only repeats the rule above the messages. A kind such as
   "evidence" or "log part" is the message itself, so that stays. */
const ROUND_TYPE = /^round\s+\d+\s*\/\s*\d+$/i;

function messageKind(message) {
  const type = message.type;
  if (!type || type === 'other' || ROUND_TYPE.test(type)) return null;
  return h('span', { class: 'mtype', text: type });
}

function charMeter(length, limit) {
  if (!limit) return h('span', { class: 'charmeter' }, h('span', { text: `${nf.format(length)} chars` }));
  const share = Math.min(1, length / limit);
  return h('span', { class: `charmeter${share > 0.95 ? ' full' : ''}`, title: `${length} of ${limit} characters` },
    h('span', { class: 'bar' }, h('i', { style: { transform: `scaleX(${share})` } })),
    h('span', { text: `${length}/${limit} chars` }),
  );
}

/** The two judges are reported the same way: the signal, and its evidence. */
/** Both judges report in the same shape: the signal, then what it found.
    Neither repeats the passage it cited -- that is highlighted in place, in
    the message or the reflection it was taken from. */
function judgeSignal(label, judged) {
  if (!judged) {
    return h('div', { class: 'signal' },
      h('span', { class: 'signal-label', text: label }),
      h('span', { class: 'signal-value is-none', text: 'Not judged' }));
  }
  const yes = judged.label === true;
  /* A clear negative used to read as a pass: a check beside "None". */
  const clear = !yes && (judged.status === 'valid' || judged.status == null);
  return h('div', { class: `signal${yes ? ' is-yes' : ''}` },
    h('span', { class: 'signal-label', text: label }),
    h('span', { class: 'signal-value' },
      yes || clear ? icon(yes ? 'flag' : 'cross') : null,
      h('span', { text: yes ? 'Detected' : clear ? 'Not detected' : titleCase(judged.status) })));
}
const titleCase = (text) => String(text).replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** The length the environment reported to the agent, not a recount of ours. */
function rawLogChars(record, state) {
  if (!record) return '—';
  const step = (record.steps || []).find((s) => s.name === 'get_log');
  const view = step?.view || state.bundle.blobs?.[step?.view_ref];
  const chars = view?.chars ?? record.raw_log_chars;
  return chars ? `${nf.format(chars)} chars` : '—';
}

function commFacts(episode, state) {
  const channel = state.channel;
  const rows = [['Messages', String(episode.chat?.length || 0)]];
  /* Shown in the header when the whole run shares them. A warm-up that
     lifts the limit, or switches the verdict policy, still reports it here. */
  if (channel.limit === undefined) {
    const limit = episodeLimit(episode, state.bundle.settings || {});
    rows.push(['Character limit', limit ? String(limit) : 'none']);
  }
  if (channel.policy === undefined) rows.push(['Verdict policy', episode.verdict_policy || '—']);
  rows.push(
    ['Alice’s raw log', rawLogChars(episode.alice, state)],
    ['Bob’s raw log', rawLogChars(episode.bob, state)],
  );
  return h('div', { class: 'judge-note' },
    h('span', { class: 'note-label', text: 'Channel' }),
    h('div', { class: 'comm-meta' }, rows.map(([label, value]) => h('div', { class: 'row' }, h('b', { text: label }), h('span', { text: value })))),
  );
}


/* --- 3. verdict --------------------------------------------------------- */

function verdictPhase(episode, state) {
  const scripted = Boolean(state.bundle.settings?.controlled_bob_messages);
  return h('div', { class: 'verdict-duo' },
    verdictCard('alice', episode, state, false),
    verdictCard('bob', episode, state, scripted),
  );
}

function verdictCard(agent, episode, state, scripted) {
  const record = episode[agent] || {};
  const peer = agent === 'alice' ? 'Bob' : 'Alice';
  const verdict = record.verdict || 'none';
  const card = h('section', { class: `vcard vcard--${verdict === 'accept' ? 'accept' : 'reject'}` });
  card.append(h('header', { class: 'agent-head' }, agentIdentity(agent)));
  card.append(h('div', { class: 'vcard-body' }, h('div', { class: 'vcard-head' },
    h('span', { class: `stamp stamp--${verdict === 'accept' ? 'accept' : 'reject'}`, text: verdict }),
    h('div', null,
      h('div', { class: 'vcard-target' }, `On ${peer}’s task`),
      record.verdict_correct === true ? badge('pass', 'Correct')
        : record.verdict_correct === false ? badge('fail', 'Incorrect') : null,
    ),
  )));
  const content = card.querySelector('.vcard-body');
  if (scripted) {
    content.append(h('p', { class: 'no-data', text: `Scripted: always ${state.bundle.settings.controlled_bob_verdict}` }));
    return card;
  }
  if (record.verdict_reasoning) content.append(disclosure('Reasoning', () => prose(record.verdict_reasoning), { quiet: true }));
  if (record.verdict_forced) content.append(h('p', { class: 'table-note', text: 'Forced verdict' }));
  return card;
}

/* --- 4. feedback and reflection ---------------------------------------- */

function reflectionPhase(episode, state) {
  const scripted = Boolean(state.bundle.settings?.controlled_bob_messages);
  return h('div', { class: 'reflect-duo' },
    reflectionPanel('alice', episode, state, false),
    reflectionPanel('bob', episode, state, scripted),
  );
}

function reflectionPanel(agent, episode, state, scripted) {
  const record = episode[agent] || {};
  const panel = h('section', { class: `agent-panel agent-panel--${agent}` });
  panel.append(h('header', { class: 'agent-head' }, agentIdentity(agent)));
  const body = h('div', { class: 'agent-body' });

  /* The same disclosure the task prompt uses, closed: the feedback is the
     same few lines every episode, and the reflection is what is worth
     reading, so that stands open underneath. */
  if (record.feedback) body.append(disclosure('Feedback', () => markdown(record.feedback)));

  if (scripted) {
    body.append(h('p', { class: 'no-data', text: 'Scripted peer — no reflection' }));
  } else if (!record.reflection) {
    body.append(h('p', { class: 'no-data', text: state.bundle.settings?.reflection === false ? 'Reflection disabled' : 'No reflection recorded' }));
  } else {
    /* A heading for what follows, with its judge's reading boxed off on the
       same line, the way the agreement judge reports beside the channel. */
    const relax = record.relaxation;
    body.append(h('div', { class: 'note-head' },
      h('span', { class: 'note-label', text: 'Reflection' }),
      relax ? judgeSignal('Relaxation Signal', relax) : null));
    body.append(prose(record.reflection, {
      clamp: record.reflection.length > 1500,
      quotes: relax?.quote ? [relax.quote] : null,
    }));
  }
  panel.append(body);
  return panel;
}
