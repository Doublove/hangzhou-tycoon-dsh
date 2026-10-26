#!/usr/bin/env node
/* ============================================================
   棋盘快照：不依赖浏览器，把当前布局画成 SVG 再交给 LibreOffice 栅格化。

   为什么要它：开发机上的 Chrome / Edge 在沙箱里无法启动（crashpad 需要
   OpenProcess，被拒），没有截图手段时只能盲改 CSS。这个脚本复用游戏里
   真实的几何函数（ringPos / cellPct / slotPct）和建筑矢量（ART.building），
   把棋盘画成一张等比例的 SVG —— 位置、间距、重叠、格名长度都能先看到，
   不需要跑起整个页面。

   用法：
     node tools/board-preview.js [章节 0-3] [输出文件]
     "C:\Program Files\LibreOffice\program\soffice.exe" --headless \
        --convert-to png --outdir docs/preview docs/preview/board.svg
   ============================================================ */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createEnv } = require("../tests/env.js");

const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const chapter = Number(args[0] === undefined ? 3 : args[0]) & 3;
const out = args[1] || path.join(__dirname, "..", "docs", "preview", "board.svg");
const jsonOut = path.join(path.dirname(out), "board.json");
const W = 900;                       // 画布边长（等比即可）

const env = createEnv();
env.newGame("hang", "normal", chapter);
const cells = env.curCells();

/* --demo：给几块地配上 1—5 级，用来检查房产位里的房子是否放得下 */
if (process.argv.includes("--demo")) {
  const plots = cells.filter(c => c.t === "plot");
  [1, 2, 3, 4, 5, 2, 3, 4].forEach((lv, k) => {
    const c = plots[k];
    if (!c) return;
    c.owner = env.state.players[k % 4];
    c.lv = lv;
    c.unlocked = true;
  });
}
const n = cells.length;

const RING_N = env.RING_N || 7;
const BAND = 0.135;
const step = (1 - BAND * 2) / RING_N;
const stepPx = W * step;
const cellPx = Math.round(stepPx * 0.86);
const slotPx = Math.round(Math.min(W * BAND * 0.95, stepPx * 0.80));

const px = (p) => (p / 100) * W;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const parts = [];

// 木纹底 + 7 等分棋格
parts.push(`<rect width="${W}" height="${W}" fill="#E2C08A"/>`);
parts.push(`<rect x="0" y="0" width="${W}" height="${W}" fill="url(#wood)"/>`);
const gx = px(BAND * 100), gw = W - gx * 2;
for (let i = 0; i <= RING_N; i++) {
  const x = gx + (gw / RING_N) * i;
  parts.push(`<line x1="${x}" y1="${gx}" x2="${x}" y2="${gx + gw}" stroke="#4A3218" stroke-opacity=".35"/>`);
  parts.push(`<line x1="${gx}" y1="${x}" x2="${gx + gw}" y2="${x}" stroke="#4A3218" stroke-opacity=".35"/>`);
}

// 格子
cells.forEach((c, i) => {
  const p = env.cellPct(i);
  const x = px(p.x), y = px(p.y), h = cellPx / 2;
  const isPlot = c.t === "plot";
  const fill = isPlot ? "#EFE7D4" : "#2A2420";
  const stroke = c.owner ? c.owner.color : (isPlot ? "#7A5426" : "#141010");
  parts.push(`<rect x="${x - h}" y="${y - h}" width="${cellPx}" height="${cellPx}" rx="${cellPx * .16}" fill="${fill}" stroke="${stroke}" stroke-width="${c.owner ? 4 : 2}"/>`);
  const fs = Math.max(9, cellPx * 0.21);
  parts.push(`<text x="${x}" y="${y + fs * 0.36}" font-size="${fs}" font-family="Microsoft YaHei" text-anchor="middle" fill="${isPlot ? "#2A2420" : "#FFFFFF"}">${esc(c.name)}</text>`);
  if (isPlot && c.lv > 0) {
    parts.push(`<text x="${x + h - 4}" y="${y + h - 4}" font-size="${cellPx * .16}" text-anchor="end" fill="#B08A5A" font-family="Microsoft YaHei">Lv${c.lv}</text>`);
  }
});

// 中央监狱
const jr = cellPx * 0.52;
parts.push(`<rect x="${W / 2 - jr}" y="${W / 2 - jr}" width="${jr * 2}" height="${jr * 2}" rx="${jr * .3}" fill="#3B2A44" stroke="#241A2B" stroke-width="2"/>`);
parts.push(`<text x="${W / 2}" y="${W / 2 + 4}" font-size="${cellPx * .24}" font-family="Microsoft YaHei" text-anchor="middle" fill="#EDE7F3">监狱</text>`);

// 外圈房产位
cells.forEach((c, i) => {
  if (c.t !== "plot") return;
  const p = env.slotPct(i);
  const x = px(p.x), y = px(p.y), h = slotPx / 2;
  parts.push(`<rect x="${x - h}" y="${y - h}" width="${slotPx}" height="${slotPx}" rx="5" fill="#14121A" stroke="#0B0A10" stroke-width="2"/>`);
  parts.push(`<rect x="${x - h + 3}" y="${y - h + 3}" width="${slotPx - 6}" height="${slotPx - 6}" rx="3" fill="none" stroke="${c.owner ? c.owner.color : "#B07BE0"}" stroke-width="2" stroke-dasharray="${c.owner ? "0" : "5 4"}"/>`);
  parts.push(`<text x="${x}" y="${y + h - 3}" font-size="${slotPx * .17}" text-anchor="middle" fill="#9A8FB0" font-family="Microsoft YaHei">${c.owner ? "Lv" + c.lv : (c.unlocked ? "空地" : "待出让")}</text>`);
  if (c.owner && c.lv > 0) {
    const bw = slotPx * 0.66, bh = slotPx * 0.76;
    parts.push(`<g transform="translate(${x - bw / 2},${y + h - 6 - bh}) scale(${bw / 24},${bh / 32})">${env.ART.building(c.lv, c.owner.color)}</g>`);
  }
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
<defs><linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#E9C894"/><stop offset=".6" stop-color="#C79A62"/><stop offset="1" stop-color="#A87A3F"/>
</linearGradient></defs>
${parts.join("\n")}
</svg>`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg, "utf8");

/* 同时导出一份几何数据：给 tools/render_preview.py 用 Pillow 出图。
   浏览器在沙箱里起不来，这条路是不依赖浏览器的预览管线。 */
const geo = {
  size: W, chapter, cellPx, slotPx, step,
  jail: { x: W / 2, y: W / 2, size: jr * 2 },
  cells: cells.map((c, i) => {
    const p = env.cellPct(i);
    return { i, name: c.name, t: c.t, x: px(p.x), y: px(p.y),
             owner: c.owner ? c.owner.color : null, lv: c.lv || 0, unlocked: !!c.unlocked };
  }),
  slots: cells.map((c, i) => {
    if (c.t !== "plot") return null;
    const p = env.slotPct(i);
    return { i, x: px(p.x), y: px(p.y), owner: c.owner ? c.owner.color : null,
             lv: c.lv || 0, unlocked: !!c.unlocked };
  }).filter(Boolean),
};
fs.writeFileSync(jsonOut, JSON.stringify(geo, null, 1), "utf8");
console.log(`已生成 ${jsonOut}`);
console.log(`已生成 ${out}`);
console.log(`第 ${chapter + 1} 章｜${n} 格｜格 ${cellPx}px｜房产位 ${slotPx}px`);
