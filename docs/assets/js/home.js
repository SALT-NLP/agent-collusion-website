/* Overview: the paper, and the way in. */

import { h, clear, icon, reveal } from './dom.js';
import { PAPER_URL, CODE_URL, HF_DATASET_URL } from './config.js';

/* The abstract as published. */
const ABSTRACT = 'LLM agents are increasingly deployed in collaborative settings, yet long-term interaction may give rise to undesirable coordination. We study the emergence of collusion in a long-horizon multi-agent environment: two agents repeatedly complete individual tasks, share task logs, verify each other’s work, and receive rewards. We introduce realistic constraints that make compliance with the verification protocol incompatible with reward maximization, and find that agents increasingly deviate from the protocol over repeated interactions. Collusion emerges in 94% of trajectories across 10 models, and more capable models within the same family reach it earlier. Controlled peer interventions show that collusion is shaped by peer behavior, while ablations reveal additional effects of reward structure, the verification feedback agents receive, and their interaction history. In particular, restricting the amount and scope of interaction history available to agents reduces collusion. Overall, our findings show that long-horizon interaction can reshape how agents coordinate in ways that create safety risks.';

/* The citation as arXiv gives it. */
const BIBTEX = `@misc{shi2026emergentcollusionlonghorizonllm,
      title={Emergent Collusion in Long-Horizon LLM Agent Interaction},
      author={Xinrui Shi and Yanzhe Zhang and Diyi Yang},
      year={2026},
      eprint={2609.24967},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2609.24967},
}`;

/** Copies on click; the glyph becomes a tick to say it worked. */
function copyButton(text) {
  const button = h('button', { class: 'copy-btn', type: 'button', title: 'Copy BibTeX', 'aria-label': 'Copy BibTeX' }, icon('copy'));
  let revert;
  const show = (name, label) => {
    clear(button);
    button.append(icon(name));
    button.title = label;
    button.setAttribute('aria-label', label);
  };
  button.addEventListener('click', async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ok = false;
      /* Without clipboard access -- an insecure origin, or a denied prompt --
         select the block instead, so the reader's own copy shortcut works. */
      const range = document.createRange();
      range.selectNodeContents(button.previousElementSibling);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    show(ok ? 'check' : 'copy', ok ? 'Copied' : 'Selected — press your copy shortcut');
    clearTimeout(revert);
    revert = setTimeout(() => show('copy', 'Copy BibTeX'), 1600);
  });
  return button;
}

export function renderHome(host) {
  clear(host);
  const page = h('div', { class: 'view-swap project-home' },
    h('section', { class: 'hero hero--centred' }, h('div', { class: 'hero-inner' },
      h('h1', null,
        h('span', { text: 'Emergent Collusion' }),
        h('span', { text: 'in Long-Horizon LLM Agent Interaction' })),
      h('p', { class: 'hero-authors' },
        h('span', null, h('b', { text: 'Xinrui Shi' }), h('sup', { text: '1*' })),
        h('span', null, h('b', { text: 'Yanzhe Zhang' }), h('sup', { text: '2*' })),
        h('span', null, h('b', { text: 'Diyi Yang' }), h('sup', { text: '1' }))),
      h('p', { class: 'hero-note', text: '¹ Stanford University   ² Georgia Tech   * Equal contribution' }),
      h('nav', { class: 'hero-links', 'aria-label': 'Project links' },
        h('a', { class: 'is-primary', href: '#/explore' }, 'Explore the data', icon('arrow')),
        h('a', { href: PAPER_URL, target: '_blank', rel: 'noopener' }, icon('doc'), 'Paper'),
        h('a', { href: CODE_URL, target: '_blank', rel: 'noopener' }, icon('code'), 'Code'),
        h('a', { href: HF_DATASET_URL, target: '_blank', rel: 'noopener' }, icon('db'), 'Dataset')),
    )),
    h('section', { class: 'abstract-section' },
      h('h2', { text: 'Abstract' }),
      h('p', { class: 'hero-abstract', text: ABSTRACT })),
    h('section', { class: 'abstract-section cite-section' },
      h('h2', { text: 'BibTeX' }),
      h('div', { class: 'cite-block' },
        h('pre', { class: 'codeblock', text: BIBTEX }),
        copyButton(BIBTEX))));
  host.append(page);
  reveal(page);
}
