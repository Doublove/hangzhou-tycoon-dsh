/* ============================================================
   整局不变量 · 需求 8.6 / 8.7 / 2.3
   用例前缀 TC-BAL
   ------------------------------------------------------------
   这一组跑一局完整的 48 回合（4 名 AI），验证"能不能跑完、
   跑完之后状态还自洽"。数值是否好看不在这里判定，
   这里只保证没有 NaN、没有越界、没有产权错乱。
   ============================================================ */
'use strict';

const test = require('node:test');
const { before } = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');

const CHAPTER_TURNS = 48 * 4;

let snap = null;

/** 让 AI 自己跑一回合：先清 busy，跑完再把 busy 置回，
 *  阻止 nextTurn 排下的自动 roll 重复执行 */
async function autoTurn(env) {
  env.state.busy = false;
  await env.roll();
  env.state.busy = true;
  /* nextTurn 会排一个 setTimeout(roll)。等它跑完并因 busy 提前返回，
     再进入下一回合，否则会多跑一回合。全量并发时给足 8ms 余量。 */
  await new Promise(r => setTimeout(r, 8));
}

before(async () => {
  const env = F.boot({ silenceAI: false });
  env.state.players.forEach(p => { p.human = false; });
  const startCash = env.state.players.reduce((s, p) => s + p.cash, 0);
  let turns = 0;
  while (!env.state.over && turns < CHAPTER_TURNS + 40) {
    await autoTurn(env);
    turns++;
  }
  snap = {
    env,
    turns,
    startCash,
    endCash: env.state.players.reduce((s, p) => s + p.cash, 0),
    ranks: env.state.players.map(p => ({ p, net: env.netWorth(p) })).sort((a, b) => b.net - a.net),
    ownedTotal: env.allCells().filter(c => c.t === 'plot' && c.owner).length,
    fired: Object.keys(env.state.fired).length,
  };
}, { timeout: 180000 });

test('TC-BAL-01 一局 48 回合能跑到章末，回合数正好 192', () => {
  assert.equal(snap.env.state.over, true, '应正常结束，而不是卡死');
  assert.equal(snap.turns, CHAPTER_TURNS, `应为 48×4=192 回合，实际 ${snap.turns}`);
  assert.equal(snap.env.state.absMonth, 48);
});

test('TC-BAL-02 结束后没有 NaN / Infinity', () => {
  snap.env.state.players.forEach(p => {
    assert.ok(Number.isFinite(p.cash), `${p.name} 现金异常：${p.cash}`);
    assert.ok(Number.isFinite(p.debt), `${p.name} 负债异常：${p.debt}`);
    assert.ok(Number.isFinite(snap.env.netWorth(p)), `${p.name} 净资产异常`);
  });
  assert.ok(Number.isFinite(snap.env.state.stockPrice));
});

test('TC-BAL-03 所有棋子位置都在棋盘范围内', () => {
  snap.env.state.players.forEach(p => {
    assert.ok(p.pos >= 0 && p.pos < 26, `${p.name} 位置越界：${p.pos}`);
    assert.ok(Number.isInteger(p.pos));
  });
});

test('TC-BAL-04 地块产权只可能为空或指向本局玩家', () => {
  const ids = new Set(snap.env.state.players.map(p => p.id));
  snap.env.allCells().filter(c => c.t === 'plot').forEach(c => {
    if (c.owner) assert.ok(ids.has(c.owner.id), `${c.name} 的产权指向了不存在的玩家`);
    assert.ok(c.lv >= 0 && c.lv <= 5, `${c.name} 等级越界：${c.lv}`);
    assert.ok(c.lv <= c.maxLv, `${c.name} 等级超过上限`);
  });
});

test('TC-BAL-05 AI 会真的买地，一局结束时场上有产权', () => {
  assert.ok(snap.ownedTotal >= 4, `一局下来只成交了 ${snap.ownedTotal} 块地，AI 过于保守`);
});

test('TC-BAL-06 破产人数落在 0—4 之间（8.7 验收区间）', () => {
  const dead = snap.env.state.players.filter(p => p.bankrupt).length;
  assert.ok(dead >= 0 && dead <= 4);
});

test('TC-BAL-07 能排出名次，冠军净资产为正', () => {
  assert.equal(snap.ranks.length, 4);
  assert.ok(snap.ranks[0].net > 0, '冠军净资产应为正');
  for (let i = 1; i < snap.ranks.length; i++) {
    assert.ok(snap.ranks[i - 1].net >= snap.ranks[i].net, '名次应按净资产降序');
  }
});

test('TC-BAL-08 历史事件按时间轴触发', () => {
  assert.ok(snap.fired >= 5, `第一章只触发了 ${snap.fired} 个事件`);
});

test('TC-BAL-09 系统注入没有失控（总现金不膨胀）', () => {
  const ratio = snap.endCash / snap.startCash;
  assert.ok(ratio > 0, '总现金不应归零');
  assert.ok(ratio < 3, `总现金膨胀到 ${ratio.toFixed(2)} 倍，系统注入过多`);
});

test('TC-BAL-10 净资产曲线在合理量级（未出现天文数字）', () => {
  snap.ranks.forEach(({ p, net }) => {
    assert.ok(Math.abs(net) < 1e7, `${p.name} 净资产 ${net} 明显溢出`);
  });
});
