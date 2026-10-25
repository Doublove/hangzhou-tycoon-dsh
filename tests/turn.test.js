/* ============================================================
   回合流程 · 需求 2.1 / 2.2 / 2.3 / 3.7.1 / 3.7.2 / 7.1
   用例前缀 TC-TURN
   ============================================================ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');

/* ---------------- 掷骰与移动 ---------------- */

test('TC-TURN-01 单骰点数为 1—6，不会出现 0 或 7', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  // 覆盖 rnd 的上下边界：Math.random 0 → 1 点，0.999 → 6 点
  const samples = [[0, 1], [0.999, 6], [0.5, 4]];
  for (const [r, expected] of samples) {
    env.put(p, 12);                       // 落点依次为 13 地块 / 18 银行 / 16 地块，均无随机卡牌
    p.scenicTurns = 0;
    env.setRandom([r]);
    await env.takeTurn();
    assert.equal(p.pos, (12 + expected) % 26, `随机数 ${r} 应走 ${expected} 步`);
    assert.ok(expected >= 1 && expected <= 6);
  }
});

test('TC-TURN-02 掷 1 点前进 1 格', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.put(p, 23);
  env.setRandom([0]);
  await env.takeTurn();
  assert.equal(p.pos, 24);
  assert.equal(env.curCells()[24].t, 'scenic');
  assert.ok(p.scenicTurns >= 1, '落在风景区应产生停留');
});

test('TC-TURN-03 经过起点：月供 1 万 + 当前现金 3%', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.put(p, 20);              // 20 + 6 = 26 → 回到起点
  p.cash = 1000;
  env.setRandom([0.999]);      // 6 点
  await env.takeTurn();
  assert.equal(p.pos, 0);
  assert.equal(p.cash, 1000 + 1 + Math.round(1000 * 0.03));
});

test('TC-TURN-04 反向经过起点同样结算月供（V1.5）', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.put(p, 1);
  p.cash = 800;
  p.reverse = true;
  env.setRandom([0]);          // 1 点，反向走到 idx 0
  await env.takeTurn();
  assert.equal(p.pos, 0);
  assert.equal(p.cash, 800 + 1 + Math.round(800 * 0.03));
});

test('TC-TURN-05 反向移动时位置递减', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.put(p, 10);
  p.reverse = true;
  env.setRandom([0.999]);      // 6 点反向
  await env.takeTurn();
  assert.equal(p.pos, 4);
});

test('TC-TURN-06 掉头卡用后即清空标记', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.put(p, 10);
  p.reverse = true;
  env.setRandom([0]);
  await env.takeTurn();
  assert.equal(p.reverse, false, '掉头只对下一次掷骰生效');
});

test('TC-TURN-07 路障拦停移动并消耗自身', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.put(p, 1);
  const blocker = env.at(2);
  blocker.block = true;
  env.setRandom([0.999]);      // 6 点，本应到 7
  await env.takeTurn();
  assert.equal(p.pos, 2, '应被拦在路障格');
  assert.equal(blocker.block, false, '路障是一次性的');
});

/* ---------------- 停留卡 ---------------- */

test('TC-TURN-08 停留卡不移动，但重新触发脚下地块（站在对手地上要再付一次）', async () => {
  const env = F.boot();
  const payer = env.state.players[0];
  const owner = env.state.players[1];
  const c = env.grant(owner, env.at(1), 2);
  env.put(payer, 1);
  payer.skipMove = true;
  payer.cash = 3000;
  const before = payer.cash;
  await env.takeTurn();
  assert.equal(payer.pos, 1, '不应移动');
  assert.ok(payer.cash < before, '应再次支付过路费');
  assert.equal(payer.cash, before - env.tollFor(payer, c).pay);
});

test('TC-TURN-09 停留卡停在起点时重新领月供', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.put(p, 0);
  p.skipMove = true;
  p.cash = 500;
  await env.takeTurn();
  assert.equal(p.pos, 0);
  assert.equal(p.cash, 500 + 1 + Math.round(500 * 0.03));
});

/* ---------------- 监狱 ---------------- */

