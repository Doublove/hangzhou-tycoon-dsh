/* ============================================================
   杭州大富翁 · 配置文件（唯一调参入口）

   对应需求：《杭州大富翁 游戏开发需求文档 V1.6》
     · 10.3 配置表管线 —— 运行时可调参数与内容配置分离
     · 附录 C 设计参数总表 —— 本文件的每一项都能在附录 C 找到出处

   用法：
     1. 只改这一个文件，不要改 data.js / game.js 里的数值（那里已经改成读本文件）。
     2. 页面加载时 index.html 用 <script src="config.js"> 读一次；
        之后所有逻辑都读内存里的 CFG / RENT_RATE / TOLL_RATE / UP_GATE / ERA，
        运行过程中不再读文件。
     3. 改完刷新页面即可生效；测试无需改动，tests/env.js 会先装本文件。

   为什么是 .js 而不是 .json：
     本站承诺「双击 index.html 即可离线游玩」。file:// 协议下 fetch('config.json')
     会被浏览器的同源策略拦掉，而 .js 用 <script> 同步加载，本地与线上行为一致。
     格式仍然是纯字面量，结构化读取与 JSON 等价。

   命名约定：本文件的键名与代码变量名严格一致。
     HZ_CONFIG.CFG.passGoRate  ←→ 代码里的 CFG.passGoRate
     HZ_CONFIG.RENT_RATE[3]    ←→ 代码里的 RENT_RATE[3]
   ============================================================ */

