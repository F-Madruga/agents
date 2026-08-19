import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultStorePath, readSavedStorePath, saveStorePath, treesEqual, syncItem } from './store.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agents-store-'));

test('defaultStorePath uses XDG_CONFIG_HOME when set, ~/.config otherwise', () => {
  assert.equal(defaultStorePath({ XDG_CONFIG_HOME: '/xdg' }, '/home/u'), path.join('/xdg', 'agents'));
  assert.equal(defaultStorePath({}, '/home/u'), path.join('/home/u', '.config', 'agents'));
});

test('saveStorePath / readSavedStorePath round-trip via the default location', () => {
  const root = tmp();
  const env = { XDG_CONFIG_HOME: path.join(root, 'config') };
  assert.equal(readSavedStorePath(env, root), null);
  saveStorePath('/custom/store', env, root);
  assert.equal(readSavedStorePath(env, root), '/custom/store');
  fs.rmSync(root, { recursive: true, force: true });
});

test('treesEqual compares directory trees by content', () => {
  const root = tmp();
  const make = (name, files) => {
    for (const [rel, content] of Object.entries(files)) {
      const p = path.join(root, name, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content);
    }
    return path.join(root, name);
  };
  const a = make('a', { 'SKILL.md': 'x', 'ref/notes.md': 'y' });
  const b = make('b', { 'SKILL.md': 'x', 'ref/notes.md': 'y' });
  const c = make('c', { 'SKILL.md': 'x', 'ref/notes.md': 'CHANGED' });
  const d = make('d', { 'SKILL.md': 'x' });
  assert.equal(treesEqual(a, b), true);
  assert.equal(treesEqual(a, c), false);
  assert.equal(treesEqual(a, d), false);
  assert.equal(treesEqual(a, path.join(root, 'missing')), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('syncItem adds, skips identical, and asks before replacing edits', async () => {
  const root = tmp();
  const source = path.join(root, 'repo', 'skill');
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'SKILL.md'), 'v1');
  const target = path.join(root, 'store', 'skills', 'skill');

  assert.equal(await syncItem(source, target), 'added');
  assert.equal(await syncItem(source, target), 'same');

  // Manual edit in the store: kept without consent, updated with it.
  fs.writeFileSync(path.join(target, 'SKILL.md'), 'my manual edit');
  assert.equal(await syncItem(source, target), 'kept');
  assert.equal(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8'), 'my manual edit');
  assert.equal(await syncItem(source, target, { resolveConflict: async () => true }), 'updated');
  assert.equal(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8'), 'v1');
  fs.rmSync(root, { recursive: true, force: true });
});
