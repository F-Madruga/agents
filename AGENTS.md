# agents

This repo is where I keep everything I share between my coding agents (Claude
Code, Cursor, Codex): my skills and my personal AGENTS.md. It also has a small
CLI that installs them on a machine or into a project.

- `skills/` — my skills, split into `active/` (I use these), `experimenting/`
  (trying them out), and `archived/` (tried them, didn't keep them).
- `instructions/AGENTS.md` — my personal instructions, the file the CLI
  installs for each agent. Not the file you are reading now.
- `cli/` — the setup CLI. Plain Node, no dependencies, no build step. Keep it
  that way. Run the tests with `npm test`. It installs everything through a
  store folder (default `~/.config/agents`): repo → store → symlinks in each
  agent (symlinks only, no copy mode). The store is flat (no group folders)
  and may contain manual edits, so syncing to it must ask before overwriting
  differing files.

## Adding a skill from somewhere else

When I ask you to add a skill from GitHub (or anywhere else):

1. Copy it into the group folder I ask for (default: `experimenting/`).
2. Add a `SOURCE.md` next to its `SKILL.md` with:
   - a permalink to the original, pinned to a commit
   - the license and copyright holder at that commit, plus a commit-pinned
     link to the license text (look for a LICENSE file in the skill's repo,
     plugin, or folder)
   - a list of any changes made
   A skill without a `SOURCE.md` is one I wrote myself. When updating a
   copied skill from its source, check the license again at the new commit.
3. Check if the skill depends on anything else — other skills, scripts, or
   reference files it mentions — and add those too, each with its own
   `SOURCE.md`.
