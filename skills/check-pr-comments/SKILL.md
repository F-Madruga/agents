---
name: check-pr-comments
description: List every comment on a pull request, numbered, and say whether the current changes address each one.
disable-model-invocation: true
---

# Check PR comments

Two steps, in order. Finish step 1 before starting step 2.

Always fetch. Never build the list from what was said earlier in this
conversation, even if you fetched the same PR a minute ago. Comments and
commits change. Every run starts with the fetch.

## Step 1: fetch and number every comment

Find the PR first. If the user named one, use it. If not, list the open ones
and ask which:

```sh
gh pr list --json number,title,author,headRefName --limit 30
```

Show the number, title and author for each, and mark the one built from the
branch you're on. Then ask which to use and wait for the answer. Don't pick for
them, not even when only one is open. If nothing is open, say so and stop.

Once you have the number, `gh repo view --json nameWithOwner` gives you the
owner and repo.

Comments live in three places, so make three calls:

```sh
gh api repos/{owner}/{repo}/issues/{number}/comments --paginate
gh api repos/{owner}/{repo}/pulls/{number}/reviews --paginate
gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate
```

The first is the conversation at the bottom of the PR. The second is the note
someone writes when they approve or request changes; skip the ones with an
empty body, GitHub shows nothing for those. The third is the comments on lines
of code, replies included.

Put them in the order GitHub shows them:

- Sort the top level by time. Use `created_at` for a conversation comment,
  `submitted_at` for a review, and the `created_at` of the first comment for a
  thread on a line of code.
- A reply has `in_reply_to_id` set to the id of the first comment in its
  thread. Nest replies under that comment, oldest first.
- Number the top level 1, 2, 3. Number the replies 1.1, 1.2, 1.3 in that same
  order.

For each one keep the text, the author, the date, the file and line if it has
one, and the `html_url`. That last one is the link straight to the comment on
GitHub, and every kind of comment has it, replies included. Quote the text,
don't summarise it.

## Step 2: check each comment against the code as it stands now

Work out whether the PR today does what each comment asked for. Every comment
on the list gets an answer. The checks don't depend on each other, so how you
run them and in what order is up to you. Only the list you hand back has to
follow the numbering from step 1.

Read the current code, not the code the comment was written against:

```sh
gh pr diff {number}
gh pr view {number} --json commits
git log --oneline origin/main..HEAD
```

For a comment on a line of code, open that file at the line it points at now
and read it. A review comment with `position: null` sits on a line that has
changed since it was written. That tells you someone touched the line, not
that they fixed it.

Give every comment one of four labels:

- `[addressed]` the change it asked for is in the code now.
- `[partly addressed]` some of what it asked for is in, some isn't.
- `[not addressed]` nothing in the current changes deals with it.
- `[no action needed]` praise, a question already answered, or anything that
  never asked for a change.

Anything you label addressed or partly addressed needs the commit that did it.
`git log --oneline -- <file>` narrows it down, and `git log -p -S'<text from
the fix>'` finds the commit that introduced a specific line. When that commit
is large or spans a lot of files, name the file and line that matter too, so
the reader doesn't have to read the whole thing. Add one short sentence saying
what the fix does.

For partly addressed, say what is in and what is still missing. Be concrete
about both.

If something looks done but you can't find the commit, say that. Don't guess a
hash.

## What the list looks like

Use this shape every time:

```
PR #482 in acme/web, 7 comments.

1. "This should sit behind the same feature flag as the sidebar."
   @alice, conversation, Aug 19
   https://github.com/acme/web/pull/482#issuecomment-2080158371
   [addressed] Commit 3f9a1c2. The panel checks flags.newSidebar before it
   renders.

2. "findUser throws when the list is empty. Guard it."
   @bob, src/api/users.ts:88
   https://github.com/acme/web/pull/482#discussion_r2205855589
   [not addressed] src/api/users.ts:88 still reads rows[0].id with no check.

   2.1 "Good catch, I'll add a guard."
       @alice, reply
       https://github.com/acme/web/pull/482#discussion_r2205861318
       [not addressed] Nothing in the current changes adds one.

   2.2 "Worth a test for the empty case too."
       @bob, reply
       https://github.com/acme/web/pull/482#discussion_r2205863004
       [not addressed] No test covers the empty case.

3. "Rename this to fetchRows and add a test for it."
   @carol, src/db/query.ts:14
   https://github.com/acme/web/pull/482#discussion_r2205870112
   [partly addressed] Commit 8b2e440.
   Done: renamed to fetchRows, src/db/query.ts:14.
   Not done: no test covers it.

4. "Drop the retry here, the caller already retries."
   @bob, src/panel.tsx:120
   https://github.com/acme/web/pull/482#discussion_r2205881946
   [addressed] Commit c71d05e, a 14 file refactor. The part that matters is
   src/panel.tsx:118, where the retry loop is gone.

5. "Nice cleanup on the error handling."
   @dave, conversation, Aug 20
   https://github.com/acme/web/pull/482#issuecomment-2080311502
   [no action needed]

Left to do: 3 not addressed, 1 partly addressed.
```

Hand back the list. No summary paragraph in front of it.
