import fs from 'node:fs';
import path from 'node:path';
import { GROUPS } from './constants.mjs';

export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  if (!match) return out;
  for (const line of match[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

// Returns [{ name, dirName, description, group, path }] across the 3 group folders.
export function loadSkills(repoRoot) {
  const skills = [];
  for (const group of GROUPS) {
    const groupDir = path.join(repoRoot, 'skills', group.dir);
    let entries;
    try {
      entries = fs.readdirSync(groupDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(groupDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;
      const fm = parseFrontmatter(fs.readFileSync(skillFile, 'utf8'));
      skills.push({
        name: fm.name || entry.name,
        dirName: entry.name,
        description: fm.description || '',
        group: group.dir,
        path: path.join(groupDir, entry.name),
      });
    }
  }
  return skills;
}
