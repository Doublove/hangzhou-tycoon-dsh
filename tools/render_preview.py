# -*- coding: utf-8 -*-
"""把 board.json 画成 PNG（Pillow）。

浏览器在沙箱里无法启动，这里用几何数据直接出图，
用来检查格位间距、房产位对齐、名字是否会溢出。
"""
import io
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "docs", "preview", "board.json")
DST = os.path.join(HERE, "..", "docs", "preview", "board.png")

FONT = r"C:\Windows\Fonts\msyh.ttc"
if not os.path.exists(FONT):
    FONT = r"C:\Windows\Fonts\simhei.ttf"


def font(size):
    try:
        return ImageFont.truetype(FONT, int(size))
    except Exception:
        return ImageFont.load_default()


def main():
    geo = json.load(io.open(SRC, encoding="utf-8"))
    W = geo["size"]
    cell = geo["cellPx"]
    slot = geo["slotPx"]
    img = Image.new("RGB", (W, W), "#C79A62")
    d = ImageDraw.Draw(img)

    # 木纹底（竖向渐变 + 细纹）
    for y in range(W):
        k = y / W
        r = int(233 - 60 * k)
        g = int(200 - 55 * k)
        b = int(148 - 45 * k)
        d.line([(0, y), (W, y)], fill=(r, g, b))
    for y in range(0, W, 6):
        d.line([(0, y), (W, y)], fill=(200, 165, 112))

    # 7 等分棋格
    band = W * 0.135
    gw = W - band * 2
    for i in range(8):
        x = band + gw / 7 * i
        d.line([(x, band), (x, band + gw)], fill=(120, 86, 44))
        d.line([(band, x), (band + gw, x)], fill=(120, 86, 44))

    # 格子
    for c in geo["cells"]:
        x, y = c["x"], c["y"]
        h = cell / 2
        is_plot = c["t"] == "plot"
        fill = (239, 231, 212) if is_plot else (42, 36, 32)
        outline = c["owner"] or ((122, 84, 38) if is_plot else (20, 16, 16))
        d.rounded_rectangle([x - h, y - h, x + h, y + h], radius=cell * 0.16,
                            fill=fill, outline=outline, width=4 if c["owner"] else 2)
        tx, ty = x, y
        col = (42, 36, 32) if is_plot else (255, 255, 255)
        d.text((tx, ty), c["name"], font=font(max(11, cell * 0.21)), fill=col, anchor="mm")
        if is_plot and c["lv"] > 0:
            d.text((x + h - 4, y + h - 4), "Lv%d" % c["lv"], font=font(cell * 0.16),
                   fill=(176, 138, 90), anchor="rd")

    # 中央监狱
    j = geo["jail"]
    jr = j["size"] / 2
    d.rounded_rectangle([j["x"] - jr, j["y"] - jr, j["x"] + jr, j["y"] + jr],
                        radius=jr * 0.3, fill=(59, 42, 68), outline=(36, 26, 43), width=3)
    d.text((j["x"], j["y"]), "监狱", font=font(cell * 0.24), fill=(237, 231, 243), anchor="mm")

    # 外圈房产位
    for s_ in geo["slots"]:
        x, y = s_["x"], s_["y"]
        h = slot / 2
        d.rectangle([x - h, y - h, x + h, y + h], fill=(20, 18, 26), outline=(11, 10, 16), width=3)
        pad = 4
        d.rectangle([x - h + pad, y - h + pad, x + h - pad, y + h - pad],
                    outline=s_["owner"] or (176, 123, 224), width=2)
        label = "Lv%d" % s_["lv"] if (s_["owner"] and s_["lv"] > 0) else ("空地" if s_["unlocked"] else "待出让")
        d.text((x, y + h - 4), label, font=font(slot * 0.17), fill=(154, 143, 176), anchor="md")
        # 房子用简化体量代替（真实外观由 art.js 的 SVG 提供）
        if s_["owner"] and s_["lv"] > 0:
            bw = slot * 0.46
            bh = slot * 0.20 * s_["lv"]
            bh = min(bh, slot * 0.66)
            top = y + h - 6 - bh - slot * 0.12
            d.rectangle([x - bw / 2, top + slot * 0.12, x + bw / 2, y + h - 6 - slot * 0.12],
                        fill=(228, 220, 203), outline=s_["owner"], width=2)
            if s_["lv"] >= 1:
                d.polygon([(x - bw / 2 - 3, top + slot * 0.12), (x, top),
                           (x + bw / 2 + 3, top + slot * 0.12)], fill=s_["owner"])

    img.save(DST)
    print("已渲染", DST, img.size)


if __name__ == "__main__":
    main()
