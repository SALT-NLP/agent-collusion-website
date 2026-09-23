/* Turns recorded agent activity into readable page elements.
   Nothing here prints a raw object: every tool result has a shape the viewer
   knows how to draw, and anything unrecognised falls back to labelled fields. */

import { h, frag, icon, nf, plural } from './dom.js';

const SQL_KEYWORDS = 'select|from|where|join|inner|left|right|outer|full|cross|on|and|or|not|null|as|group|by|order|limit|offset|having|distinct|union|all|case|when|then|else|end|between|like|in|is|asc|desc|count|sum|avg|min|max|coalesce|cast|with|exists';
const PY_KEYWORDS = 'def|return|if|elif|else|for|while|break|continue|import|from|class|try|except|finally|raise|with|as|pass|lambda|yield|assert|global|nonlocal|del|and|or|not|in|is|None|True|False|self';

/** Colour a snippet without trusting it: every token becomes a text node. */
export function code(text, language = 'text') {
  const pre = h('pre', { class: 'codeblock' });
  if (!text) return pre;
  const keywords = language === 'sql' ? SQL_KEYWORDS : language === 'python' ? PY_KEYWORDS : null;
  if (!keywords) { pre.textContent = text; return pre; }

  const comment = language === 'sql' ? '--[^\\n]*' : '#[^\\n]*';
  const pattern = new RegExp(
    `(${comment})|('(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")|\\b(${keywords})\\b|\\b(\\d+(?:\\.\\d+)?)\\b`,
    language === 'sql' ? 'gi' : 'g',
  );
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) pre.append(text.slice(last, match.index));
    const cls = match[1] ? 'c' : match[2] ? 's' : match[3] ? 'k' : 'n';
    pre.append(h('span', { class: cls, text: match[0] }));
    last = match.index + match[0].length;
  }
  if (last < text.length) pre.append(text.slice(last));
  return pre;
}

/** Long passages collapse to a few lines with an inline control. */
export function clampable(node, lines = 7, label = 'Show more') {
  const wrap = h('div', { class: 'clampable', dataset: { collapsed: '1' } });
  node.classList.add('clamp-target');
  const button = h('button', { class: 'clamp-btn', type: 'button', text: label });
  button.addEventListener('click', () => {
    const collapsed = wrap.dataset.collapsed === '1';
    wrap.dataset.collapsed = collapsed ? '0' : '1';
    button.textContent = collapsed ? 'Show less' : label;
  });
  wrap.style.setProperty('--clamp-lines', lines);
  wrap.append(node, button);
  return wrap;
}

function needsClamp(text, chars = 520) {
  return typeof text === 'string' && text.length > chars;
}

export function prose(text, { className = 'prose-block', clamp = true, quotes = null } = {}) {
  const node = h('div', { class: className });
  node.append(markdown(text));
  if (quotes?.length) highlightQuotes(node, quotes);
  return clamp && needsClamp(text) ? clampable(node) : node;
}

/* ------------------------------------------------------------- markdown */
/* Agents write markdown in their reasoning and reflections, so render the
   common subset. Text always becomes text nodes, never markup, so a model
   that writes HTML cannot reach the page. Channel messages are left as
   written: they are terse, often deliberately unformatted, and the character
   budget is part of what is being shown. */

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)/g;

function inline(target, text) {
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) target.append(text.slice(last, m.index));
    const token = m[0];
    if (m[1]) target.append(h('code', { text: token.slice(1, -1) }));
    else if (m[2] || m[3]) target.append(h('strong', { text: token.slice(2, -2) }));
    else target.append(h('em', { text: token.slice(1, -1) }));
    last = m.index + token.length;
  }
  if (last < text.length) target.append(text.slice(last));
  return target;
}

/** Lines joined with soft breaks, so a paragraph keeps the shape it was written in. */
function softLines(target, block) {
  block.split('\n').forEach((line, i) => {
    if (i) target.append(h('br'));
    inline(target, line);
  });
  return target;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const NUMBER = /^(\s*)(\d+)[.)]\s+(.*)$/;

/** A list row, with the indent that says which list it belongs to. */
function listItem(row) {
  if (row == null) return null;
  const bullet = BULLET.exec(row);
  if (bullet) return { indent: bullet[1].length, ordered: false, number: null, text: bullet[2] };
  const number = NUMBER.exec(row);
  if (number) return { indent: number[1].length, ordered: true, number: Number(number[2]), text: number[3] };
  return null;
}

