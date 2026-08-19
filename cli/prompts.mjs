// Minimal clack-style interactive prompts. Zero dependencies.
import { emitKeypressEvents } from 'node:readline';

const ANSI = /\x1b\[[0-9;]*m/g;

export const bold = (s) => `\x1b[1m${s}\x1b[0m`;
export const dim = (s) => `\x1b[2m${s}\x1b[0m`;
export const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
export const green = (s) => `\x1b[32m${s}\x1b[0m`;
export const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
export const red = (s) => `\x1b[31m${s}\x1b[0m`;

export const intro = (title) => process.stdout.write(`${dim('┌')} ${bold(title)}\n`);
export const outro = (msg) => process.stdout.write(`${dim('└')} ${msg}\n`);
export const note = (msg) => process.stdout.write(`${dim('│')} ${msg}\n`);

const visibleWidth = (s) => s.replace(ANSI, '').length;

function countRows(text) {
  const cols = process.stdout.columns || 80;
  return text
    .split('\n')
    .reduce((n, line) => n + Math.max(1, Math.ceil(visibleWidth(line) / cols)), 0);
}

function runPrompt({ render, renderDone, onKey }) {
  if (!process.stdin.isTTY) {
    throw new Error('This step needs an interactive terminal. Pass it as a flag instead (see --help).');
  }
  return new Promise((resolve) => {
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write('\x1b[?25l');
    let rows = 0;
    const draw = (text) => {
      if (rows) process.stdout.write(`\x1b[${rows}A\x1b[0J`);
      rows = countRows(text);
      process.stdout.write(text + '\n');
    };
    const cleanup = () => {
      process.stdout.write('\x1b[?25h');
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('keypress', handler);
    };
    const handler = (str, key = {}) => {
      if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
        cleanup();
        process.stdout.write(dim('└ Cancelled.') + '\n');
        process.exit(130);
      }
      const result = onKey(key, str);
      if (result) {
        draw(renderDone(result.value));
        cleanup();
        resolve(result.value);
      } else {
        draw(render());
      }
    };
    process.stdin.on('keypress', handler);
    draw(render());
  });
}

const doneLine = (message, answer) => `${green('◇')} ${message} ${dim('·')} ${dim(answer)}`;

// groups: [{ label?, options: [{ label, value, description?, selected? }] }]
export function multiselect(message, groups) {
  const rows = [];
  for (const g of groups) {
    if (g.label) rows.push({ type: 'header', label: g.label });
    for (const o of g.options) rows.push({ type: 'option', ...o, selected: !!o.selected });
  }
  const options = rows.filter((r) => r.type === 'option');
  if (options.length === 0) return Promise.resolve([]);
  let cursor = 0;

  const render = () => {
    const lines = [`${cyan('◆')} ${bold(message)}`];
    let i = 0;
    for (const r of rows) {
      if (r.type === 'header') {
        lines.push(`${dim('│')} ${yellow(r.label)}`);
        continue;
      }
      const active = i === cursor;
      const box = r.selected ? green('◼') : dim('◻');
      const label = active ? cyan(r.label) : r.label;
      const desc = r.description ? `  ${dim(r.description)}` : '';
      lines.push(`${dim('│')} ${active ? cyan('❯') : ' '} ${box} ${label}${desc}`);
      i++;
    }
    lines.push(dim('└ ↑/↓ move · space toggle · a toggle all · enter confirm'));
    return lines.join('\n');
  };

  return runPrompt({
    render,
    renderDone: (values) => {
      const labels = options.filter((o) => values.includes(o.value)).map((o) => o.label);
      return doneLine(message, labels.length ? labels.join(', ') : 'none');
    },
    onKey: (key, str) => {
      if (key.name === 'up' || key.name === 'k') cursor = (cursor - 1 + options.length) % options.length;
      else if (key.name === 'down' || key.name === 'j') cursor = (cursor + 1) % options.length;
      else if (key.name === 'space') options[cursor].selected = !options[cursor].selected;
      else if (str === 'a') {
        const all = options.every((o) => o.selected);
        for (const o of options) o.selected = !all;
      } else if (key.name === 'return') {
        return { value: options.filter((o) => o.selected).map((o) => o.value) };
      }
    },
  });
}

// options: [{ label, value, description? }]
export function select(message, options, initial = 0) {
  let cursor = initial;
  const render = () => {
    const lines = [`${cyan('◆')} ${bold(message)}`];
    options.forEach((o, i) => {
      const active = i === cursor;
      const radio = active ? green('●') : dim('○');
      const label = active ? cyan(o.label) : o.label;
      const desc = o.description ? `  ${dim(o.description)}` : '';
      lines.push(`${dim('│')} ${radio} ${label}${desc}`);
    });
    lines.push(dim('└ ↑/↓ move · enter confirm'));
    return lines.join('\n');
  };
  return runPrompt({
    render,
    renderDone: (value) => doneLine(message, options.find((o) => o.value === value).label),
    onKey: (key) => {
      if (key.name === 'up' || key.name === 'k') cursor = (cursor - 1 + options.length) % options.length;
      else if (key.name === 'down' || key.name === 'j') cursor = (cursor + 1) % options.length;
      else if (key.name === 'return') return { value: options[cursor].value };
    },
  });
}

export function text(message, { initial = '' } = {}) {
  let value = initial;
  const render = () =>
    [
      `${cyan('◆')} ${bold(message)}`,
      `${dim('│')} ${value ? cyan(value) : dim('(empty)')}`,
      dim('└ type to edit · enter confirm'),
    ].join('\n');
  return runPrompt({
    render,
    renderDone: (v) => doneLine(message, v),
    onKey: (key, str) => {
      if (key.name === 'return') {
        if (value.trim()) return { value: value.trim() };
      } else if (key.name === 'backspace') value = value.slice(0, -1);
      else if (str && !key.ctrl && !key.meta && str >= ' ') value += str;
    },
  });
}

export function confirm(message, initial = true) {
  let value = initial;
  const render = () => {
    const yes = value ? `${green('●')} ${cyan('Yes')}` : `${dim('○')} Yes`;
    const no = !value ? `${green('●')} ${cyan('No')}` : `${dim('○')} No`;
    return [
      `${cyan('◆')} ${bold(message)}`,
      `${dim('│')} ${yes} ${dim('/')} ${no}`,
      dim('└ ←/→ move · y/n · enter confirm'),
    ].join('\n');
  };
  return runPrompt({
    render,
    renderDone: (v) => doneLine(message, v ? 'Yes' : 'No'),
    onKey: (key, str) => {
      if (['left', 'right', 'up', 'down', 'tab'].includes(key.name)) value = !value;
      else if (str === 'y') return { value: true };
      else if (str === 'n') return { value: false };
      else if (key.name === 'return') return { value };
    },
  });
}
