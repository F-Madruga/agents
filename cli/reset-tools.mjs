#!/usr/bin/env node
// Fork helper, separate from the setup CLI: drops every skill in this repo so
// you can put your own in. Keeps the group folders and their .gitkeep files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS } from './constants.mjs';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let removed = 0;

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
    fs.rmSync(path.join(groupDir, entry.name), { recursive: true });
    process.stdout.write(`removed skills/${group.dir}/${entry.name}\n`);
    removed++;
  }
}

process.stdout.write(removed === 0 ? 'No skills to remove.\n' : `Removed ${removed} skill(s).\n`);