const nextContent = (rows, from) => {
  let i = from;
  while (i < rows.length && !rows[i].trim()) i += 1;
  return i;
};

/* One list, and any list written inside it. An item's own indented rows hang
   off that item rather than ending the list it is part of, and `start` keeps
   the numbering the writer used when something does interrupt the run --
   otherwise a list that resumed after a sub-list restarted at 1. */
function buildList(rows, start) {
  const head = listItem(rows[start]);
  const list = h(head.ordered ? 'ol' : 'ul', { class: 'md-list' });
  if (head.ordered && head.number !== 1) list.setAttribute('start', head.number);
  let i = start;

  while (i < rows.length) {
    /* A blank line between items is still one list. */
    const probe = nextContent(rows, i);
    const item = listItem(rows[probe]);
    if (!item || item.ordered !== head.ordered || item.indent !== head.indent) break;

    const li = h('li');
    const body = [item.text];
    i = probe + 1;
    /* Keep wrapped continuation lines with the item they belong to. */
    while (i < rows.length && rows[i].trim() && !listItem(rows[i]) && !HEADING.test(rows[i])) {
      body.push(rows[i].trim());
      i += 1;
    }
    softLines(li, body.join('\n'));

    const nested = listItem(rows[nextContent(rows, i)]);
    if (nested && nested.indent > head.indent) {
      const [sub, after] = buildList(rows, nextContent(rows, i));
      li.append(sub);
      i = after;
    }
    list.append(li);
  }
  return [list, i];
}

export function markdown(text) {
  const out = document.createDocumentFragment();
  if (!text) return out;

  const rows = String(text).replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  let paragraph = [];

  const flush = () => {
    if (!paragraph.length) return;
    out.append(softLines(h('p'), paragraph.join('\n')));
    paragraph = [];
  };

  while (i < rows.length) {
    const row = rows[i];

    if (row.trim().startsWith('```')) {
      flush();
      const fence = [];
      i += 1;
      while (i < rows.length && !rows[i].trim().startsWith('```')) { fence.push(rows[i]); i += 1; }
      i += 1;
      out.append(h('pre', { class: 'codeblock wrap', text: fence.join('\n') }));
      continue;
    }

    const heading = HEADING.exec(row);
    if (heading) {
      flush();
      out.append(inline(h('p', { class: 'md-h' }), heading[2]));
      i += 1;
      continue;
    }

    if (listItem(row)) {
      flush();
      const [list, after] = buildList(rows, i);
      out.append(list);
      i = after;
      continue;
    }

    if (!row.trim()) { flush(); i += 1; continue; }
    paragraph.push(row);
    i += 1;
  }
  flush();
  return out;
}

/* --------------------------------------------------- quote highlighting */

/** Wrap each judge quote where it appears, even across bold or code spans. */
export function highlightQuotes(root, quotes) {
  /* One walk per quote: wrapping splits text nodes, so offsets collected
     before a wrap would no longer line up with the tree after it. */
  for (const quote of quotes || []) {
    const nodes = [];
    let full = '';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      nodes.push({ node: n, start: full.length });
      full += n.nodeValue;
    }
    const range = full && locate(full, quote);
    if (!range) continue;
    const marks = wrapRange(nodes, range[0], range[1]);
    if (marks.length) prepareStroke(marks);
  }
  return root;
}

/** One span per character, each starting a little after the one before it. */
function prepareStroke(marks) {
  const cells = [];
  for (const mark of marks) {
    const text = mark.textContent;
    mark.textContent = '';
    for (const ch of text) {
      const cell = h('span', { class: 'qc', text: ch });
      mark.append(cell);
      cells.push(cell);
    }
  }
  const span = Math.min(1500, Math.max(350, cells.length * 7));
  cells.forEach((cell, i) => {
    cell.style.transitionDelay = `${Math.round((i / cells.length) * span)}ms`;
  });

  /* A quote crossing a bold run is several marks; they are one stroke, so the
     first one to be seen starts all of them. */
  const draw = () => marks.forEach((mark) => mark.classList.add('drawn'));
  if (!drawer) { draw(); return; }
  marks[0]._stroke = draw;
  drawer.observe(marks[0]);
}

