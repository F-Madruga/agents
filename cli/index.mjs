#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS, loadSkills } from './skills.mjs';
import { AGENTS, planInstall, applyAction, findBrokenLinks } from './install.mjs';
import { intro, outro, note, multiselect, select, confirm, dim, green, yellow, red, bold } from './prompts.mjs';
import fs from 'node:fs';

const HELP = `Usage: agents [flags]

Interactive by default; every flag skips its prompt.

  --skills=a,b        Skill folder names to install (or --all-skills)
  --agents=ids        Comma-separated: ${AGENTS.map((a) => a.id).join(', ')}
  --scope=SCOPE       global | project
  --method=METHOD     symlink | copy
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
    else if (arg.startsWith('--method=')) flags.method = arg.slice('--method='.length);
    else fail(`Unknown flag: ${arg}\n\n${HELP}`);
  }
  if (flags.scope && !['global', 'project'].includes(flags.scope)) fail(`--scope must be global or project`);
  if (flags.method && !['symlink', 'copy'].includes(flags.method)) fail(`--method must be symlink or copy`);
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

  // 1. Skills
  const allSkills = loadSkills(repoRoot);
  let skills;
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
    const groups = GROUPS.map((g) => ({
      label: g.label,
      options: allSkills
        .filter((s) => s.group === g.dir)
        .map((s) => ({ label: s.dirName, value: s, description: s.description })),
    })).filter((g) => g.options.length > 0);
    skills = await multiselect('Which skills do you want to set up?', groups);
  }

  // 2. AGENTS.md
  const instructionsSource = path.join(repoRoot, 'instructions', 'AGENTS.md');
  let includeInstructions = flags.agentsMd;
  if (includeInstructions === undefined) {
    includeInstructions = await confirm('Also set up AGENTS.md?');
  }
  if (includeInstructions && !fs.existsSync(instructionsSource)) {
    fail(`instructions/AGENTS.md not found in ${repoRoot}`);
  }

  if (skills.length === 0 && !includeInstructions) {
    outro(dim('Nothing selected — nothing to do.'));
    return;
  }

  // 3. Agents
  const agentIds =
    flags.agents ??
    (await multiselect('Which agents?', [
      { options: AGENTS.map((a) => ({ label: a.label, value: a.id })) },
    ]));
  if (agentIds.length === 0) {
    outro(dim('No agents selected — nothing to do.'));
    return;
  }

  // 4. Scope
  const scope =
    flags.scope ??
    (await select('Where?', [
      { label: 'Global', value: 'global', description: `~ (${home})` },
      { label: 'This project', value: 'project', description: projectRoot },
    ]));

  // 5. Method
  const method =
    flags.method ??
    (await select('How?', [
      { label: 'Symlink', value: 'symlink', description: 'single source of truth, updates with this repo' },
      { label: 'Copy', value: 'copy', description: 'independent files, updated manually' },
    ]));

  // Heal symlinks broken by skills moving between group folders.
  const broken = findBrokenLinks({ agentIds, scope, home, projectRoot, repoRoot });
  if (broken.length > 0) {
    note(yellow(`Found ${broken.length} broken symlink(s) pointing into this repo:`));
    for (const b of broken) note(dim(`  ${b.link} → ${b.dest}`));
    const remove = flags.force || !process.stdin.isTTY ? true : await confirm('Remove them?');
    if (remove) {
      for (const b of broken) fs.rmSync(b.link, { force: true });
      note(green(`Removed ${broken.length} broken symlink(s).`));
    }
  }

  // Install
  const actions = planInstall({ skills, agentIds, scope, method, includeInstructions, repoRoot, projectRoot, home });
  const interactive = process.stdin.isTTY && !flags.force;
  const resolveConflict = interactive
    ? (action) => confirm(`${action.target} already exists. Overwrite?`, false)
    : () => flags.force === true;

  const icons = { linked: green('✔'), copied: green('✔'), already: dim('●'), skipped: yellow('▲') };
  const words = { linked: 'linked', copied: 'copied', already: 'already set up', skipped: 'skipped (exists)' };
  let changed = 0;
  for (const action of actions) {
    const result = await applyAction(action, { resolveConflict });
    if (result === 'linked' || result === 'copied') changed++;
    note(`${icons[result]} ${action.label} ${dim(`· ${words[result]} · ${action.target}`)}`);
  }
  outro(bold(`Done — ${changed} ${method === 'symlink' ? 'linked' : 'copied'}, ${actions.length - changed} untouched.`));
}

main().catch((err) => fail(err.message));
