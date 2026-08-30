Source: https://github.com/cursor/plugins/tree/46125561306434d8a1d7745d540d8932ab0cd2a2/pstack/skills/typescript-best-practices
License: MIT — Copyright (c) 2026 Lauren Tan (at the linked commit)
License text: https://github.com/cursor/plugins/blob/46125561306434d8a1d7745d540d8932ab0cd2a2/pstack/LICENSE

Not a verbatim copy. Copied exactly first, then changed.

Changes:
- Renamed from `typescript-best-practices` to `typescript-conventions`:
  folder, frontmatter `name`, and the `SKILL.md` heading.
- Rewrote the frontmatter `description` so the skill always applies to
  TypeScript work, not only when a `.ts` or `.tsx` file is open.
- `SKILL.md`: replaced the intro line about applying the
  `type-system-discipline` principle skill with a line saying a project's own
  stated conventions win over this skill where they overlap.
- `SKILL.md`: reworded the `Object args` row to ask for a single destructured
  object parameter, covering the function signature and not just the call site.
- `SKILL.md`: added a `No parameter mutation` row, with a matching section in
  the reference.
- Renamed `references/patterns.md` to `references/conventions.md`, retitled it
  to match, and updated the pointer at the end of `SKILL.md`.
- Reordered the reference sections to match the table, which meant swapping
  `Discriminated unions` and `Branded types`.
- `Object args` section: added a lead-in sentence and a `createUser` example
  showing the destructured signature, before the existing call-site example.
- Dropped every mention of the `type-system-discipline` and
  `boundary-discipline` principle skills, which live in the same plugin but
  are not copied here: the trailing pointer on the `Boundary validation` row
  and section, and the reference's opening line.
