# agents

This repo is where I keep everything I share between my coding agents (Claude
Code, Cursor, Codex): my skills and my personal AGENTS.md. It also has a small
CLI that installs them on a machine or into a project.

- `skills/` — my skills, split into `active/` (I use these), `experimenting/`
  (trying them out), and `archived/` (tried them, didn't keep them).
- `instructions/AGENTS.md` — my personal instructions, the file the CLI
  installs for each agent. Not the file you are reading now.
- `cli/` — the setup CLI. Plain Node, no dependencies, no build step. Keep it
  that way. Run the tests with `npm test`.

## Adding a skill from somewhere else

When I ask you to add a skill from GitHub (or anywhere else):

1. Copy it into the group folder I ask for (default: `experimenting/`).
2. Add a `SOURCE.md` next to its `SKILL.md` with a permalink to the original
   (pinned to a commit) and a list of any changes made. A skill without a
   `SOURCE.md` is one I wrote myself.
3. Check if the skill depends on anything else — other skills, scripts, or
   reference files it mentions — and add those too, each with its own
   `SOURCE.md`.
