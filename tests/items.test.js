/* ============================================================
   道具系统 · 需求 3.10
   用例前缀 TC-ITEM
   ============================================================ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');

test('TC-ITEM-01 初始道具：遥控骰子 3、停留卡 1、掉头卡 1、路障 1', () => {
  const env = F.boot();
  const p = env.state.players[0];
  assert.equal(p.items.dice, 3);
  assert.equal(p.items.stay, 1);
  assert.equal(p.items.uturn, 1);
  assert.equal(p.items.block, 1);
});

test('TC-ITEM-02 王中介自带 6 个遥控骰子，其余角色 3 个', () => {
  const env = F.boot({ charId: 'wang' });
  const wang = env.state.players.find(p => p.charId === 'wang');
  const other = env.state.players.find(p => p.charId !== 'wang');
  assert.equal(wang.items.dice, 6);
  assert.equal(other.items.dice, 3);
});

test('TC-ITEM-03 机会格掉落权重：骰子 40% / 停留 30% / 掉头 20% / 路障 10%', () => {
  const env = F.boot();
  const cases = [
    [0.00, 'dice'], [0.39, 'dice'],
    [0.40, 'stay'], [0.69, 'stay'],
    [0.70, 'uturn'], [0.89, 'uturn'],
    [0.90, 'block'], [0.999, 'block'],
  ];
  cases.forEach(([r, expected]) => {
    env.setRandom([r]);
    assert.equal(env.randomItemKey(), expected, `随机数 ${r} 应掉落 ${expected}`);
  });
});

test('TC-ITEM-04 落在机会格有 35% 概率额外掉一件道具', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const chance = env.curCells().find(c => c.t === 'chance');
  const total = () => Object.values(p.items).reduce((a, b) => a + b, 0);

  /* V1.8：牌堆是随机抽样的，卡面效果也可能发道具。
     这里把牌堆固定成一张无副作用的卡，单独验证 35% 掉落。 */
  env.state.decks = { "机会": [{ t: "测试卡", d: "无效果", act: () => "无效果" }] };

  const before = total();
  env.setRandom([0]);                // 0 < 0.35，掉落
  await env.landOn(p, chance);
  assert.equal(total(), before + 1, '应掉落 1 件');

  env.state.decks = { "机会": [{ t: "测试卡", d: "无效果", act: () => "无效果" }] };
  const after = total();
  env.setRandom([0.5]);              // 0.5 > 0.35，不掉落
  await env.landOn(p, chance);
  assert.equal(total(), after, '未命中概率不应掉落');
});

test('TC-ITEM-05 道具商店按总资产 3% 定价，低于 10 万按下限（V1.8）', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const shop = env.curCells().find(c => c.t === 'shop');
  assert.ok(shop, '棋盘上应有商店格');
  assert.equal(shop.idx, 15, '商店在 15 号格');

  p.cash = 1000; p.debt = 0;
  env.allCells().forEach(c => { if (c.t === 'plot') { c.owner = null; c.lv = 0; } });
  assert.equal(env.shopPrice(p), 30, '净资产 1000 万 → 30 万');

  p.cash = 200;
  assert.equal(env.shopPrice(p), 10, '低于下限时按下限 10 万');
});

test('TC-ITEM-06 买入指数时 13% 概率掉掉头卡', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const stock = env.curCells().find(c => c.t === 'stock');
  p.cash = 5000;
  p.items.uturn = 0;
  env.eval('askStock = async () => "buy"');
  env.setRandom([0]);
  await env.landOn(p, stock);
  assert.equal(p.stock, 1, '应买入 1 手');
  assert.equal(p.items.uturn, 1, '应掉落掉头卡');
  env.eval('askStock = async () => null');
});

test('TC-ITEM-07 进监狱时 5% 概率掉路障', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.items.block = 0;
  env.setRandom([0]);
  env.sendToJail(p, '测试');
  assert.equal(p.items.block, 1);

  p.items.block = 0;
  env.setRandom([0.5]);
  env.sendToJail(p, '测试');
  assert.equal(p.items.block, 0);
});

test('TC-ITEM-08 路障不能放在起点、监狱、风景区', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.items.block = 3;
  ['start', 'jail', 'scenic'].forEach(t => {
    const cell = env.curCells().find(c => c.t === t);
    assert.equal(env.placeBlock(p, cell), false, `${t} 格不应允许放路障`);
    assert.equal(cell.block, undefined, `${t} 格不应被标记`);
  });
  assert.equal(p.items.block, 3, '放置失败不应消耗道具');
});

