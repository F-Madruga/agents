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

// Returns [{ kind, method, source, target, label }]. Targets shared between
// agents (e.g. project AGENTS.md for Cursor + Codex) are deduped.
export function planInstall({ skills, agentIds, scope, method, includeInstructions, repoRoot, projectRoot, home }) {
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
        method,
        source: skill.path,
        target,
        label: `${skill.dirName} → ${agent.label}`,
      });
    }
    if (includeInstructions && !seen.has(targets.instructionsFile)) {
      seen.add(targets.instructionsFile);
      actions.push({
        kind: 'instructions',
        method,
        source: path.join(repoRoot, 'instructions', 'AGENTS.md'),
        target: targets.instructionsFile,
        label: `${path.basename(targets.instructionsFile)} → ${agent.label}`,
      });
    }
  }
  return actions;
}

// Returns 'already' | 'skipped' | 'linked' | 'copied'.
export async function applyAction(action, { resolveConflict } = {}) {
  const source = path.resolve(action.source);
  const { target, method } = action;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let existing;
  try {
    existing = fs.lstatSync(target);
  } catch {}
  if (existing) {
    if (existing.isSymbolicLink() && method === 'symlink') {
      const current = path.resolve(path.dirname(target), fs.readlinkSync(target));
      if (current === source) return 'already';
    }
    const overwrite = resolveConflict ? await resolveConflict(action) : false;
    if (!overwrite) return 'skipped';
    fs.rmSync(target, { recursive: true, force: true });
  }
  if (method === 'symlink') {
    fs.symlinkSync(source, target, fs.statSync(source).isDirectory() ? 'dir' : 'file');
    return 'linked';
  }
  if (fs.statSync(source).isDirectory()) {
    fs.cpSync(source, target, { recursive: true });
  } else {
    fs.copyFileSync(source, target);
  }
  return 'copied';
}

// Symlinks in the selected agents' target dirs that point into this repo but
// no longer resolve (e.g. a skill moved between group folders).
export function findBrokenLinks({ agentIds, scope, home, projectRoot, repoRoot }) {
  const broken = new Map();
  const root = path.resolve(repoRoot);
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
      if (dest.startsWith(root + path.sep) && !fs.existsSync(dest)) {
        broken.set(candidate, { link: candidate, dest });
      }
    }
  }
  return [...broken.values()];
}
