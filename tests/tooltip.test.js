/* ============================================================
   HUD 悬浮说明 · 需求 9.2 / 9.4
   政策条、旧环资产、技能按钮的 tooltip
   用例前缀 TC-TIP
   ============================================================ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');

const tipEl = env => env.document.querySelector('#tip');
const shown = env => tipEl(env).classList.contains('show');
const tipText = env => tipEl(env).innerHTML;
/** 模拟鼠标进入容器内的某个 chip */
const hover = (container, el) => container.onmouseover({ target: el, relatedTarget: null });

/* ---------------- 政策条 ---------------- */

test('TC-TIP-01 有生效政策时渲染出可悬停的 chip', () => {
  const env = F.boot();
  env.setPolicy('limitBuy', 30);
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  assert.equal(pol.children.length, 1);
  assert.equal(pol.children[0].dataset.tip, 'policy');
  assert.equal(pol.children[0].dataset.key, 'limitBuy');
});

test('TC-TIP-02 悬停政策 chip 显示名称、生效时间与详情', () => {
  const env = F.boot();
  env.setPolicy('limitBuy', 30);
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  hover(pol, pol.children[0]);
  assert.equal(shown(env), true, '提示应显示');
  assert.match(tipText(env), /限购令落地/);
  assert.match(tipText(env), /2010 年 1 月 起/);
  assert.match(tipText(env), /剩余 30 个月/);
  assert.match(tipText(env), /名下持有 2 套及以上时/);
});

test('TC-TIP-03 剩余月数随月份推进递减', () => {
  const env = F.boot();
  env.setPolicy('limitBuy', 30);
  env.setMonth(10);
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  hover(pol, pol.children[0]);
  assert.match(tipText(env), /剩余 20 个月/);
});

test('TC-TIP-04 永久政策显示「永久生效」', () => {
  const env = F.boot();
  env.setPolicy('lottery', null);
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  hover(pol, pol.children[0]);
  assert.match(tipText(env), /永久生效/);
  assert.doesNotMatch(tipText(env), /剩余 \d+ 个月/);
});

test('TC-TIP-05 同 key 有多条记录时，取生效中的那条', () => {
  const env = F.boot();
  env.state.mods = [
    { key: 'limitBuy', kind: 'policy', name: '旧限购', detail: '旧的说明', start: 0, until: 5 },
    { key: 'limitBuy', kind: 'policy', name: '新限购', detail: '新的说明', start: 6, until: 50 },
  ];
  env.setMonth(10);
  assert.equal(env.activeMod('limitBuy').name, '新限购');
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  hover(pol, pol.children[0]);
  assert.match(tipText(env), /新限购/);
  assert.doesNotMatch(tipText(env), /旧限购/);
});

test('TC-TIP-06 没有生效政策时显示「政策宽松」，悬停给出解释', () => {
  const env = F.boot();
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  assert.equal(pol.children.length, 1);
  assert.equal(pol.children[0].textContent, '政策宽松');
  hover(pol, pol.children[0]);
  assert.equal(shown(env), true, '占位 chip 也要有反馈，否则用户以为坏了');
  assert.match(tipText(env), /政策宽松/);
  assert.match(tipText(env), /没有生效的政策/);
  assert.match(tipText(env), /按月自动触发/);
});

test('TC-TIP-07 悬停高杠杆 chip 显示杠杆率与豁免规则', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 960; p.debt = 600;
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  const chip = pol.children.find(c => c.dataset.tip === 'leverage');
  assert.ok(chip, '应渲染高杠杆 chip');
  hover(pol, chip);
  assert.match(tipText(env), /高杠杆/);
  assert.match(tipText(env), /负债 600 万/);
  assert.match(tipText(env), /不再享受/);
  assert.match(tipText(env), /上限保护/);
});

test('TC-TIP-08 悬停清算 chip 显示剩余月数与债务', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.liquidating = true; p.liqDeadline = 13; p.debt = 800;
  env.setMonth(10);
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  const chip = pol.children.find(c => c.dataset.tip === 'liquidation');
  assert.ok(chip, '应渲染清算 chip');
  hover(pol, chip);
  assert.match(tipText(env), /破产清算中/);
  assert.match(tipText(env), /剩余 3 个月/);
  assert.match(tipText(env), /债务 800 万/);
});

