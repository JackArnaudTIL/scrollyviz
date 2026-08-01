import scrollama from 'scrollama';

// The wiring layer. Scrollama watches the .step elements and reports which one
// is active; we translate that into graphic.renderScene(i). This is the ONLY
// place that knows about both scroll and the graphic — keep it thin.
export function initScroller(graphic) {
  const scroller = scrollama();

  scroller
    .setup({
      step: '.step',
      offset: 0.55, // a step activates when it crosses ~55% of the viewport
    })
    .onStepEnter(({ element }) => {
      element.classList.add('is-active');
      const i = +element.dataset.step;
      graphic.renderScene(i);
    })
    .onStepExit(({ element }) => {
      element.classList.remove('is-active');
    });

  window.addEventListener('resize', () => {
    graphic.resize();
    scroller.resize();
  });

  return scroller;
}
