// Progress tracker and section navigation, built from the step list, with a
// link back to the title card at the top and to Key concepts at the bottom.
//   Wide screens: a rail of dots on the right edge, grouped under section
//   headings, with a progress line; hover or focus opens it to show titles.
//   Narrow screens: a thin progress bar across the top, plus a "Contents"
//   button that opens the same list.
// Clicking any entry scrolls to that step. setActive(i) is called as steps
// become active, so the rail always matches where the reader is.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createProgressNav(steps) {
  const stepEl = (i) => document.querySelector(`.step[data-step="${i}"] .step-card`);
  const narrow = () => matchMedia('(max-width: 720px)').matches;
  const jumpTo = (el, block) => el?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block });

  // Entries: a heading for each section break, a dot for every other step.
  const entries = steps.map((s, i) =>
    s.section
      ? `<li class="nav-section"><button type="button" data-i="${i}"><span class="nav-label">${s.section}</span><span class="nav-tick" aria-hidden="true"></span></button></li>`
      : `<li class="nav-step"><button type="button" data-i="${i}"><span class="nav-label">${s.title}</span><span class="nav-dot" aria-hidden="true"></span></button></li>`
  );

  const nav = document.createElement('nav');
  nav.className = 'progress-nav';
  nav.setAttribute('aria-label', 'Sections');
  const pageTitle = document.querySelector('.intro h1')?.textContent ?? 'Top';
  nav.innerHTML = `
    <div class="nav-track" aria-hidden="true"><div class="nav-fill"></div></div>
    <a class="nav-title" href="#"><span class="nav-label">${pageTitle}</span><span class="nav-dot nav-dot-square" aria-hidden="true"></span></a>
    <ol>${entries.join('')}</ol>
    <a class="nav-glossary" href="#key-concepts"><span class="nav-label">Key concepts</span><span class="nav-dot nav-dot-square" aria-hidden="true"></span></a>`;

  // Narrow screens: top progress bar + contents toggle.
  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<div class="progress-bar-fill"></div>';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = 'Contents';

  document.body.append(bar, nav, toggle);

  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-i]');
    if (btn) {
      jumpTo(stepEl(+btn.dataset.i), narrow() ? 'end' : 'center');
      setOpen(false);
    } else if (e.target.closest('.nav-title')) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      setOpen(false);
    } else if (e.target.closest('.nav-glossary')) {
      e.preventDefault();
      jumpTo(document.getElementById('key-concepts'), 'start');
      setOpen(false);
    }
  });

  const buttons = [...nav.querySelectorAll('button[data-i]')];
  const fill = nav.querySelector('.nav-fill');
  const barFill = bar.querySelector('.progress-bar-fill');

  return {
    setActive(i) {
      for (const b of buttons) {
        const active = +b.dataset.i === i;
        b.classList.toggle('active', active);
        b.classList.toggle('done', +b.dataset.i < i);
        if (active) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      }
      const progress = (i + 1) / steps.length;
      fill.style.height = `${progress * 100}%`;
      barFill.style.width = `${progress * 100}%`;
    },
  };
}