test('TC-TURN-10 监狱掷奇数继续关押，计数 +1', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.inJail = true; p.jailFail = 0;
  env.setRandom([0]);          // 1 点，奇数
  await env.takeTurn();
  assert.equal(p.inJail, true);
  assert.equal(p.jailFail, 1);
});

test('TC-TURN-11 监狱掷偶数出狱，并按点数前进', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const jailIdx = env.curCells().findIndex(c => c.t === 'jail');
  p.inJail = true; p.jailFail = 0; p.pos = jailIdx;
  env.setRandom([0.2]);        // rnd=1 → 2 点，偶数
  await env.takeTurn();
  assert.equal(p.inJail, false);
  assert.equal(p.jailFail, 0);
  assert.equal(p.pos, (jailIdx + 2) % 26);
});

test('TC-TURN-12 连续 3 次奇数后，第 4 回合强制出狱', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.inJail = true; p.jailFail = 3;
  const jailIdx = env.curCells().findIndex(c => c.t === 'jail');
  p.pos = jailIdx;
  env.setRandom([0]);          // 仍掷 1 点（奇数），但关押期满
  await env.takeTurn();
  assert.equal(p.inJail, false);
  assert.equal(p.pos, (jailIdx + 1) % 26);
});

test('TC-TURN-13 踩中监狱格直接进监狱', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.sendToJail(p, '测试');
  assert.equal(p.inJail, true);
  assert.equal(env.curCells()[p.pos].t, 'jail');
});

/* ---------------- 风景区 ---------------- */

test('TC-TURN-14 风景区梯度分布：50/25/12/7/5/1 对应 1—6 回合', () => {
  const env = F.boot();
  const cases = [
    [0.00, 1], [0.49, 1],
    [0.50, 2], [0.74, 2],
    [0.75, 3], [0.86, 3],
    [0.87, 4], [0.93, 4],
    [0.94, 5], [0.98, 5],
    [0.99, 6], [0.999, 6],
  ];
  cases.forEach(([r, expected]) => {
    env.setRandom([r]);
    assert.equal(env.rollScenicStay(), expected, `随机数 ${r} 应停留 ${expected} 回合`);
  });
});

test('TC-TURN-15 风景区停留期望约 1.95 回合', () => {
  const env = F.boot();
  const odds = [...env.CFG.scenicOdds];
  assert.deepEqual(odds, [50, 25, 12, 7, 5, 1]);
  assert.equal(odds.reduce((a, b) => a + b, 0), 100, '概率之和应为 100');
  const expect = odds.reduce((s, p, i) => s + (i + 1) * p / 100, 0);
  assert.ok(Math.abs(expect - 1.95) < 1e-9, `期望应约 1.95，实际 ${expect}`);
});

test('TC-TURN-16 风景区停留期间跳过移动，回合数递减', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const scenic = env.curCells().findIndex(c => c.t === 'scenic');
  env.put(p, scenic);
  p.scenicTurns = 2; p.scenicName = '西湖风景区';
  await env.takeTurn();
  assert.equal(p.pos, scenic, '不应移动');
  assert.equal(p.scenicTurns, 1);
});

test('TC-TURN-17 阿莲在风景区停留回合数减半（向上取整）', async () => {
  const env = F.boot({ charId: 'lian' });
  const lian = env.state.players.find(p => p.charId === 'lian');
  const scenic = env.curCells().find(c => c.t === 'scenic');
  env.setRandom([0.99]);       // 基础 6 回合
  await env.landOn(lian, scenic);
  assert.equal(lian.scenicTurns, 3, '6 回合减半为 3');
  env.setRandom([0.75]);       // 基础 3 回合
  await env.landOn(lian, scenic);
  assert.equal(lian.scenicTurns, 2, '3 回合减半向上取整为 2');
});

/* ---------------- 回合与月份推进 ---------------- */

test('TC-TURN-18 四名玩家各行动一次，月份 +1', () => {
  const env = F.boot();
  assert.equal(env.state.absMonth, 0);
  for (let i = 0; i < 4; i++) env.nextTurn();
  assert.equal(env.state.absMonth, 1);
  assert.equal(env.state.turnIdx, 0, '一轮结束后回到 0 号玩家');
  assert.equal(env.state.turnCount, 0);
});

