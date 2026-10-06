# Local skill behavior evaluations

The latest [2026-10-06 synthetic preflight](results/2026-10-06-preflight.md) remains blocked by managed execution policy after PR #9 was reconciled with current `main`. No fixed case was started in that run; the three recorded case outcomes below remain `not-run`.

These are three independent, synthetic task probes, not a benchmark or evidence
of improvement over Codex without skills. Installation success, instruction
loading, execution, and output quality are separate results. Licensed skill
content is never modified by this evaluation.

## Fixtures and criteria

[`cases.json`](cases.json) contains the exact fictional inputs, requested output,
required instruction reads, and independent human review criteria, fixed before
the runs. The tasks are a Mosslight seed-kit landing page, a Juniper Studio
workshop handout using the brand palette/typography, and a Seedling team 3P update.
No customer data, real company updates, connectors or external sends are needed.
Synthetic prompts and the instructions necessarily go to the configured Codex
model service; the no-network requirement applies to task tools and artifacts.

| Layer | Required evidence | What it does not prove |
| --- | --- | --- |
| Source files | Eligible bundled record, reviewed inventory and hashes | Installation or behavior |
| Project install | CLI `success: true`, reviewed destination bytes, install record, `info` and `list` | Instruction loading |
| Execution | Successful non-read command or file change and completed turn in actual CLI JSONL | Use of a specific skill or good output |
| Loading | Successful full instruction read with matching returned content; internal-comms also needs `examples/3p-updates.md` | Comprehension or causal benefit |
| Output | Actual agent artifact, static checks, browser measurements where applicable | Visual/writing quality or improvement over a baseline |
| Human review | Named reviewer, date, inspected artifacts, per-criterion verdict and reasons | Generalization from a single task |

`turn.completed` and exit code 0 alone do **not** mean a task ran. A policy-blocked
session containing only agent messages is `not-run`. An interrupted session
with some successful work is `incomplete`. Self-reported use is never counted as
loading evidence. The read detector supports complete `cat`, `Get-Content` and
file-read command traces; alternative mechanisms require explicit trace review,
not silently treating a missing match as proof of non-use.

On Windows PowerShell, the runner prompts for `Get-Content -Raw -Encoding utf8` so
UTF-8 skill files without a BOM are decoded correctly. An interactive scratch
run on 2026-10-06 read the complete `frontend-design` file without an explicit
encoding; its output matched the legacy ANSI decoding rather than the actual
UTF-8 text. That read is exploratory, not exact instruction-use evidence for a
fixed case.

## Reproduce

Requirements: repository dependencies, Node >=22, Git and an installed,
authenticated Codex CLI. The recorded run used CLI 0.153.0. Check the local CLI
help for availability of the flags below. The runner uses its configured default
model; the recorded event stream may not expose the resolved model, which limits
reproducibility. It does not alter authentication, personal settings or user skills.

```sh
pnpm validate-materialized
node scripts/evaluations/preflight.mjs --codex-js /absolute/path/to/@openai/codex/bin/codex.js
node scripts/evaluations/run.mjs --case all --codex-js /absolute/path/to/@openai/codex/bin/codex.js
node --test tests/behavior-evaluations.test.mjs
pnpm validate-all
```

On Windows, use `pnpm.cmd` if PowerShell blocks `pnpm.ps1`. The recorded CLI path
was the npm installation's `node_modules/@openai/codex/bin/codex.js`. Pass it as a
quoted argument when it contains spaces. `--case` also accepts any one of the
three fixture names. No global CLI install or package download is performed.

The standalone preflight creates a synthetic nested project and requires a complete
instruction read, an exact project-local write, and a successful readback. The
runner repeats that gate before starting any fixed case and exits nonzero without
starting a case if the gate fails. This is intentionally a live model request, so
run it once for diagnosis and do not retry paid cases after a policy failure.

