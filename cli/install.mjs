import fs from 'node:fs';
import path from 'node:path';

export const AGENTS = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'codex', label: 'Codex' },
];

// Claude Code has no AGENTS.md support, so its instructions target is named
// CLAUDE.md; in symlink mode it points at the same instructions/AGENTS.md.
const PATHS = {
  claude: {
    project: { skillsDir: '.claude/skills', instructionsFile: 'CLAUDE.md' },
    global: { skillsDir: '.claude/skills', instructionsFile: '.claude/CLAUDE.md' },
  },
  cursor: {
    project: { skillsDir: '.cursor/skills', instructionsFile: 'AGENTS.md' },
    global: { skillsDir: '.cursor/skills', instructionsFile: '.cursor/AGENTS.md' },
  },
  codex: {
    project: { skillsDir: '.agents/skills', instructionsFile: 'AGENTS.md' },
    global: { skillsDir: '.codex/skills', instructionsFile: '.codex/AGENTS.md' },
  },
};

export function resolveTargets(agentId, scope, { home, projectRoot }) {
  const base = scope === 'global' ? home : projectRoot;
  const t = PATHS[agentId][scope];
  return {
    skillsDir: path.join(base, t.skillsDir),
    instructionsFile: path.join(base, t.instructionsFile),
  };
}

// Returns [{ kind, source, target, label }]. Sources point into the store,
// never at the repo. Targets shared between agents (e.g. project AGENTS.md
// for Cursor + Codex) are deduped.
export function planInstall({ skills, agentIds, scope, includeInstructions, storeDir, projectRoot, home }) {
  const actions = [];
  const seen = new Set();
  for (const agentId of agentIds) {
    const agent = AGENTS.find((a) => a.id === agentId);
    const targets = resolveTargets(agentId, scope, { home, projectRoot });
    for (const skill of skills) {
      const target = path.join(targets.skillsDir, skill.dirName);
      if (seen.has(target)) continue;
      seen.add(target);
      actions.push({
        kind: 'skill',
        source: path.join(storeDir, 'skills', skill.dirName),
        target,
        label: `${skill.dirName} → ${agent.label}`,
      });
    }
    if (includeInstructions && !seen.has(targets.instructionsFile)) {
      seen.add(targets.instructionsFile);
      actions.push({
        kind: 'instructions',
        source: path.join(storeDir, 'AGENTS.md'),
        target: targets.instructionsFile,
        label: `${path.basename(targets.instructionsFile)} → ${agent.label}`,
      });
    }
  }
  return actions;
}

// Returns 'already' | 'skipped' | 'linked'. A stale absolute link that still
// resolves to our source is migrated to relative and reported as 'linked'.
export async function applyAction(action, { resolveConflict } = {}) {
  const source = path.resolve(action.source);
  const { target } = action;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // The link is written relative to its own directory so a committed project
  // setup stays valid after a clone or a move.
  const linkTarget = path.relative(path.dirname(target), source);
  let existing;
  try {
    existing = fs.lstatSync(target);
  } catch {}
  if (existing) {
    if (existing.isSymbolicLink()) {
      const stored = fs.readlinkSync(target);
      if (stored === linkTarget) return 'already';
      // Our own link, resolving to the same source but stored differently
      // (e.g. an old absolute link): migrate it to the relative form in place,
      // no conflict prompt. Re-running the setup then heals stale links.
      if (path.resolve(path.dirname(target), stored) === source) {
        fs.rmSync(target);
        fs.symlinkSync(linkTarget, target, fs.statSync(source).isDirectory() ? 'dir' : 'file');
        return 'linked';
      }
    }
    const overwrite = resolveConflict ? await resolveConflict(action) : false;
    if (!overwrite) return 'skipped';
    fs.rmSync(target, { recursive: true, force: true });
  }
  fs.symlinkSync(linkTarget, target, fs.statSync(source).isDirectory() ? 'dir' : 'file');
  return 'linked';
}