test('TC-ITEM-09 路障可放在地块与功能格，且消耗一个', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.items.block = 1;
  const cell = env.at(1);
  assert.equal(env.placeBlock(p, cell), true);
  assert.equal(cell.block, true);
  assert.equal(p.items.block, 0);
});

test('TC-ITEM-10 同一格不能叠放两个路障', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.items.block = 2;
  const cell = env.at(1);
  env.placeBlock(p, cell);
  assert.equal(env.placeBlock(p, cell), false);
  assert.equal(p.items.block, 1, '第二次失败不应扣道具');
});

test('TC-ITEM-11 没有道具时使用失败，且不改变状态', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.items.dice = 0;
  assert.equal(env.useDiceItem(p, 6), false);
  assert.equal(p.nextRoll, 0);

  p.items.stay = 0;
  assert.equal(env.useStayItem(p), false);
  assert.equal(p.skipMove, false);

  p.items.uturn = 0;
  assert.equal(env.useUturnItem(p), false);
  assert.equal(p.reverse, false);
});

test('TC-ITEM-12 遥控骰子指定点数并生效', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.put(p, 24);
  p.items.dice = 1;
  assert.equal(env.useDiceItem(p, 4), true);
  assert.equal(p.nextRoll, 4);
  assert.equal(p.items.dice, 0);
  env.setRandom([0.999]);            // 自然掷骰会被指定值覆盖
  await env.takeTurn();
  assert.equal(p.pos, (24 + 4) % 26);
  assert.equal(p.nextRoll, 0, '用后即清');
});

test('TC-ITEM-13 遥控骰子在监狱里可指定偶数越狱', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const jailIdx = env.curCells().findIndex(c => c.t === 'jail');
  p.inJail = true; p.jailFail = 0; p.pos = jailIdx;
  env.useDiceItem(p, 6);
  await env.takeTurn();
  assert.equal(p.inJail, false);
  assert.equal(p.pos, (jailIdx + 6) % 26);
});

test('TC-ITEM-14 停留卡设置本回合不动', () => {
  const env = F.boot();
  const p = env.state.players[0];
  assert.equal(env.useStayItem(p), true);
  assert.equal(p.skipMove, true);
  assert.equal(p.items.stay, 0);
});

test('TC-ITEM-15 掉头卡设置下一次反向移动', () => {
  const env = F.boot();
  const p = env.state.players[0];
  assert.equal(env.useUturnItem(p), true);
  assert.equal(p.reverse, true);
  assert.equal(p.items.uturn, 0);
});

test('TC-ITEM-16 关押期间除遥控骰子外不能用道具', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.inJail = true;
  env.state.turnIdx = 0;
  const stay = p.items.stay;
  const uturn = p.items.uturn;
  const block = p.items.block;
  env.onItemClick('stay');
  env.onItemClick('uturn');
  env.onItemClick('block');
  assert.equal(p.items.stay, stay, '关押期间不应消耗停留卡');
  assert.equal(p.items.uturn, uturn);
  assert.equal(p.items.block, block);
});

test('TC-ITEM-17 度假期间不能用任何道具', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.scenicTurns = 2;
  env.state.turnIdx = 0;
  const dice = p.items.dice;
  env.onItemClick('dice');
  assert.equal(p.items.dice, dice, '度假期间不应消耗骰子');
});

test('TC-ITEM-18 不是自己的回合不能用道具', () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.state.turnIdx = 1;
  const stay = p.items.stay;
  env.onItemClick('stay');
  assert.equal(p.items.stay, stay);
  assert.equal(p.skipMove, false);
});

test('TC-ITEM-19 道具数量不会变成负数', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.items.dice = 0;
  env.takeItem(p, 'dice');
  assert.equal(p.items.dice, 0);
});

test('TC-ITEM-20 存档会保留道具数量', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.items = { dice: 5, stay: 2, uturn: 0, block: 3 };
  env.saveTo(1);
  p.items = { dice: 0, stay: 0, uturn: 0, block: 0 };
  assert.equal(env.loadFrom(1), true);
  assert.equal(p.items.dice, 5);
  assert.equal(p.items.stay, 2);
  assert.equal(p.items.block, 3);
});