The runner creates a fresh directory under ignored `.ai-skills-hub/evaluations/`:
each task gets a separate nested Git project, its one installed skill, synthetic
`task.txt`, local `AGENTS.md`, JSONL trace, stderr, and `result.json`. It checks
eligibility, reviewed bytes, project installation, `info`/`list` before starting
Codex, then checks installed file integrity again after execution. It uses
`exec --ignore-user-config --ephemeral --sandbox workspace-write --json`, disables
web search/apps/multi-agent features and gives explicit project-only instructions.
Existing managed policies still apply. Never bypass a policy to make this pass.
Each task has a five-minute execution limit; failures/timeouts must stay visible.

The local process may need permission to reach the model service and its existing
authentication. If authentication, policy, network, or tools prevent execution,
record `not-run` with the observed diagnostic. Do not manufacture output, insert
skill content into an answer by hand, or change the skill to force a passing run.
Keep raw logs and large artifacts ignored. Review all exported summaries for
private paths and secrets before committing them. The runner's exit code indicates
that evidence collection completed, **not** that behavior passed; inspect every
`result.json`. Unit tests use fabricated trace fixtures only to test the grader.

## Artifact checks and independent human review

Automated checks in `scripts/evaluations/checks.mjs` inspect actual output files:
document/viewport, external resources, brief content, focus/reduced motion, palette
and font-stack declarations, disclaimer, strict 3P lines/word count, selected facts
and unprovided numeric tokens. These are bounded syntactic checks. Palette text
alone is not evidence of computed styling, and an allowed number can still be used
in a fabricated statement. Passing these checks is deliberately called
`passed-static-checks`, not a quality pass.

For an actual HTML output, open `index.html` locally in Chrome/Edge (the task requires
a standalone page). Use DevTools responsive view at **1440x900** and **390x844**.
Save screenshots locally, note browser version and errors, and check:

- The page loads without external requests, missing assets or console errors;
  no horizontal overflow, clipped text, overlapping elements or unusable targets.
- Frontend: click **Show kit contents**; actual contents must become visible or be
  navigated to. Tab through controls; focus is visible. Emulate reduced motion.
  Review the plan and trace ordering: plan and critique before implementation.
- Brand: inspect **computed** body background/text (`#faf9f5`/`#141413`), heading
  `Poppins, Arial` and body `Lora, Georgia` font stacks; inspect rendered fonts to
  determine which is actually used. Do not install fonts. Confirm headings >=32px,
  body >=18px, visible non-text accents `#d97757`, `#6a9bcc`, `#788c5d`, neutral
  colors `#b0aea5`/`#e8e6dc`, and readable contrast. Look for the disclaimer and
  absence of logos. A CSS declaration that is overridden does not pass.

For the 3P output, compare **every factual clause** with `cases.json`, including
reporting periods, metrics and blocker wording. Read at a normal pace (30–60
seconds target), and assess the 1–3 sentence sections for clarity. Audit the
complete tool trace for reads outside the project, connector use, or external
sends; a regex or an agent's assurance alone cannot certify absence of disclosure.

Record human review with: reviewer name, date, output SHA-256, screenshot hashes
where applicable, criterion, pass/fail, and a concrete observation. Until a human
has actually reviewed it, leave `human_review.status` as `pending`; do not describe
another agent or the producer's self-critique as human review. If no output exists,
quality and preview are `not-run`, not failures of the skill itself.

To measure whether a skill *helps*, a later experiment needs matched no-skill
baselines, multiple independent runs, a fixed model/runtime, and blinded human
ratings. These single task probes only establish whether a usable path exists.

## Results

See [the recorded run](results/2026-10-02.md) and its
[follow-up policy preflight](results/2026-10-03-preflight.md). No positive
performance claim should be inferred from the three eligible catalog entries or
the automated test count.

CLI behavior reference: [OpenAI non-interactive mode documentation](https://learn.chatgpt.com/docs/non-interactive-mode).
