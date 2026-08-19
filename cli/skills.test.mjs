import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseFrontmatter, loadSkills } from './skills.mjs';

test('parseFrontmatter extracts key/value pairs', () => {
  const fm = parseFrontmatter('---\nname: tdd\ndescription: Write tests first: always\n---\n\n# Body\n');
  assert.equal(fm.name, 'tdd');
  assert.equal(fm.description, 'Write tests first: always');
});

test('parseFrontmatter returns empty object without frontmatter', () => {
  assert.deepEqual(parseFrontmatter('# Just markdown\n'), {});
});

test('loadSkills scans the three group folders', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-skills-'));
  const write = (group, name, content) => {
    const dir = path.join(root, 'skills', group, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), content);
  };
  write('active', 'tdd', '---\nname: tdd\ndescription: desc\n---\nbody');
  write('experimenting', 'bare', 'no frontmatter');
  fs.mkdirSync(path.join(root, 'skills', 'active', 'no-skill-md'), { recursive: true });
  // archived/ intentionally missing

  const skills = loadSkills(root);
  assert.deepEqual(
    skills.map((s) => [s.dirName, s.group, s.description]),
    [
      ['tdd', 'active', 'desc'],
      ['bare', 'experimenting', ''],
    ],
  );
  assert.equal(skills[0].path, path.join(root, 'skills', 'active', 'tdd'));
  fs.rmSync(root, { recursive: true, force: true });
});
