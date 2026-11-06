export {};

type Entry = { text: string; url?: string };
type Data = { files: Record<string, Entry> };

const dialog = document.getElementById('shell') as HTMLDialogElement | null;
const out = document.getElementById('shell-out');
const form = document.getElementById('shell-form') as HTMLFormElement | null;
const input = document.getElementById('shell-in') as HTMLInputElement | null;
const prompt = document.getElementById('shell-prompt');

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};

let data: Data | null = null;
let cwd = '/';
const history: string[] = [];
let cursor = 0;

function print(text = '', kind = '') {
  if (!out) return;
  const line = document.createElement('div');
  line.className = `shell-line ${kind}`;
  line.textContent = text;
  out.append(line);
  out.scrollTop = out.scrollHeight;
}

const home = () => (cwd === '/' ? '~' : `~${cwd}`);
const refreshPrompt = () => {
  if (prompt) prompt.textContent = `guest@arjun-giri:${home()}$`;
};

function resolve(path = '') {
  const parts = (path.startsWith('/') || path.startsWith('~') ? '' : cwd).split('/');
  for (const part of path.replace(/^~/, '').split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return `/${parts.filter(Boolean).join('/')}`;
}

function paths() {
  return Object.keys(data?.files ?? {});
}

const isDir = (path: string) =>
  path === '/' || paths().some((p) => p.startsWith(`${path}/`));
const isFile = (path: string) => paths().includes(path);

function entries(dir: string, hidden: boolean) {
  const prefix = dir === '/' ? '/' : `${dir}/`;
  const names = new Set<string>();
  for (const p of paths()) {
    if (!p.startsWith(prefix)) continue;
    const [name, rest] = [p.slice(prefix.length).split('/')[0], p.slice(prefix.length).includes('/')];
    if (!hidden && name.startsWith('.')) continue;
    names.add(rest ? `${name}/` : name);
  }
  return [...names].sort();
}


const quips: Record<string, string> = {
  sudo: `This session is not in the sudoers file. This incident will be reported. (To nobody, there is no server.)`,
  nmap: 'One host, one open port, and it is a static site. Try ls instead.',
  sqlmap: 'No database here, so nothing to inject into. Respect for checking.',
  ssh: 'Connection refused. There is no box behind this page.',
  rm: 'rm: read-only file system. It is all HTML, nothing to delete.',
  vim: 'You would never get out. Try cat.',
};

const commands: Record<string, (args: string[]) => void | Promise<void>> = {
  help() {
    print('ls [-a] [dir]    list a directory');
    print('cd <dir>         change directory');
    print('cat <file>       print a file');
    print('open <file>      go to the page behind a file');
    print('whoami           who is here');
    print('theme [mode]     switch light or dark');
    print('motion on|off    full animation or calm mode');
    print('history, clear, exit');
    print('Tab completes, arrow keys walk history.', 'dim');
  },
  ls(args) {
    const all = args.some((a) => a.startsWith('-') && a.includes('a'));
    const target = resolve(args.find((a) => !a.startsWith('-')) ?? '.');
    if (isFile(target)) return print(target.split('/').pop());
    if (!isDir(target)) return print(`ls: ${target}: no such directory`, 'err');
    print(entries(target, all).join('  '));
  },
  cd(args) {
    const target = resolve(args[0] ?? '/');
    if (!isDir(target)) return print(`cd: ${args[0]}: no such directory`, 'err');
    cwd = target;
    refreshPrompt();
  },
  pwd: () => print(cwd),
  cat(args) {
    if (!args[0]) return print('usage: cat <file>', 'err');
    const target = resolve(args[0]);
    if (isDir(target)) return print(`cat: ${args[0]}: is a directory`, 'err');
    if (!isFile(target)) return print(`cat: ${args[0]}: no such file`, 'err');
    print(data?.files[target]?.text ?? '');
  },
  open(args) {
    const url = data?.files[resolve(args[0] ?? '')]?.url;
    if (!url) return print('open: nothing to open there', 'err');
    location.assign(url);
  },
  whoami: () => print('guest'),
  theme(args) {
    const root = document.documentElement;
    const mode = args[0] ?? (root.classList.contains('light') ? 'dark' : 'light');
    if (mode !== 'light' && mode !== 'dark') return print('usage: theme [light|dark]', 'err');
    root.classList.toggle('light', mode === 'light');
    store.set('theme', mode);
    dispatchEvent(new Event('field:theme'));
    print(`theme: ${mode}`);
  },
  motion(args) {
    if (args[0] !== 'on' && args[0] !== 'off') return print('usage: motion on|off', 'err');
    store.set('motion', args[0]);
    document.documentElement.classList.toggle('motion-on', args[0] === 'on');
    dispatchEvent(new Event('field:motion'));
    print(`motion: ${args[0]}`);
  },
  history: () => history.forEach((h, i) => print(`${String(i + 1).padStart(3)}  ${h}`)),
  clear() {
    if (out) out.textContent = '';
  },
  exit: () => dialog?.close(),
};

async function run(line: string) {
  print(`${prompt?.textContent ?? '$'} ${line}`, 'echo');
  const [name, ...args] = line.trim().split(/\s+/);
  if (!name) return;
  history.push(line);
  cursor = history.length;
  if (Object.hasOwn(quips, name)) return print(quips[name], 'dim');
  const command = Object.hasOwn(commands, name) ? commands[name] : undefined;
  if (!command) return print(`${name.slice(0, 40)}: command not found. Try help.`, 'err');
  await command(args);
}

function complete() {
  if (!input) return;
  const parts = input.value.split(/\s+/);
  const last = parts[parts.length - 1];
  let matches: string[];
  if (parts.length === 1) {
    matches = Object.keys(commands).filter((c) => c.startsWith(last));
  } else {
    const slash = last.lastIndexOf('/') + 1;
    const dir = resolve(last.slice(0, slash) || '.');
    const stem = last.slice(slash);
    matches = entries(dir, stem.startsWith('.'))
      .filter((n) => n.startsWith(stem))
      .map((n) => last.slice(0, slash) + n);
  }
  if (matches.length === 1) {
    parts[parts.length - 1] = matches[0];
    input.value = parts.join(' ') + (matches[0].endsWith('/') ? '' : ' ');
  } else if (matches.length > 1) {
    print(`${prompt?.textContent ?? '$'} ${input.value}`, 'echo');
    print(matches.join('  '));
  }
}

async function launch() {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  input?.focus();
  refreshPrompt();
  if (data) return;
  try {
    const res = await fetch('/shell.json');
    if (!res.ok) throw new Error(String(res.status));
    data = (await res.json()) as Data;
    print('Everything on this site is a file here. Type help to start.', 'dim');
  } catch {
    print('Could not load the filesystem. Refresh and try again.', 'err');
  }
}

if (dialog && form && input && out) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const line = input.value;
    input.value = '';
    void run(line);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      complete();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      cursor = Math.min(history.length, Math.max(0, cursor + (event.key === 'ArrowUp' ? -1 : 1)));
      input.value = history[cursor] ?? '';
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      out.textContent = '';
    }
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
    else if (!getSelection()?.toString()) input.focus();
  });

  document.getElementById('shell-close')?.addEventListener('click', () => dialog.close());
  document.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('#shell-open')) void launch();
  });

  document.addEventListener('keydown', (event) => {
    const el = event.target as HTMLElement;
    const typing = el.matches?.('input, textarea, select, [contenteditable]');
    const combo = event.key === 'k' && (event.metaKey || event.ctrlKey);
    if (combo || (event.key === '`' && !typing)) {
      event.preventDefault();
      if (dialog.open) dialog.close();
      else void launch();
    }
  });

}