test('TC-TURN-19 回合推进跳过已破产玩家', () => {
  const env = F.boot();
  env.state.players[1].bankrupt = true;
  env.state.turnIdx = 0;
  env.nextTurn();
  assert.equal(env.state.turnIdx, 2);
});

test('TC-TURN-20 仅剩一名玩家时提前结束章节', () => {
  const env = F.boot();
  env.state.players[1].bankrupt = true;
  env.state.players[2].bankrupt = true;
  env.state.players[3].bankrupt = true;
  env.nextTurn();
  assert.equal(env.state.over, true);
});

/* ---------------- 月末结算 ---------------- */

test('TC-TURN-21 月末结算：租金 − 物业费 − 贷款利息', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.at(1), 2);
  p.cash = 1000; p.debt = 500;
  const rent = env.rentOf(c);
  const fee = env.mgmtFee(p);
  const interest = Math.round(500 * env.loanRate());
  await env.endMonth();
  assert.equal(p.cash, 1000 + rent - fee - interest);
});

test('TC-TURN-22 月末租金按地块逐块累加', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const a = env.grant(p, env.at(1), 2);
  const b = env.grant(p, env.at(2), 3);
  p.cash = 0; p.debt = 0;
  const rent = env.rentOf(a) + env.rentOf(b);
  const fee = env.mgmtFee(p);
  await env.endMonth();
  assert.equal(p.cash, rent - fee);
});

test('TC-TURN-23 月末 boost 计数递减，归零后停止', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.at(1), 2);
  c.boost = 2;
  await env.endMonth();
  assert.equal(c.boost, 1);
  await env.endMonth();
  assert.equal(c.boost, 0);
  await env.endMonth();
  assert.equal(c.boost, 0, '不应变成负数');
});

test('TC-TURN-24 月末技能冷却递减', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.skillCd = 2;
  await env.endMonth();
  assert.equal(p.skillCd, 1);
  await env.endMonth();
  assert.equal(p.skillCd, 0);
});

test('TC-TURN-25 月末股价在 ±4% 内波动，且不低于 200', async () => {
  const env = F.boot();
  env.setRandom([0.5]);        // 0.96 + 0.04 = 1.00
  const before = env.state.stockPrice;
  await env.endMonth();
  assert.equal(env.state.stockPrice, before);
  env.setRandom([0.999]);      // 接近 +4%
  const b2 = env.state.stockPrice;
  await env.endMonth();
  assert.ok(env.state.stockPrice <= Math.round(b2 * 1.04));
  env.state.stockPrice = 200;
  env.setRandom([0]);
  await env.endMonth();
  assert.ok(env.state.stockPrice >= 200, '股价有 200 的下限');
});

test('TC-TURN-26 跨章前月末不结算租金给已破产者', async () => {
  const env = F.boot();
  const dead = env.state.players[1];
  env.grant(dead, env.at(2), 2);
  dead.bankrupt = true;
  const before = dead.cash;
  await env.endMonth();
  assert.equal(dead.cash, before);
});

/* ---------------- 章节 ---------------- */

test('TC-TURN-27 章节回合数：48 / 48 / 48 / 60，合计 204', () => {
  const env = F.boot();
  assert.deepEqual([...env.CHAPTERS.map(c => c.months)], [48, 48, 48, 60]);
  assert.equal(env.CHAPTERS.reduce((s, c) => s + c.months, 0), 204);
  assert.deepEqual([...env.CHAPTERS.map(c => c.from)], [0, 48, 96, 144]);
});

test('TC-TURN-28 打满 48 回合后章节结束', async () => {
  const env = F.boot();
  env.setMonth(47);            // 最后一个月
  assert.equal(env.chapterMonth(), 47);
  await env.endMonth();        // 推进到 48
  assert.equal(env.state.over, true);
  assert.equal(env.state.absMonth, 48);
});

