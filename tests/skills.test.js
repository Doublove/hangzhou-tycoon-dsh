/* ============================================================
   角色技能 · 需求 6.2 / 6.5
   用例前缀 TC-SKILL
   ============================================================ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');

const CD = { hang: 12, wen: 12, ma: 10, lian: 15, bao: 8, wang: 12 };

test('TC-SKILL-01 六名角色都有主动技能，冷却与文档一致', () => {
  const env = F.boot();
  assert.equal(env.CHARS.length, 6);
  env.CHARS.forEach(c => {
    assert.ok(c.active && c.active.name && c.active.desc, `${c.name} 缺少主动技能`);
    assert.equal(c.active.cd, CD[c.id], `${c.name} 冷却应为 ${CD[c.id]} 月`);
  });
});

test('TC-SKILL-02 杭铁头「拆迁款」：获得净资产 8%，最低 80 万', () => {
  const env = F.boot();
  const p = env.state.players.find(x => x.charId === 'hang');
  p.cash = 1000; p.debt = 0;
  const gain = Math.round(env.netWorth(p) * 0.08);
  assert.equal(env.useSkill(p), true);
  assert.equal(p.cash, 1000 + Math.max(80, gain));

  // 净资产很小时按 80 万兜底
  const env2 = F.boot();
  const p2 = env2.state.players.find(x => x.charId === 'hang');
  p2.cash = 100; p2.debt = 0;
  env2.useSkill(p2);
  assert.equal(p2.cash, 180);
});

test('TC-SKILL-03 温老板「配资」：借入净资产 30%，计入负债', () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  p.cash = 1000; p.debt = 0;
  const amt = Math.round(env.netWorth(p) * 0.30);
  assert.equal(env.useSkill(p), true);
  assert.equal(p.cash, 1000 + amt);
  assert.equal(p.debt, amt, '配资是负债，不是白给');
});

test('TC-SKILL-04 温老板净资产过低时配资失败，不进入冷却', () => {
  const env = F.boot({ charId: 'wen' });
  const p = env.state.players.find(x => x.charId === 'wen');
  p.cash = 0; p.debt = 0;
  assert.equal(env.useSkill(p), false);
  assert.equal(p.skillCd, 0, '失败不应消耗冷却');
});

test('TC-SKILL-05 码哥「期权行权」：金额随未来科技城热度浮动', () => {
  const env = F.boot({ charId: 'ma' });
  const p = env.state.players.find(x => x.charId === 'ma');
  p.cash = 0; p.skillCd = 0;
  env.setHeat('未来科技城', 60);
  env.useSkill(p);
  assert.equal(p.cash, 80);

  p.cash = 0; p.skillCd = 0;
  env.setHeat('未来科技城', 90);
  env.useSkill(p);
  assert.equal(p.cash, 120, '热度越高行权收益越高');
});

test('TC-SKILL-06 阿莲「摇橹」：脱离监狱并让下次掷骰 +2', () => {
  const env = F.boot({ charId: 'lian' });
  const p = env.state.players.find(x => x.charId === 'lian');
  p.inJail = true; p.jailFail = 2;
  assert.equal(env.useSkill(p), true);
  assert.equal(p.inJail, false);
  assert.equal(p.jailFail, 0);
  assert.equal(p.bonusRoll, 2);
});

test('TC-SKILL-07 阿莲「摇橹」：也能脱离风景区', () => {
  const env = F.boot({ charId: 'lian' });
  const p = env.state.players.find(x => x.charId === 'lian');
  p.scenicTurns = 3; p.scenicName = '西湖风景区';
  assert.equal(env.useSkill(p), true);
  assert.equal(p.scenicTurns, 0);
  assert.equal(p.scenicName, '');
  assert.equal(p.bonusRoll, 2);
});

test('TC-SKILL-08 阿莲未被限制时摇橹无效', () => {
  const env = F.boot({ charId: 'lian' });
  const p = env.state.players.find(x => x.charId === 'lian');
  p.inJail = false; p.scenicTurns = 0;
  assert.equal(env.useSkill(p), false);
  assert.equal(p.skillCd, 0);
});

test('TC-SKILL-09 小笼包「带节奏」：自己地块最多的区域热度 +15', () => {
  const env = F.boot({ charId: 'bao' });
  const p = env.state.players.find(x => x.charId === 'bao');
  env.grant(p, env.allCells().find(c => c.t === 'plot' && c.region === '城北'), 1);
  env.grant(p, env.allCells().find((c, i) => c.t === 'plot' && c.region === '城北' && !c.owner), 1);
  env.grant(p, env.allCells().find(c => c.t === 'plot' && c.region === '城西'), 1);
  env.setHeat('城北', 50);
  env.setHeat('城西', 50);
  assert.equal(env.useSkill(p), true);
  assert.equal(env.state.heat['城北'], 65);
  assert.equal(env.state.heat['城西'], 50, '非主营区域不应被加热');
});

test('TC-SKILL-10 王中介「撮合」：85 折买下最便宜的无主地', () => {
  const env = F.boot({ charId: 'wang' });
  const p = env.state.players.find(x => x.charId === 'wang');
  p.cash = 5000;
  const cheapest = env.curCells()
    .filter(c => c.t === 'plot' && !c.owner && c.unlocked && !c.broken)
    .sort((a, b) => env.value(a) - env.value(b))[0];
  const price = Math.round(env.value(cheapest) * 0.85);
  const before = p.cash;
  assert.equal(env.useSkill(p), true);
  assert.equal(cheapest.owner, p);
  assert.equal(cheapest.lv, 1);
  assert.equal(before - p.cash, price);
});

test('TC-SKILL-11 王中介现金不足时撮合失败', () => {
  const env = F.boot({ charId: 'wang' });
  const p = env.state.players.find(x => x.charId === 'wang');
  p.cash = 1;
  assert.equal(env.useSkill(p), false);
  assert.equal(p.skillCd, 0);
});

test('TC-SKILL-12 技能发动后进入冷却，冷却期内不可重复发动', () => {
  const env = F.boot();
  const p = env.state.players.find(x => x.charId === 'hang');
  p.cash = 1000;
  env.useSkill(p);
  assert.equal(p.skillCd, 12);
  const cash = p.cash;
  assert.equal(env.useSkill(p), false);
  assert.equal(p.cash, cash);
});

test('TC-SKILL-13 冷却按月递减，冷却结束后可再次发动', async () => {
  const env = F.boot();
  const p = env.state.players.find(x => x.charId === 'hang');
  p.cash = 1000;
  env.useSkill(p);
  assert.equal(p.skillCd, 12);
  for (let i = 0; i < 12; i++) await env.endMonth();
  assert.equal(p.skillCd, 0);
  assert.equal(env.useSkill(p), true);
});

test('TC-SKILL-14 破产玩家不能发动技能', () => {
  const env = F.boot();
  const p = env.state.players.find(x => x.charId === 'hang');
  p.bankrupt = true;
  assert.equal(env.useSkill(p), false);
});

test('TC-SKILL-15 换章时技能冷却重置', () => {
  const env = F.boot();
  const p = env.state.players[0];
  p.skillCd = 8;
  env.nextChapter();
  assert.equal(p.skillCd, 0);
});

test('TC-SKILL-16 AI 会自动发动「白拿钱」型技能', () => {
  const env = F.boot();
  const p = env.state.players.find(x => x.charId === 'hang');
  p.cash = 1000; p.skillCd = 0;
  const before = p.cash;
  env.aiUseSkill(p);
  assert.ok(p.cash > before, 'AI 应在冷却好时使用拆迁款');
  assert.equal(p.skillCd, 12);
});

test('TC-SKILL-17 AI 的温老板只在缺钱时配资', () => {
  const env = F.boot({ charId: 'wen' });
  const wen = env.state.players.find(x => x.charId === 'wen');
  wen.cash = 5000; wen.debt = 0; wen.skillCd = 0;
  env.aiUseSkill(wen);
  assert.equal(wen.debt, 0, '现金充裕时不应加杠杆');

  env.grant(wen, env.at(1), 1);        // 有资产才有可借空间
  wen.cash = 100; wen.skillCd = 0;
  env.aiUseSkill(wen);
  assert.ok(wen.debt > 0, '缺钱时应配资');
});

test('TC-SKILL-18 被动：杭铁头破产判定时免死一次，保留 1 元', async () => {
  const env = F.boot();
  const p = env.state.players.find(x => x.charId === 'hang');
  p.cash = -500; p.debt = 0;
  p.savedOnce = false;
  await env.settle(p);
  assert.equal(p.bankrupt, false);
  assert.equal(p.cash, 1);
  assert.equal(p.savedOnce, true);

  // 第二次不再免死
  p.cash = -500;
  await env.settle(p);
  assert.equal(p.bankrupt, true);
});

test('TC-SKILL-19 被动：温老板贷款额度 +30%（已含在额度公式里）', () => {
  const env = F.boot({ charId: 'wen' });
  const wen = env.state.players.find(p => p.charId === 'wen');
  const hang = env.state.players.find(p => p.charId === 'hang');
  wen.cash = 1000; wen.debt = 0;
  hang.cash = 1000; hang.debt = 0;
  assert.equal(env.loanCap(wen), Math.round(env.netWorth(wen) * 0.6 * 1.3));
  assert.equal(env.loanCap(hang), Math.round(env.netWorth(hang) * 0.6));
});
