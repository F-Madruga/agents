import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STORE_DIR_NAME, STORE_CONFIG_FILE, PROJECT_STORE_DIR_NAME } from './constants.mjs';

// The store is a flat folder holding the installed copies of skills and
// AGENTS.md. Agent symlinks point here (never at the repo or the npx cache),
// and manual edits here are allowed — sync asks before replacing them.

export function defaultStorePath(env = process.env, home = os.homedir()) {
  const base = env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(base, STORE_DIR_NAME);
}

// Project installs keep their store inside the project. It holds machine-local
// copies and the symlinks pointing at it are absolute, so it belongs in
// .gitignore rather than in the repo.
export function projectStorePath(projectRoot) {
  return path.join(projectRoot, PROJECT_STORE_DIR_NAME);
}

// The pointer to a custom store location always lives at the DEFAULT
// location, so it can be found again without knowing the custom path.
const configFile = (env, home) => path.join(defaultStorePath(env, home), STORE_CONFIG_FILE);

export function readSavedStorePath(env = process.env, home = os.homedir()) {
  try {
    return JSON.parse(fs.readFileSync(configFile(env, home), 'utf8')).store || null;
  } catch {
    return null;
  }
}

export function saveStorePath(storePath, env = process.env, home = os.homedir()) {
  const file = configFile(env, home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ store: storePath }, null, 2) + '\n');
}

// Skill folder names currently in the store, i.e. what's already installed.
// Only folders holding a SKILL.md count: anything else under the path may
// belong to another program and is not ours to touch.
export function listInstalledSkills(storeDir) {
  try {
    return fs
      .readdirSync(path.join(storeDir, 'skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => fs.existsSync(path.join(storeDir, 'skills', entry.name, 'SKILL.md')))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

export function treesEqual(a, b) {
  const sa = fs.statSync(a, { throwIfNoEntry: false });
  const sb = fs.statSync(b, { throwIfNoEntry: false });
  if (!sa || !sb || sa.isDirectory() !== sb.isDirectory()) return false;
  if (!sa.isDirectory()) return fs.readFileSync(a).equals(fs.readFileSync(b));
  const ea = fs.readdirSync(a).sort();
  const eb = fs.readdirSync(b).sort();
  if (ea.length !== eb.length || ea.some((name, i) => name !== eb[i])) return false;
  return ea.every((name) => treesEqual(path.join(a, name), path.join(b, name)));
}

function copyInto(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.statSync(source).isDirectory()) fs.cpSync(source, target, { recursive: true });
  else fs.copyFileSync(source, target);
}

// Returns 'added' | 'same' | 'updated' | 'kept'. 'kept' means the store copy
// differs (e.g. manual edits) and the conflict was not approved.
export async function syncItem(source, target, { resolveConflict } = {}) {
  if (!fs.existsSync(target)) {
    copyInto(source, target);
    return 'added';
  }
  if (treesEqual(source, target)) return 'same';
  const overwrite = resolveConflict ? await resolveConflict(target) : false;
  if (!overwrite) return 'kept';
  fs.rmSync(target, { recursive: true, force: true });
  copyInto(source, target);
  return 'updated';
}
