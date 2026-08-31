import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveTargets, planInstall, applyAction, findBrokenLinks, findLinksTo, removeStoreSkill, removeStoreSetup } from './install.mjs';

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

test('planInstall dedupes the shared project AGENTS.md and sources from the store', () => {
  const actions = planInstall({
    skills: [{ dirName: 'tdd', path: '/repo/skills/tdd' }],
    agentIds: ['cursor', 'codex'],
    scope: 'project',
    includeInstructions: true,
    storeDir: '/home/u/.config/agents',
    projectRoot: '/proj',
    home: '/home/u',
  });
  const instructions = actions.filter((a) => a.kind === 'instructions');
  assert.equal(instructions.length, 1);
  assert.equal(instructions[0].target, '/proj/AGENTS.md');
  assert.equal(instructions[0].source, '/home/u/.config/agents/AGENTS.md');
  assert.equal(actions.filter((a) => a.kind === 'skill')[0].source, '/home/u/.config/agents/skills/tdd');
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
  const action = { source, target };

  assert.equal(await applyAction(action), 'linked');
  // The link is relative to its own directory, and resolves back to the source.
  const link = fs.readlinkSync(target);
  assert.ok(!path.isAbsolute(link), `expected a relative link, got ${link}`);
  assert.equal(path.resolve(path.dirname(target), link), source);
  assert.equal(await applyAction(action), 'already');

  // A stale absolute link resolving to our source is migrated to relative.
  fs.rmSync(target);
  fs.symlinkSync(source, target, 'dir');
  assert.equal(await applyAction(action), 'linked');
  const migrated = fs.readlinkSync(target);
  assert.ok(!path.isAbsolute(migrated), `expected a relative link, got ${migrated}`);
  assert.equal(path.resolve(path.dirname(target), migrated), source);

  // Foreign file at target: skipped without consent, replaced with it.
  fs.rmSync(target);
  fs.mkdirSync(target);
  assert.equal(await applyAction(action), 'skipped');
  assert.equal(await applyAction(action, { resolveConflict: async () => true }), 'linked');
  assert.equal(path.resolve(path.dirname(target), fs.readlinkSync(target)), source);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findBrokenLinks flags dead links into our roots, ignores foreign ones', () => {
  const root = tmp();
  const storeDir = path.join(root, 'store');
  const repoRoot = path.join(root, 'repo');
  const projectRoot = path.join(root, 'proj');
  const skillsDir = path.join(projectRoot, '.claude', 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });

  const alive = path.join(storeDir, 'skills', 'alive');
  fs.mkdirSync(alive, { recursive: true });
  fs.symlinkSync(alive, path.join(skillsDir, 'alive'));
  // Dead link into the store (skill removed from it).
  fs.symlinkSync(path.join(storeDir, 'skills', 'gone'), path.join(skillsDir, 'gone'));
  // Dead link into the repo (old repo-pointing scheme).
  fs.symlinkSync(path.join(repoRoot, 'skills', 'old'), path.join(skillsDir, 'old'));
  // Dead link NOT into store or repo — someone else's, leave it alone.
  fs.symlinkSync(path.join(root, 'elsewhere', 'gone'), path.join(skillsDir, 'foreign'));

  const broken = findBrokenLinks({ agentIds: ['claude'], scope: 'project', home: root, projectRoot, roots: [storeDir, repoRoot] });
  assert.deepEqual(broken.map((b) => path.basename(b.link)).sort(), ['gone', 'old']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('removeStoreSkill deletes the store copy and every link to it, across agents', () => {
  const root = tmp();
  const storeDir = path.join(root, 'store');
  const projectRoot = path.join(root, 'proj');
  const skill = path.join(storeDir, 'skills', 'unslop');
  const keep = path.join(storeDir, 'skills', 'grilling');
  fs.mkdirSync(skill, { recursive: true });
  fs.mkdirSync(keep, { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), 'x');

  // Same skill linked from two agents, plus an unrelated link that must survive.
  const claudeDir = path.join(projectRoot, '.claude', 'skills');
  const codexDir = path.join(projectRoot, '.agents', 'skills');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(codexDir, { recursive: true });
  fs.symlinkSync(skill, path.join(claudeDir, 'unslop'));
  fs.symlinkSync(skill, path.join(codexDir, 'unslop'));
  fs.symlinkSync(keep, path.join(claudeDir, 'grilling'));

  const env = { storeDir, scope: 'project', home: root, projectRoot };
  assert.equal(findLinksTo(skill, env).length, 2);

  const removed = removeStoreSkill('unslop', env);
  assert.deepEqual(removed.map((l) => path.basename(path.dirname(path.dirname(l)))).sort(), ['.agents', '.claude']);
  assert.equal(fs.existsSync(skill), false);
  assert.equal(fs.existsSync(path.join(claudeDir, 'unslop')), false);
  assert.equal(fs.existsSync(path.join(codexDir, 'unslop')), false);
  assert.equal(fs.existsSync(path.join(claudeDir, 'grilling')), true);
  assert.equal(fs.existsSync(keep), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('removeStoreSetup deletes store skills, AGENTS.md, and every link into the store', () => {
  const root = tmp();
  const home = path.join(root, 'home');
  const projectRoot = path.join(root, 'proj');
  const storeDir = path.join(projectRoot, '.agents-store');

  fs.mkdirSync(path.join(storeDir, 'skills', 'old-skill'), { recursive: true });
  fs.writeFileSync(path.join(storeDir, 'skills', 'old-skill', 'SKILL.md'), 'x');
  fs.writeFileSync(path.join(storeDir, 'AGENTS.md'), 'y');
  fs.writeFileSync(path.join(storeDir, 'config.json'), '{}');

  const skillLink = path.join(projectRoot, '.claude', 'skills', 'old-skill');
  fs.mkdirSync(path.dirname(skillLink), { recursive: true });
  fs.symlinkSync(path.join(storeDir, 'skills', 'old-skill'), skillLink, 'dir');
  const instructionsLink = path.join(projectRoot, 'CLAUDE.md');
  fs.symlinkSync(path.join(storeDir, 'AGENTS.md'), instructionsLink, 'file');
  const unrelatedLink = path.join(projectRoot, '.cursor', 'skills', 'elsewhere');
  fs.mkdirSync(path.dirname(unrelatedLink), { recursive: true });
  fs.symlinkSync(path.join(root, 'somewhere-else'), unrelatedLink, 'dir');
  // Another program's folder in skills/: no SKILL.md, so not ours to delete.
  const foreignDir = path.join(storeDir, 'skills', 'other-programs-folder');
  fs.mkdirSync(foreignDir, { recursive: true });
  fs.writeFileSync(path.join(foreignDir, 'data.txt'), 'z');

  const removed = removeStoreSetup(storeDir, { scope: 'project', home, projectRoot });

  assert.deepEqual(removed.sort(), [instructionsLink, skillLink].sort());
  assert.equal(fs.existsSync(path.join(storeDir, 'skills', 'old-skill')), false);
  assert.equal(fs.existsSync(path.join(foreignDir, 'data.txt')), true);
  assert.equal(fs.existsSync(path.join(storeDir, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(storeDir, 'config.json')), true);
  assert.equal(fs.lstatSync(unrelatedLink).isSymbolicLink(), true);
  assert.equal(fs.existsSync(skillLink), false);
  assert.equal(fs.existsSync(instructionsLink), false);
});
