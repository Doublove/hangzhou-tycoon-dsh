/* ============================================================
   历史事件 · 政策 · 机会卡与命运卡
   需求 2.2 / 4.1 / 5.1 / 5.4 / 3.6
   用例前缀 TC-CARD
   ============================================================ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');

/* ---------------- 事件表结构 ---------------- */

test('TC-CARD-01 事件表按月份升序排列，key 唯一', () => {
  const env = F.boot();
  const events = [...env.EVENTS];
  assert.ok(events.length >= 30, `事件应有 30 条以上，实际 ${events.length}`);
  const keys = events.map(e => e.key);
  assert.equal(new Set(keys).size, keys.length, '存在重复 key');
  for (let i = 1; i < events.length; i++) {
    assert.ok(events[i].m >= events[i - 1].m, `第 ${i} 条事件月份乱序`);
  }
});

test('TC-CARD-02 每条事件字段完整，且月份落在 2010.01—2026.12', () => {
  const env = F.boot();
  env.EVENTS.forEach(e => {
    assert.ok(e.key && e.name && e.desc && e.detail, `${e.key} 字段缺失`);
    assert.ok(['event', 'policy'].includes(e.kind), `${e.key} kind 非法`);
    assert.ok(e.m >= 0 && e.m <= 203, `${e.key} 月份越界：${e.m}`);
  });
});

test('TC-CARD-03 政策类事件必须带 until 或显式永久生效', () => {
  const env = F.boot();
  const policies = env.EVENTS.filter(e => e.policy);
  assert.ok(policies.length >= 4, '政策事件数量不足');
  policies.forEach(e => {
    assert.ok('until' in e, `${e.key} 缺少 until 字段`);
    if (e.until != null) assert.ok(e.until > e.m, `${e.key} 的解除月份应晚于生效月份`);
  });
});

test('TC-CARD-04 事件覆盖四章，每章都有内容', () => {
  const env = F.boot();
  const buckets = [0, 0, 0, 0];
  env.EVENTS.forEach(e => {
    const ch = Math.min(3, Math.floor(e.m / 48));
    buckets[ch]++;
  });
  buckets.forEach((n, i) => assert.ok(n >= 4, `第 ${i + 1} 章只有 ${n} 条事件`));
});

/* ---------------- 事件触发 ---------------- */

test('TC-CARD-05 事件在对应月份触发，并改变热度', async () => {
  const env = F.boot();
  const before = env.state.heat['城东'];
  env.setMonth(1);                     // 月末推进到 2010.03（m=2）
  await env.endMonth();
  assert.equal(env.state.absMonth, 2);
  assert.equal(env.state.fired['hot'], true);
  assert.equal(env.state.heat['城东'], before + 20);
});

test('TC-CARD-06 同一事件只触发一次', async () => {
  const env = F.boot();
  env.setMonth(1);
  await env.endMonth();
  const heat = env.state.heat['城东'];
  env.setMonth(1);                     // 人为把月份拨回去
  await env.endMonth();
  assert.equal(env.state.heat['城东'], heat, '不应二次生效');
});

test('TC-CARD-07 全城事件对所有区域生效', async () => {
  const env = F.boot();
  const before = { ...env.state.heat };
  env.setMonth(7);                     // m=8 成交量创新高，全城 +8
  await env.endMonth();
  Object.keys(env.REGIONS).forEach(r => {
    const expect = Math.min(95, before[r] + 8);
    assert.equal(env.state.heat[r], expect, `${r} 未按全城事件变化`);
  });
});

test('TC-CARD-08 政策生效写入 mods，可供 HUD 展示', async () => {
  const env = F.boot();
  env.setMonth(12);                    // m=13 限购令
  await env.endMonth();
  const mod = env.state.mods.find(m => m.key === 'limitBuy');
  assert.ok(mod, '政策应写入 mods');
  assert.equal(mod.name, '限购令落地');
  assert.ok(mod.detail.length > 0, '政策详情用于悬停提示');
  assert.equal(env.hasPolicy('limitBuy'), true);
});

test('TC-CARD-09 政策到期自动解除', async () => {
  const env = F.boot();
  env.setMonth(12);
  await env.endMonth();                // 触发限购
  assert.equal(env.hasPolicy('limitBuy'), true);
  env.setMonth(24);
  await env.endMonth();                // 到 until=25 解除
  assert.equal(env.hasPolicy('limitBuy'), false);
  assert.equal(env.state.mods.some(m => m.key === 'limitBuy'), false);
});

test('TC-CARD-10 全面取消限购会立即清除限购类政策', async () => {
  const env = F.boot();
  env.setPolicy('limitBuy', null);
  env.setPolicy('limit16', null);
  env.setMonth(171);                   // m=172 全面取消限购
  await env.endMonth();
  assert.equal(env.hasPolicy('limitBuy'), false);
  assert.equal(env.hasPolicy('limit16'), false);
});

