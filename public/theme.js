// Applied before first paint to avoid a theme flash.
try {
  if (localStorage.getItem('theme') === 'light') document.documentElement.classList.add('light');
  if (localStorage.getItem('motion') === 'on') document.documentElement.classList.add('motion-on');
} catch {}
