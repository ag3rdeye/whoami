// Applied before first paint so animation preference does not flash.
try {
  if (localStorage.getItem('motion') === 'on') document.documentElement.classList.add('motion-on');
} catch {}
