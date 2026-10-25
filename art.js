/* ============================================================
   杭州大富翁 · 视觉层（art.js）

   职责：把「数据」画成「东西」——建筑立面、地铁线路底图、卫星底纹。
   与逻辑层完全解耦：这里只接受一个等级/年份/配色，返回 SVG 字符串。

   需求对照：《杭州大富翁 游戏开发需求文档 V1.7》
     3.4 地块等级（Lv0—Lv5 的建筑形态）
     3.9 命名与建筑表现规则（不出现真实楼盘、招牌无字）
     6.4 美术设定（平涂 + 单层硬阴影，不做写实光影）
     9.5 美术与音频风格 / 9.1 适配
     13.1 地图数据合规（示意底图，不画行政边界、不标经纬度）

   说明：建筑是矢量立面图，靠体量、材质与光影分级，
   不使用任何真实项目的外观，也没有可读文字。
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------------- 工具 ---------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // 把某个颜色压暗/提亮，用于立面的受光面与背光面
  function shade(hex, k) {
    const h = hex.replace("#", "");
    const n = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
    const f = v => clamp(Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)), 0, 255);
    return "#" + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, "0")).join("");
  }

  /* ============================================================
     一、建筑立面（Lv1—Lv5，统一 24×32 画布、同一基线）
     ============================================================ */
  function building(level, color) {
    const lv = clamp(level | 0, 0, 5);
    if (lv === 0) return "";
    const c = color || "#B08A5A";
    const roof = shade(c, -0.18);      // 屋顶
    const faceL = shade(c, 0.62);      // 受光面
    const faceR = shade(c, 0.24);      // 背光面
    const wall = "#E4DCCB";
    const glass = "#9FC3D8";
    const win = "#5C6B77";
    const gid = "g" + Math.random().toString(36).slice(2, 8);

    const shadow = `<ellipse cx="12" cy="30.6" rx="9.4" ry="1.9" fill="#000" opacity=".26"/>`;
    // 窗户阵列：小格栅
    const grid = (x, y, w, h, cols, rows, fill) => {
      let s = "";
      const cw = w / cols, ch = h / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        s += `<rect x="${(x + i * cw + cw * 0.22).toFixed(2)}" y="${(y + j * ch + ch * 0.2).toFixed(2)}" width="${(cw * 0.56).toFixed(2)}" height="${(ch * 0.56).toFixed(2)}" fill="${fill}" opacity="${j === rows - 1 ? ".55" : ".85"}"/>`;
      }
      return s;
    };

    let body = "";
    if (lv === 1) {
      /* 单间平房：坡屋顶 + 一间正房 */
      body = `
        <polygon points="2,16 12,9 22,16" fill="${roof}"/>
        <polygon points="12,9 22,16 20.4,16 12,10.6" fill="${shade(c, 0.05)}" opacity=".55"/>
        <rect x="4" y="16" width="16" height="13.4" fill="${wall}"/>
        <rect x="15.4" y="16" width="4.6" height="13.4" fill="${faceR}" opacity=".55"/>
        <rect x="6.2" y="18.4" width="4.2" height="4" fill="${win}"/>
        <rect x="6.2" y="18.4" width="4.2" height="1.6" fill="${glass}" opacity=".8"/>
        <rect x="9.4" y="24.4" width="5.2" height="5" fill="${shade(c, -0.35)}"/>
        <rect x="14.6" y="18.6" width="3.2" height="3.4" fill="${win}" opacity=".8"/>`;
    } else if (lv === 2) {
      /* 两层平房：两层窗 + 女儿墙 */
      body = `
        <rect x="3.4" y="7.4" width="17.2" height="22" fill="${wall}"/>
        <rect x="15.6" y="7.4" width="5" height="22" fill="${faceR}" opacity=".5"/>
        <rect x="3" y="6.4" width="18" height="2" fill="${roof}"/>
        ${grid(5.2, 10.2, 11.6, 5.6, 4, 1, win)}
        ${grid(5.2, 18.2, 11.6, 5.6, 4, 1, win)}
        <rect x="3" y="16.4" width="18" height="1.2" fill="${faceR}" opacity=".35"/>
        <rect x="9.6" y="25.4" width="4.8" height="4" fill="${shade(c, -0.3)}"/>
        <rect x="3.4" y="29.2" width="17.2" height=".8" fill="${roof}" opacity=".5"/>`;
    } else if (lv === 3) {
      /* 公寓楼：五层 + 阳台 + 顶部水箱 */
      let floors = "";
      for (let f = 0; f < 5; f++) {
        const y = 6.4 + f * 4.4;
        floors += `<rect x="4.6" y="${y}" width="14.8" height="4.4" fill="${wall}"/>`;
        floors += grid(5.2, y + 0.7, 10.4, 3, 4, 1, win);
        floors += `<rect x="14.4" y="${y + 0.4}" width="5" height="3.6" fill="${faceR}" opacity=".42"/>`;
        floors += `<rect x="15.8" y="${y + 0.4}" width=".6" height="3.6" fill="${roof}" opacity=".5"/>`;
      }
      body = `
        <rect x="4" y="28" width="17" height="1.6" fill="${shade(c, -0.32)}"/>
        ${floors}
        <rect x="3.8" y="5" width="17" height="2" fill="${roof}"/>
        <rect x="3.8" y="5" width="17" height=".7" fill="${shade(c, 0.1)}" opacity=".7"/>
        <rect x="6" y="2.6" width="4.6" height="2.6" fill="${faceR}"/>
        <rect x="13" y="3.2" width="2.4" height="2" fill="${faceR}" opacity=".8"/>
        <rect x="9.8" y="25.6" width="3.4" height="2.4" fill="${shade(c, -0.4)}"/>`;
    } else if (lv === 4) {
      /* 写字楼：幕墙网格 + 收分 + 顶部门厅 */
      const floors = [];
      for (let f = 0; f < 7; f++) {
        const y = 4 + f * 3.3;
        const inset = f === 0 ? 0 : 0;
        floors.push(`<rect x="${5 + inset}" y="${y}" width="14" height="3.3" fill="${glass}" opacity="${0.35 + (f % 2) * 0.12}"/>`);
        for (let m = 0; m < 7; m++) floors.push(`<rect x="${5.6 + m * 2}" y="${y}" width=".34" height="3.3" fill="#FFFFFF" opacity=".38"/>`);
        floors.push(`<rect x="${5}" y="${y + 3.1}" width="14" height=".35" fill="#FFFFFF" opacity=".5"/>`);
        floors.push(`<rect x="15.6" y="${y}" width="3.4" height="3.3" fill="${faceR}" opacity=".3"/>`);
      }
      body = `
        <rect x="4.6" y="27.4" width="16" height="2.2" fill="${shade(c, -0.4)}"/>
        <rect x="5" y="3.2" width="14" height="24.4" fill="${glass}"/>
        ${floors.join("")}
        <rect x="4.4" y="2.4" width="15.2" height="1.4" fill="${roof}"/>
        <rect x="12.4" y=".6" width="1" height="1.9" fill="${faceR}"/>
        <rect x="7.6" y="24.4" width="8.8" height="3" fill="${shade(c, -0.28)}"/>
        <rect x="9" y="25.6" width="5.8" height="1.7" fill="${glass}" opacity=".75"/>`;
    } else {
      /* 商业综合体：裙房 + 塔楼 + 顶部灯带 */
      let curtain = "";
      for (let m = 0; m < 6; m++) curtain += `<rect x="${9.6 + m * 1.9}" y="4" width=".3" height="15.4" fill="#FFF" opacity=".35"/>`;
      body = `
        <rect x="1.6" y="19.2" width="21" height="10.4" fill="${shade(c, -0.1)}"/>
        <rect x="16" y="19.2" width="6.6" height="10.4" fill="${faceR}" opacity=".45"/>
        <rect x="2.6" y="21.2" width="17.6" height="3.6" fill="${glass}" opacity=".55"/>
        <rect x="2.6" y="25.6" width="5.4" height="3.2" fill="${shade(c, -0.42)}"/>
        <rect x="9.4" y="26" width="4.4" height="2.8" fill="${shade(c, -0.5)}" opacity=".85"/>
        <rect x="8.4" y="3.8" width="10.4" height="15.6" fill="${glass}"/>
        ${curtain}
        <rect x="8.4" y="3.8" width="10.4" height="1.2" fill="${faceL}" opacity=".5"/>
        <rect x="8" y="2.6" width="11.2" height="1.4" fill="${roof}"/>
        <rect x="9" y="1.2" width="9.2" height="1.5" fill="${shade(c, 0.45)}" opacity=".9"/>
        <rect x="10.6" y=".4" width="6" height=".9" fill="#FFF" opacity=".85"/>
        <rect x="12.4" y="19.2" width="2.2" height=".7" fill="#FFF" opacity=".55"/>`;
    }

    return `<svg class="bld-svg" viewBox="0 0 24 32" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".12"/>
      </linearGradient></defs>
      ${shadow}${body}
      <rect x="0" y="0" width="24" height="32" fill="url(#${gid})" opacity=".16" pointer-events="none"/>
    </svg>`;
  }

  /* ============================================================
     二、地铁示意底图（按章节结束年份）
     画的是「拓扑示意」不是地理图：不画行政边界、不标经纬度，
     符合 13.1 对地图数据合规的要求，同时保留「线网在长」的体感。
     ============================================================ */
  const METRO = {
    2013: [
      { c: "#D33A2C", w: 1.5, p: "8,68 26,62 44,56 60,58 74,66 86,74" },      // 1 号线
      { c: "#2E7D6F", w: 1.2, p: "26,62 30,44 38,30 50,22" },                  // 2 号线（局部）
    ],
    2017: [
      { c: "#D33A2C", w: 1.5, p: "8,68 26,62 44,56 60,58 74,66 86,74" },
      { c: "#2E7D6F", w: 1.4, p: "26,62 30,44 38,30 50,22 66,20" },
      { c: "#1B5FA8", w: 1.3, p: "18,34 38,36 56,34 72,30 88,26" },
      { c: "#B08A5A", w: 1.2, p: "56,34 58,50 62,66 70,80" },
    ],
    2021: [
      { c: "#D33A2C", w: 1.5, p: "8,68 26,62 44,56 60,58 74,66 86,74" },
      { c: "#2E7D6F", w: 1.4, p: "26,62 30,44 38,30 50,22 66,20" },
      { c: "#1B5FA8", w: 1.3, p: "18,34 38,36 56,34 72,30 88,26" },
      { c: "#B08A5A", w: 1.2, p: "56,34 58,50 62,66 70,80" },
      { c: "#8E44AD", w: 1.2, p: "12,48 30,52 48,50 64,52 82,48" },
      { c: "#0F8B8D", w: 1.2, p: "36,84 44,70 50,56 52,40 50,22" },
      { c: "#C9A227", w: 1.1, p: "70,80 78,62 84,44 88,26" },
    ],
    2026: [
      { c: "#D33A2C", w: 1.6, p: "8,68 26,62 44,56 60,58 74,66 86,74" },
      { c: "#2E7D6F", w: 1.5, p: "26,62 30,44 38,30 50,22 66,20" },
      { c: "#1B5FA8", w: 1.4, p: "18,34 38,36 56,34 72,30 88,26" },
      { c: "#B08A5A", w: 1.3, p: "56,34 58,50 62,66 70,80" },
      { c: "#8E44AD", w: 1.3, p: "12,48 30,52 48,50 64,52 82,48" },
      { c: "#0F8B8D", w: 1.3, p: "36,84 44,70 50,56 52,40 50,22" },
      { c: "#C9A227", w: 1.2, p: "70,80 78,62 84,44 88,26" },
      { c: "#E06C3A", w: 1.2, p: "10,58 24,74 40,84 58,84 74,74 84,56" },
      { c: "#4A6FA5", w: 1.1, p: "30,52 34,68 40,84" },
    ],
  };

  function metro(year) {
    const lines = METRO[year] || METRO[2026];
    let out = "";
    lines.forEach(L => {
      const pts = L.p.split(" ").map(s => s.split(",").map(Number));
      const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
      out += `<path d="${d}" fill="none" stroke="${L.c}" stroke-width="${L.w}" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>`;
      pts.forEach(p => {
        out += `<circle cx="${p[0]}" cy="${p[1]}" r="1.5" fill="#F7F1E2" stroke="${L.c}" stroke-width=".9" opacity=".9"/>`;
      });
    });
    return `<svg class="metro-svg" viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${out}</svg>`;
  }

  /* ============================================================
     三、对外接口
     ============================================================ */
  global.ART = {
    version: "1.0.0",
    building,
    metro,
    /* 棋盘中央的城市底纹：直接用卫星图，裁成圆 */
    coreStyle() {
      return `background-image:radial-gradient(circle at 50% 45%, rgba(21,21,30,.15), rgba(21,21,30,.85) 72%), url("assets/hangzhou-satellite.png");`;
    },
    /* 章节 → 结束年份 */
    yearOf(chapter) {
      return [2013, 2017, 2021, 2026][clamp(chapter | 0, 0, 3)];
    },
  };
})(window);
