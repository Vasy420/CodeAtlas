from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public"


def make(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.02)
    draw.rounded_rectangle(
        (pad, pad, size - pad - 1, size - pad - 1),
        radius=int(size * 0.22),
        fill=(14, 20, 30, 255),
    )

    def pt(x: float, y: float) -> tuple[float, float]:
        return x / 32 * size, y / 32 * size

    def rad(n: float) -> float:
        return n / 32 * size

    cyan = (125, 211, 240, 255)
    amber = (232, 184, 109, 255)
    line = (125, 211, 240, 220)
    stroke = max(2, int(size * 0.045))
    center = pt(16, 16)
    nodes = [pt(8.2, 9.2), pt(24.2, 10.2), pt(8.8, 23.2), pt(23.4, 22.6)]
    for node in nodes:
        draw.line([center, node], fill=line, width=stroke)
    for i, node in enumerate(nodes):
        r = rad(2.15)
        fill = amber if i == 2 else cyan
        draw.ellipse([node[0] - r, node[1] - r, node[0] + r, node[1] + r], fill=fill)
    r = rad(3.35)
    draw.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r], fill=amber)
    hole = rad(1.15)
    draw.ellipse(
        [center[0] - hole, center[1] - hole, center[0] + hole, center[1] + hole],
        fill=(14, 20, 30, 255),
    )
    return img


if __name__ == "__main__":
    make(1024).save(OUT / "logo.png", "PNG")
    make(192).save(OUT / "logo-192.png", "PNG")
    make(64).save(OUT / "favicon.png", "PNG")
    print("wrote", OUT / "logo.png")
