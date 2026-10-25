/* ============================================================
   测试夹具：把一局游戏摆成可断言的状态
   ============================================================ */
'use strict';

const { createEnv } = require('./env');

/**
 * 建立一局游戏。
 * @param {object} opts
 * @param {string} opts.charId  人类角色，默认 hang
 * @param {number} opts.chapter 起始章节 0—3
 * @param {string} opts.diff    难度 easy|normal|hard
 * @param {boolean} opts.silenceAI 默认 true：把所有玩家标记为 human，
 *        使 nextTurn 不会自动掷骰，回合推进完全由测试驱动
 */
function boot(opts = {}) {
  const env = createEnv(opts);
  env.newGame(opts.charId || 'hang', opts.diff || 'normal', opts.chapter || 0);
  if (opts.silenceAI !== false) {
    env.state.players.forEach(p => { p.human = true; });
  }
  /* 把常用夹具挂到 env 上，测试里直接 env.grant(...) */
  Object.assign(env, {
    at: (idx, ring) => at(env, idx, ring),
    freePlot: (ring) => freePlot(env, ring),
    plotByName: (name) => plotByName(env, name),
    grant: (p, cell, lv) => grant(env, p, cell, lv),
    put: (p, idx) => put(env, p, idx),
    setHeat: (region, v) => setHeat(env, region, v),
    setAllHeat: (v) => setAllHeat(env, v),
    setMonth: (m) => setMonth(env, m),
    takeTurn: () => takeTurn(env),
    clearBoard: () => clearBoard(env),
    expectedValue: (cell) => expectedValue(env, cell),
  });
  env.clearLog();
  return env;
}

const players = env => env.state.players;
const P = (env, i) => env.state.players[i];
const cells = env => env.curCells();
const all = env => env.allCells();

/** 取当前环上第 idx 格 */
const at = (env, idx, ring) => {
  const r = ring === undefined ? env.state.chapter : ring;
  return env.state.rings[r].cells[idx];
};

/** 当前环上第一块"无主 + 已解锁 + 未烂尾"的地 */
function freePlot(env, ring) {
  const r = ring === undefined ? env.state.chapter : ring;
  return env.state.rings[r].cells.find(c => c.t === 'plot' && !c.owner && c.unlocked && !c.broken);
}

/** 按名称找地（跨环） */
function plotByName(env, name) {
  return env.allCells().find(c => c.t === 'plot' && c.name === name);
}

/** 直接把某块地塞给某玩家，返回该地块 */
function grant(env, p, cell, lv = 1) {
  cell.owner = p;
  cell.lv = lv;
  cell.boughtAt = env.state.absMonth;
  cell.unlocked = true;
  return cell;
}

/** 把某玩家挪到指定格 */
function put(env, p, idx) {
  p.pos = idx;
  return p;
}

/** 设定某区域热度 */
function setHeat(env, region, v) {
  env.state.heat[region] = v;
  return v;
}

/** 设定所有区域热度，便于构造确定的地价 */
function setAllHeat(env, v) {
  Object.keys(env.state.heat).forEach(k => { env.state.heat[k] = v; });
}

/** 设定当前月份（绝对序号，2010.01 = 0） */
function setMonth(env, m) {
  env.state.absMonth = m;
}

/** 推进一回合：指定玩家（默认 0 号）掷骰并结算 */
async function takeTurn(env, idx = 0) {
  env.state.turnIdx = idx;
  env.state.busy = false;
  await env.roll();
}

/** 清空所有玩家的地，回到干净棋盘 */
function clearBoard(env) {
  env.allCells().forEach(c => {
    if (c.t === 'plot') {
      c.owner = null;
      c.lv = 0;
      c.boughtAt = -99;
      c.broken = false;
      c.boost = 0;
      c.discount = 1;
    }
    c.block = false;
  });
}

/** 按需求文档口径手算地价，用于交叉校验 value() */
function expectedValue(env, cell) {
  const era = env.ERA[env.year()] || 1;
  const heat = 0.6 + 0.8 * env.state.heat[cell.region] / 100;
  return Math.round(cell.price * era * heat);
}

module.exports = {
  boot, players, P, cells, all, at, freePlot, plotByName, grant, put,
  setHeat, setAllHeat, setMonth, takeTurn, clearBoard, expectedValue,
};
