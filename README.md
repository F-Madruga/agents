# agents

A repo you fork to build your own agent setup. Keep your skills and instructions
here, and the CLI installs them into each coding agent, in the folder and file
name that agent expects.

What's in it now is my setup: the skills I use. Take them or throw them out.

Supports:

- Claude Code
- Cursor
- Codex

## Create your own setup

1. Fork this repo and clone your fork.
2. Put your own skills in `skills/`, one folder with a `SKILL.md` each. You can
   write them yourself, or ask your own agent to add one by describing what you
   want or giving it a link to a skill you like.
3. Write your own `instructions/AGENTS.md`.
4. Push, then install your setup on any machine:

   ```sh
   npx github:<your-username>/<your-fork>
   ```

The CLI reads whatever is in your fork, so you don't have to touch `cli/`.

## Create multiple setups

Each branch is a setup of its own. Keep a work one apart from a personal one
without a second fork.

1. From your fork, branch off:

   ```sh
   git checkout -b work
   ```

2. Add the skills and `instructions/AGENTS.md` you want for it.
3. Push the branch, then install it by naming the branch after `#`:

   ```sh
   npx github:<your-username>/<your-fork>#work
   ```

My own setup is one of these, and if you want you can use it by running:

```sh
npx github:F-Madruga/agents#personal-global
```

## What the CLI does

It copies everything into one folder and links each agent to it, so editing a
skill in that folder updates it everywhere. It asks:

1. Whether to set up for the whole machine or just the current project
2. Where to keep the shared copy that everything links to. Global installs
   default to `~/.config/agents` and remember your answer; project installs
   default to `.agents-store/` inside the project, which you'll want to
   gitignore.
3. Which skills to set up. Whatever is already in that folder starts checked.
   Uncheck one and the CLI deletes it from the folder and removes its links,
   after asking. Flags only add: `--skills=` never deletes.
4. Whether to also set up the AGENTS.md
5. Which agents to set them up for
6. If anything already in that folder no longer matches the repo character for
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
