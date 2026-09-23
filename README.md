# Agent Collusion Explorer

A static site for reading the trajectories behind *Emergent Collusion in
Long-Horizon LLM Agent Interaction*. It carries its own copy of the data, so a
clone needs nothing but a local web server.

## Run it

```bash
python3 -m http.server 8000 --directory docs
```

Then open <http://localhost:8000/>.

A server is required: the page is ES modules and `fetch`, neither of which a
browser will run from a `file://` path.

## What you are looking at

Three levels, in order:

1. **Explore** — one card per condition: the model or pairing, what the
   condition varies, and how its fifty runs came out.
2. **A condition** — its fifty runs, each a strip of ten episode outcomes
   (Alice's verdict above Bob's) with the collusion pathway and whether it
   converged.
3. **A run** — one trajectory, episode by episode: what each agent did on its
   own task, the messages the two exchanged, the verdict each returned, and
   the feedback and private reflection that followed.

## What is in the repository

| Path | What | Size |
| --- | --- | --- |
| `docs/` | the viewer: one page, plain ES modules, no build step | ~1 MB |
| `docs/data/index.json` | the browse index — every condition and run, with a compact per-episode encoding of verdicts, task correctness, judge labels and task type | ~1 MB |
| `docs/data/viewer/<condition_id>/repNNN.json.gz` | one trajectory each, reduced to what the viewer draws | ~120 KB each |

The bundles are gzipped JSON, fetched on demand and unpacked in the page with
`DecompressionStream`, then kept for the session.

## Where the viewer looks for a trajectory

In order, stopping at the first that answers:

1. `docs/data/viewer/` — this repository's own copy.
2. The [Hugging Face dataset](https://huggingface.co/datasets/SALT-NLP/agent-collusion),
   under `viewer/`, for a deployment that ships without the bundles.

`?data=<base>` overrides both and uses only what it names, which is how you
point the page at a freshly built copy:

```
http://localhost:8000/?data=/some/other/build/#/explore
```

## Regenerating the data

Both tiers come from `viewer/build.py` in the research repository, run against
a release directory:

```bash
python viewer/build.py --release release --out release/viewer
```

That writes `docs/data/index.json` and one bundle per run. Copy the bundles
here as `docs/data/viewer/`.

## Browser support

Unpacking a trajectory needs `DecompressionStream` (Chrome 80+, Safari 16.4+,
Firefox 113+); the page says so plainly if it is missing. Everything else
degrades quietly — motion is dropped under `prefers-reduced-motion`.
