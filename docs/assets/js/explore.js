/* Browse the release in two steps: choose a condition, then a run inside it.
   A condition is what was varied; its fifty runs differ only in the task
   sequence they were given, so they belong on a page of their own. */

import { h, clear, icon, nf, stagger, reveal } from './dom.js';
import { emptyFilters, filterRuns, SORTS, prefetchTrajectory, convergedKey } from './store.js';
import { ribbon, ribbonLegend } from './ribbon.js';
import { EXPERIMENTS, PATHWAY_LABEL } from './config.js';

/* ------------------------------------------------- 1. choose a condition */

export function renderExplore(host, data, route) {
  clear(host);
  const state = { filters: routeToFilters(route.query) };

  host.append(h('header', { class: 'wrap explore-intro' },
    h('h1', { text: 'Explore trajectories' }),
    h('p', { text: 'Choose a condition. Each has 50 runs on the same 50 task sequences.' })));

  const shell = h('div', { class: 'wrap explore view-swap' });
  const narrow = window.matchMedia('(max-width: 1040px)').matches;
  const rail = h('aside', { class: `filters${narrow ? ' is-collapsed' : ''}` });
  const main = h('div', { class: 'results' });
  shell.append(rail, main);
  host.append(shell);

  const apply = () => {
    drawRail(rail, data, state, apply, ['experiment', 'model']);
    drawConditions(main, data, state);
    writeHash('#/explore', state, [['exp', 'experiments'], ['model', 'models']]);
  };
  apply();
}

function drawConditions(host, data, state) {
  clear(host);
  const runsBy = runsByCondition(data.runs);
  const conditions = data.conditions
    .filter((condition) => matches(condition, runsBy.get(condition.id) || [], state.filters))
    .sort((a, b) => a.order - b.order);

  if (!conditions.length) {
    host.append(h('div', { class: 'empty' }, h('h3', { class: 'serif', text: 'No matches' })));
    return;
  }

  const grid = h('div', { class: 'cond-grid' });
  conditions.forEach((condition) => grid.append(conditionCard(condition, runsBy.get(condition.id) || [])));
  host.append(stagger(grid, 18, 24));
  reveal(host);
}

function conditionCard(condition, runs) {
  const onsets = runs.filter((run) => run.onset != null).length;
  const converged = runs.filter((run) => run.converged === true).length;
  return h('a', { class: 'cond-card', href: `#/c/${condition.id}` },
    h('div', { class: 'cond-head' },
      h('span', { class: 'cond-name', text: condition.model }),
      familyTag(condition)),
    condition.settingText ? h('div', { class: 'cond-setting', text: condition.settingText }) : null,
    /* Both counts are always written out: none is a result too. */
    h('div', { class: 'cond-foot' },
      h('span', { class: 'chip tiny', text: `${onsets} with onset` }),
      h('span', { class: 'chip tiny chip--flag', text: `${converged} converged` }),
      h('span', { class: 'run-go' }, icon('arrow'))),
  );
}

/** The experiment family, as a tag with a colour of its own. */
function familyTag(condition) {
  return h('span', { class: 'cond-family', dataset: { exp: condition.experiment }, text: condition.group });
}

/* ------------------------------------------------------ 2. choose a run */

export function renderCondition(host, data, condition, route) {
  clear(host);
  const state = {
    filters: routeToFilters(route.query),
    sort: route.query.get('sort') || 'condition',
  };
  const all = (runsByCondition(data.runs).get(condition.id) || []);

  host.append(h('header', { class: 'wrap explore-intro' },
    h('div', { class: 'crumbs' },
      h('a', { class: 'back-link', href: '#/explore', title: 'Back to all conditions', 'aria-label': 'Back to all conditions' },
        icon('arrow'))),
    h('h1', null, condition.model, familyTag(condition)),
    condition.settingText ? h('p', { text: condition.settingText }) : null));

  const shell = h('div', { class: 'wrap explore view-swap' });
  const narrow = window.matchMedia('(max-width: 1040px)').matches;
  const rail = h('aside', { class: `filters${narrow ? ' is-collapsed' : ''}` });
  const main = h('div', { class: 'results' });
  shell.append(rail, main);
  host.append(shell);

  const apply = () => {
    drawRail(rail, data, state, apply, ['onset', 'converged'], all);
    drawRuns(main, filterRuns(all, state.filters).sort(SORTS[state.sort].fn), state, apply);
    writeHash(`#/c/${condition.id}`, state, [['path', 'pathways'], ['conv', 'converged']]);
  };
  host.addEventListener('view:teardown', () => legendSize?.disconnect(), { once: true });
  apply();
}