test('TC-TURN-29 换章继承：净资产 × 40% 现金，保留 1 宗最贵地块', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const rich = env.grant(p, env.at(1), 3);    // 湖滨，地价最高
  const cheap = env.grant(p, env.at(2), 1);
  p.cash = 1000; p.debt = 0; p.stock = 2;
  const nw = env.netWorth(p);
  env.nextChapter();
  assert.equal(p.cash, Math.max(0, Math.round(nw * 0.4)));
  assert.equal(env.owned(p).length, 1, '只保留 1 宗');
  assert.equal(env.owned(p)[0].name, rich.name, '保留最贵的一宗');
  assert.equal(p.debt, 0);
  assert.equal(p.stock, 0);
  assert.equal(p.pos, 0);
});

test('TC-TURN-30 换章不复活已破产玩家', () => {
  const env = F.boot();
  const dead = env.state.players[1];
  dead.bankrupt = true;
  env.nextChapter();
  assert.equal(dead.bankrupt, true, '出局者不参与后续章节');
});

test('TC-TURN-31 换章清空政策、重置月份与回合计数', () => {
  const env = F.boot();
  env.setPolicy('limitBuy', 100);
  env.state.over = false;
  env.nextChapter();
  assert.equal(env.state.mods.length, 0);
  assert.equal(env.state.absMonth, 48);
  assert.equal(env.state.turnIdx, 0);
  assert.equal(env.state.turnCount, 0);
  assert.equal(env.state.over, false);
});

test('TC-TURN-32 中途章节开局会补演此前事件，热度与历史一致', () => {
  const env = F.boot({ chapter: 2 });   // 2018 开局，前面 96 个月的事件应已结算
  assert.equal(env.state.absMonth, 96);
  assert.equal(env.state.fired['g20'], true, 'G20 应已发生');
  assert.equal(env.state.fired['asian17'], true, '亚运选址应已发生');
  assert.ok(env.state.heat['钱江世纪城'] > env.REGIONS['钱江世纪城'].heat, '亚运选址应已抬高热度');
});

test('TC-TURN-33 中途章节开局不补演疫情冻结', () => {
  const env = F.boot({ chapter: 3 });   // 2022 开局
  assert.equal(env.state.freezeBuy, 0, '疫情冻结不应带到新章节');
});

/* ---------------- 落地与购买限制 ---------------- */

test('TC-TURN-34 交易冻结期间不能买地', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.state.freezeBuy = 1;
  const c = env.at(1);
  await env.landOn(p, c);
  assert.equal(c.owner, null);
});

test('TC-TURN-35 限购期名下已有 2 套不能继续买地', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.setPolicy('limitBuy', null);
  env.grant(p, env.at(1), 1);
  env.grant(p, env.at(2), 1);
  const c = env.at(4);
  assert.equal(c.t, 'plot');
  await env.landOn(p, c);
  assert.equal(c.owner, null, '限购期内应被拦截');
});

test('TC-TURN-36 区域冻结期间该区不能交易', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.at(1);
  env.state.freezeRegion = { region: c.region, until: 10 };
  env.setMonth(5);
  await env.landOn(p, c);
  assert.equal(c.owner, null);
});

test('TC-TURN-37 摇号：热度越高中签率越低，且落在 15%—70%', () => {
  const env = F.boot();
  env.setPolicy('lottery', null);
  const c = env.at(1);
  const rateAt = heat => Math.max(0.15, Math.min(0.7, 0.85 - heat / 150));
  assert.ok(Math.abs(rateAt(60) - 0.45) < 1e-9);
  assert.equal(rateAt(200), 0.15);
  assert.equal(rateAt(10), 0.7);

  const p = env.state.players[0];
  env.setHeat(c.region, 60);
  env.setRandom([0.4]);        // 0.4 < 0.45 → 中签
  return env.lotteryCheck(p, c).then(won => assert.equal(won, true));
});

test('TC-TURN-38 摇号未中则买不到地', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.at(1);
  env.setPolicy('lottery', null);
  env.setHeat(c.region, 60);
  env.setRandom([0.6]);        // 0.6 > 0.45 → 未中
  const won = await env.lotteryCheck(p, c);
  assert.equal(won, false);
});

