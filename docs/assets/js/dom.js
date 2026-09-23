/* Tiny DOM helpers. Everything the agents produced is inserted as text, never
   as markup, so a model that writes HTML into a message cannot reach the page. */

export function h(tag, props = null, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key === 'style' && typeof value === 'object') setStyle(node, value);
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, value);
    }
  }
  add(node, children);
  return node;
}

/** Custom properties need setProperty; Object.assign silently drops them. */
function setStyle(node, declarations) {
  for (const [property, value] of Object.entries(declarations)) {
    if (value === null || value === undefined) continue;
    if (property.startsWith('--')) node.style.setProperty(property, value);
    else node.style[property] = value;
  }
}

function add(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) add(node, child);
    else node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  add(f, children);
  return f;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const ICONS = {
  arrow: 'M5 12h13M13 6l6 6-6 6',
  caret: 'M9 5l7 7-7 7',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
  /* Two lobes that meet at the fold; drawn apart they read as two marks. */
  brain: 'M12 6a3.2 3.2 0 0 0-5.5 2.2A2.8 2.8 0 0 0 5 13.4a2.9 2.9 0 0 0 3.6 4A2.9 2.9 0 0 0 12 18V6ZM12 6a3.2 3.2 0 0 1 5.5 2.2A2.8 2.8 0 0 1 19 13.4a2.9 2.9 0 0 1-3.6 4A2.9 2.9 0 0 1 12 18V6Z',
  tool: 'M14.5 4.5a4.5 4.5 0 0 0-5.9 5.7L4 14.8V19h4.2l4.6-4.6a4.5 4.5 0 0 0 5.7-5.9L16 11l-2.5-.5L13 8l2.5-2.5Z',
  /* One circle and a tail. The old path asked for a radius too small to span
     its own end points, so the bubble came out dented along the bottom. */
  speech: 'M12 4a8 8 0 1 1-4.7 14.5L4 20l.9-3.3A8 8 0 0 1 12 4Z',
  check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
  cross: 'M6 6l12 12M18 6 6 18',
  /* The wave used to end at x=24, so the right edge sat on the viewBox
     boundary and half its stroke was clipped away. */
  flag: 'M6 20V5c2.6-1.2 5.2-1.2 7.8 0s5.2 1.2 7.8 0v8.4c-2.6 1.2-5.2 1.2-7.8 0s-5.2-1.2-7.8 0',
  doc: 'M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9ZM13 3v6h6',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5ZM4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z',
  db: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3ZM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  code: 'M9 7l-5 5 5 5M15 7l5 5-5 5',
  copy: 'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2ZM4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2',
  save: 'M5 4h11l3 3v13H5ZM8 4v6h7V4M8 20v-6h8v6',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 7.5V12l3 2',
  spark: 'M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.3l-1.9-5.5L4.5 11 10.1 9Z',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5',
  reset: 'M4.5 9A8 8 0 1 1 4 13.2M4.5 4.5V9H9',
  link: 'M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.2 1.2M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 1 0 5.7 5.7l1.2-1.2',
};

export function icon(name, extra = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (extra) svg.setAttribute('class', extra);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name] || ICONS.doc);
  svg.append(path);
  return svg;
}

/** Fade sections in as they scroll into view; harmless when unsupported. */
const revealer = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        revealer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 })
  : null;

export function reveal(root) {
  const nodes = root.classList?.contains('rise') ? [root, ...qsa('.rise', root)] : qsa('.rise', root);
  for (const node of nodes) {
    if (node.classList.contains('in')) continue;
    /* Anything already on screen appears at once; the rest waits for scroll. */
    if (!revealer || node.getBoundingClientRect().top < window.innerHeight) node.classList.add('in');
    else revealer.observe(node);
  }
}

export function stagger(root, step = 42, cap = 16) {
  Array.from(root.children).forEach((child, i) => {
    child.style.animationDelay = `${Math.min(i, cap) * step}ms`;
  });
  root.classList.add('stagger');
  return root;
}

export function toast(message, ms = 3200) {
  const host = document.getElementById('toast-host');
  const node = h('div', { class: 'toast', text: message });
  host.append(node);
  setTimeout(() => {
    node.style.transition = 'opacity .3s, transform .3s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    setTimeout(() => node.remove(), 320);
  }, ms);
}

export const nf = new Intl.NumberFormat('en-US');
export const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export function plural(n, one, many = `${one}s`) {
  return `${nf.format(n)} ${n === 1 ? one : many}`;
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
