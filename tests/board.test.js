/* ============================================================
   地图与棋盘 · 需求 3.1 / 3.2 / 3.7 / 3.8
   用例前缀 TC-MAP
   ============================================================ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');

test('TC-MAP-01 四环对应四章，环名与年代连续', () => {
  const env = F.boot();
  assert.equal(env.RINGS.length, 4);
  assert.equal(env.CHAPTERS.length, 4);
  env.RINGS.forEach((ring, i) => {
    assert.equal(ring.chapter, i, `第 ${i} 环的 chapter 字段应指向同序号章节`);
    assert.match(ring.years, /^\d{4} — \d{4}$/);
  });
  assert.deepEqual([...env.RINGS.map(r => r.years)], [
    '2010 — 2013', '2014 — 2017', '2018 — 2021', '2022 — 2026',
  ]);
});

test('TC-MAP-02 每环 24 格（起点 1 + 地块 16 + 功能格 7，V2.0 方环）', () => {
  const env = F.boot();
  env.RINGS.forEach((ring, i) => {
    const cells = env.state.rings[i].cells;
    assert.equal(cells.length, 24, `第 ${i} 环应为 24 格`);
    const count = t => cells.filter(c => c.t === t).length;
    assert.equal(count('start'), 1);
    assert.equal(count('plot'), 16);
    assert.equal(
      cells.length - count('start') - count('plot'),
      7,
      '功能格应为 7 个（监狱不在环上）',
    );
  });
});

test('TC-MAP-03 功能格构成：机会2 命运1 银行1 证券1 风景区1 商店1，监狱在中心（V2.0）', () => {
  const env = F.boot();
  const expected = { chance: 2, fate: 1, bank: 1, stock: 1, scenic: 1, shop: 1, jail: 0, tax: 0 };
  env.state.rings.forEach((ring, i) => {
    const count = t => ring.cells.filter(c => c.t === t).length;
    Object.entries(expected).forEach(([t, n]) => {
      assert.equal(count(t), n, `第 ${i} 环 ${t} 格数量`);
    });
  });
});

test('TC-MAP-04 起点固定在 idx 0 且唯一，首尾不相连', () => {
  const env = F.boot();
  env.state.rings.forEach(ring => {
    assert.equal(ring.cells[0].t, 'start');
    assert.equal(ring.cells.filter(c => c.t === 'start').length, 1);
    // 首尾隔断：idx 23 与 idx 1 不是邻居
    const first = ring.cells[1];
    const last = ring.cells[23];
    assert.ok(!env.neighbors(first).includes(last), 'idx 1 不应把 idx 23 当作邻居');
    assert.ok(!env.neighbors(last).includes(first), 'idx 23 不应把 idx 1 当作邻居');
  });
});

test('TC-MAP-05 地价 = 楼面价 ÷ 40（万元）', () => {
  const env = F.boot();
  env.state.rings.forEach(ring => {
    ring.cells.filter(c => c.t === 'plot').forEach(c => {
      assert.equal(c.price, Math.round(c.base / 40), `${c.name} 地价换算`);
    });
  });
});

test('TC-MAP-06 新开地块为 Lv0 空地、无主、未烂尾、无折扣', () => {
  const env = F.boot();
  env.state.rings.forEach(ring => {
    ring.cells.filter(c => c.t === 'plot').forEach(c => {
      assert.equal(c.lv, 0);
      assert.equal(c.owner, null);
      assert.equal(c.broken, false);
      assert.equal(c.discount, 1);
      assert.equal(c.boost, 0);
      assert.equal(c.boughtAt, -99);
    });
  });
});

test('TC-MAP-07 地块解锁：unlock 为 0 的开局即解锁，其余按月份解锁', () => {
  const env = F.boot();
  const cells = env.curCells().filter(c => c.t === 'plot');
  cells.forEach(c => {
    assert.equal(c.unlocked, c.unlock === 0, `${c.name} 初始解锁状态`);
  });
  const locked = cells.filter(c => c.unlock > 0);
  assert.ok(locked.length > 0, '第一章应存在需要解锁的地块');
});

test('TC-MAP-08 到达解锁月份后地块自动出现在棋盘上', async () => {
  const env = F.boot();
  const target = env.curCells().find(c => c.t === 'plot' && c.unlock > 0);
  env.setMonth(target.unlock - 1);
  assert.equal(target.unlocked, false);
  await env.endMonth();            // 月末推进到 unlock 当月
  assert.equal(env.state.absMonth, target.unlock);
  assert.equal(target.unlocked, true, `${target.name} 应在第 ${target.unlock} 月解锁`);
});

test('TC-MAP-09 同一环内地块名不重复', () => {
  const env = F.boot();
  env.state.rings.forEach((ring, i) => {
    const names = ring.cells.filter(c => c.t === 'plot').map(c => c.name);
    assert.equal(new Set(names).size, names.length, `第 ${i} 环存在重名地块`);
  });
});

test('TC-MAP-10 地块所属区域必须存在于区域表', () => {
  const env = F.boot();
  const regions = Object.keys(env.REGIONS);
  env.state.rings.forEach((ring, i) => {
    ring.cells.filter(c => c.t === 'plot').forEach(c => {
      assert.ok(regions.includes(c.region), `第 ${i} 环 ${c.name} 的区域 ${c.region} 未登记`);
    });
  });
});

test('TC-MAP-11 每环至少覆盖 4 个区域，保证"成片"排布', () => {
  const env = F.boot();
  env.state.rings.forEach((ring, i) => {
    const set = new Set(ring.cells.filter(c => c.t === 'plot').map(c => c.region));
    assert.ok(set.size >= 4, `第 ${i} 环只覆盖了 ${set.size} 个区域`);
  });
});

test('TC-MAP-12 风景区随章节换名，机制格位不变', () => {
  const env = F.boot();
  const expected = ['西湖风景区', '运河夜游', '亚运场馆', '良渚遗址'];
  env.state.rings.forEach((ring, i) => {
    const sc = ring.cells.find(c => c.t === 'scenic');
    assert.equal(sc.fullName, expected[i], `第 ${i} 环风景区名称`);
  });
  // 格位一致
  const idx = env.state.rings.map(r => r.cells.findIndex(c => c.t === 'scenic'));
  assert.equal(new Set(idx).size, 1, '各环风景区应位于同一格位');
});

test('TC-MAP-13 监狱不在行走环上（只能被卡牌送进去）', () => {
  const env = F.boot();
  env.state.rings.forEach(ring => {
    assert.equal(ring.cells.filter(c => c.t === 'jail').length, 0, '行走环上不应有监狱格');
  });
  // 送进去之后棋子位置不变，只有 inJail 标记
  const p = env.state.players[0];
  const before = p.pos;
  env.sendToJail(p, '测试');
  assert.equal(p.inJail, true);
  assert.equal(p.pos, before, '进监狱不改棋子位置');
});

test('TC-MAP-14 切换到第二章后，行走环切到中环', () => {
  const env = F.boot();
  assert.equal(env.state.chapter, 0);
  env.state.over = false;
  env.nextChapter();
  assert.equal(env.state.chapter, 1);
  assert.equal(env.curCh().ring, 1);
  assert.equal(env.curCells(), env.state.rings[1].cells);
  assert.equal(env.state.absMonth, 48);
});

test('TC-MAP-15 TRACK_PATTERN 的 p0—p15 与地块数量一一对应', () => {
  const env = F.boot();
  const plots = env.TRACK_PATTERN.filter(t => t[0] === 'p');
  assert.equal(plots.length, 16);
  assert.deepEqual([...plots], Array.from({ length: 16 }, (_, i) => `p${i}`));
  env.RINGS.forEach((ring, i) => {
    assert.equal(ring.plots.length, 16, `第 ${i} 环地块配置应有 16 条`);
  });
});

test('TC-MAP-16 24 格单骰一圈约 6.9 回合（节奏预算）', () => {
  const env = F.boot();
  assert.equal(env.curCells().length, 24);
  const laps = 24 / 3.5;   // 单骰期望 3.5
  assert.ok(laps > 6 && laps < 8, `一圈应约 6.9 回合，实际 ${laps.toFixed(2)}`);
});