test('TC-TIP-09 高杠杆与清算可以同时出现', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 100; p.debt = 900;
  p.liquidating = true; p.liqDeadline = 20;
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  assert.ok(pol.children.some(c => c.dataset.tip === 'leverage'));
  assert.ok(pol.children.some(c => c.dataset.tip === 'liquidation'));
});

/* ---------------- 旧环资产 ---------------- */

test('TC-TIP-10 当前环的持有不计入旧环栏', () => {
  const env = F.boot();
  env.grant(env.state.players[0], env.at(1), 2);
  env.renderHUD();
  const legacy = env.document.querySelector('#legacy');
  assert.equal(legacy.children.length, 0, '第一章的地不应显示为旧环资产');
});

test('TC-TIP-11 换章后旧环持有显示为 chip', () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.grant(p, env.at(1), 2);
  env.grant(p, env.at(2), 1);
  env.nextChapter();
  env.renderHUD();
  const legacy = env.document.querySelector('#legacy');
  assert.equal(legacy.children.length, 1);
  assert.equal(legacy.children[0].dataset.tip, 'legacy');
  assert.match(legacy.children[0].textContent, /内环 1 宗/);
});

test('TC-TIP-12 悬停旧环 chip 显示地块明细、估值与月租', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.at(1), 2);
  env.nextChapter();
  env.renderHUD();
  const legacy = env.document.querySelector('#legacy');
  hover(legacy, legacy.children[0]);
  assert.equal(shown(env), true);
  assert.match(tipText(env), /内环 · 老城时代 · 旧环资产/);
  assert.match(tipText(env), /1 宗/);
  assert.match(tipText(env), new RegExp(`${c.name} · Lv2`), '应保留时代遗产的等级');
  assert.match(tipText(env), /估值/);
  assert.match(tipText(env), /月租/);
  assert.match(tipText(env), /不能再买入/);
});

test('TC-TIP-13 旧环超过 6 宗时折叠显示', () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.grant(p, env.at(1), 1);
  env.nextChapter();
  /* 内环 idx 3/6/9/12/15 是功能格，这里只取地块格凑满 7 宗 */
  [1, 2, 4, 5, 7, 8, 10].forEach(i => env.grant(p, env.at(i, 0), 1));
  env.renderHUD();
  const legacy = env.document.querySelector('#legacy');
  hover(legacy, legacy.children[0]);
  assert.match(tipText(env), /等 7 宗/);
});

test('TC-TIP-14 旧环明细按估值从高到低排序', () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.grant(p, env.at(1), 1);
  env.nextChapter();
  const cheap = env.grant(p, env.at(2, 0), 1);   // 北山，较便宜
  const rich = env.grant(p, env.at(1, 0), 3);    // 湖滨，较贵
  env.renderHUD();
  const legacy = env.document.querySelector('#legacy');
  hover(legacy, legacy.children[0]);
  const text = tipText(env);
  assert.ok(text.indexOf(rich.name) < text.indexOf(cheap.name), '贵的应排在前面');
});

/* ---------------- 技能按钮 ---------------- */

test('TC-TIP-15 悬停技能按钮显示主动技能说明', () => {
  const env = F.boot();
  env.renderSkillBtn();
  const btn = env.document.querySelector('#skill');
  btn.onmouseenter();
  assert.equal(shown(env), true);
  assert.match(tipText(env), /拆迁款/);
  assert.match(tipText(env), /主动技能 · 冷却 12 个月/);
  assert.match(tipText(env), /净资产 8% 的现金/);
});

test('TC-TIP-16 说明里同时给出角色被动', () => {
  const env = F.boot();
  env.renderSkillBtn();
  env.document.querySelector('#skill').onmouseenter();
  assert.match(tipText(env), /被动 · 祖宅底气/);
  assert.match(tipText(env), /免死一次/);
});

test('TC-TIP-17 冷却中仍可悬停，并提示剩余冷却', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.skillCd = 5;
  env.renderSkillBtn();
  const btn = env.document.querySelector('#skill');
  assert.equal(btn.classList.contains('off'), true, '冷却中应显示为不可用');
  assert.equal(btn.disabled, false, '不能用 disabled，否则浏览器不派发 hover');
  btn.onmouseenter();
  assert.match(tipText(env), /冷却中，剩 5 个月/);
});