test('TC-TURN-39 摇号中签卡（freePass）可免摇号一次', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.at(1);
  env.setPolicy('lottery', null);
  env.setHeat(c.region, 95);
  p.freePass = true;
  const won = await env.lotteryCheck(p, c);
  assert.equal(won, true);
  assert.equal(p.freePass, false, '免摇号资格用后即清');
});

/* ---------------- AI 行为 ---------------- */

test('TC-TURN-40 AI 现金不够时不会买地，也不会为此借钱', () => {
  const env = F.boot();
  const ai = env.state.players[1];
  ai.cash = 0; ai.debt = 0;
  const c = env.at(1);
  const ok = env.aiBuy(ai, c);
  assert.equal(ok, false);
  assert.equal(ai.debt, 0, '不应为买地产生负债');
});

test('TC-TURN-41 AI 名下无地且买得起时会出手', () => {
  const env = F.boot();
  const ai = env.state.players[1];
  ai.cash = 5000; ai.debt = 0;
  const c = env.at(1);
  assert.equal(env.aiBuy(ai, c), true);
});

test('TC-TURN-42 AI 不会买下自己已持有的地块', () => {
  const env = F.boot();
  const ai = env.state.players[1];
  const c = env.grant(ai, env.at(1), 1);
  const before = ai.cash;
  env.aiBuy(ai, c);
  assert.equal(c.owner, ai);
  assert.equal(ai.cash, before, '不应重复购买');
});

test('TC-TURN-43 AI 升级受"持有时间 + 热度"双门槛限制', () => {
  const env = F.boot();
  const ai = env.state.players[1];
  ai.cash = 5000;
  const c = env.grant(ai, env.at(1), 1);
  env.setRandom([0]);                 // 概率判定必过，只留门槛在起作用

  // Lv2 门槛：持有满 1 个月 + 热度 ≥ 30
  env.setMonth(0); c.boughtAt = 0;
  env.setHeat(c.region, 80);
  assert.equal(env.aiUpgrade(ai, c), false, '持有 0 个月不能升 Lv2');

  env.setMonth(1); c.boughtAt = 0;
  env.setHeat(c.region, 29);
  assert.equal(env.aiUpgrade(ai, c), false, '热度 29 不满足 Lv2 的 30');

  env.setMonth(1); c.boughtAt = 0;
  env.setHeat(c.region, 30);
  assert.equal(env.aiUpgrade(ai, c), true, '持有 1 个月 + 热度 30 可以升 Lv2');

  // Lv5 门槛：持有满 6 个月 + 热度 ≥ 75
  c.lv = 4;
  env.setMonth(5); c.boughtAt = 0;
  env.setHeat(c.region, 90);
  assert.equal(env.aiUpgrade(ai, c), false, '持有 5 个月不能升 Lv5');

  env.setMonth(6); c.boughtAt = 0;
  assert.equal(env.aiUpgrade(ai, c), true, '持有 6 个月 + 热度 90 可以升 Lv5');
});

test('TC-TURN-44 AI 现金安全线随难度变化：困难 < 普通 < 简单', () => {
  const needs = ['easy', 'normal', 'hard'].map(diff => {
    const env = F.boot({ diff });
    env.grant(env.state.players[0], env.at(1), 3);   // 场上有收费地块，平均过路费 > 0
    return env.aiNeed(env.state.players[1]);
  });
  assert.ok(needs[0] > needs[1], '简单难度应留更多现金');
  assert.ok(needs[1] > needs[2], '普通应比困难保守');
});

test('TC-TURN-45 开局日志的进场金额按时代系数缩放，不用角色基准值', () => {
  const { createEnv } = require('./env');
  const env = createEnv();
  env.newGame('hang', 'normal', 3);        // 2022 年开局，时代系数 1.86
  const p = env.state.players[0];
  const text = env.logText();
  const m = text.match(/带着 ([\d,]+) 万进场/);
  assert.ok(m, `日志里没找到进场金额：${text.slice(0, 120)}`);
  assert.equal(Number(m[1].replace(/,/g, '')), p.cash, '日志金额应等于玩家实际现金');
  assert.notEqual(p.cash, 960, '第四章起始资金应随时代系数放大');
  assert.equal(p.cash, Math.round(960 * 1.86));
});
