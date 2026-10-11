import { easeCubicInOut } from 'd3';
import { W, H, wrapLines } from './layout.js';
import { dur, wait } from './motion.js';

// Full-graphic view that sets up the running example: a simple browser window
// with Sam's email on the left and an AI assistant chat panel on the right,
// where the user has typed their request. Deliberately generic — no real
// product's look or branding.
const WIN = { x: 16, y: (H - 430) / 2, w: W - 32, h: 430 };
const BAR_H = 34;
const EMAIL_SHARE = 0.58;
const BODY_LINE = 15;
const BULLET_INDENT = 10;

// Wrapped text with a little structure: '\n' is a line break, '\n\n' a
// paragraph gap, '## ' starts a bold heading line and '• ' a bullet whose
// wrapped lines hang under its text. Returns the height used.
function textBlock(parent, text, { x, y, maxChars, cls, lineHeight }) {
  const lines = [];
  text.split('\n\n').forEach((para, p) =>
    para.split('\n').forEach((raw, r) => {
      const heading = raw.startsWith('## ');
      const bullet = raw.startsWith('• ');
      const content = heading ? raw.slice(3) : raw;
      wrapLines(content, maxChars).forEach((line, k) =>
        lines.push({ line, heading, indent: bullet && k > 0, gap: p > 0 && r === 0 && k === 0 })
      );
    })
  );
  const t = parent.append('text').attr('class', cls).attr('x', x).attr('y', y);
  let height = 0;
  lines.forEach((d, i) => {
    const dy = i === 0 ? 0 : lineHeight * (d.gap ? 1.6 : 1);
    height += dy;
    t.append('tspan')
      .attr('x', x + (d.indent ? BULLET_INDENT : 0))
      .attr('dy', dy)
      .classed('mail-heading', d.heading)
      .text(d.line);
  });
  return height + lineHeight;
}

