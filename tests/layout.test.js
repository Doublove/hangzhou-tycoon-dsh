/* ============================================================
   TC-LAYOUT：布局契约（不依赖浏览器，直接读 CSS 文本）

   背景：v1.9.3 把 #boardOuter 的 min-width 去掉后，移动端棋盘整块消失——
   原因是 #boardCol 当时是 display:contents，棋盘成了列向 flex 的子项，
   flex 先按内容算高度（0），aspect-ratio 拿不到宽度，最终高度为 0。
   这类问题在沙箱里没有截图看不出，所以把「谁可以是 display:contents」写成断言。
   ============================================================ */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SITE = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const CSS = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));

/** 取出某条选择器在「窄屏（不在 media query 内）」的声明块 */
function baseBlock(selector) {
  const re = new RegExp('(^|\\n)\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  let m;
  while ((m = re.exec(CSS))) {
    // 粗略判断：出现在 @media 之前的部分视为窄屏基线
    const before = CSS.slice(0, m.index);
    const mediaOpen = (before.match(/@media[^{]*\{/g) || []).length;
    const mediaClose = (before.match(/\}\s*\n\s*\}/g) || []).length;
    if (mediaOpen <= mediaClose) return m[2];
  }
  return null;
}

test('TC-LAYOUT-01 窄屏只摊平侧栏，#boardCol 保持 block', () => {
  const sideCol = baseBlock('#sideCol');
  assert.ok(sideCol && sideCol.includes('display:contents'),
    '#sideCol 应保持 display:contents（让玩家栏能提到棋盘前面）');

  const boardCol = baseBlock('#boardCol');
  assert.ok(boardCol, '应有 #boardCol 的窄屏规则');
  assert.ok(!/display:\s*contents/.test(boardCol),
    '#boardCol 不能是 display:contents —— 否则棋盘会成为列向 flex 子项，高度塌成 0');
  assert.ok(/display:\s*block/.test(boardCol), '#boardCol 窄屏应为 block');
});

test('TC-LAYOUT-02 棋盘用 aspect-ratio 撑出正方形，且有兜底高度', () => {
  const outer = baseBlock('#boardOuter');
  assert.ok(outer, '应有 #boardOuter 规则');
  assert.ok(/aspect-ratio:\s*1\s*\/\s*1/.test(outer), '#boardOuter 应声明 aspect-ratio:1/1');
  assert.ok(/min-height:\s*\d+px/.test(outer), '#boardOuter 应有 min-height 兜底');
});

test('TC-LAYOUT-03 玩家栏在窄屏排到棋盘之前', () => {
  const hud = baseBlock('#hud');
  assert.ok(hud && /order:\s*-\d/.test(hud), '#hud 窄屏应 order:-1，排在棋盘前面');
});

test('TC-LAYOUT-04 宽屏断点仍在，且棋盘宽度由 --board 决定', () => {
  assert.ok(/@media\s*\(min-width:1080px\)/.test(CSS), '应有 1080px 断点');
  assert.ok(/--board:/.test(CSS), '应定义 --board');
  assert.ok(/\{display:block;\s*flex:0 0 auto;\s*width:var\(--board\)/.test(CSS.replace(/\n\s*/g, ' ')),
    '宽屏 #boardCol 应恢复 block 并按 --board 定宽');
});