/* The stroke starts when the quote is scrolled to. */
const drawer = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        drawer.unobserve(entry.target);
        entry.target._stroke?.();
      }
    }, { rootMargin: '0px 0px -10% 0px' })
  : null;

function locate(full, quote) {
  const text = (quote || '').trim();
  if (text.length < 8) return null;
  const direct = full.indexOf(text);
  if (direct >= 0) return [direct, direct + text.length];

  /* The quote was copied from the raw text, so against the rendered tree its
     emphasis markers may be gone and its line breaks may have become
     elements. Underscores stay optional rather than stripped, because
     `top_n` is an identifier while `_word_` was emphasis. */
  const pattern = Array.from(text).map((ch) => {
    if (/\s/.test(ch)) return '\\s*';
    if (ch === '*' || ch === '`') return '[*`]?';
    if (ch === '_') return '_?';
    return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('').replace(/(\\s\*)+/g, '\\s*');

  let found = null;
  try {
    found = new RegExp(pattern).exec(full);
  } catch {
    found = null;
  }
  return found && found[0].length ? [found.index, found.index + found[0].length] : null;
}

function wrapRange(nodes, from, to) {
  const marks = [];
  for (const entry of nodes) {
    const node = entry.node;
    const start = entry.start;
    const stop = start + node.nodeValue.length;
    if (stop <= from || start >= to) continue;
    const localFrom = Math.max(0, from - start);
    const localTo = Math.min(node.nodeValue.length, to - start);
    let target = node;
    if (localTo < target.nodeValue.length) target.splitText(localTo);
    if (localFrom > 0) target = target.splitText(localFrom);
    const mark = h('mark', { class: 'q' });
    target.parentNode.insertBefore(mark, target);
    mark.append(target);
    entry.node = mark.firstChild;
    marks.push(mark);
  }
  return marks;
}

export function disclosure(summaryText, bodyFactory, { note = null, open = false, quiet = false } = {}) {
  const details = h('details', { class: `disc${quiet ? ' disc--quiet' : ''}`, open });
  const summary = h('summary', null, icon('caret', 'caret'), h('span', { text: summaryText }), note ? h('span', { class: 'sm', text: note }) : null);
  details.append(summary);
  let built = false;
  const body = h('div', { class: 'disc-body' });
  const build = () => { if (!built) { built = true; body.append(bodyFactory()); } };
  if (open) build();
  details.addEventListener('toggle', () => { if (details.open) build(); });
  details.append(body);
  return details;
}

/* ------------------------------------------------------------ tool steps */

/* The keys that name the file a call is about. They ride in the card header
   instead of the body, because as a File field, a Path in the result view and
   another File on the next call, one filename was being read three times. */
const SUBJECT_KEYS = ['filename', 'test_file', 'path', 'file'];

function subjectOf(step, view) {
  const args = step.args || {};
  for (const key of SUBJECT_KEYS) {
    if (typeof args[key] === 'string' && args[key]) return args[key];
  }
  return view?.kind === 'file' ? view.path || null : null;
}

export function toolStep(step, blobs) {
  const view = step.view || blobs?.[step.view_ref] || null;
  const subject = subjectOf(step, view);
  const card = h('div', { class: 'toolcard' });
  card.append(h('div', { class: 'toolcard-head' },
    h('span', { class: 'toolcard-name', text: step.name || 'tool' }),
    subject ? h('span', { class: 'toolcard-subject mono', text: subject }) : null,
    h('span', { class: `toolcard-status${step.ok === false ? ' bad' : ''}` }, h('i'), step.ok === false ? 'failed' : 'ok'),
  ));
  const body = h('div', { class: 'toolcard-body' });
  const args = toolArgs(step);
  if (args) body.append(args);
  /* append() stringifies whatever it is given, so a view that renders to
     nothing has to be dropped here rather than written out as "null". */
  const result = view ? toolResult(step.name, view) : null;
  if (result) body.append(result);
  if (body.childElementCount) card.append(body);
  return card;
}

function toolArgs(step) {
  const args = step.args || {};
  const keys = Object.keys(args).filter((k) => !k.endsWith('_omitted') && !SUBJECT_KEYS.includes(k));
  if (!keys.length) return null;

  if (step.name === 'query_database' && args.sql) return field('SQL', code(args.sql, 'sql'));
  if (step.name === 'write_test_file') {
    return args.content ? disclosure('Test code', () => code(args.content, 'python'), { note: `${nf.format(args.content.length)} chars` }) : null;
  }
  if (step.name === 'resolve_records' && Array.isArray(args.records)) {
    return disclosure(`${plural(args.records.length + (args.records_omitted || 0), 'record')}`,
      () => h('div', { class: 'records' }, args.records.map((r, i) => h('div', { class: 'record-item' }, h('em', { text: String(i + 1) }), h('span', { text: r })))));
  }
  if (step.name === 'save_final_answer') return null; // rendered with the final saved answer by the trajectory view

  const chips = keys.map((key) => {
    const value = args[key];
    if (typeof value === 'string' && value.length > 120) return null;
    return h('span', { class: 'kv' }, h('b', { text: key }), h('span', { text: Array.isArray(value) ? `${value.length} items` : String(value) }));
  }).filter(Boolean);
  const long = keys.filter((k) => typeof args[k] === 'string' && args[k].length > 120);
  return frag(
    chips.length ? h('div', { class: 'kvlist' }, chips) : null,
    long.map((key) => disclosure(key, () => code(args[key]), { note: `${nf.format(args[key].length)} chars` })),
  );
}

function field(label, node) {
  return h('dl', { class: 'field' }, h('dt', { text: label }), h('dd', null, node));
}

function toolResult(name, view) {
  switch (view.kind) {
    case 'rows': return rowsView(view);
    case 'schema': return schemaView(view);
    case 'source': return disclosure(view.language === 'python' ? 'Code' : 'Source',
      () => code(view.content, view.language), { note: `${nf.format((view.content || '').length)} chars` });
    case 'tests': return disclosure('Output', () => code(view.output || ''), { note: testSummary(view.output) });
    case 'file': return null; // the path is the subject in the card header
    case 'log': return logView(view);
    case 'ids': return idsView(view);
    case 'error': return h('div', { class: 'feedback-card', text: view.text });
    case 'text': return code(view.text || '', 'text');
    case 'fields': return h('div', { class: 'kvlist' }, Object.entries(view.fields).map(([k, v]) =>
      h('span', { class: 'kv' }, h('b', { text: k }), h('span', { text: typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v) }))));
    case 'ok':
    default: return null;
  }
}

function testSummary(output) {
  if (!output) return null;
  const match = output.match(/(\d+) failed|(\d+) passed/g);
  return match ? match.join(', ') : null;
}

function rowsView(view) {
  if (!view.columns.length) return h('p', { class: 'table-note', text: 'No columns' });
  if (!view.row_count) return h('p', { class: 'table-note', text: '0 rows' });
  const table = h('table', null,
    h('thead', null, h('tr', null, view.columns.map((c) => h('th', { text: c })))),
    h('tbody', null, view.rows.map((row) => h('tr', null, view.columns.map((c) => h('td', { text: cellText(row[c]) }))))),
  );
  const hidden = view.row_count - view.shown;
  return frag(
    h('div', { class: 'datatable' }, table),
    h('p', { class: 'table-note', text: hidden > 0 ? `${plural(view.row_count, 'row')}, ${view.shown} shown` : plural(view.row_count, 'row') }),
  );
}

function cellText(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function schemaView(view) {
  const summary = `${plural(view.tables.length, 'table')}, ${plural(view.tables.reduce((n, t) => n + t.columns.length, 0), 'column')}`;
  return disclosure('Schema', () => h('div', { class: 'schema-list' },
    view.tables.map((table) => h('div', { class: 'schema-row' },
      h('b', { text: table.name }),
      h('span', { text: `${table.columns.map((c) => c[0]).join(', ')}` }),
      table.rows != null ? h('span', { class: 'dim nowrap', text: `${nf.format(table.rows)} rows` }) : null,
    )),
  ), { note: summary });
}

function logView(view) {
  return frag(
    h('div', { class: 'kvlist' },
      h('span', { class: 'kv' }, h('b', { text: 'raw log' }), h('span', { text: `${nf.format(view.chars)} chars` }))),
    view.preview ? disclosure('Raw log', () => code(view.preview), { note: 'truncated' }) : null,
  );
}

function idsView(view) {
  return frag(
    h('div', { class: 'kvlist' }, view.ids.slice(0, 24).map((id) => h('span', { class: 'kv' }, h('span', { text: id })))),
    view.count > 24 ? h('p', { class: 'table-note', text: `+${view.count - 24} more` }) : null,
  );
}

