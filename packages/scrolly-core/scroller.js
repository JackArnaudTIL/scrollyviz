import scrollama from 'scrollama';

// The wiring layer. Scrollama watches the .step elements and reports which one
// is active; we translate that into graphic.renderScene(i). This is the ONLY
// place that knows about both scroll and the graphic — keep it thin.
//
// renderScene(i) fires once, the moment a step becomes active — this is the
// hook for "don't build/reveal anything until the reader actually scrolls
// here." renderProgress(i, progress) is optional: implement it on a graphic
// that wants a scroll-scrubbed effect (a value 0→1 across the step's full
// scroll distance, continuous, ticking on every scroll frame, independent of
// the offset trigger below) — a graphic without it just never receives calls.
// If it RETURNS a number, that value is also exposed as --chart-progress —
// a graphic that rebases progress to its own timeline (e.g. counting from
// when a sticky element locks into place rather than from step-entry) can
// use this to hand that same rebased value to the step's own CSS, so text
// motion stays in sequence with the graphic instead of running on the raw,
// un-rebased --step-progress.
export function initScroller(graphic) {
  const scroller = scrollama();

  scroller
    .setup({
      step: '.step',
      offset: 0.55, // a step activates when it crosses ~55% of the viewport
      progress: true,
    })
    .onStepEnter(({ element }) => {
      element.classList.add('is-active');
      const i = +element.dataset.step;
      graphic.renderScene(i);
    })
    .onStepExit(({ element }) => {
      element.classList.remove('is-active');
    })
    .onStepProgress(({ element, progress }) => {
      const i = +element.dataset.step;
      const chartProgress = graphic.renderProgress?.(i, progress);
      // Every step gets this for free, whether or not the graphic cares
      // about progress: a live 0→1 CSS custom property on the step itself,
      // so text motion (fade, slide, whatever) can be scroll-scrubbed
      // entirely in CSS instead of needing JS for every effect.
      element.style.setProperty('--step-progress', progress);
      if (typeof chartProgress === 'number') {
        element.style.setProperty('--chart-progress', chartProgress);
      }
    });

  window.addEventListener('resize', () => {
    graphic.resize();
    scroller.resize();
  });

  return scroller;
}