window.HZ_CONFIG = {

  /* 配置版本：改了数值就把尾号 +1，便于对存档与线上问题定位 */
  CONFIG_VERSION: "1.0.0",

  /* ------------------------------------------------------------
     CFG —— 全局经济与规则参数
     对应 PRD：2.3 章节化、2.2 起点结算、3.5 公式、3.7 功能格、
               3.10 道具、8.2 初始配置、8.5 破产、10.4 存档
     ------------------------------------------------------------ */
  CFG: {
    chapters: [48, 48, 48, 60],      // [PRD 2.3] 四章回合数，合计 204
    passGo: 1,                        // [PRD 2.2] 经过起点固定月供（万）
    passGoRate: 0.03,                 // [PRD 2.2] 经过起点额外获得当前现金的比例
    tollCap: 0.30,                    // [PRD 3.5] 单次过路费上限 = 支付方净资产 × 该值（V1.6 目标 25%，见 impl-status）
    levThreshold: 0.5,                // [PRD 3.5 / 8.4] 杠杆率超过此值不再享受上限保护
    mgmtRate: 0.0015,                 // [PRD 3.5] 物业费：每月按地价 0.15%
    mgmtVacantRate: 0.00075,          // [PRD 3.5] 空地减半
    liqMonths: 3,                     // [PRD 8.5] 破产清算宽限月数
    scenicOdds: [50, 25, 12, 7, 5, 1],// [PRD 3.7.2] 风景区停留 1—6 回合的概率（合计 100）
    items: {                          // [PRD 3.10] 道具系统
      start: { dice: 3, stay: 1, uturn: 1, block: 1 },  // 初始库存（王中介另有 6 个遥控骰子，见 data.js CHARS）
      chanceDrop: 0.35,               // 落在机会格额外掉一件道具的概率
      taxStay: 0.13,                  // 税务格掉停留卡
      stockUturn: 0.13,               // 买入指数掉掉头卡
      jailBlock: 0.05,                // 进监狱掉路障
    },
    jailFailMax: 3,                   // [PRD 3.7.1] 连续 N 次未掷出偶数后强制出狱
    upRate: 0.6,                      // [PRD 3.5] 升级费 = 地价 × 该值（V1.6 目标 30%，见 impl-status）
    sellRate: 0.8,                    // [PRD 3.5] 卖地回笼 = 地价 × 该值
    loanRate: 0.006,                  // [PRD 8.2] 贷款月息 0.6%
    loanRateTight: 0.0075,            // [PRD 8.2] 限贷期月息
    loanCap: 0.6,                     // [PRD 8.2] 贷款上限 = 净资产 × 60%
    loanCapTight: 0.4,                // [PRD 8.2] 限贷期 40%
    loanStep: 200,                    // [PRD 8.2] 单次借款上限（万）
    inheritRate: 0.4,                 // [PRD 2.3] 章节继承比例
    taxRate: 0.012,                   // [PRD 3.7] 税务格：净资产 × 1.2%（V1.6 目标为累进税，见 impl-status）
  },

  /* ------------------------------------------------------------
     ERA —— 时代系数，按年给定，还原 2010—2026 的大周期
     对应 PRD 4.1 时间轴总表、3.5 实时地价公式
     ------------------------------------------------------------ */
  ERA: {
    2010: 1.00, 2011: 0.92, 2012: 0.96, 2013: 1.06,
    2014: 0.95, 2015: 1.06, 2016: 1.38, 2017: 1.52,
    2018: 1.62, 2019: 1.72, 2020: 1.88, 2021: 2.10,
    2022: 1.86, 2023: 1.78, 2024: 1.70, 2025: 1.63, 2026: 1.60,
  },

  /* ------------------------------------------------------------
     RENT_RATE —— 各等级月租金率（索引即等级，Lv0 无租金）
     对应 PRD 3.4 地块等级表、3.5 月租金公式
     当前 0.8% / 1.1% / 1.4% / 1.7% / 2.0%；V1.6 目标为每级 +0.5%（见 impl-status）
     ------------------------------------------------------------ */
  RENT_RATE: [0, 0.008, 0.011, 0.014, 0.017, 0.020],

  /* ------------------------------------------------------------
     TOLL_RATE —— 各等级过路费率（索引即等级）
     对应 PRD 3.5 过路费费率表（V1.1 由 4% 上调至 10%）
     ------------------------------------------------------------ */
  TOLL_RATE: [0, 0.10, 0.12, 0.14, 0.16, 0.18],


  /* ------------------------------------------------------------
     CHANCE / FATE —— 机会卡与命运卡池
     对应 PRD 5.1 卡牌分类、5.3 机会卡与命运卡

     规则（V1.8）：每局开始时从下列池子里随机抽 CARD_POOL_SIZE 张，
     作为本局的牌堆；抽完自动洗牌。池子变大时不要改这里的数量，
     只改 CARD_POOL_SIZE —— 保证单局节奏不会被内容量稀释。
     ------------------------------------------------------------ */
  CARD_POOL_SIZE: 25,

  CHANCE:   [
    { t:"拆迁通知",   d:"自有地块被征收，补偿 180 万", act:p => { p.cash += 180; return "获得补偿 180 万"; } },
    { t:"老破小改造", d:"随机一块自有地块免费升一级", act:p => {
        const c = owned(p).filter(x => x.lv < x.maxLv && !x.broken);
        if (!c.length) return "没有可升级的地块";
        const one = c[rnd(c.length)]; one.lv++;
        return `${one.name} 免费升到 Lv${one.lv}`;
    }},
    { t:"茶水费",     d:"现金 +60 万", act:p => { p.cash += 60; return "现金 +60 万"; } },
    { t:"中介佣金",   d:"现金 +45 万", act:p => { p.cash += 45; return "现金 +45 万"; } },
    { t:"法拍捡漏",   d:"以 7 折买入一块无主地块", act:p => {
        const free = curCells().filter(c => c.t === "plot" && !c.owner && c.unlocked && !c.broken);
        if (!free.length) return "没有在拍的地块";
        const c = free[rnd(free.length)];
        const cost = Math.round(value(c) * 0.7);
        if (p.cash < cost) return "现金不够，错过法拍";
        p.cash -= cost; c.owner = p; c.lv = 1; c.boughtAt = state.absMonth;
        return `${c.name} 以 7 折（${cost} 万）拍下`;
    }},
    { t:"人才补贴",   d:"现金最少者获得 120 万补贴", act:p => {
        const poor = state.players.filter(x => !x.bankrupt).sort((a,b) => a.cash - b.cash)[0];
        poor.cash += 120; return `${poor.name} 获得补贴 120 万`;
    }},
    { t:"温州老乡",   d:"获得一笔无息借款 150 万", act:p => { p.cash += 150; p.debt += 150; return "借入 150 万（仍计负债）"; } },
    { t:"摇号中签",   d:"免费获得一次购买资格", act:p => { p.freePass = true; return "本回合买地免摇号"; } },
    { t:"地铁规划泄露", d:"指定区域热度 +15", act:p => {
        const r = pick(Object.keys(REGIONS)); heatAdd([r], 15); return `${r} 热度 +15`; } },
    { t:"直播带看",   d:"现金 +80 万，但下月舆情风险", act:p => { p.cash += 80; p.risk = 1; return "现金 +80 万"; } },
    { t:"老客户介绍", d:"现金 +35 万", act:p => { p.cash += 35; return "现金 +35 万"; } },
    { t:"车位热销",   d:"每块自有地块 +8 万", act:p => {
        const n = owned(p).length; p.cash += n * 8; return `车位收入 +${n * 8} 万`; } },
    { t:"精装溢价",   d:"随机一块自有地块免费升一级", act:p => {
        const c = owned(p).filter(x => x.lv < x.maxLv && !x.broken);
        if (!c.length) return "没有可升级的地块";
        const one = c[rnd(c.length)]; one.lv++;
        return `${one.name} 升到 Lv${one.lv}`;
    }},
    { t:"政策解读",   d:"下个月事件提前可知", act:p => { p.vision = 2; return "获得 2 个月视野"; } },
    { t:"团购大单",   d:"现金 +110 万", act:p => { p.cash += 110; return "现金 +110 万"; } },
    { t:"旧改补偿",   d:"城北、城东地块各 +5 万/级", act:p => {
        const list = owned(p).filter(x => (x.region === "城北" || x.region === "城东"));
        const sum = list.reduce((s,x) => s + x.lv * 5, 0);
        p.cash += sum; return sum ? `补偿 +${sum} 万` : "没有相关地块"; } },
    { t:"学区挂牌",   d:"西湖边、城西热度 +10", act:p => { heatAdd(["西湖边","城西"], 10); return "两地热度 +10"; } },
    { t:"网红打卡",   d:"随机一块自有地块租金翻倍 3 个月", act:p => {
        const c = owned(p).filter(x => x.lv > 0);
        if (!c.length) return "没有可出租的地块";
        const one = c[rnd(c.length)]; one.boost = 3;
        return `${one.name} 租金翻倍 3 个月`;
    }},
    { t:"过桥资金",   d:"立即获得 200 万，3 个月后归还", act:p => { p.cash += 200; p.bridge = 3; return "获得过桥资金 200 万"; } },
    { t:"顺利交付",   d:"随机一块烂尾地块恢复", act:p => {
        const c = owned(p).filter(x => x.broken);
        if (!c.length) return "没有烂尾地块";
        c[0].broken = false; return `${c[0].name} 恢复交付`;
    }},
    { t:"物业升值",   d:"随机一块自有地块 +1 级（不超上限）", act:p => {
        const c = owned(p).filter(x => x.lv < x.maxLv && !x.broken);
        if (!c.length) return "没有可升级的地块";
        const one = c[rnd(c.length)]; one.lv++; return `${one.name} 升到 Lv${one.lv}`;
    }},
    { t:"尾盘甩卖",   d:"以 6 折买入一块无主地块", act:p => {
        const free = curCells().filter(c => c.t === "plot" && !c.owner && c.unlocked);
        if (!free.length) return "没有可买的地块";
        const c = free[rnd(free.length)];
        const cost = Math.round(value(c) * 0.6);
        if (p.cash < cost) return "现金不够";
        p.cash -= cost; c.owner = p; c.lv = 1; c.boughtAt = state.absMonth;
        return `${c.name} 以 6 折（${cost} 万）买下`;
    }},
    { t:"评估上调",   d:"净资产估值 +5%（现金不变）", act:p => { p.revalue = 1.05; return "名下地块估值 +5%"; } },
    { t:"返乡置业",   d:"现金 +70 万", act:p => { p.cash += 70; return "现金 +70 万"; } },
    { t:"虚假宣传被立案", d:"被带走调查，直接进监狱", act:p => { sendToJail(p); return "被带走调查，进了监狱"; } }
  ],

  FATE:   [
    { t:"业主维权",   d:"有房者现金 −40 万", act:p => {
        if (!owned(p).length) return "无房一身轻";
        p.cash -= 40; return "现金 −40 万"; } },
    { t:"房贷利率上调", d:"现金 −55 万", act:p => { p.cash -= 55; return "现金 −55 万"; } },
    { t:"土拍熔断",   d:"本回合无法买地", act:p => { p.skipBuy = true; return "本回合不能买地"; } },
    { t:"股市跳水",   d:"现金 −70 万，持仓缩水", act:p => {
        const loss = Math.round((p.stock || 0) * stockLot() * 0.1);
        p.cash -= 70; state.stockPrice *= 0.9;
        return `现金 −70 万，股票缩水 ${loss} 万`; } },
    { t:"中介带看",   d:"现金 +30 万", act:p => { p.cash += 30; return "现金 +30 万"; } },
    { t:"限价传闻",   d:"下月起卖地收益封顶", act:p => { setPolicy("pricecap", state.absMonth + 6); return "限价预期升温"; } },
    { t:"学区调整",   d:"西湖边、城西 −25", act:p => { heatAdd(["西湖边","城西"], -25); return "两地热度 −25"; } },
    { t:"交付延期",   d:"Lv1 地块暂停收租 3 个月", act:p => {
        owned(p).filter(x => x.lv === 1).forEach(x => x.boost = -3);
        return "工地暂缓"; } },
    { t:"房产税传闻", d:"每块地 −2% 现金", act:p => {
        const list = owned(p);
        const t = Math.round(list.reduce((s, c) => s + value(c), 0) * 0.02);
        p.cash -= t; return `现金 −${t} 万`; } },
    { t:"降价维权",   d:"现金 −35 万", act:p => { p.cash -= 35; return "现金 −35 万"; } },
    { t:"银行抽贷",   d:"负债超过净资产一半则强制卖地", act:p => {
        if (p.debt > netWorth(p) * 0.5 && owned(p).length){
            const c = owned(p).sort((a,b) => value(a) - value(b))[0];
            sellLand(p, c); return `${c.name} 被强制处置`;
        }
        return "暂未触及红线"; } },
    { t:"舆情反噬",   d:"随机区域热度 −15", act:p => {
        const r = pick(Object.keys(REGIONS)); heatAdd([r], -15); return `${r} 热度 −15`; } },
    { t:"中介跑路",   d:"现金 −60 万", act:p => { p.cash -= 60; return "现金 −60 万"; } },
    { t:"工期延误",   d:"最贵的地块暂停收租 2 个月", act:p => {
        const c = owned(p).sort((a,b) => value(b) - value(a))[0];
        if (!c) return "没有地块";
        c.boost = -2; return `${c.name} 暂缓收租`; } },
    { t:"租金下跌",   d:"全城热度 −8", act:p => { heatAdd(null, -8); return "全城热度 −8"; } },
    { t:"资金链紧张", d:"现金 −90 万", act:p => { p.cash -= 90; return "现金 −90 万"; } },
    { t:"政策加码",   d:"限购延长 6 个月", act:p => {
        if (hasPolicy("limitBuy")) extendPolicy("limitBuy", 6);
        else setPolicy("limitBuy", state.absMonth + 6);
        return "限购加码"; } },
    { t:"合作方违约", d:"现金 −50 万", act:p => { p.cash -= 50; return "现金 −50 万"; } },
    { t:"评估下调",   d:"名下地块估值 −5%", act:p => { p.revalue = 0.95; return "估值 −5%"; } },
    { t:"罚单",       d:"现金 −25 万", act:p => { p.cash -= 25; return "现金 −25 万"; } },
    { t:"空置税",     d:"空地每块 −10 万", act:p => {
        const n = owned(p).filter(x => x.lv === 0).length;
        p.cash -= n * 10; return n ? `空置税 −${n * 10} 万` : "没有空地"; } },
    { t:"竞品入市",   d:"同区域地块租金 −20%（3 个月）", act:p => {
        const c = owned(p)[0];
        if (!c) return "没有地块";
        c.boost = -3; return `${c.name} 租金下调`; } },
    { t:"法拍冲击",   d:"随机自有地块价值 −20%", act:p => {
        const c = owned(p)[0];
        if (!c) return "没有地块";
        c.discount = 0.8; return `${c.name} 估值下调`; } },
    { t:"断供",       d:"现金 −100 万", act:p => { p.cash -= 100; return "现金 −100 万"; } },
    { t:"代持被查",   d:"违规代持曝光，直接进监狱", act:p => { sendToJail(p); return "违规代持曝光，进了监狱"; } },
    { t:"违规套现",   d:"经营贷流入楼市被查，直接进监狱", act:p => { sendToJail(p); return "经营贷被查，进了监狱"; } }
  ],

  /* ------------------------------------------------------------
     道具商店（原 15 号命运格）
     售价 = 玩家当前总资产 × SHOP_PRICE_RATE，低于 SHOP_MIN_PRICE 时按下限
     ------------------------------------------------------------ */
  SHOP_PRICE_RATE: 0.03,
  SHOP_MIN_PRICE: 10,
  SHOP_ITEMS: ["dice", "stay", "uturn", "block"],

  /* ------------------------------------------------------------
     UP_GATE —— 升级门槛：持有满 m 回合 + 区域热度 ≥ h
     索引即目标等级；Lv0/Lv1 无门槛（空对象）
     对应 PRD 3.4 升级条件列
     ------------------------------------------------------------ */
  UP_GATE: [
    {},                     // → Lv0（不使用）
    {},                     // → Lv1：持有满 1 回合，无热度要求
    { m: 1, h: 30 },        // → Lv2
    { m: 2, h: 45 },        // → Lv3
    { m: 3, h: 60 },        // → Lv4
    { m: 6, h: 75 },        // → Lv5（另受区域 maxLv 与「全局仅 1 座」限制）
  ],
};

/* 忘记引入 config.js 时给出明确报错，而不是让 CFG 变成 undefined */
if (!window.HZ_CONFIG || !window.HZ_CONFIG.CFG) {
  throw new Error("[杭州大富翁] 配置未加载：请确认 index.html 在 data.js 之前引入了 config.js");
}
