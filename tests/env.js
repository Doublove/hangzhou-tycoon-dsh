/* ============================================================
   测试环境：在 Node 的 vm 沙箱里加载真实的 data.js / game.js
   ------------------------------------------------------------
   设计要点：
   1. 不复制业务代码，测试对象就是线上跑的那两个文件
   2. 不引入 jsdom 等外部依赖，用最小 DOM 桩满足渲染路径
   3. Math.random 可注入序列，让随机机制可复现
   4. 定时器统一压到 0ms 并 unref，避免测试进程被挂住
   ============================================================ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SITE_DIR = path.resolve(__dirname, '..');
const CONFIG_SRC = fs.readFileSync(path.join(SITE_DIR, 'config.js'), 'utf8');
const ART_SRC = fs.readFileSync(path.join(SITE_DIR, 'art.js'), 'utf8');
const DATA_SRC = fs.readFileSync(path.join(SITE_DIR, 'data.js'), 'utf8');
const GAME_SRC = fs.readFileSync(path.join(SITE_DIR, 'game.js'), 'utf8');

/* ---------------- 最小 DOM 桩 ---------------- */

function createStyle() {
  const style = {
    cssText: '',
    setProperty(k, v) { style[k] = v; },
    removeProperty(k) { delete style[k]; },
    getPropertyValue(k) { return style[k] == null ? '' : style[k]; },
  };
  return style;
}

function createElement(tag = 'div') {
  let cls = new Set();
  const el = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    children: [],
    dataset: {},
    attrs: {},
    textContent: '',
    disabled: false,
    onclick: null,
    parentNode: null,
    clientWidth: 400,
    clientHeight: 400,
    offsetHeight: 0,
    offsetWidth: 0,
    scrollTop: 0,
    scrollHeight: 400,
    style: createStyle(),
    appendChild(child) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    insertBefore(child) { return el.appendChild(child); },
    removeChild(child) {
      const i = el.children.indexOf(child);
      if (i >= 0) el.children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    remove() { if (el.parentNode) el.parentNode.removeChild(el); },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return el.attrs[k] === undefined ? null : el.attrs[k]; },
    removeAttribute(k) { delete el.attrs[k]; },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    focus() {}, blur() {},
    click() { if (typeof el.onclick === 'function') el.onclick(); },
    getBoundingClientRect() {
      return { top: 0, left: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0 };
    },
    /* 子元素按选择器缓存，便于断言渲染结果 */
    _q: new Map(),
    querySelector(sel) {
      if (!el._q.has(sel)) el._q.set(sel, createElement('div'));
      return el._q.get(sel);
    },
    querySelectorAll() { return []; },
    contains(node) {
      if (node === el) return true;
      return el.children.some(c => c === node || (typeof c.contains === 'function' && c.contains(node)));
    },
    matches(sel) {
      if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
      if (sel.startsWith('#')) return el.attrs.id === sel.slice(1) || el.id === sel.slice(1);
      if (sel.startsWith('[')) {
        const raw = sel.slice(1, -1).split('=')[0];                 // data-tip
        const key = raw.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return el.dataset[key] !== undefined || el.attrs[raw] !== undefined;
      }
      return el.tagName === sel.toUpperCase();
    },
    closest(sel) {
      let node = el;
      while (node) {
        if (typeof node.matches === 'function' && node.matches(sel)) return node;
        node = node.parentNode;
      }
      return null;
    },
    get firstChild() { return el.children[0] || null; },
    get lastChild() { return el.children[el.children.length - 1] || null; },
    get childElementCount() { return el.children.length; },
  };

  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return html; },
    set(v) {
      html = String(v);
      /* 真实 DOM 赋空字符串会清空子节点，这里保持一致，
         否则多次 renderHUD 会累积出重复的 chip */
      if (html === '') el.children.length = 0;
    },
    configurable: true,
  });

  Object.defineProperty(el, 'className', {
    get() { return [...cls].join(' '); },
    set(v) { cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
    configurable: true,
  });

  el.classList = {
    add(...names) { names.forEach(n => n && cls.add(n)); },
    remove(...names) { names.forEach(n => cls.delete(n)); },
    contains(n) { return cls.has(n); },
    toggle(n, force) {
      const want = force === undefined ? !cls.has(n) : !!force;
      if (want) cls.add(n); else cls.delete(n);
      return want;
    },
    get length() { return cls.size; },
    toString() { return [...cls].join(' '); },
  };

  return el;
}