// Symlinks in any agent's skills dir at this scope that point at `dest`,
// whether or not `dest` still exists. Used to pull a skill back out.
export function findLinksTo(dest, { scope, home, projectRoot }) {
  const resolved = path.resolve(dest);
  const found = new Set();
  for (const agent of AGENTS) {
    const { skillsDir } = resolveTargets(agent.id, scope, { home, projectRoot });
    let entries;
    try {
      entries = fs.readdirSync(skillsDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const link = path.join(skillsDir, entry);
      let stat;
      try {
        stat = fs.lstatSync(link);
      } catch {
        continue;
      }
      if (!stat.isSymbolicLink()) continue;
      if (path.resolve(path.dirname(link), fs.readlinkSync(link)) === resolved) found.add(link);
    }
  }
  return [...found];
}

// Deletes a skill's store copy and every symlink pointing at it, across all
// agents at this scope (not just the selected ones: once the store copy is
// gone, any link to it is dead). Returns the links removed.
export function removeStoreSkill(dirName, { storeDir, scope, home, projectRoot }) {
  const storePath = path.join(storeDir, 'skills', dirName);
  const links = findLinksTo(storePath, { scope, home, projectRoot });
  for (const link of links) fs.rmSync(link, { force: true });
  fs.rmSync(storePath, { recursive: true, force: true });
  return links;
}

// Symlinks in the selected agents' target dirs that point into one of ours
// (store or repo) but no longer resolve (e.g. a removed skill, or links from
// the old repo-pointing scheme).
export function findBrokenLinks({ agentIds, scope, home, projectRoot, roots }) {
  const broken = new Map();
  const resolvedRoots = roots.map((r) => path.resolve(r));
  for (const agentId of agentIds) {
    const targets = resolveTargets(agentId, scope, { home, projectRoot });
    const candidates = [targets.instructionsFile];
    try {
      for (const entry of fs.readdirSync(targets.skillsDir)) {
        candidates.push(path.join(targets.skillsDir, entry));
      }
    } catch {}
    for (const candidate of candidates) {
      let stat;
      try {
        stat = fs.lstatSync(candidate);
      } catch {
        continue;
      }
      if (!stat.isSymbolicLink()) continue;
      const dest = path.resolve(path.dirname(candidate), fs.readlinkSync(candidate));
      if (resolvedRoots.some((r) => dest.startsWith(r + path.sep)) && !fs.existsSync(dest)) {
        broken.set(candidate, { link: candidate, dest });
      }
    }
  }
  return [...broken.values()];
}

// Deletes the whole installed setup at this scope: every symlink into the
// store across all agents, then the store's skill folders and AGENTS.md.
// Only folders holding a SKILL.md are deleted; anything else in the store
// (e.g. config.json, or another program's files) stays. Returns the links
// removed.
export function removeStoreSetup(storeDir, { scope, home, projectRoot }) {
  const links = findSetupLinks(storeDir, { scope, home, projectRoot });
  for (const link of links) fs.rmSync(link, { force: true });
  const storeSkillsDir = path.join(storeDir, 'skills');
  let entries = [];
  try {
    entries = fs.readdirSync(storeSkillsDir);
  } catch {}
  for (const entry of entries) {
    if (fs.existsSync(path.join(storeSkillsDir, entry, 'SKILL.md'))) {
      fs.rmSync(path.join(storeSkillsDir, entry), { recursive: true, force: true });
    }
  }
  if (fs.existsSync(storeSkillsDir) && fs.readdirSync(storeSkillsDir).length === 0) fs.rmdirSync(storeSkillsDir);
  fs.rmSync(path.join(storeDir, 'AGENTS.md'), { force: true });
  return links;
}

// Symlinks in any agent's dirs at this scope that resolve into the store:
// every skill link plus the instructions link.
export function findSetupLinks(storeDir, { scope, home, projectRoot }) {
  const resolvedStore = path.resolve(storeDir);
  const pointsIntoStore = (link) => {
    let stat;
    try {
      stat = fs.lstatSync(link);
    } catch {
      return false;
    }
    if (!stat.isSymbolicLink()) return false;
    const dest = path.resolve(path.dirname(link), fs.readlinkSync(link));
    return dest.startsWith(resolvedStore + path.sep);
  };
  const found = new Set();
  for (const agent of AGENTS) {
    const targets = resolveTargets(agent.id, scope, { home, projectRoot });
    let entries = [];
    try {
      entries = fs.readdirSync(targets.skillsDir);
    } catch {}
    for (const entry of entries) {
      const link = path.join(targets.skillsDir, entry);
      if (pointsIntoStore(link)) found.add(link);
    }
    if (pointsIntoStore(targets.instructionsFile)) found.add(targets.instructionsFile);
  }
  return [...found];
}
