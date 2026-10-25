/* ============================================================
   破产与清算 · 需求 8.5
   用例前缀 TC-BANK
   ============================================================ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');

test('TC-BANK-01 现金为负时先卖地补窟窿，不直接出局', async () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  const c = env.grant(p, env.at(1), 1);
  p.cash = -100;
  const price = Math.round(env.value(c) * 0.8 * 0.97);
  await env.settle(p);
  assert.equal(p.bankrupt, false);
  assert.equal(c.owner, null, '地应被卖掉');
  assert.equal(p.cash, -100 + price);
});

test('TC-BANK-02 卖地仍不够且非杭铁头，则破产出局', async () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  env.grant(p, env.at(1), 1);
  p.cash = -100000;
  await env.settle(p);
  assert.equal(p.bankrupt, true);
});

test('TC-BANK-03 出局后名下地块被清空并进入法拍', async () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  const c = env.grant(p, env.at(1), 1);
  p.cash = -100000;
  const rich = env.state.players.find(x => x !== p);
  rich.cash = 100000;
  env.setRandom([0]);                  // 法拍 60% 概率成交
  await env.settle(p);
  assert.equal(p.bankrupt, true);
  assert.equal(env.owned(p).length, 0, '出局者名下不应还有地');
  assert.notEqual(c.owner, p);
});

test('TC-BANK-04 限售期内卖不掉地，只能走破产流程', async () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  const c = env.grant(p, env.at(1), 1);
  env.setPolicy('noSell', null);
  env.setMonth(5);
  c.boughtAt = 5;
  p.cash = -100;
  await env.settle(p);
  assert.ok(p.cash < 0, '限售期内没有回笼资金');
  assert.equal(p.bankrupt, true);
});

test('TC-BANK-05 净资产为负触发强制拍卖（85% 市价）', async () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  const c = env.grant(p, env.at(1), 1);
  p.cash = 100; p.debt = 5000;
  assert.ok(env.netWorth(p) < 0, '构造场景应为资不抵债');
  const buyer = env.state.players.find(x => x !== p);
  buyer.cash = 100000;
  const expect = Math.round(env.value(c) * 0.85);
  const before = buyer.cash;
  env.setRandom([0]);
  env.startLiquidation(p);
  assert.equal(p.liquidating, true);
  assert.equal(c.owner, buyer, '应由其他玩家接手');
  assert.equal(before - buyer.cash, expect);
});

test('TC-BANK-06 无人接手时按 7 折抵押给银行，地块回到市场', () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  const c = env.grant(p, env.at(1), 1);
  p.cash = 0; p.debt = 5000;
  env.state.players.filter(x => x !== p).forEach(x => { x.cash = 0; });
  env.setRandom([0]);
  const mortgage = Math.round(env.value(c) * 0.7);
  env.startLiquidation(p);
  assert.equal(c.owner, null, '应回到市场');
  assert.equal(p.debt, 5000 - mortgage, '抵押款应全部抵债');
  assert.equal(p.cash, 0, '抵债后不留现金');
});

test('TC-BANK-07 拍卖所得全部用于还债，先还清再谈其他', () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  env.grant(p, env.at(1), 1);
  p.cash = 0; p.debt = 5000;
  env.state.players.find(x => x !== p).cash = 100000;
  env.setRandom([0]);
  env.startLiquidation(p);
  assert.equal(p.cash, 0, '回笼资金应全部抵债');
  assert.ok(p.debt < 5000, '负债应减少');
});

test('TC-BANK-08 清算启动后记录 3 个月宽限期', () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  p.cash = 0; p.debt = 5000;
  env.setMonth(10);
  env.startLiquidation(p);
  assert.equal(p.liquidating, true);
  assert.equal(p.liqDeadline, 13);
});

test('TC-BANK-09 清算期满仍未还清，宣告破产出局', async () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  p.cash = 100; p.debt = 5000;         // 无地可拍，只能等宽限期
  await env.endMonth();                // 触发清算
  assert.equal(p.liquidating, true);
  const deadline = p.liqDeadline;
  while (env.state.absMonth < deadline) await env.endMonth();
  assert.equal(env.state.absMonth, deadline);
  assert.equal(p.bankrupt, true, '期满应出局');
});

test('TC-BANK-10 宽限期内还清债务则解除清算', async () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  p.cash = 100; p.debt = 5000;
  await env.endMonth();
  assert.equal(p.liquidating, true);
  p.debt = 0; p.cash = 100;            // 模拟靠技能/变卖还清
  await env.endMonth();
  assert.equal(p.liquidating, false, '债务清零应解除清算');
  assert.equal(p.bankrupt, false);
});

test('TC-BANK-11 出局者不再参与后续章节', () => {
  const env = F.boot();
  const dead = env.state.players[2];
  dead.bankrupt = true;
  env.nextChapter();
  assert.equal(dead.bankrupt, true);
});

test('TC-BANK-12 破产者不再产生租金、不再被扣物业费', async () => {
  const env = F.boot();
  const dead = env.state.players[1];
  env.grant(dead, env.at(2), 2);
  dead.bankrupt = true;
  const before = dead.cash;
  await env.endMonth();
  assert.equal(dead.cash, before);
});

test('TC-BANK-13 清算期内仍可正常掷骰行动', async () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  p.liquidating = true; p.liqDeadline = 99;
  env.put(p, 12);            // 12 → 13 是地块，无随机卡牌
  env.setRandom([0]);
  await env.takeTurn(env.state.players.indexOf(p));
  assert.equal(p.pos, 13, '清算期不应阻止移动');
});

test('TC-BANK-14 清算拍卖不足以清偿时，宽限期满即出局（结构性缺口）',
  { todo: '地块按 value×(1+12%×lv) 计入净资产，但拍卖只给 85%、抵押只给 70%，债务清零分支实际不可达' },
  () => {
    const env = F.boot({ charId: 'wen' });
    const p = env.state.players.find(x => x.charId === 'wen');
    env.grant(p, env.at(1), 3);
    p.cash = 0; p.debt = 5000;
    env.state.players.find(x => x !== p).cash = 100000;
    env.setRandom([0]);
    env.startLiquidation(p);
    assert.equal(p.debt <= 0, true, '拍卖后应能还清');
  });