function drawRuns(host, runs, state, apply) {
  legendSize?.disconnect();
  legendSize = null;
  clear(host);

  const sort = h('select', { class: 'select', 'aria-label': 'Sort runs' },
    Object.entries(SORTS).map(([key, { label }]) => h('option', { value: key, selected: key === state.sort, text: label })));
  sort.addEventListener('change', () => { state.sort = sort.value; apply(); });

  host.append(h('div', { class: 'results-head' },
    ribbonLegend(),
    h('div', { class: 'results-tools' }, sort),
  ));

  if (!runs.length) {
    host.append(h('div', { class: 'empty' }, h('h3', { class: 'serif', text: 'No matches' })));
    return;
  }

  const grid = h('div', { class: 'run-grid' });
  runs.forEach((run) => grid.append(runRow(run)));
  host.append(stagger(grid, 16, 24));
  reveal(host);
  fitLegend(host);
}

/* The key is drawn with the same cells as the strips, and sized from the first one. */
let legendSize = null;

function fitLegend(host) {
  legendSize?.disconnect();
  legendSize = null;
  const strip = host.querySelector('.run-card .ribbon');
  const marks = [...host.querySelectorAll('.ribbon-legend .ribbon-cell')];
  if (!strip || !marks.length) return;
  const apply = () => {
    const cell = strip.querySelector('.ribbon-cell');
    if (!cell) return;
    const { width, height } = cell.getBoundingClientRect();
    const half = parseFloat(getComputedStyle(cell, '::before').height);
    /* Whole pixels: a cell is 33.3 wide, and on a fractional box each edge
       of the frame rounds its own way and comes out a different weight. */
    marks.forEach((mark) => {
      mark.style.width = `${Math.round(width)}px`;
      mark.style.height = `${Math.round(mark.classList.contains('is-swatch') ? half : height)}px`;
    });
  };
  legendSize = new ResizeObserver(apply);
  legendSize.observe(strip);
  apply();
}

function runRow(run) {
  /* The row is not one link: a cell opens that episode, and the name opens
     the run on its onset, which is where a click with no episode lands. */
  const open = `#/t/${run.id}`;
  const row = h('div', {
    class: 'run-card run-row',
    onmouseenter: () => prefetchTrajectory(run),
  });
  row.append(h('a', {
    class: 'run-card-top', href: open,
    onfocus: () => prefetchTrajectory(run),
  },
    h('div', { class: 'run-seq', text: `sequence ${run.sequence}` }),
    h('span', { class: 'run-go' }, icon('arrow'))));
  row.append(ribbon(run, {
    numbers: true,
    href: (episode) => `${open}/${episode.index + 1}`,
  }));
  const chips = outcomeChips(run);
  if (chips.length) row.append(h('a', { class: 'run-foot', href: open }, chips));
  return row;
}

function outcomeChips(run) {
  const chips = [];
  if (run.pathway) chips.push(h('span', { class: 'chip tiny', text: PATHWAY_LABEL[run.pathway] || run.pathway }));
  /* "No onset" already implies it never converged. */
  if (run.pathway === 'No onset') return chips;
  if (run.converged === true) {
    chips.push(h('span', { class: 'chip chip--flag tiny', text: 'Converged' }));
  } else if (run.converged === false) {
    chips.push(h('span', { class: 'chip tiny', text: 'Not Converged' }));
  }
  return chips;
}

/* -------------------------------------------------------------- filters */

function routeToFilters(query) {
  const filters = emptyFilters();
  for (const [key, field] of [['exp', 'experiments'], ['model', 'models'], ['path', 'pathways'], ['conv', 'converged']]) {
    const raw = query.get(key);
    if (raw) raw.split('|').filter(Boolean).forEach((value) => filters[field].add(value));
  }
  return filters;
}

function writeHash(base, state, pairs) {
  const query = new URLSearchParams();
  for (const [key, field] of pairs) {
    const value = state.filters[field];
    if (value.size) query.set(key, Array.from(value).join('|'));
  }
  if (state.sort && state.sort !== 'condition') query.set('sort', state.sort);
  const next = `${base}${query.toString() ? `?${query}` : ''}`;
  if (location.hash !== next) history.replaceState(null, '', next);
}

