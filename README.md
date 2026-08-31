# agents

A repo you fork to keep your agent setup in one place. The CLI puts your skills
and instructions where each agent expects to find them.

`main` is empty on purpose. Setups live on branches, so one fork holds as many
as you want.

Supports:

- Claude Code
- Cursor
- Codex

## Getting started

1. Fork this repo and clone your fork.
2. Leave `main` empty and branch off it. That way you can have multiple setups
   (one for projects, one global, one personal, another for work, whatever you
   want), and updating is a pull into `main` plus a rebase.

   ```sh
   git checkout -b <setup-name>
   ```

   ```sh
   git checkout -b personal-global
   ```

3. Put your own skills in `skills/`, one folder with a `SKILL.md` each. You can
   write them yourself, or ask your own agent to add one by describing what you
   want or giving it a link to a skill you like.
4. Write your own `instructions/AGENTS.md`.
5. Push the branch.
6. Install it on any machine by naming the branch after `#`:

   ```sh
   npx github:<your-username>/<your-fork>#<setup-name>
   ```

My own setup (don't judge, pls <3) lives on a branch like this, and you can use
it by running:

```sh
npx github:F-Madruga/agents#personal-global
```

The setup for working on this repo lives on a branch like that too, with a
script in `package.json` that installs it:

```sh
npm run agent-setup
```

The CLI reads whatever is in your fork, so you don't have to touch `cli/`.

## What the CLI does

AI wrote the entire CLI. I never read the code, only checked that it behaves
as described here. Use it at your own risk.

It copies everything into one folder and links each agent to it, so editing a
skill in that folder updates it everywhere. It asks:

1. Whether to set up for the whole machine or just the current project
2. Where to keep the shared copy that everything links to. Global installs
   default to `~/.config/agents` and remember your answer; project installs
   default to `.agents-store/` inside the project, which you'll want to
   gitignore.
3. Whether to delete a setup that's already there. If the folder holds
   skills this one doesn't include, the CLI asks to delete that setup and
   its links before installing. Folders without a SKILL.md may belong to
   another program, so it leaves them alone.
4. Which skills to set up. Whatever is already in that folder starts checked.
   Uncheck one and the CLI deletes it from the folder and removes its links,
   after asking. Flags only add: `--skills=` never deletes.
5. Whether to also set up the AGENTS.md
6. Which agents to set them up for
7. If anything already in that folder no longer matches the repo character for
   character, which of those to update. All are checked.

Run it again anytime. It skips what's already in place and cleans up links left
behind by removed skills. It never overwrites a file you changed by hand without
asking first.

Answer every question up front with flags instead. Run
`npx github:F-Madruga/agents --help` to see them.

## License

MIT, except the skills I copied from other people's repos; those keep their
original license. Each one has a `SOURCE.md` in its folder saying where it came
from and under which license. Use at your own risk.
