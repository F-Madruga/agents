---
name: add-skill
description: Add a skill to the agents repo. Always use it when adding skills.
---

# Add a skill to the agents repo

A skill is one folder under `skills/` with a `SKILL.md`. You can write your
own skill or copy a skill from someone else.

## Writing your own skill

Create `skills/<name>/SKILL.md` with `name` and `description` frontmatter,
each on a single line. The CLI reads frontmatter line by line.

The description must say when to use the skill, and use words like "must"
and "always" so the model actually uses it. If only you will ever invoke the
skill by typing its name, set `disable-model-invocation: true` instead. Its
description then stays out of the model's context.

## Copying a skill from someone else

When I pass you a link to a skill to copy, copy it into `skills/` and always
add a `SOURCE.md` next to its `SKILL.md`. If the skill comes from GitHub,
`SOURCE.md` must include a permalink pinned to the newest commit that
touches the skill's own folder, the license if one exists, and any changes
made.

Copy every file character for character: same formatting, same wording,
typos included. Copy anything the skill depends on, like scripts, reference
files, or other skills, the same way, each with its own `SOURCE.md`. Verify
by diffing every copied file against the source at the pinned commit; the
diff must be empty. If the skill has to change, copy it exactly first, then
change it in a separate step and list the change in `SOURCE.md`.

When updating a copied skill from its source, repeat all of the above at the
new pinned commit, license check included.