export function createBrowserView(parent, brief) {
  const g = parent.append('g').attr('class', 'view').style('opacity', 0);

  // Window contents are clipped to its rounded outline; the border is drawn last.
  g.append('clipPath')
    .attr('id', 'browser-window-clip')
    .append('rect')
    .attr('width', WIN.w)
    .attr('height', WIN.h)
    .attr('rx', 10);
  const frame = g.append('g').attr('transform', `translate(${WIN.x},${WIN.y})`);
  const win = frame.append('g').attr('clip-path', 'url(#browser-window-clip)');
  win.append('rect').attr('class', 'win-frame').attr('width', WIN.w).attr('height', WIN.h);

  // ---- Browser chrome ----
  win.append('rect').attr('class', 'win-bar').attr('width', WIN.w).attr('height', BAR_H);
  [16, 30, 44].forEach((cx) => win.append('circle').attr('class', 'win-dot').attr('cx', cx).attr('cy', BAR_H / 2).attr('r', 4.5));
  win.append('rect').attr('class', 'win-address').attr('x', 62).attr('y', 8).attr('width', WIN.w - 76).attr('height', 18).attr('rx', 9);
  win.append('text').attr('class', 'win-url').attr('x', 74).attr('y', 17).attr('dy', '0.35em').text('mail.example.com/inbox');

  const emailW = Math.round(WIN.w * EMAIL_SHARE);
  const chatW = WIN.w - emailW;

  // ---- Email pane ----
  const email = win.append('g').attr('transform', `translate(16,${BAR_H + 22})`);
  email.append('text').attr('class', 'mail-subject').attr('y', 6).text(brief.subject);
  email.append('circle').attr('class', 'avatar').attr('cx', 12).attr('cy', 36).attr('r', 12);
  email.append('text').attr('class', 'avatar-text').attr('x', 12).attr('y', 36).attr('dy', '0.35em').attr('text-anchor', 'middle').text(brief.from[0]);
  email.append('text').attr('class', 'mail-from').attr('x', 32).attr('y', 32).text(brief.from);
  email.append('text').attr('class', 'mail-meta').attr('x', 32).attr('y', 47).text('to me');
  email.append('line').attr('class', 'win-divider').attr('x1', -16).attr('x2', emailW - 16).attr('y1', 60).attr('y2', 60);

  // The body is longer than the pane, so it sits in a clipped viewport and
  // scrolls (with a scrollbar) as if being read.
  const VIEW = { y: 61, h: WIN.h - BAR_H - 22 - 61, w: emailW - 16 };
  g.append('clipPath')
    .attr('id', 'email-body-clip')
    .append('rect')
    .attr('x', -16)
    .attr('y', VIEW.y)
    .attr('width', VIEW.w + 16)
    .attr('height', VIEW.h);
  const body = email.append('g').attr('clip-path', 'url(#email-body-clip)').append('g');
  const textH = textBlock(body, brief.email, { x: 0, y: VIEW.y + 22, maxChars: 38, cls: 'mail-body', lineHeight: BODY_LINE });
  const attachY = VIEW.y + 22 + textH;
  const attachW = brief.attachment.length * 6.4 + 34;
  body.append('rect').attr('class', 'attach').attr('y', attachY).attr('width', attachW).attr('height', 28).attr('rx', 6);
  body.append('text').attr('class', 'attach-text').attr('x', 10).attr('y', attachY + 14).attr('dy', '0.35em').text(`▤ ${brief.attachment}`);

  const contentH = attachY + 28 + 16 - VIEW.y;
  const scrollMax = Math.max(0, contentH - VIEW.h);
  const thumbH = Math.max(24, (VIEW.h * VIEW.h) / contentH);
  const trackX = VIEW.w - 22;
  email.append('rect').attr('class', 'scroll-track').attr('x', trackX).attr('y', VIEW.y + 4).attr('width', 4).attr('height', VIEW.h - 8).attr('rx', 2);
  const thumb = email.append('rect').attr('class', 'scroll-thumb').attr('x', trackX).attr('width', 4).attr('height', thumbH - 8).attr('rx', 2);
  const thumbY = (scroll) => VIEW.y + 4 + (scrollMax ? (scroll / scrollMax) * (VIEW.h - thumbH) : 0);

  // ---- Chat panel ----
  const chat = win.append('g').attr('transform', `translate(${emailW},${BAR_H})`);
  chat.append('rect').attr('class', 'chat-bg').attr('width', chatW).attr('height', WIN.h - BAR_H);
  chat.append('line').attr('class', 'win-divider').attr('y2', WIN.h - BAR_H);
  chat.append('text').attr('class', 'chat-title').attr('x', 12).attr('y', 22).text('✦ AI assistant');
  chat.append('line').attr('class', 'win-divider').attr('x2', chatW).attr('y1', 36).attr('y2', 36);

  // The user's request, as a chat bubble.
  const reqLines = wrapLines(brief.request, 24);
  const bubbleW = chatW - 24;
  const bubbleH = reqLines.length * 16 + 16;
  const userMsg = chat.append('g').attr('transform', 'translate(12,56)');
  userMsg.append('text').attr('class', 'chat-who').attr('x', bubbleW).attr('text-anchor', 'end').text('You');
  userMsg.append('rect').attr('class', 'bubble-user').attr('y', 6).attr('width', bubbleW).attr('height', bubbleH).attr('rx', 10);
  const reqText = userMsg.append('text').attr('class', 'bubble-text').attr('y', 6 + 20);
  reqLines.forEach((l, i) => reqText.append('tspan').attr('x', 10).attr('dy', i ? 16 : 0).text(l));

  // The assistant, about to reply.
  const typingY = 56 + 6 + bubbleH + 30;
  const aiMsg = chat.append('g').attr('transform', `translate(12,${typingY})`);
  aiMsg.append('text').attr('class', 'chat-who').text('Assistant');
  aiMsg.append('rect').attr('class', 'bubble-ai').attr('y', 6).attr('width', 56).attr('height', 28).attr('rx', 10);
  const dots = aiMsg
    .selectAll('circle')
    .data([0, 1, 2])
    .join('circle')
    .attr('class', 'typing-dot')
    .attr('cx', (i) => 16 + i * 12)
    .attr('cy', 20)
    .attr('r', 3.5);

  chat.append('rect').attr('class', 'chat-input').attr('x', 10).attr('y', WIN.h - BAR_H - 42).attr('width', chatW - 20).attr('height', 30).attr('rx', 15);
  chat.append('text').attr('class', 'chat-placeholder').attr('x', 24).attr('y', WIN.h - BAR_H - 27).attr('dy', '0.35em').text('Ask anything…');

  frame.append('rect').attr('class', 'win-outline').attr('width', WIN.w).attr('height', WIN.h).attr('rx', 10);

  return {
    g,
    async play(_cfg, alive) {
      email.style('opacity', 0);
      userMsg.style('opacity', 0);
      aiMsg.style('opacity', 0);
      body.attr('transform', 'translate(0,0)');
      thumb.attr('y', thumbY(0));

      email.transition().duration(dur(500)).style('opacity', 1);
      await wait(900);
      if (!alive()) return;

      // Read through the email, top to bottom.
      const readMs = Math.max(3000, scrollMax * 18);
      body.transition().duration(dur(readMs)).ease(easeCubicInOut).attr('transform', `translate(0,${-scrollMax})`);
      thumb.transition().duration(dur(readMs)).ease(easeCubicInOut).attr('y', thumbY(scrollMax));
      await wait(readMs + 300);
      if (!alive()) return;

      userMsg.transition().duration(dur(400)).style('opacity', 1);
      await wait(800);
      if (!alive()) return;
      aiMsg.transition().duration(dur(300)).style('opacity', 1);

      // "Typing…" dots bounce until the reader moves on (still if motion is reduced).
      if (dur(1) === 0) return;
      while (alive()) {
        dots
          .transition('typing')
          .delay((i) => i * 150)
          .duration(250)
          .attr('cy', 16)
          .transition()
          .duration(250)
          .attr('cy', 20);
        await wait(1100);
        if (!alive()) return;
      }
    },
  };
}
