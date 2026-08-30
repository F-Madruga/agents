#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSkills } from './skills.mjs';
import { AGENTS, planInstall, applyAction, findBrokenLinks, findLinksTo, removeStoreSkill } from './install.mjs';
import {
  defaultStorePath,
  projectStorePath,
  readSavedStorePath,
  saveStorePath,
  syncItem,
  listInstalledSkills,
  treesEqual,
} from './store.mjs';
import { intro, outro, note, multiselect, select, confirm, text, dim, green, yellow, red, bold } from './prompts.mjs';
import fs from 'node:fs';

const HELP = `Usage: agents [flags]

Interactive by default; every flag skips its prompt.

  --scope=SCOPE       global | project
  --store=PATH        Where to keep the files the symlinks point to
                      (global: ~/.config/agents, or the location chosen last
                      time; project: <project>/.agents-store)
  --skills=a,b        Skill folder names to install (or --all-skills)
  --agents=ids        Comma-separated: ${AGENTS.map((a) => a.id).join(', ')}
  --agents-md         Also install AGENTS.md (--no-agents-md to skip)
  --force             Overwrite existing files without asking
  -h, --help          Show this help
`;

function fail(message) {
  process.stderr.write(red('✖ ') + message + '\n');
  process.exit(1);
}

function parseArgs(argv) {
  const flags = {};
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--force') flags.force = true;
    else if (arg === '--agents-md') flags.agentsMd = true;
    else if (arg === '--no-agents-md') flags.agentsMd = false;
    else if (arg === '--all-skills') flags.skills = 'all';
    else if (arg.startsWith('--skills=')) flags.skills = arg.slice('--skills='.length).split(',').filter(Boolean);
    else if (arg.startsWith('--agents=')) flags.agents = arg.slice('--agents='.length).split(',').filter(Boolean);
    else if (arg.startsWith('--scope=')) flags.scope = arg.slice('--scope='.length);
    else if (arg.startsWith('--store=')) flags.store = arg.slice('--store='.length);
    else fail(`Unknown flag: ${arg}\n\n${HELP}`);
  }
  if (flags.scope && !['global', 'project'].includes(flags.scope)) fail(`--scope must be global or project`);
  if (flags.agents) {
    for (const id of flags.agents) {
      if (!AGENTS.some((a) => a.id === id)) fail(`Unknown agent: ${id} (expected ${AGENTS.map((a) => a.id).join(', ')})`);
    }
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    process.stdout.write(HELP);
    return;
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const projectRoot = process.cwd();
  const home = os.homedir();

  intro('agents · skills & AGENTS.md setup');

  // 1. Scope
  const scope =
    flags.scope ??
    (await select('Where do you want this set up?', [
      { label: 'Global', value: 'global', description: `~ (${home})` },
      { label: 'This project', value: 'project', description: projectRoot },
    ]));

  // 2. Store location. Global installs default to ~/.config/agents and
  // remember a custom answer across runs; project installs stay in the project.
  const suggestedStore =
    flags.store ??
    (scope === 'project' ? projectStorePath(projectRoot) : readSavedStorePath() ?? defaultStorePath());
  let storeDir = process.stdin.isTTY && !flags.store
    ? await text('Where should skills be stored?', { initial: suggestedStore })
    : suggestedStore;
  if (storeDir.startsWith('~/')) storeDir = path.join(home, storeDir.slice(2));
  storeDir = path.resolve(storeDir);
  if (scope === 'global') saveStorePath(storeDir);

  // 3. Skills. What's already in this store starts checked; unchecking is how
  // you uninstall. Only the picker can remove: --skills= lists what to add.
  const allSkills = loadSkills(repoRoot);
  const installed = new Set(listInstalledSkills(storeDir));
  let skills;
  let removals = [];
  if (flags.skills === 'all') {
    skills = allSkills;
  } else if (flags.skills) {
    skills = flags.skills.map((name) => {
      const skill = allSkills.find((s) => s.dirName === name || s.name === name);
      if (!skill) fail(`Unknown skill: ${name} (available: ${allSkills.map((s) => s.dirName).join(', ') || 'none'})`);
      return skill;
    });
  } else if (allSkills.length === 0) {
    note(dim('No skills found in skills/ yet.'));
    skills = [];
  } else {
    note(dim("Heads up: some skills depend on others (e.g. grill-me needs grilling)."));
    if (installed.size > 0) note(dim('Installed skills are checked. Uncheck one to delete it.'));
    const options = allSkills.map((s) => ({
      label: s.dirName,
      value: s,
      description: s.description,
      selected: installed.has(s.dirName),
    }));
    skills = await multiselect('Which skills do you want to set up?', options);
    const picked = new Set(skills.map((s) => s.dirName));
    removals = allSkills.map((s) => s.dirName).filter((name) => installed.has(name) && !picked.has(name));
  }

  // Unchecked skills: delete the store copy and every link to it, with consent.
  let removed = 0;
  if (removals.length > 0) {
    const links = removals.flatMap((name) =>
      findLinksTo(path.join(storeDir, 'skills', name), { scope, home, projectRoot }),
    );
    note(yellow(`Unchecked ${removals.length} installed skill(s): ${removals.join(', ')}`));
    for (const link of links) note(dim(`  link ${link}`));
    const doIt =
      flags.force || (await confirm(`Delete them from ${storeDir} and remove ${links.length} link(s)?`, false));
    if (doIt) {
      for (const name of removals) removeStoreSkill(name, { storeDir, scope, home, projectRoot });
      removed = removals.length;
      note(green(`Deleted ${removed} skill(s) and ${links.length} link(s).`));
    } else {
      note(dim('Kept them.'));
    }
  }

  // 4. AGENTS.md
  const instructionsSource = path.join(repoRoot, 'instructions', 'AGENTS.md');
  let includeInstructions = flags.agentsMd;
  if (includeInstructions === undefined) {
    includeInstructions = await confirm('Also set up AGENTS.md?');
  }
  if (includeInstructions && !fs.existsSync(instructionsSource)) {
    fail(`instructions/AGENTS.md not found in ${repoRoot}`);
  }

  if (skills.length === 0 && !includeInstructions) {
    outro(dim(removed > 0 ? `Removed ${removed} skill(s). Nothing left to set up.` : 'Nothing selected — nothing to do.'));
    return;
  }

  // 5. Agents
  const agentIds =
    flags.agents ??
    (await multiselect(
      'Which agents?',
      AGENTS.map((a) => ({ label: a.label, value: a.id })),
    ));
  if (agentIds.length === 0) {
    outro(dim('No agents selected — nothing to do.'));
    return;
  }

  // Sync repo -> store. Anything already in the store that no longer matches
  // the repo byte for byte (repo moved on, or you edited the store copy) is
  // offered as one update list, all checked.
  const interactive = process.stdin.isTTY && !flags.force;
  const syncTargets = skills.map((s) => ({ source: s.path, target: path.join(storeDir, 'skills', s.dirName) }));
  if (includeInstructions) syncTargets.push({ source: instructionsSource, target: path.join(storeDir, 'AGENTS.md') });

  const stale = syncTargets.filter((t) => fs.existsSync(t.target) && !treesEqual(t.source, t.target));
  let toUpdate = new Set(flags.force ? stale.map((t) => t.target) : []);
  if (stale.length > 0 && interactive) {
    note(yellow(`${stale.length} installed item(s) differ from the repo.`));
    note(dim('Unchecked ones keep the copy in your store.'));
    const chosen = await multiselect(
      'Which do you want to update?',
      stale.map((t) => ({ label: path.basename(t.target), value: t.target, selected: true })),
    );
    toUpdate = new Set(chosen);
  }

  const counts = { added: 0, same: 0, updated: 0, kept: 0 };
  const updatedNames = [];
  for (const { source, target } of syncTargets) {
    const result = await syncItem(source, target, { resolveConflict: (t) => toUpdate.has(t) });
    counts[result]++;
    if (result === 'updated') updatedNames.push(path.basename(target));
    if (result === 'kept') note(`${yellow('▲')} kept your version of ${target}`);
  }
  note(dim(`Store ${storeDir}: ${counts.added} added, ${counts.updated} updated, ${counts.same} unchanged, ${counts.kept} kept.`));

  // Heal symlinks broken by removed skills or the old repo-pointing scheme.
  const broken = findBrokenLinks({ agentIds, scope, home, projectRoot, roots: [storeDir, repoRoot] });
  if (broken.length > 0) {
    note(yellow(`Found ${broken.length} broken symlink(s) left behind:`));
    for (const b of broken) note(dim(`  ${b.link} → ${b.dest}`));
    const remove = flags.force || !process.stdin.isTTY ? true : await confirm('Remove them?');
    if (remove) {
      for (const b of broken) fs.rmSync(b.link, { force: true });
      note(green(`Removed ${broken.length} broken symlink(s).`));
    }
  }

  // Symlink from the store into each agent.
  const actions = planInstall({ skills, agentIds, scope, includeInstructions, storeDir, projectRoot, home });
  const resolveConflict = interactive
    ? (action) => confirm(`${action.target} already exists. Overwrite?`, false)
    : () => flags.force === true;

  const icons = { linked: green('✔'), already: dim('●'), skipped: yellow('▲') };
  const words = { linked: 'linked', already: 'already set up', skipped: 'skipped (exists)' };
  let changed = 0;
  for (const action of actions) {
    const result = await applyAction(action, { resolveConflict });
    if (result === 'linked') changed++;
    note(`${icons[result]} ${action.label} ${dim(`· ${words[result]} · ${action.target}`)}`);
  }
  const updatedPart = updatedNames.length
    ? `, ${updatedNames.length} updated (${updatedNames.join(', ')})`
    : '';
  outro(bold(`Done — ${changed} linked, ${actions.length - changed} untouched${updatedPart}.`));
}

main().catch((err) => fail(err.message));
