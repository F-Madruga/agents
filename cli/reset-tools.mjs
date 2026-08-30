#!/usr/bin/env node
// Fork helper, separate from the setup CLI: drops every skill in this repo so
// you can put your own in. Keeps skills/ and its .gitkeep file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = path.join(repoRoot, 'skills');
let removed = 0;

let entries;
try {
  entries = fs.readdirSync(skillsDir, { withFileTypes: true });
} catch {
  entries = [];
}
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
  process.stdout.write(`removed skills/${entry.name}\n`);
  removed++;
}

process.stdout.write(removed === 0 ? 'No skills to remove.\n' : `Removed ${removed} skill(s).\n`);
