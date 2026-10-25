/* ============================================================
   存档与读档 · 需求 10.4
   用例前缀 TC-SAVE
   ============================================================ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');

test('TC-SAVE-01 存档带版本号，结构可 JSON 序列化', () => {
  const env = F.boot();
  const data = env.serialize();
  assert.equal(data.v, 1);
  assert.equal(data.chapter, 0);
  assert.equal(data.absMonth, 0);
  assert.equal(data.players.length, 4);
  assert.ok(Array.isArray(data.cells));
  const json = JSON.stringify(data);
  assert.ok(json.length > 100);
  assert.doesNotThrow(() => JSON.parse(json));
});

test('TC-SAVE-02 现金、负债、位置、股票完整往返', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 1234; p.debt = 56; p.pos = 7; p.stock = 3;
  env.saveTo(1);

  p.cash = 0; p.debt = 0; p.pos = 0; p.stock = 0;
  assert.equal(env.loadFrom(1), true);
  assert.equal(p.cash, 1234);
  assert.equal(p.debt, 56);
  assert.equal(p.pos, 7);
  assert.equal(p.stock, 3);
});

test('TC-SAVE-03 地块产权、等级、状态完整往返', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.at(1), 3);
  c.broken = false;
  c.boost = 2;
  c.discount = 0.9;
  c.maxLv = 4;
  c.block = true;
  env.saveTo(1);

  c.owner = null; c.lv = 0; c.boost = 0; c.discount = 1; c.maxLv = 3; c.block = false;
  assert.equal(env.loadFrom(1), true);
  assert.equal(c.owner, p);
  assert.equal(c.lv, 3);
  assert.equal(c.boost, 2);
  assert.equal(c.discount, 0.9);
  assert.equal(c.maxLv, 4);
  assert.equal(c.block, true);
});

test('TC-SAVE-04 热度、政策、已触发事件、股价完整往返', () => {
  const env = F.boot();
  env.setHeat('城东', 88);
  env.setPolicy('limitBuy', 30);
  env.state.fired['hot'] = true;
  env.state.stockPrice = 1234;
  env.saveTo(2);

  env.setHeat('城东', 20);
  env.state.mods = [];
  env.state.fired = {};
  env.state.stockPrice = 1000;
  assert.equal(env.loadFrom(2), true);
  assert.equal(env.state.heat['城东'], 88);
  assert.equal(env.state.stockPrice, 1234);
  assert.equal(env.state.fired['hot'], true);
  assert.ok(env.state.mods.some(m => m.key === 'limitBuy'));
});

test('TC-SAVE-05 监狱 / 风景区 / 清算状态完整往返', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.inJail = true; p.jailFail = 2;
  p.scenicTurns = 3; p.scenicName = '西湖风景区';
  p.liquidating = true; p.liqDeadline = 20;
  p.savedOnce = true;
  env.saveTo(3);

  p.inJail = false; p.jailFail = 0; p.scenicTurns = 0; p.scenicName = '';
  p.liquidating = false; p.liqDeadline = 0; p.savedOnce = false;
  assert.equal(env.loadFrom(3), true);
  assert.equal(p.inJail, true);
  assert.equal(p.jailFail, 2);
  assert.equal(p.scenicTurns, 3);
  assert.equal(p.scenicName, '西湖风景区');
  assert.equal(p.liquidating, true);
  assert.equal(p.liqDeadline, 20);
  assert.equal(p.savedOnce, true);
});

test('TC-SAVE-06 技能冷却与道具数量完整往返', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.skillCd = 7;
  p.items = { dice: 4, stay: 2, uturn: 1, block: 3 };
  env.saveTo(1);

  p.skillCd = 0;
  p.items = { dice: 0, stay: 0, uturn: 0, block: 0 };
  env.loadFrom(1);
  assert.equal(p.skillCd, 7);
  assert.equal(p.items.dice, 4);
  assert.equal(p.items.block, 3);
});

test('TC-SAVE-07 读档后进入可操作状态', () => {
  const env = F.boot();
  env.saveTo(1);
  env.state.started = false;
  env.state.over = true;
  env.loadFrom(1);
  assert.equal(env.state.started, true);
  assert.equal(env.state.over, false);
  assert.equal(env.state.busy, false);
});

test('TC-SAVE-08 空存档返回 false，不破坏当前局面', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 777;
  assert.equal(env.loadFrom(99), false);
  assert.equal(p.cash, 777);
});

test('TC-SAVE-09 版本号不匹配的存档被拒绝', () => {
  const env = F.boot();
  env.localStorage.setItem('hztycoon_v1_1', JSON.stringify({ v: 999, players: [] }));
  assert.equal(env.loadFrom(1), false);
});

test('TC-SAVE-10 损坏的存档不会抛异常', () => {
  const env = F.boot();
  env.localStorage.setItem('hztycoon_v1_1', '{ 这不是 JSON');
  assert.equal(env.loadFrom(1), false);
});

test('TC-SAVE-11 多个存档位互不覆盖', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 111;
  env.saveTo(1);
  p.cash = 222;
  env.saveTo(2);
  p.cash = 333;
  env.saveTo('auto');

  env.loadFrom(1);
  assert.equal(p.cash, 111);
  env.loadFrom(2);
  assert.equal(p.cash, 222);
  env.loadFrom('auto');
  assert.equal(p.cash, 333);
});

test('TC-SAVE-12 读档会清空棋盘上残留的旧产权', () => {
  const env = F.boot();
  env.saveTo(1);
  const p = env.state.players[0];
  const c = env.grant(p, env.at(5), 2);   // 存档之后新增的地
  env.loadFrom(1);
  assert.equal(c.owner, null, '存档中不存在的产权应被清空');
  assert.equal(c.lv, 0);
});