test('TC-TIP-18 不是自己的回合时说明里给出原因', () => {
  const env = F.boot();
  env.state.turnIdx = 1;
  env.renderSkillBtn();
  env.document.querySelector('#skill').onmouseenter();
  assert.match(tipText(env), /等你的回合/);
});

test('TC-TIP-19 鼠标移出后提示消失', () => {
  const env = F.boot();
  env.renderSkillBtn();
  const btn = env.document.querySelector('#skill');
  btn.onmouseenter();
  assert.equal(shown(env), true);
  btn.onmouseleave();
  assert.equal(shown(env), false);
});

test('TC-TIP-20 移入 chip 内部子元素不会误关提示', () => {
  const env = F.boot();
  env.setPolicy('limitBuy', 30);
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  const chip = pol.children[0];
  const inner = env.document.createElement('span');
  chip.appendChild(inner);
  pol.onmouseout({ target: chip, relatedTarget: inner });
  assert.equal(shown(env), false, '尚未显示时无副作用');
  hover(pol, chip);
  pol.onmouseout({ target: chip, relatedTarget: inner });
  assert.equal(shown(env), true, '在 chip 内部移动不应关闭');
  pol.onmouseout({ target: chip, relatedTarget: null });
  assert.equal(shown(env), false, '移出容器后应关闭');
});

/* ---------------- 重绘与幂等 ---------------- */

test('TC-TIP-21 连续重绘不会累积重复 chip', () => {
  const env = F.boot();
  env.setPolicy('limitBuy', 30);
  env.renderHUD();
  env.renderHUD();
  env.renderHUD();
  assert.equal(env.document.querySelector('#policy').children.length, 1);
});

test('TC-TIP-22 chip 被重绘替换后，悬停仍然有效（事件委托）', () => {
  const env = F.boot();
  env.setPolicy('limitBuy', 30);
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  const before = pol.children[0];
  env.setMonth(5);                     // 剩余月数变化，触发重建
  env.renderHUD();
  const after = pol.children[0];
  assert.notEqual(before, after, '内容变化应产生新节点');
  hover(pol, after);
  assert.equal(shown(env), true, '委托监听在容器上，换节点也能响应');
  assert.match(tipText(env), /限购令落地/);
});

test('TC-TIP-23 点击 chip 同样能看详情（触屏兜底）', () => {
  const env = F.boot();
  env.setPolicy('limitBuy', 30);
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  pol.children[0].onclick({ stopPropagation() {} });
  assert.equal(shown(env), true);
  assert.match(tipText(env), /限购令落地/);
});

test('TC-TIP-24 内容没变时不重建节点，避免打断悬停', () => {
  const env = F.boot();
  env.setPolicy('limitBuy', 30);
  env.renderHUD();
  const pol = env.document.querySelector('#policy');
  const first = pol.children[0];
  env.renderHUD();
  env.renderHUD();
  assert.equal(pol.children[0], first, '同一节点应被复用，AI 回合重绘才不会闪');

  env.setMonth(5);                     // 剩余月数变了，才需要重建
  env.renderHUD();
  assert.notEqual(pol.children[0], first);
  assert.match(pol.children[0].textContent, /剩25月/);
});

test('TC-TIP-25 进入第二章却没有旧环资产时，显示占位并说明', () => {
  const env = F.boot();
  env.nextChapter();                   // 一块地都没有
  env.renderHUD();
  const legacy = env.document.querySelector('#legacy');
  assert.equal(legacy.children.length, 1);
  assert.match(legacy.children[0].textContent, /暂无/);
  hover(legacy, legacy.children[0]);
  assert.equal(shown(env), true);
  assert.match(tipText(env), /旧环资产/);
  assert.match(tipText(env), /沉降/);
});

test('TC-TIP-26 第一章不显示旧环占位（概念还没出现）', () => {
  const env = F.boot();
  env.renderHUD();
  assert.equal(env.document.querySelector('#legacy').children.length, 0);
});
