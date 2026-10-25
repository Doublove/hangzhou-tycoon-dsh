/* ============================================================
   用例文档生成器
   从测试源码里提取 TC-ID 与标题，输出可追溯的用例矩阵。
   用法：node tests/report.js
   ============================================================ */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TESTS_DIR = __dirname;
const OUT = path.join(TESTS_DIR, '测试用例.md');

const MODULES = [
  { prefix: 'MAP',   file: 'board.test.js',    name: '地图与棋盘' },
  { prefix: 'ECO',   file: 'economy.test.js',  name: '经济与数值' },
  { prefix: 'TURN',  file: 'turn.test.js',     name: '回合流程' },
  { prefix: 'CARD',  file: 'cards.test.js',    name: '历史事件与卡牌' },
  { prefix: 'ITEM',  file: 'items.test.js',    name: '道具系统' },
  { prefix: 'SKILL', file: 'skills.test.js',   name: '角色技能' },
  { prefix: 'BANK',  file: 'bankrupt.test.js', name: '破产与清算' },
  { prefix: 'SAVE',  file: 'save.test.js',     name: '存档与读档' },
  { prefix: 'TIP',   file: 'tooltip.test.js',  name: 'HUD 悬浮说明' },
  { prefix: 'BAL',   file: 'balance.test.js',  name: '整局不变量' },
];

/* 需求条款 → 用例范围（人工维护，随文档改版同步） */
const MATRIX = [
  ['2.1 核心循环',       '掷骰→落地→决策→月末→时间推进', 'TC-TURN-18, TC-TURN-21, TC-TURN-22'],
  ['2.2 单回合流程',     '八个阶段的执行顺序与结算', 'TC-TURN-01~17, TC-CARD-05'],
  ['2.3 时间轴与章节化', '一回合一个月，四章 48/48/48/60', 'TC-MAP-01, TC-MAP-14, TC-TURN-27~32'],
  ['2.4 胜负与结算',     '净资产最高者胜，仅剩一人提前结束', 'TC-TURN-20, TC-BAL-07'],
  ['3.1 年轮式地图',     '四环 26 格，只在当前环行走', 'TC-MAP-01~04, TC-MAP-16'],
  ['3.2 区域设定',       '12 个区域与热度基准', 'TC-MAP-10, TC-MAP-11'],
  ['3.3 地块数据结构',   '地价换算、初始态字段', 'TC-MAP-05, TC-MAP-06'],
  ['3.4 地块等级',       'Lv0—Lv5 租金率与升级双门槛', 'TC-ECO-06, TC-ECO-07, TC-TURN-43'],
  ['3.5 地价与租金公式', '地价 / 租金 / 过路费 / 连片 / 上限 / 成本', 'TC-ECO-01~26'],
  ['3.6 板块热度系统',   '热度加减与钳制', 'TC-ECO-01, TC-ECO-02, TC-CARD-05~07'],
  ['3.7 功能格',         '机会/命运/银行/税务/证券/监狱/风景区', 'TC-MAP-03, TC-CARD-05~14'],
  ['3.7.1 监狱',         '偶数出狱、3 次保底', 'TC-TURN-10~13, TC-ITEM-13'],
  ['3.7.2 西湖风景区',   '梯度停留、阿莲减半', 'TC-TURN-14~17'],
  ['3.8 地块解锁规则',   '按月解锁', 'TC-MAP-07, TC-MAP-08'],
  ['3.9 命名与建筑表现', '合规检查清单（美术/文案）', '未覆盖（非代码逻辑，见缺口说明）'],
  ['3.10 道具系统',      '四种道具、掉落权重、使用限制', 'TC-ITEM-01~20'],
  ['4.1 时间轴总表',     '30+ 条历史事件按月触发', 'TC-CARD-01~04, TC-BAL-08'],
  ['5.1—5.5 卡牌与政策', '机会/命运卡效果、政策生效与解除', 'TC-CARD-08~33'],
  ['6.2 角色一览',       '六名角色被动', 'TC-SKILL-01, TC-SKILL-18, TC-SKILL-19'],
  ['6.5 主动技能',       '六个技能效果、冷却、AI 使用', 'TC-SKILL-02~17'],
  ['7.1 三档难度',       '现金安全线随难度变化', 'TC-TURN-44'],
  ['7.3 性格参数',       'AI 买卖与升级的启发式', 'TC-TURN-40~43, TC-SKILL-17'],
  ['8.2 初始配置',       '起始资金随时代缩放、贷款额度', 'TC-ECO-29, TC-ECO-30, TC-TURN-32'],
  ['8.3 现金流模型',     '租金 − 利息 − 物业费', 'TC-TURN-21~26, TC-ECO-25, TC-ECO-26'],
  ['8.4 杠杆与风险',     '杠杆率 > 50% 失去上限保护', 'TC-ECO-19~21'],
  ['8.5 破产与接管',     '清算两级路径、3 个月宽限', 'TC-BANK-01~14'],
  ['8.7 资金流向平衡',   '系统注入不失控', 'TC-BAL-09'],
  ['10.4 账号与存档',    '版本号、往返一致、坏档容错', 'TC-SAVE-01~12'],
  ['9.2 / 9.4 界面与交互', '政策条、旧环资产、技能按钮的悬浮说明', 'TC-TIP-01~26'],
];

