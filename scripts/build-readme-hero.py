#!/usr/bin/env python3
"""Build the animated README masthead from the project's native artwork."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/assets/images/readme-hero.webp"
LOGO = ROOT / "public/assets/images/ccc-small.webp"
TITLE_FONT = ROOT / "assets-src/fonts/TsangerJinKai02-W05.ttf"
SUMMARY_FONT = ROOT / "assets-src/fonts/TsangerJinKai02-W04.ttf"

WIDTH = 1200
HEIGHT = 220
FRAME_COUNT = 90
FRAME_DURATION_MS = 50

NAVY = (27, 54, 93)
# Pantone TCX screen references: Transparent Yellow 11-0617 (#F4EAC2),
# Snow White 11-0602 (#F2F0EB). Gradients interpolate these reference colors.
CLOUD_STOPS = ((244, 234, 194), (242, 240, 235), (244, 234, 194))


def cloud_background() -> Image.Image:
    background = Image.new("RGBA", (WIDTH, HEIGHT))
    pixels = background.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            position = (x / (WIDTH - 1) + y / (HEIGHT - 1)) / 2
            if position <= 0.52:
                start, end = CLOUD_STOPS[:2]
                blend = position / 0.52
            else:
                start, end = CLOUD_STOPS[1:]
                blend = (position - 0.52) / 0.48
            pixels[x, y] = (*(
                round(a + (b - a) * blend) for a, b in zip(start, end)
            ), 255)
    return background


CLOUD_BACKGROUND = cloud_background()


def fluid_background(progress: float) -> Image.Image:
    background = CLOUD_BACKGROUND.copy()
    mask = Image.new("L", background.size, 0)
    draw = ImageDraw.Draw(mask)

    # Move only the highlights; the foreground and palette remain fixed.
    motion = math.sin(progress * math.tau)
    shift_x = 90 * motion
    shift_y = 12 * motion
    for offset, thickness, opacity in [(0, 52, 245), (132, 20, 150)]:
        points = [
            (x + shift_x, 92 + offset + shift_y + 66 * math.sin(x / WIDTH * math.tau * 0.85))
            for x in range(-240, WIDTH + 241, 8)
        ]
        draw.line(points, fill=opacity, width=thickness)
    haze = Image.new("RGBA", background.size, (242, 240, 235, 0))
    haze.putalpha(mask.filter(ImageFilter.GaussianBlur(18)))
    return Image.alpha_composite(background, haze)


def load_logo_frames() -> list[Image.Image]:
    source = Image.open(LOGO)
    frames: list[Image.Image] = []
    for index in range(source.n_frames):
        source.seek(index)
        frames.append(source.convert("RGBA").copy())
    return frames


def compose_logo(index: int, logo_frames: list[Image.Image], apply_opacity: bool = True) -> Image.Image:
    progress = index / FRAME_COUNT
    logo_index = round(progress * (len(logo_frames) - 1))
    logo = logo_frames[logo_index].resize((116, 99), Image.Resampling.LANCZOS)
    logo_alpha = 0.94 + 0.06 * math.sin(progress * math.tau - math.pi / 2)
    if apply_opacity:
        logo.putalpha(logo.getchannel("A").point(lambda value: round(value * logo_alpha)))
    return logo


def draw_title(frame: Image.Image) -> None:
    draw = ImageDraw.Draw(frame)
    title_font = ImageFont.truetype(str(TITLE_FONT), 62)
    summary_font = ImageFont.truetype(str(SUMMARY_FONT), 28)
    draw.text((414, 43), "CCC Attendance", font=title_font, fill=(*NAVY, 255), stroke_width=0)
    draw.text((417, 123), "一个签到码，三步搞定", font=summary_font, fill=(45, 70, 102, 242))


def compose_frame(index: int, logo_frames: list[Image.Image]) -> Image.Image:
    frame = fluid_background(index / FRAME_COUNT)
    frame.alpha_composite(compose_logo(index, logo_frames), (272, 61))
    draw_title(frame)
    return frame.convert("RGB")


def main() -> None:
    logo_frames = load_logo_frames()
    frames = [compose_frame(index, logo_frames) for index in range(FRAME_COUNT)]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUTPUT,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_DURATION_MS,
        loop=0,
        quality=82,
        method=6,
        # Full frames preserve subtle background motion that delta encoding drops.
        kmin=1,
        kmax=1,
    )
    print(f"Built {OUTPUT.relative_to(ROOT)} ({WIDTH}x{HEIGHT}, {FRAME_COUNT} frames)")


if __name__ == "__main__":
    main()
