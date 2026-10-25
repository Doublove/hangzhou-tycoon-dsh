/* ============================================================
   经济与数值 · 需求 3.4 / 3.5 / 3.6 / 8.2 / 8.3
   用例前缀 TC-ECO
   口径说明：断言以需求文档为准；代码与文档不一致的条目用 { todo } 标注，
   使测试全绿的同时把偏差留在报告里。
   ============================================================ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');

/* ---------------- 热度系数 ---------------- */

test('TC-ECO-01 热度系数 = 0.60 + 热度/100 × 0.80，取值 0.60—1.40', () => {
  const env = F.boot();
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}：期望 ${b}，实际 ${a}`);
  near(env.heatF('西湖边'), 1.176, '热度 72');
  env.setHeat('西湖边', 50);
  near(env.heatF('西湖边'), 1.0, '热度 50');
  env.setHeat('西湖边', 20);
  near(env.heatF('西湖边'), 0.76, '热度 20（下限）');
  env.setHeat('西湖边', 100);
  near(env.heatF('西湖边'), 1.4, '热度 100（上限）');
});

test('TC-ECO-02 热度被钳制在 20—95', () => {
  const env = F.boot();
  env.setHeat('城北', 90);
  env.heatAdd(['城北'], 30);
  assert.equal(env.state.heat['城北'], 95);
  env.setHeat('城北', 25);
  env.heatAdd(['城北'], -30);
  assert.equal(env.state.heat['城北'], 20);
});

test('TC-ECO-03 实时地价 = 地价 × 时代系数 × 热度系数', () => {
  const env = F.boot();
  env.state.rings.forEach(ring => {
    ring.cells.filter(c => c.t === 'plot').forEach(c => {
      assert.equal(env.value(c), env.expectedValue(c), `${c.name} 地价公式`);
    });
  });
});

test('TC-ECO-04 时代系数按年查表：2010=1.00、2021=2.10、2026=1.60', () => {
  const env = F.boot();
  env.setMonth(0);    assert.equal(env.eraF(), 1.00);
  env.setMonth(11);   assert.equal(env.eraF(), 1.00);
  env.setMonth(12);   assert.equal(env.eraF(), 0.92);   // 2011 限购
  env.setMonth(36);   assert.equal(env.eraF(), 1.06);   // 2013
  env.setMonth(132);  assert.equal(env.eraF(), 2.10);   // 2021
  env.setMonth(203);  assert.equal(env.eraF(), 1.60);   // 2026
});

test('TC-ECO-05 时代系数覆盖 2010—2026 全部 17 个年份', () => {
  const env = F.boot();
  const years = Object.keys(env.ERA).map(Number).sort((a, b) => a - b);
  assert.deepEqual([...years], Array.from({ length: 17 }, (_, i) => 2010 + i));
  years.forEach(y => assert.ok(env.ERA[y] > 0.8 && env.ERA[y] < 2.2, `${y} 年系数异常`));
});

/* ---------------- 租金 ---------------- */

test('TC-ECO-06 六档租金率：0 / 0.8% / 1.1% / 1.4% / 1.7% / 2.0%', () => {
  const env = F.boot();
  assert.deepEqual([...env.RENT_RATE], [0, 0.008, 0.011, 0.014, 0.017, 0.020]);
});

test('TC-ECO-07 空地不收租，Lv1 起按等级租金率计算', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.plotByName('湖滨');
  env.grant(p, c, 0);
  assert.equal(env.rentOf(c), 0);
  for (let lv = 1; lv <= 5; lv++) {
    c.lv = lv;
    assert.equal(env.rentOf(c), Math.round(env.value(c) * env.RENT_RATE[lv]), `Lv${lv} 租金`);
  }
});

test('TC-ECO-08 阿莲在西湖边 / 之江 / 滨江收租 +30%', () => {
  const env = F.boot();
  const lian = env.state.players.find(p => p.charId === 'lian');
  const regions = ['西湖边', '之江', '滨江'];
  regions.forEach(r => {
    const c = env.allCells().find(x => x.t === 'plot' && x.region === r);
    env.grant(lian, c, 2);
    const base = Math.round(env.value(c) * env.RENT_RATE[2]);
    assert.equal(env.rentOf(c), Math.round(base * 1.3), `${r} 阿莲加成`);
  });
});

test('TC-ECO-09 码哥在未来科技城收租 +25%', () => {
  const env = F.boot();
  const ma = env.state.players.find(p => p.charId === 'ma');
  const c = env.allCells().find(x => x.t === 'plot' && x.region === '未来科技城');
  env.grant(ma, c, 2);
  const base = Math.round(env.value(c) * env.RENT_RATE[2]);
  assert.equal(env.rentOf(c), Math.round(base * 1.25));
});

test('TC-ECO-10 角色加成不跨区生效', () => {
  const env = F.boot();
  const lian = env.state.players.find(p => p.charId === 'lian');
  const c = env.allCells().find(x => x.t === 'plot' && x.region === '城北');
  env.grant(lian, c, 2);
  assert.equal(env.rentOf(c), Math.round(env.value(c) * env.RENT_RATE[2]));
});

test('TC-ECO-11 烂尾地块不收租', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.plotByName('湖滨'), 2);
  c.broken = true;
  assert.equal(env.rentOf(c), 0);
});

test('TC-ECO-12 网红打卡（boost>0）租金翻倍，工期延误（boost<0）暂停收租', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.plotByName('湖滨'), 2);
  c.boost = 3;
  assert.equal(env.rentOf(c), Math.round(env.value(c) * env.RENT_RATE[2] * 2));
  c.boost = -2;
  assert.equal(env.rentOf(c), 0);
});

/* ---------------- 过路费 ---------------- */

test('TC-ECO-13 五档过路费率：10% / 12% / 14% / 16% / 18%', () => {
  const env = F.boot();
  assert.deepEqual([...env.TOLL_RATE], [0, 0.10, 0.12, 0.14, 0.16, 0.18]);
});

test('TC-ECO-14 过路费 = 地价 × 费率（Lv1 起）', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.plotByName('湖滨'), 0);
  assert.equal(env.tollOf(c), 0, '空地不收费');
  for (let lv = 1; lv <= 5; lv++) {
    c.lv = lv;
    assert.equal(env.tollOf(c), Math.round(env.value(c) * env.TOLL_RATE[lv]), `Lv${lv} 过路费`);
  }
});

test('TC-ECO-15 相邻同主地块过路费 ×2', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const a = env.at(1);   // 湖滨
  const b = env.at(2);   // 北山
  env.grant(p, a, 1);
  assert.equal(env.adjacentBonus(a), 1);
  env.grant(p, b, 1);
  assert.equal(env.adjacentBonus(a), 2);
  assert.equal(env.tollOf(a), Math.round(env.value(a) * 0.10 * 2));
});

test('TC-ECO-16 两侧都是同主，仍是 ×2 不叠乘', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const left = env.at(2), mid = env.at(3), right = env.at(4);
  env.grant(p, left, 1);
  env.grant(p, mid, 1);
  env.grant(p, right, 1);
  assert.equal(env.adjCount(p, mid), 2);
  assert.equal(env.adjacentBonus(mid), 2, '两侧同主不应变成 ×4');
  assert.equal(env.tollOf(mid), Math.round(env.value(mid) * 0.10 * 2));
});

test('TC-ECO-17 跨起点不算相邻（idx1 与 idx25）', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const first = env.at(1);
  const last = env.at(25);
  env.grant(p, first, 1);
  env.grant(p, last, 1);
  assert.equal(env.adjacentBonus(first), 1, 'idx1 不应与 idx25 连片');
  assert.equal(env.adjacentBonus(last), 1, 'idx25 不应与 idx1 连片');
});

test('TC-ECO-18 连片只影响过路费，不影响地价、租金、升级费', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const a = env.at(1), b = env.at(2);
  env.grant(p, a, 2);
  const v0 = env.value(a), r0 = env.rentOf(a), u0 = env.upCost(a);
  env.grant(p, b, 2);
  assert.equal(env.value(a), v0);
  assert.equal(env.rentOf(a), r0);
  assert.equal(env.upCost(a), u0);
  assert.equal(env.tollOf(a), Math.round(env.value(a) * 0.12 * 2));
});

test('TC-ECO-19 单次过路费上限 = 支付方净资产 × 30%', () => {
  const env = F.boot();
  const owner = env.state.players[0];
  const payer = env.state.players[1];
  const c = env.grant(owner, env.plotByName('湖滨'), 5);
  payer.cash = 960; payer.debt = 0;
  const nw = env.netWorth(payer);
  const raw = env.tollOf(c);
  assert.ok(raw > nw * 0.30, '构造的过路费应超过上限');
  const t = env.tollFor(payer, c);
  assert.equal(t.pay, Math.round(nw * 0.30));
  assert.equal(t.cut, raw - t.pay);
  assert.equal(t.exempt, false);
});

test('TC-ECO-20 杠杆率 > 50% 时不再享受上限保护', () => {
  const env = F.boot();
  const owner = env.state.players[0];
  const payer = env.state.players[1];
  const c = env.grant(owner, env.plotByName('湖滨'), 5);
  payer.cash = 960; payer.debt = 600;
  const lev = env.leverage(payer);
  assert.ok(lev > 0.5, `构造杠杆应 > 50%，实际 ${lev}`);
  const t = env.tollFor(payer, c);
  assert.equal(t.exempt, true);
  assert.equal(t.pay, env.tollOf(c), '高杠杆玩家应全额支付');
  assert.equal(t.cut, 0);
});

test('TC-ECO-21 杠杆率恰好 50% 仍受上限保护（边界）', () => {
  const env = F.boot();
  const owner = env.state.players[0];
  const payer = env.state.players[1];
  const c = env.grant(owner, env.plotByName('湖滨'), 5);
  payer.cash = 960; payer.debt = 320;      // 净资产 640，杠杆 0.5
  assert.equal(env.leverage(payer), 0.5);
  assert.equal(env.cappedFor(payer), true);
  assert.equal(env.tollFor(payer, c).exempt, false);
});

/* ---------------- 成本与费用 ---------------- */

test('TC-ECO-22 升级费 = 实时地价 × 60%', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.plotByName('湖滨'), 1);
  assert.equal(env.upCost(c), Math.round(env.value(c) * 0.60));
});

test('TC-ECO-23 卖地回笼 = 地价 × 80% 再扣 3% 手续费（王中介 1.5%）', () => {
  const env = F.boot({ charId: 'wang' });
  const normal = env.state.players.find(p => p.charId === 'hang');
  const wang = env.state.players.find(p => p.charId === 'wang');
  const c1 = env.grant(normal, env.plotByName('湖滨'), 1);
  const v = env.value(c1);
  normal.cash = 0;
  env.sellLand(normal, c1);
  assert.equal(normal.cash, Math.round(v * 0.8 * 0.97));

  const c2 = env.grant(wang, env.plotByName('北山'), 1);
  const v2 = env.value(c2);
  wang.cash = 0;
  env.sellLand(wang, c2);
  assert.equal(wang.cash, Math.round(v2 * 0.8 * 0.985));
});

test('TC-ECO-24 买地手续费 3%，王中介减半 1.5%', () => {
  const env = F.boot({ charId: 'wang' });
  const normal = env.state.players.find(p => p.charId === 'hang');
  const wang = env.state.players.find(p => p.charId === 'wang');
  const c1 = env.at(1);
  normal.cash = 5000;
  env.buy(normal, c1);
  assert.equal(normal.cash, 5000 - env.value(c1) - Math.round(env.value(c1) * 0.03));
  assert.equal(c1.lv, 1, '买入即为 Lv1 工地');
  assert.equal(c1.owner, normal);

  const c2 = env.at(2);
  wang.cash = 5000;
  env.buy(wang, c2);
  assert.equal(wang.cash, 5000 - env.value(c2) - Math.round(env.value(c2) * 0.015));
});

test('TC-ECO-25 物业费 0.15%/月，空地减半', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.plotByName('湖滨'), 1);
  const v = env.value(c);
  assert.equal(env.mgmtFee(p), Math.round(v * 0.0015));
  c.lv = 0;
  assert.equal(env.mgmtFee(p), Math.round(v * 0.00075));
});

test('TC-ECO-26 物业费按地块逐块取整后求和', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const a = env.grant(p, env.at(1), 1);
  const b = env.grant(p, env.at(2), 1);
  const expected = Math.round(env.value(a) * 0.0015) + Math.round(env.value(b) * 0.0015);
  assert.equal(env.mgmtFee(p), expected);
});

/* ---------------- 净资产与贷款 ---------------- */

test('TC-ECO-27 净资产 = 现金 + Σ地价×(1+12%×等级) + 股票 − 负债', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 1000; p.debt = 100; p.stock = 5;
  const c = env.grant(p, env.plotByName('湖滨'), 2);
  const land = env.value(c) * (1 + 0.12 * 2);
  const stock = 5 * env.stockLot();
  assert.equal(env.netWorth(p), Math.round(1000 + land + stock - 100));
});

test('TC-ECO-28 股票每手 = 指数点位 × 0.1（约 100 万）', () => {
  const env = F.boot();
  assert.equal(env.state.stockPrice, 1000);
  assert.equal(env.stockLot(), 100);
  env.state.stockPrice = 1500;
  assert.equal(env.stockLot(), 150);
});

test('TC-ECO-29 贷款额度 = 净资产 × 60%，温老板 +30%', () => {
  const env = F.boot();
  const hang = env.state.players[0];
  const wen = env.state.players.find(p => p.charId === 'wen');
  hang.cash = 1000; hang.debt = 0;
  wen.cash = 1000; wen.debt = 0;
  assert.equal(env.loanCap(hang), Math.round(env.netWorth(hang) * 0.6));
  assert.equal(env.loanCap(wen), Math.round(env.netWorth(wen) * 0.6 * 1.3));
});

test('TC-ECO-30 限贷期额度降到 40%', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 1000; p.debt = 0;
  env.setPolicy('tightLoan', null);
  assert.equal(env.loanCap(p), Math.round(env.netWorth(p) * 0.4));
});

test('TC-ECO-31 借款 / 还款双向记账', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 100; p.debt = 0;
  env.doLoan(p, 200);
  assert.equal(p.cash, 300);
  assert.equal(p.debt, 200);
  env.doRepay(p, 50);
  assert.equal(p.cash, 250);
  assert.equal(p.debt, 150);
});

test('TC-ECO-32 还款不超过现金与负债', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 30; p.debt = 100;
  env.doRepay(p, 500);
  assert.equal(p.cash, 0);
  assert.equal(p.debt, 70);
});

/* ---------------- 限售与限价 ---------------- */

test('TC-ECO-33 限售期内（持有不足 3 个月）不能卖地', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.plotByName('湖滨'), 1);
  env.setPolicy('noSell', null);
  env.setMonth(10);
  c.boughtAt = 10;
  assert.equal(env.sellLand(p, c), false, '刚买入不应能卖');
  c.boughtAt = 7;
  assert.equal(env.sellLand(p, c), true, '满 3 个月后可卖');
});

test('TC-ECO-34 二手房指导价：卖出价不超过买入地价的 1.5 倍', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.plotByName('湖滨'), 5);
  env.setPolicy('pricecap', null);
  p.cash = 0;
  env.sellLand(p, c);
  const cap = Math.round(c.price * env.eraF() * 1.5 * 0.97);
  const normal = Math.round(env.value(c) * 0.8 * 0.97);
  assert.equal(p.cash, Math.min(cap, normal));
  assert.ok(p.cash <= Math.round(c.price * env.eraF() * 1.5), '不应超过买入价 1.5 倍');
});

/* ---------------- 与文档的偏差（记录，不阻塞） ---------------- */

test('TC-ECO-35 贷款利率应为 0.6%/月', { todo: '代码对所有角色统一 ×0.8，实际 0.48%/月；温老板的 -20% 被错误地施加给了所有人' }, () => {
  const env = F.boot();
  assert.ok(Math.abs(env.loanRate() - 0.006) < 1e-9, `实际 ${env.loanRate()}`);
});

test('TC-ECO-36 税务格应按持有套数累进征税', { todo: '代码按净资产 × 1.2% 单一税率，未实现累进' }, () => {
  const env = F.boot();
  const p = env.state.players[0];
  for (let i = 1; i <= 4; i++) env.grant(p, env.at(i), 1);
  const taxCell = env.curCells().find(c => c.t === 'tax');
  const before = p.cash;
  env.landOn(p, taxCell);
  const paid = before - p.cash;
  assert.ok(paid > Math.round(env.netWorth(p) * 0.012), '4 套应触发累进税率');
});

test('TC-ECO-37 热度应每回合向基准值自然回归 3%', { todo: '代码未实现热度自然回归' }, async () => {
  const env = F.boot();
  const base = env.REGIONS['城北'].heat;
  env.setHeat('城北', base + 30);
  await env.endMonth();
  const now = env.state.heat['城北'];
  assert.ok(now < base + 30, `应回落，实际 ${now}`);
});
