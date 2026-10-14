# @axiomnode-lab/skills-hub

Install reviewed, license-checked [Agent Skills](https://agentskills.io) into Claude Code, Codex, Cursor, GitHub Copilot and OpenCode projects.

```bash
npx @axiomnode-lab/skills-hub --help
npx @axiomnode-lab/skills-hub available --agent codex
npx @axiomnode-lab/skills-hub search "frontend design" --agent codex
npx @axiomnode-lab/skills-hub install anthropics/frontend-design --agent codex
```

Requires Node.js 22+. The package includes the catalog and every released skill; installing a skill needs no network access.

## Commands

| Command | What it does |
| --- | --- |
| `available [query]` | Skills you can install now (`--agent` to filter) |
| `search <query>` | Keyword search over the whole catalog (`--installable`, `--ai-rerank`, `--limit`, `--json`) |
| `info <id>` | License, security, release state and provenance of one skill |
| `install <id[,id...]>` | Install released skills into the current project (`--agent` required, `--scope user` for your home directory) |
| `list` | Hub-managed installations and whether their files still match |
| `update [id]` | Move installed skills to the released revision (`--dry-run`) |
| `uninstall <id>` | Remove a Hub-managed installation |
| `add <phrase\|git-url>` | Interactive discovery, or clone a repository into `capabilities-library/` for review |
| `mcp` / `serve` | Read-only catalog over MCP stdio, or HTTP on 127.0.0.1:8787 (no authentication) |

Exit codes: `0` success, `1` operation did not complete, `2` invalid usage. `--json` output is always machine-readable.

## What "released" means

Each installable skill was read in full by an AI-assisted reviewer, has a recorded license basis (Apache-2.0 or MIT, with the license file shipped alongside), is pinned to an exact upstream commit, and is verified against SHA-256 hashes before it is written to your project. This is not a security certification or legal advice, and skills are not benchmarked for task performance. Unreleased catalog entries are shown with the reason they cannot be installed.

Source, documentation, license policy and release evidence: https://github.com/AxiomNode-lab/AI-Skills-Hub


## Optional AI reranking

By default, search ranks locally and makes no model request. To rerank the top keyword matches, configure an OpenAI-compatible endpoint and pass `--ai-rerank`:

```bash
export SKILLS_HUB_RERANK_BASE_URL="http://127.0.0.1:11434/v1"
export SKILLS_HUB_RERANK_MODEL="qwen3:8b"
skills-hub search "frontend testing patterns" --agent codex --ai-rerank
```

`SKILLS_HUB_RERANK_API_KEY` is optional and only needed by endpoints that require a key. The request contains the query and metadata for up to 20 local candidate entries; it does not send skill contents. If the endpoint fails, the CLI warns on stderr and retains the keyword order. Model output only changes ranking; it cannot make held skills installable.
