/* The episode ribbon: one column per episode. Alice's verdict sits on top and
   Bob's underneath, with a gap between them so two matching accepts still
   read as two verdicts. The onset column — the first mutual accept — is
   outlined and marked. */

import { h } from './dom.js';
import { TASK_LABEL } from './config.js';

/* The figures draw these hues at 0.6 alpha on white; the light steps of the
   same palette are that tone, so the strip reads like the plots. */
const COLOUR = { a: 'var(--accept-soft)', r: 'var(--reject-soft)' };
const fill = (verdict) => COLOUR[verdict] || 'var(--surface-3)';

const isOnset = (run, episode) => run.onset != null && episode.evaluation === run.onset;

export function ribbon(run, { numbers = false, href } = {}) {
  /* Linked cells are the click target, so the strip is not one image. */
  const strip = h('div', {
    class: 'ribbon',
    role: href ? null : 'img',
    'aria-label': href ? null : ribbonLabel(run),
  });

  run.episodes.forEach((episode) => {
    const onset = isOnset(run, episode);
    const label = cellTitle(episode, onset);
    const cell = h(href ? 'a' : 'div', {
      class: 'ribbon-cell',
      href: href ? href(episode) : null,
      style: { '--top': fill(episode.alice), '--bottom': fill(episode.bob) },
      dataset: {
        both: episode.bothAccept ? '1' : '0',
        onset: onset ? '1' : '0',
        warmup: episode.warmup ? '1' : '0',
      },
      title: label,
      'aria-label': href ? label.replaceAll('\n', ', ') : null,
    });
    if (onset) cell.append(h('span', { class: 'ribbon-onset-mark', 'aria-hidden': 'true' }));
    strip.append(cell);
  });

  if (!numbers) return strip;
  const scale = h('div', { class: 'ribbon-scale' },
    run.episodes.map((episode) => {
      const onset = isOnset(run, episode);
      const name = episode.warmup ? 'Warm-up' : `Episode ${episode.evaluation}`;
      return h(href ? 'a' : 'span', {
        href: href ? href(episode) : null,
        text: episode.warmup ? 'w' : String(episode.evaluation),
        dataset: onset ? { onset: '1' } : null,
        'aria-label': href ? name : null,
      });
    }));
  return h('div', { class: 'ribbon-group' }, strip, scale);
}

function cellTitle(episode, onset) {
  const label = episode.warmup ? 'Warm-up' : `Episode ${episode.evaluation}`;
  const flags = [
    episode.agreement ? 'agreement' : null,
    episode.aliceRelax || episode.bobRelax ? 'relaxation' : null,
    onset ? 'onset (first mutual accept)' : null,
  ].filter(Boolean);
  return [
    `${label} · ${TASK_LABEL[episode.task] || episode.task}`,
    `Alice ${verdictWord(episode.alice)} / Bob ${verdictWord(episode.bob)}`,
    `task ${episode.aliceCorrect ? 'ok' : 'wrong'} / ${episode.bobCorrect ? 'ok' : 'wrong'}`,
    flags.join(' · '),
  ].filter(Boolean).join('\n');
}

const verdictWord = (code) => ({ a: 'ACCEPT', r: 'REJECT' }[code] || '—');

function ribbonLabel(run) {
  const accepts = run.episodes.filter((e) => e.bothAccept).length;
  const onset = run.episodes.findIndex((episode) => isOnset(run, episode));
  const where = onset >= 0 ? `, onset at episode ${run.episodes[onset].evaluation}` : '';
  return `${run.episodes.length} episodes, Alice on top and Bob below, ${accepts} where both accepted${where}`;
}

export function ribbonLegend() {
  return h('div', { class: 'ribbon-legend' },
    legendMark(null, 'Alice (top) and Bob (bottom)'),
    legendMark({ alice: 'a', swatch: true }, 'accepted'),
    legendMark({ alice: 'r', swatch: true }, 'rejected'),
    legendMark({ alice: 'a', bob: 'a', onset: true }, 'collusion onset'),
  );
}

/* The same column the strips use, so the key is the mark and not a smaller stand-in. */
function legendMark(sample, label) {
  const cell = h('div', {
    class: `ribbon-cell${sample ? '' : ' is-frame'}${sample?.swatch ? ' is-swatch' : ''}`,
    style: sample ? { '--top': fill(sample.alice), '--bottom': fill(sample.bob || sample.alice) } : null,
    dataset: sample?.onset ? { onset: '1' } : null,
    'aria-hidden': 'true',
  });
  if (sample?.onset) cell.append(h('span', { class: 'ribbon-onset-mark', 'aria-hidden': 'true' }));
  return h('span', null, cell, label);
}
