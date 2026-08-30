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

test('loadSkills scans skills/, skipping folders without a SKILL.md', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-skills-'));
  const write = (name, content) => {
    const dir = path.join(root, 'skills', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), content);
  };
  write('tdd', '---\nname: tdd\ndescription: desc\n---\nbody');
  write('bare', 'no frontmatter');
  fs.mkdirSync(path.join(root, 'skills', 'no-skill-md'), { recursive: true });

  const skills = loadSkills(root);
  assert.deepEqual(
    skills.map((s) => [s.dirName, s.description]),
    [
      ['bare', ''],
      ['tdd', 'desc'],
    ],
  );
  assert.equal(skills[1].path, path.join(root, 'skills', 'tdd'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadSkills returns nothing when skills/ is missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-skills-'));
  assert.deepEqual(loadSkills(root), []);
  fs.rmSync(root, { recursive: true, force: true });
});
