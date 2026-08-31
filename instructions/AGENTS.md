# agents

A repo meant to be forked by anyone who wants an easy way to manage their
skills, tools, AGENTS.md, etc, across their coding agents: Claude Code,
Cursor, and Codex. A small CLI installs everything on a machine or into a
project.

## How it is designed to be used

1. Fork the repo. `main` stays empty on purpose.
2. Branch off `main`, one branch per setup: a global one, one for work,
   one per project. One fork holds as many as you want.
3. Put your skills in `skills/` and your instructions in
   `instructions/AGENTS.md`, then push the branch.
4. Install the setup on a machine or into a project by running the CLI and
   naming the branch. It copies the branch into a store folder and symlinks
   each agent to the store, never copying into the agents.
5. To update, pull upstream into `main` and rebase the setup branches on it.

## Project layout

- `skills/`: your skills, one folder with a `SKILL.md` each.
- `instructions/AGENTS.md`: the instructions the CLI installs for each
  agent. Not the file you are reading now.
- `cli/`: the setup CLI. Plain Node, no dependencies, no build step. Keep
  it that way. Change it only on `main` or on a branch meant to merge into
  `main`, never from an agent setup branch.

## Changing the agents setup

Never touch anything in `.agents-store/`. When something there has to
change, tell me instead. Changes to the agents setup go into the
`agents-project` branch; then in `main` I run the setup, push it to `main`,
and finally rebase the branches.

## Adding or updating a skill

When I ask you to add or update a skill, follow `skills/add-skill/SKILL.md`.