test('TC-CARD-11 疫情停摆冻结买地一个月', async () => {
  const env = F.boot();
  env.setMonth(120);                   // m=121
  await env.endMonth();
  assert.equal(env.state.freezeBuy, 1);
  await env.endMonth();                // 下个月末解冻
  assert.equal(env.state.freezeBuy, 0);
});

test('TC-CARD-12 奥体代持风波冻结钱江世纪城 3 个月', async () => {
  const env = F.boot();
  env.setMonth(141);                   // m=142
  await env.endMonth();
  assert.equal(env.state.freezeRegion.region, '钱江世纪城');
  assert.equal(env.state.freezeRegion.until, 145);
});

test('TC-CARD-13 停工潮让部分在建地块烂尾，价值大幅缩水', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.allCells().find(x => x.t === 'plot' && ['城东', '城北'].includes(x.region));
  env.grant(p, c, 1);
  env.setRandom([0]);                  // 必定命中 25% 概率
  env.setMonth(147);                   // m=148 停工与交付风险
  await env.endMonth();
  assert.equal(c.broken, true);
  const brokenValue = env.value(c);
  c.broken = false;                    // 同一时点对照，排除时代系数变化
  const fullValue = env.value(c);
  c.broken = true;
  assert.equal(brokenValue, Math.round(fullValue * 0.2), '烂尾后价值应缩到两成');
  assert.equal(env.rentOf(c), 0, '烂尾地块不再产生租金');
});

test('TC-CARD-14 历史事件抬高等级上限（如 CBD 成型）', async () => {
  const env = F.boot();
  const before = env.allCells()
    .filter(c => c.t === 'plot' && c.region === '钱江新城')
    .map(c => c.maxLv);
  env.setMonth(43);                    // m=44
  await env.endMonth();
  const after = env.allCells()
    .filter(c => c.t === 'plot' && c.region === '钱江新城')
    .map(c => c.maxLv);
  after.forEach((v, i) => assert.equal(v, Math.min(5, before[i] + 1)));
});

/* ---------------- 卡牌结构 ---------------- */

test('TC-CARD-15 机会卡与命运卡字段完整、标题唯一', () => {
  const env = F.boot();
  assert.ok(env.CHANCE.length >= 24, `机会卡不足 24 张，实际 ${env.CHANCE.length}`);
  assert.ok(env.FATE.length >= 24, `命运卡不足 24 张，实际 ${env.FATE.length}`);
  [env.CHANCE, env.FATE].forEach(deck => {
    deck.forEach(card => {
      assert.ok(card.t && card.d, '卡牌缺少标题或描述');
      assert.equal(typeof card.act, 'function', `${card.t} 缺少 act`);
    });
    const titles = deck.map(c => c.t);
    assert.equal(new Set(titles).size, titles.length, '卡牌标题重复');
  });
});

test('TC-CARD-16 机会卡：直接现金类数值正确', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const cases = [
    ['拆迁通知', 180], ['茶水费', 60], ['中介佣金', 45],
    ['团购大单', 110], ['返乡置业', 70], ['老客户介绍', 35],
  ];
  cases.forEach(([title, gain]) => {
    const card = env.CHANCE.find(c => c.t === title);
    p.cash = 100;
    card.act(p);
    assert.equal(p.cash, 100 + gain, `${title} 现金变化`);
  });
});

test('TC-CARD-17 机会卡：温州老乡计息负债而非白给', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 0; p.debt = 0;
  env.CHANCE.find(c => c.t === '温州老乡').act(p);
  assert.equal(p.cash, 150);
  assert.equal(p.debt, 150, '借款应计入负债');
});

test('TC-CARD-18 机会卡：人才补贴发给现金最少的玩家', () => {
  const env = F.boot();
  env.state.players.forEach((p, i) => { p.cash = 1000 - i * 100; });
  const poor = env.state.players[3];
  const before = poor.cash;
  env.CHANCE.find(c => c.t === '人才补贴').act(env.state.players[0]);
  assert.equal(poor.cash, before + 120);
});

test('TC-CARD-19 机会卡：法拍捡漏按 7 折买入无主地块', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 5000;
  const before = p.cash;
  env.setRandom([0]);
  env.CHANCE.find(c => c.t === '法拍捡漏').act(p);
  const owned = env.owned(p);
  assert.equal(owned.length, 1);
  assert.equal(owned[0].lv, 1);
  assert.equal(before - p.cash, Math.round(env.value(owned[0]) * 0.7));
});

test('TC-CARD-20 机会卡：尾盘甩卖按 6 折买入', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 5000;
  const before = p.cash;
  env.setRandom([0]);
  env.CHANCE.find(c => c.t === '尾盘甩卖').act(p);
  const c = env.owned(p)[0];
  assert.equal(before - p.cash, Math.round(env.value(c) * 0.6));
});