function createDocument() {
  const cache = new Map();
  const doc = {
    nodeType: 9,
    body: createElement('body'),
    documentElement: createElement('html'),
    createElement(tag) { return createElement(tag); },
    createTextNode(text) { return { nodeType: 3, textContent: String(text) }; },
    /* 真实 DOM 里不存在的选择器返回 null；这里统一给桩元素，
       因为渲染函数默认节点一定存在，测试关注逻辑而非 DOM 结构 */
    querySelector(sel) {
      if (!cache.has(sel)) cache.set(sel, createElement('div'));
      return cache.get(sel);
    },
    querySelectorAll() { return []; },
    getElementById(id) { return doc.querySelector('#' + id); },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
  };
  return doc;
}

function createStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(String(k)); },
    clear() { map.clear(); },
    _dump() { return Object.fromEntries(map); },
  };
}

/* ---------------- 环境 ---------------- */

const EXPORTS = [
  // 数据层
  'CFG', 'ERA', 'REGIONS', 'ITEMS', 'ITEM_KEYS', 'CHARS', 'DIFF', 'RINGS',
  'TRACK_PATTERN', 'SCENIC', 'EVENTS', 'CHANCE', 'FATE',
  // 逻辑层常量
  'state', 'CHAPTERS', 'RENT_RATE', 'TOLL_RATE', 'UP_GATE', 'PIECE', 'RISK',
  // 纯函数 / 业务函数
  'year', 'monthLabel', 'curCh', 'chapterMonth', 'buildRings', 'curCells', 'allCells', 'owned',
  'eraF', 'heatF', 'value', 'rentOf', 'neighbors', 'adjacentBonus', 'adjCount', 'sandwichedOwner',
  'tollParts', 'tollOf', 'leverage', 'cappedFor', 'tollFor', 'upCost', 'netWorth', 'loanCap', 'loanRate',
  'hasPolicy', 'setPolicy', 'extendPolicy', 'clearPolicy', 'heatAdd', 'raiseCap', 'triggerStall',
  'mgmtFee', 'liquidate', 'startLiquidation', 'settle', 'auction', 'buy', 'upgrade', 'sellLand',
  'doLoan', 'doRepay', 'payPassGo', 'move', 'landOn', 'roll', 'nextTurn', 'endMonth', 'endChapter',
  'nextChapter', 'rollScenicStay', 'sendToJail', 'lotteryCheck', 'drawCard',
  'activeOf', 'topRegionOf', 'useSkill', 'itemCount', 'giveItem', 'takeItem', 'dropItem',
  'randomItemKey', 'useDiceItem', 'useStayItem', 'useUturnItem', 'placeBlock',
  'riskOf', 'avgToll', 'aiNeed', 'aiBuy', 'aiUpgrade', 'marketPrice', 'aiPreTurn', 'aiUseSkill',
  'aiUseItems', 'boostByBao', 'cellAhead', 'tollAhead', 'humanPlayer',
  'serialize', 'restore', 'saveTo', 'loadFrom', 'newGame', 'startScreen', 'log', 'logSep',
  'ART', 'stockLot', 'onItemClick', 'showCell', 'closeSheet', 'render',
  'shopPrice', 'stockValue', 'stockCost', 'stockPnl', 'landValue', 'assetOf',
  'stockBuy', 'stockSell', 'pushCandle', 'renderKline', 'deckFor',
  'renderHUD', 'renderSkillBtn', 'renderItems',
  'showTip', 'showTipHTML', 'hideTip', 'activeMod', 'policyTip', 'legacyTip', 'skillTip',
];