/** A run-level filter matches a condition if any of its runs do, so
    narrowing never hides a condition that has them. */
function matches(condition, runs, filters) {
  if (filters.experiments.size && !filters.experiments.has(condition.experiment)) return false;
  if (filters.models.size && !filters.models.has(condition.aliceName) && !filters.models.has(condition.bobName)) return false;
  if (filters.pathways.size && !runs.some((run) => filters.pathways.has(run.pathway ?? 'n/a'))) return false;
  if (filters.converged.size && !runs.some((run) => filters.converged.has(convergedKey(run)))) return false;
  return true;
}

function runsByCondition(runs) {
  const map = new Map();
  for (const run of runs) {
    const list = map.get(run.condition.id);
    if (list) list.push(run); else map.set(run.condition.id, [run]);
  }
  return map;
}

/* ------------------------------------------------------------- the rail */

function drawRail(host, data, state, apply, groups, runs = data.runs) {
  const scroll = host.scrollTop;
  const collapsed = host.classList.contains('is-collapsed');
  clear(host);

  /* On a narrow screen the rail sits above the results, so it starts folded. */
  const active = countActive(state.filters, groups);
  host.classList.toggle('is-collapsed', collapsed);
  host.append(h('button', {
    class: 'filters-toggle', type: 'button', 'aria-expanded': String(!collapsed),
    onclick: () => { host.classList.toggle('is-collapsed'); drawRail(host, data, state, apply, groups, runs); },
  }, icon('caret', 'caret'), h('span', { text: active ? `Filters · ${active} active` : 'Filters' })));

  const body = h('div', { class: 'filters-body' });
  host.append(body);

  if (groups.includes('experiment')) {
    const counts = countConditions(data.conditions);
    body.append(group('Experiment', Object.keys(EXPERIMENTS)
      .filter((key) => counts.experiments[key])
      .map((key) => option(key, EXPERIMENTS[key].label, counts.experiments[key], state.filters.experiments, apply))));

    const models = Array.from(new Set(data.conditions.flatMap((c) => [c.aliceName, c.bobName]))).sort();
    body.append(group('Model', models.map((name) =>
      option(name, name, counts.models[name] || 0, state.filters.models, apply))));
  }

  if (groups.includes('onset')) {
    const counts = countRuns(runs);
    body.append(group('Onset', ['EX', 'RR', 'SR', 'Other', 'No onset']
      .filter((key) => counts.pathways[key])
      .map((key) => option(key, PATHWAY_LABEL[key], counts.pathways[key], state.filters.pathways, apply))));

    body.append(group('Converged', [
      option('yes', 'Converged', counts.converged.yes || 0, state.filters.converged, apply),
      option('no', 'Not Converged', counts.converged.no || 0, state.filters.converged, apply),
    ]));
  }

  host.scrollTop = scroll;
}

function countActive(filters, groups) {
  let n = 0;
  if (groups.includes('experiment')) n += filters.experiments.size + filters.models.size;
  if (groups.includes('onset')) n += filters.pathways.size + filters.converged.size;
  return n;
}

function countConditions(conditions) {
  const experiments = {}, models = {};
  for (const condition of conditions) {
    experiments[condition.experiment] = (experiments[condition.experiment] || 0) + 1;
    for (const name of new Set([condition.aliceName, condition.bobName])) {
      models[name] = (models[name] || 0) + 1;
    }
  }
  return { experiments, models };
}

function countRuns(runs) {
  const pathways = {}, converged = {};
  for (const run of runs) {
    const key = run.pathway ?? 'n/a';
    pathways[key] = (pathways[key] || 0) + 1;
    const state = convergedKey(run);
    converged[state] = (converged[state] || 0) + 1;
  }
  return { pathways, converged };
}

function group(title, options) {
  return h('section', { class: 'fgroup' }, h('h4', { text: title }), options);
}

function option(value, label, count, set, apply) {
  const on = set.has(value);
  const input = h('input', { type: 'checkbox', checked: on });
  input.addEventListener('change', () => {
    if (input.checked) set.add(value); else set.delete(value);
    apply();
  });
  return h('label', { class: `fopt${on ? ' is-on' : ''}` },
    input, h('span', { text: label }),
    count != null ? h('span', { class: 'count', text: nf.format(count) }) : null);
}
