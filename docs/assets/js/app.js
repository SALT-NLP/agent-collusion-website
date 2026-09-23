/* Router and boot. Hash routes keep the site a single static file tree, which
   is all GitHub Pages needs to serve. */

import { h, qs, qsa, clear, icon } from './dom.js';
import { loadIndex } from './store.js';
import { renderHome } from './home.js';
import { renderExplore, renderCondition } from './explore.js';
import { renderTrajectory } from './trajectory.js';

const host = qs('#main');
let data = null;
let current = null;

boot();

async function boot() {
  setUpTheme();
  setUpTopbar();
  showLoading('Loading…');
  try {
    data = await loadIndex();
  } catch (error) {
    clear(host);
    host.append(h('div', { class: 'errorbox' },
      h('h3', { text: 'Could not load the index' }),
      h('p', { text: error.message }),
      h('p', { class: 'dim', text: 'Serve this directory over HTTP; file:// pages cannot fetch modules or data.' })));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}

function showLoading(message) {
  clear(host);
  host.append(h('div', { class: 'loading' },
    h('div', { class: 'spinner' }, h('i'), h('i')),
    h('p', { text: message }),
    h('div', { class: 'progress-line' }, h('i'))));
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, search] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, query: new URLSearchParams(search || '') };
}

async function route() {
  const { parts, query } = parseHash();
  const view = parts[0] || 'home';

  if (current) host.dispatchEvent(new CustomEvent('view:teardown'));
  current = view;
  markNav(view === 't' || view === 'c' ? 'explore' : view);

  if (view === 'explore') {
    renderExplore(host, data, { query });
    scrollTop();
    return;
  }
  if (view === 'c' && parts[1]) {
    const condition = data.conditions.find((item) => item.id === parts[1]);
    if (!condition) {
      clear(host);
      host.append(h('div', { class: 'errorbox' },
        h('h3', { text: 'No such condition' }),
        h('p', null, h('code', { text: parts[1] })),
        h('p', null, h('a', { class: 'btn', href: '#/explore' }, 'Back to Explore', icon('arrow')))));
      return;
    }
    renderCondition(host, data, condition, { query });
    scrollTop();
    return;
  }
  if (view === 't' && parts[1]) {
    const run = data.byId.get(parts[1]);
    if (!run) {
      clear(host);
      host.append(h('div', { class: 'errorbox' },
        h('h3', { text: 'No such trajectory' }),
        h('p', null, h('code', { text: parts[1] })),
        h('p', null, h('a', { class: 'btn', href: '#/explore' }, 'Back to Explore', icon('arrow')))));
      return;
    }
    const episode = parts[2] ? Number(parts[2]) - 1 : null;
    scrollTop();
    await renderTrajectory(host, { run, episode });
    return;
  }
  renderHome(host, data);
  scrollTop();
}

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function markNav(view) {
  qsa('.topnav a').forEach((link) => link.classList.toggle('active', link.dataset.nav === view));
}

/* ------------------------------------------------------------- chrome */

/** Keep the research viewer on the same white canvas as the paper. */
function setUpTheme() {
  document.documentElement.dataset.theme = 'light';
}

function setUpTopbar() {
  const topbar = qs('#topbar');
  const mark = () => topbar.classList.toggle('is-stuck', window.scrollY > 6);
  mark();
  window.addEventListener('scroll', mark, { passive: true });
}
