# agents

My skills and my personal `AGENTS.md`, shared between the coding agents I use:
Claude Code, Cursor, and Codex. The CLI in this repo sets everything up for me.

## Usage

```sh
npx github:F-Madruga/agents
```

or clone it and:

```sh
node cli/index.mjs
```

It asks:

1. Whether to set up for the whole machine or just the current project
2. Where to keep the shared copy that everything links to. Global installs
   default to `~/.config/agents` and remember your answer; project installs
   default to `.agents-store/` inside the project, which you'll want to
   gitignore.
3. Which skills to set up
4. Whether to also set up my AGENTS.md
5. Which agents to set them up for

Each agent gets links to that shared folder, so updating a skill there updates
it everywhere. This works the same whether you cloned this repo or ran it with
npx. You can edit the files in that folder by hand; the CLI asks before
replacing anything you changed, and it never overwrites an existing file
without asking. Run it again anytime. It skips what's already in place and
cleans up links left behind by removed skills.

You can also answer every question up front with a flag. Run
`node cli/index.mjs --help` to see them.

## License

MIT, except the skills I copied from other people's repos; those keep their
original license. Each one has a `SOURCE.md` in its folder saying where it
came from and under which license. Use at your own risk.
