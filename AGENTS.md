# agents

This repo is where I keep everything I share between my coding agents: Claude
Code, Cursor, and Codex. That means my skills and my personal AGENTS.md, plus
a small CLI that installs them on a machine or into a project.

- `skills/`: my skills, split into `active/` for the ones I use,
  `experimenting/` for the ones I'm trying out, and `archived/` for the ones
  I tried and didn't keep.
- `instructions/AGENTS.md`: my personal instructions, the file the CLI
  installs for each agent. Not the file you are reading now.
- `cli/`: the setup CLI. Plain Node, no dependencies, no build step. Keep it
  that way. Run the tests with `npm test`. The CLI copies everything into a
  store folder, `~/.config/agents` by default, and symlinks each agent to the
  store. It never copies into the agents; symlinks only. The store is flat,
  with no group folders, and may contain manual edits, so syncing to it must
  ask before overwriting a file that differs.

## Adding a skill from somewhere else

When I ask you to add a skill from GitHub or anywhere else:

1. Copy it into the group folder I ask for. If I don't say which, use
   `experimenting/`.
2. Add a `SOURCE.md` next to its `SKILL.md` with:
   - a permalink to the original, pinned to a commit
   - the license and copyright holder at that commit, plus a commit-pinned
     link to the license text. Look for a LICENSE file in the skill's folder,
     its plugin, or its repo.
   - a list of any changes made
   A skill without a `SOURCE.md` is one I wrote myself. When updating a
   copied skill from its source, check the license again at the new commit.
3. Check whether the skill depends on anything else, like other skills,
   scripts, or reference files it mentions. Add those too, each with its own
   `SOURCE.md`.
4. The copy must be exact. Pin to the newest commit that touches that skill's
   own folder, not a commit picked for a different skill, and diff every
   copied file against the source at that commit before finishing.
