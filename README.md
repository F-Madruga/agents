# agents

My skills and my personal AGENTS.md, shared between the coding agents I use
(Claude Code, Cursor, Codex). The CLI in this repo sets everything up for me.

## Usage

```sh
npx github:F-Madruga/agents
```

or clone it and:

```sh
node cli/index.mjs
```

It asks:

1. Which skills to set up
2. Whether to also set up my AGENTS.md
3. Which agents to set them up for
4. Whether to set up for the whole machine or just the current project
5. Whether to link the files (one shared copy, updated in one place) or copy
   them (independent files that stay as they are)
6. Where to keep that shared copy (default `~/.config/agents`, remembered for
   next time)

Everything is installed from that shared folder, so it works the same whether
you cloned this repo or ran it with npx. You can edit the files there by hand;
the CLI asks before replacing anything you changed, and never overwrites any
existing file without asking. Run it again anytime; it skips what's already in
place and cleans up links left behind by removed skills.

Every question can also be answered up front with a flag — see:

```sh
node cli/index.mjs --help
```

## License

MIT, except some skills that were copied from other people's repos and keep
their original license. Each of those has a `SOURCE.md` in its folder saying
where it came from and under which license. Use at your own risk.