test('TC-CARD-21 机会卡：摇号中签与政策解读提供一次性资格', () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.CHANCE.find(c => c.t === '摇号中签').act(p);
  assert.equal(p.freePass, true);
  env.CHANCE.find(c => c.t === '政策解读').act(p);
  assert.equal(p.vision, 2);
});

test('TC-CARD-22 机会卡：过桥资金 200 万，3 个月后归还', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 0;
  env.CHANCE.find(c => c.t === '过桥资金').act(p);
  assert.equal(p.cash, 200);
  assert.equal(p.bridge, 3);
  await env.endMonth();
  await env.endMonth();
  await env.endMonth();
  assert.equal(p.cash, 0, '第 3 个月末应扣回 200 万');
});

test('TC-CARD-23 机会卡：虚假宣传直接进监狱', () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.CHANCE.find(c => c.t === '虚假宣传被立案').act(p);
  assert.equal(p.inJail, true);
  assert.equal(env.curCells()[p.pos].t, 'jail');
});

test('TC-CARD-24 机会卡：烂尾地块可被"顺利交付"修复', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const c = env.grant(p, env.at(1), 1);
  c.broken = true;
  env.CHANCE.find(c2 => c2.t === '顺利交付').act(p);
  assert.equal(c.broken, false);
});

test('TC-CARD-25 命运卡：现金惩罚类数值正确', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const cases = [
    ['房贷利率上调', 55], ['降价维权', 35], ['中介跑路', 60],
    ['资金链紧张', 90], ['合作方违约', 50], ['罚单', 25], ['断供', 100],
  ];
  cases.forEach(([title, loss]) => {
    const card = env.FATE.find(c => c.t === title);
    p.cash = 1000;
    card.act(p);
    assert.equal(p.cash, 1000 - loss, `${title} 扣款`);
  });
});

test('TC-CARD-26 命运卡：业主维权只对有房者生效', () => {
  const env = F.boot();
  const p = env.state.players[0];
  const card = env.FATE.find(c => c.t === '业主维权');
  p.cash = 500;
  card.act(p);
  assert.equal(p.cash, 500, '无房者不应被扣款');
  env.grant(p, env.at(1), 1);
  card.act(p);
  assert.equal(p.cash, 460);
});

test('TC-CARD-27 命运卡：土拍熔断本回合不能买地', async () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.FATE.find(c => c.t === '土拍熔断').act(p);
  assert.equal(p.skipBuy, true);
  const c = env.at(1);
  await env.landOn(p, c);
  assert.equal(c.owner, null, '熔断期间买不了地');
  assert.equal(p.skipBuy, false, '熔断标记用后即清');
});

test('TC-CARD-28 命运卡：股市跳水同时打压股价与持仓', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 500; p.stock = 10;
  const price = env.state.stockPrice;
  env.FATE.find(c => c.t === '股市跳水').act(p);
  assert.equal(p.cash, 430);
  assert.equal(env.state.stockPrice, price * 0.9);
});

test('TC-CARD-29 命运卡：限价传闻写入 6 个月的价格上限政策', () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.setMonth(20);
  env.FATE.find(c => c.t === '限价传闻').act(p);
  assert.equal(env.hasPolicy('pricecap'), true);
  const mod = env.state.mods.find(m => m.key === 'pricecap');
  assert.equal(mod.until, 26);
});

test('TC-CARD-30 命运卡：银行抽贷在负债超净资产一半时强制卖地', () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.grant(p, env.at(1), 1);
  p.cash = 100; p.debt = 2000;         // 负债远超净资产的一半
  const n = env.owned(p).length;
  env.FATE.find(c => c.t === '银行抽贷').act(p);
  assert.ok(env.owned(p).length < n, '应强制处置一块地');
});

test('TC-CARD-31 命运卡：空置税只对空地下手', () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.grant(p, env.at(1), 0);
  env.grant(p, env.at(2), 0);
  env.grant(p, env.at(4), 2);
  p.cash = 500;
  env.FATE.find(c => c.t === '空置税').act(p);
  assert.equal(p.cash, 500 - 20, '两块空地各扣 10 万');
});

test('TC-CARD-32 命运卡：代持被查 / 违规套现直接进监狱', () => {
  const env = F.boot();
  const p = env.state.players[0];
  env.FATE.find(c => c.t === '代持被查').act(p);
  assert.equal(p.inJail, true);
  p.inJail = false;
  env.FATE.find(c => c.t === '违规套现').act(p);
  assert.equal(p.inJail, true);
});

test('TC-CARD-33 抽卡不会让游戏崩溃，效果字符串可展示', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.cash = 1000;
  [...env.CHANCE, ...env.FATE].forEach(card => {
    p.cash = 1000; p.debt = 0; p.inJail = false;
    const msg = card.act(p);
    assert.equal(typeof msg, 'string', `${card.t} 未返回文案`);
    assert.ok(msg.length > 0, `${card.t} 文案为空`);
  });
});
