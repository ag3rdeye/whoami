export {};

// Document-level handlers survive client-side navigation, so nothing needs rebinding.
const root = document.documentElement;

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

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function restore() {
  root.classList.toggle('light', store.get('theme') === 'light');
  root.classList.toggle('motion-on', store.get('motion') === 'on');
  const offer = document.getElementById('motion-offer');
  if (offer) offer.hidden = !reduced.matches || store.get('motion') === 'on';
}

function wrapCode() {
  document.querySelectorAll<HTMLElement>('.prose pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-block')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    pre.before(wrapper);
    wrapper.append(pre);
    const copy = document.createElement('button');
    copy.className = 'copy';
    copy.type = 'button';
    copy.textContent = 'Copy';
    wrapper.append(copy);
  });
}

document.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  if (target.closest('#theme-toggle')) {
    const light = root.classList.toggle('light');
    store.set('theme', light ? 'light' : 'dark');
    dispatchEvent(new Event('field:theme'));
  } else if (target.closest('#menu-toggle')) {
    const nav = document.getElementById('mobile-nav');
    const open = nav?.classList.toggle('hidden') === false;
    target.closest('#menu-toggle')?.setAttribute('aria-expanded', String(open));
  } else if (target.closest('#motion-offer')) {
    store.set('motion', 'on');
    restore();
    dispatchEvent(new Event('field:motion'));
  } else if (target.matches('.code-block .copy')) {
    const code = target.parentElement?.querySelector('pre')?.textContent ?? '';
    await navigator.clipboard.writeText(code);
    target.textContent = 'Copied';
    setTimeout(() => (target.textContent = 'Copy'), 1500);
  }
});

document.addEventListener('astro:after-swap', restore);
document.addEventListener('astro:page-load', () => {
  restore();
  wrapCode();
});