function createEnv(options = {}) {
  const doc = createDocument();
  const storage = createStorage();

  let randomImpl = null;

  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    document: doc,
    localStorage: storage,
    location: {
      search: options.search === undefined ? '?fast=1' : options.search,
      href: 'http://localhost/index.html',
      pathname: '/index.html',
      hash: '',
    },
    URLSearchParams,
    setTimeout: (fn, ms) => {
      const delay = ms || 0;
      const t = setTimeout(() => { try { fn(); } catch (e) { sandbox.__errors.push(e); } }, delay);
      /* 0ms 的定时器是游戏内 sleep()，必须保持 ref，否则事件循环空转、
         await 永远等不到；长定时器（toast 1600ms 等）unref，避免拖住测试进程 */
      if (delay > 0 && typeof t.unref === 'function') t.unref();
      return t;
    },
    clearTimeout: (t) => clearTimeout(t),
    setInterval: (fn, ms) => { const t = setInterval(fn, ms); t.unref?.(); return t; },
    clearInterval: (t) => clearInterval(t),
    __rand: () => (randomImpl ? randomImpl() : Math.random()),
    __errors: [],
    innerWidth: 414,
    innerHeight: 896,
    devicePixelRatio: 2,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    scrollTo() {},
    matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
    requestAnimationFrame(fn) { return setTimeout(fn, 0); },
    cancelAnimationFrame(t) { clearTimeout(t); },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  const ctx = vm.createContext(sandbox);
  vm.runInContext('Math.random = __rand;', ctx, { filename: 'random-patch.js' });
  vm.runInContext(CONFIG_SRC, ctx, { filename: 'config.js' });
  vm.runInContext(ART_SRC, ctx, { filename: 'art.js' });
  vm.runInContext(DATA_SRC, ctx, { filename: 'data.js' });
  vm.runInContext(GAME_SRC, ctx, { filename: 'game.js' });

  const bridge = vm.runInContext(`({${EXPORTS.join(',')}})`, ctx, { filename: 'bridge.js' });

  /* 交互桩：人类玩家的决策弹窗默认一律"拒绝"，让回合流程能无人值守跑完。
     需要"接受"的场景调用 env.setAccept(true)。 */
  sandbox.__dialog = { accept: false };
  vm.runInContext(`
    askBuy = async () => __dialog.accept;
    askUpgrade = async () => __dialog.accept;
    askBank = async () => null;
    askStock = async () => null;
    askShop = async () => {};
  `, ctx, { filename: 'dialog-stub.js' });

  const env = {
    window: sandbox,
    document: doc,
    localStorage: storage,
    ctx,
    siteDir: SITE_DIR,
    errors: sandbox.__errors,
    eval(code) { return vm.runInContext(code, ctx, { filename: 'inline.js' }); },
    /* 注入随机数序列，用完后循环；传数组即按序返回 */
    setRandom(values) {
      let i = 0;
      randomImpl = () => {
        if (!values.length) return 0;
        const v = values[i % values.length];
        i++;
        return v;
      };
    },
    setRandomFn(fn) { randomImpl = fn; },
    resetRandom() { randomImpl = null; },
    /** 人类决策弹窗：true = 自动同意（买/升级），false = 一律拒绝 */
    setAccept(v) { sandbox.__dialog.accept = !!v; },
    /* 清空事件日志，便于断言"本次操作写了什么" */
    clearLog() { doc.querySelector('#log').children.length = 0; },
    logText() {
      return doc.querySelector('#log').children.map(c => c.textContent || c.innerHTML || '').join('\n');
    },
  };

  Object.assign(env, bridge);
  return env;
}

module.exports = { createEnv, createElement, SITE_DIR };