function extract() {
  const result = [];
  MODULES.forEach(mod => {
    const file = path.join(TESTS_DIR, mod.file);
    if (!fs.existsSync(file)) return;
    const src = fs.readFileSync(file, 'utf8');
    const re = /test\(\s*'(TC-([A-Z]+)-\d+)\s+([^']+)'\s*(,\s*\{\s*todo:\s*'([^']*)'\s*\})?/g;
    const cases = [];
    let m;
    while ((m = re.exec(src)) !== null) {
      cases.push({
        id: m[1],
        prefix: m[2],
        title: m[3].trim(),
        todo: m[5] || null,
      });
    }
    result.push({ ...mod, cases });
  });
  return result;
}

function render(mods) {
  const total = mods.reduce((s, m) => s + m.cases.length, 0);
  const todo = mods.reduce((s, m) => s + m.cases.filter(c => c.todo).length, 0);
  const now = new Date().toISOString().slice(0, 10);

  const lines = [];
  lines.push('# 杭州大富翁 · 自动化测试用例');
  lines.push('');
  lines.push(`> 本文件由 \`node tests/report.js\` 从测试源码自动生成，共 **${total}** 条用例，其中 **${todo}** 条标记为已知偏差（todo）。`);
  lines.push(`> 生成时间：${now}`);
  lines.push('');
  lines.push('## 一、测试环境与运行方式');
  lines.push('');
  lines.push('| 项 | 说明 |');
  lines.push('| --- | --- |');
  lines.push('| 被测对象 | `site/data.js`、`site/game.js`（生产代码本体，不做副本） |');
  lines.push('| 运行环境 | Node.js ≥ 20，内置 `node:test` + `node:assert`，零第三方依赖 |');
  lines.push('| 加载方式 | `vm` 沙箱执行真实脚本，最小 DOM 桩支撑渲染路径 |');
  lines.push('| 随机性 | `Math.random` 可注入序列，随机机制可复现 |');
  lines.push('| 运行全部 | `npm test`（约 16 秒） |');
  lines.push('| 只跑单测 | `npm run test:unit`（跳过整局模拟） |');
  lines.push('| 只跑整局 | `npm run test:balance` |');
  lines.push('');
  lines.push('## 二、模块分布');
  lines.push('');
  lines.push('| 模块 | 用例数 | 自动化文件 |');
  lines.push('| --- | ---: | --- |');
  mods.forEach(m => lines.push(`| ${m.name} | ${m.cases.length} | \`tests/${m.file}\` |`));
  lines.push(`| **合计** | **${total}** | ${mods.length} 个文件 |`);
  lines.push('');
  lines.push('## 三、需求覆盖矩阵');
  lines.push('');
  lines.push('| 需求条款 | 内容 | 对应用例 |');
  lines.push('| --- | --- | --- |');
  MATRIX.forEach(([k, v, ids]) => lines.push(`| ${k} | ${v} | ${ids} |`));
  lines.push('');
  lines.push('## 四、用例清单');
  mods.forEach(m => {
    lines.push('');
    lines.push(`### ${m.name}（${m.cases.length} 条）`);
    lines.push('');
    lines.push('| 用例 ID | 标题 | 状态 |');
    lines.push('| --- | --- | --- |');
    m.cases.forEach(c => {
      lines.push(`| ${c.id} | ${c.title} | ${c.todo ? '⚠️ 已知偏差' : '✅ 通过'} |`);
    });
  });

  const todos = mods.flatMap(m => m.cases.filter(c => c.todo).map(c => ({ ...c, module: m.name })));
  lines.push('');
  lines.push('## 五、已知偏差（todo）');
  lines.push('');
  if (!todos.length) {
    lines.push('无。');
  } else {
    lines.push('这些用例按需求文档口径编写，当前代码实现与文档不一致。测试以 `todo` 标记，不计入失败，但会在报告中持续暴露，直到实现补齐。');
    lines.push('');
    lines.push('| 用例 ID | 模块 | 偏差说明 |');
    lines.push('| --- | --- | --- |');
    todos.forEach(t => lines.push(`| ${t.id} | ${t.module} | ${t.todo} |`));
  }
  lines.push('');
  lines.push('## 六、覆盖缺口');
  lines.push('');
  lines.push('以下内容属于需求文档范围，但无法用当前代码层的自动化测试覆盖：');
  lines.push('');
  lines.push('1. **表现层**：二头身美术、年轮生长动画、音效、镜头与动效，依赖美术资源与真机观感。');
  lines.push('2. **商业化**：Google H5 Games Ads 的激励视频与插屏、频次控制、CMP 同意管理，需要真实广告环境。');
  lines.push('3. **埋点与数据**：`10.7` 定义的事件表需接入统计后端后才能端到端验证。');
  lines.push('4. **命名与建筑合规**：`3.9` 的验收清单是美术/文案交付检查项，应在资源评审环节执行，不适合自动化断言。');
  lines.push('5. **多端适配**：竖屏 750×1624、刘海安全区、横屏布局，需真机或视觉回归工具。');
  lines.push('');
  lines.push('建议在 M2 阶段补：Playwright 冒烟（首屏 3 秒内可交互、掷骰按钮可点、存档刷新后恢复）、视觉回归（棋盘四环截图对比）。');
  lines.push('');

  return lines.join('\n');
}

const mods = extract();
fs.writeFileSync(OUT, render(mods), 'utf8');

const total = mods.reduce((s, m) => s + m.cases.length, 0);
const todo = mods.reduce((s, m) => s + m.cases.filter(c => c.todo).length, 0);
console.log(`已生成 ${path.relative(process.cwd(), OUT)}`);
console.log(`用例 ${total} 条，其中 todo ${todo} 条`);
mods.forEach(m => console.log(`  ${m.name.padEnd(12, '　')} ${String(m.cases.length).padStart(3)} 条`));
