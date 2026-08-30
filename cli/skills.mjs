import fs from 'node:fs';
import path from 'node:path';

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

// Returns [{ name, dirName, description, path }] for every skill in skills/.
export function loadSkills(repoRoot) {
  const skillsDir = path.join(repoRoot, 'skills');
  let entries;
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const fm = parseFrontmatter(fs.readFileSync(skillFile, 'utf8'));
    skills.push({
      name: fm.name || entry.name,
      dirName: entry.name,
      description: fm.description || '',
      path: path.join(skillsDir, entry.name),
    });
  }
  return skills;
}
