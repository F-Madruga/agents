import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveTargets, planInstall, applyAction, findBrokenLinks } from './install.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agents-install-'));

test('resolveTargets maps agent/scope to the right paths', () => {
  const env = { home: '/home/u', projectRoot: '/proj' };
  assert.deepEqual(resolveTargets('claude', 'project', env), {
    skillsDir: '/proj/.claude/skills',
    instructionsFile: '/proj/CLAUDE.md',
  });
  assert.deepEqual(resolveTargets('claude', 'global', env), {
    skillsDir: '/home/u/.claude/skills',
    instructionsFile: '/home/u/.claude/CLAUDE.md',
  });
  assert.deepEqual(resolveTargets('codex', 'project', env), {
    skillsDir: '/proj/.agents/skills',
    instructionsFile: '/proj/AGENTS.md',
  });
  assert.deepEqual(resolveTargets('cursor', 'global', env), {
    skillsDir: '/home/u/.cursor/skills',
    instructionsFile: '/home/u/.cursor/AGENTS.md',
  });
});

test('planInstall dedupes the shared project AGENTS.md for cursor+codex', () => {
  const actions = planInstall({
    skills: [{ dirName: 'tdd', path: '/repo/skills/active/tdd' }],
    agentIds: ['cursor', 'codex'],
    scope: 'project',
    method: 'symlink',
    includeInstructions: true,
    repoRoot: '/repo',
    projectRoot: '/proj',
    home: '/home/u',
  });
  const instructions = actions.filter((a) => a.kind === 'instructions');
  assert.equal(instructions.length, 1);
  assert.equal(instructions[0].target, '/proj/AGENTS.md');
  assert.equal(instructions[0].source, '/repo/instructions/AGENTS.md');
  const skills = actions.filter((a) => a.kind === 'skill');
  assert.deepEqual(
    skills.map((a) => a.target),
    ['/proj/.cursor/skills/tdd', '/proj/.agents/skills/tdd'],
  );
});

test('applyAction symlinks, detects already-installed, and respects conflicts', async () => {
  const root = tmp();
  const source = path.join(root, 'repo', 'skill');
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'SKILL.md'), 'x');
  const target = path.join(root, 'proj', '.claude', 'skills', 'skill');
  const action = { method: 'symlink', source, target };

  assert.equal(await applyAction(action), 'linked');
  assert.equal(fs.readlinkSync(target), source);
  assert.equal(await applyAction(action), 'already');

  // Foreign file at target: skipped without consent, replaced with it.
  fs.rmSync(target);
  fs.mkdirSync(target);
  assert.equal(await applyAction(action), 'skipped');
  assert.equal(await applyAction(action, { resolveConflict: async () => true }), 'linked');
  assert.equal(fs.readlinkSync(target), source);
  fs.rmSync(root, { recursive: true, force: true });
});

test('applyAction copies directories and files', async () => {
  const root = tmp();
  const dirSource = path.join(root, 'repo', 'skill');
  fs.mkdirSync(dirSource, { recursive: true });
  fs.writeFileSync(path.join(dirSource, 'SKILL.md'), 'content');
  const dirTarget = path.join(root, 'out', 'skill');
  assert.equal(await applyAction({ method: 'copy', source: dirSource, target: dirTarget }), 'copied');
  assert.equal(fs.readFileSync(path.join(dirTarget, 'SKILL.md'), 'utf8'), 'content');
  assert.ok(!fs.lstatSync(dirTarget).isSymbolicLink());

  const fileSource = path.join(root, 'repo', 'AGENTS.md');
  fs.writeFileSync(fileSource, 'instructions');
  const fileTarget = path.join(root, 'out', 'CLAUDE.md');
  assert.equal(await applyAction({ method: 'copy', source: fileSource, target: fileTarget }), 'copied');
  assert.equal(fs.readFileSync(fileTarget, 'utf8'), 'instructions');
  fs.rmSync(root, { recursive: true, force: true });
});

test('findBrokenLinks flags dead links into the repo, ignores foreign ones', () => {
  const root = tmp();
  const repoRoot = path.join(root, 'repo');
  const projectRoot = path.join(root, 'proj');
  const skillsDir = path.join(projectRoot, '.claude', 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });

  const alive = path.join(repoRoot, 'skills', 'active', 'alive');
  fs.mkdirSync(alive, { recursive: true });
  fs.symlinkSync(alive, path.join(skillsDir, 'alive'));
  // Dead link into the repo (skill moved between group folders).
  fs.symlinkSync(path.join(repoRoot, 'skills', 'experimenting', 'gone'), path.join(skillsDir, 'gone'));
  // Dead link NOT into the repo — someone else's, leave it alone.
  fs.symlinkSync(path.join(root, 'elsewhere', 'gone'), path.join(skillsDir, 'foreign'));

  const broken = findBrokenLinks({ agentIds: ['claude'], scope: 'project', home: root, projectRoot, repoRoot });
  assert.deepEqual(
    broken.map((b) => path.basename(b.link)),
    ['gone'],
  );
  fs.rmSync(root, { recursive: true, force: true });
});
