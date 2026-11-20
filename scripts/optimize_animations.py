"""Retiming and color/size normalization of the original Shenshi WebP frames.

The source files in src/assets/animations stay untouched. This script does not
generate poses: each output frame comes from the matching source frame.
Requires Pillow and NumPy (python3 -m pip install pillow numpy).
"""

from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

SOURCE = Path(__file__).resolve().parents[1] / "src/assets/animations"
DEST = SOURCE / "optimized"

# canvas scale, frame duration multiplier, loop count, saturation, brightness
TUNING = {
    "eye": (0.96, 1.20, 4, 0.96, 1.00),
    "drink": (0.90, 2.00, 3, 0.90, 1.06),
    "lunch": (1.02, 1.45, 2, 0.90, 1.00),
    "daka": (0.93, 1.75, 3, 0.95, 1.02),
    "custom": (0.96, 1.40, 3, 0.96, 1.00),
}


def normalize(frame: Image.Image, scale: float, saturation: float, brightness: float) -> Image.Image:
    frame = frame.convert("RGBA")
    if saturation != 1:
        frame = ImageEnhance.Color(frame).enhance(saturation)
    if brightness != 1:
        frame = ImageEnhance.Brightness(frame).enhance(brightness)
    if scale == 1:
        return frame
    width, height = frame.size
    resized = frame.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((width - resized.width) // 2, (height - resized.height) // 2))
    return canvas


def refine_alarm_material(frame: Image.Image, name: str) -> Image.Image:
    """Match the eye/drink clock face to the idle face's pearl blue highlights.

    The adjustment is feathered and restricted to light blue opaque pixels, so
    the clock hands, eyes, drink glass, and transparent edges stay untouched.
    """
    if name not in {"eye", "drink"}:
        return frame
    pixels = np.asarray(frame.convert("RGBA"), dtype=np.float32).copy()
    rgb, alpha = pixels[..., :3], pixels[..., 3]
    height, width = alpha.shape
    y, x = np.ogrid[:height, :width]
    cx, cy, rx, ry, face_lift = {
        "eye": (310, 330, 132, 166, (28, 14, 2)),
        "drink": (360, 350, 148, 152, (30, 22, 10)),
    }[name]
    distance = np.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
    face = (
        np.clip((1 - distance) / .20, 0, 1)
        * np.clip((rgb[..., 0] - 100) / 70, 0, 1)
        * np.clip((rgb[..., 2] - rgb[..., 0] - 10) / 50, 0, 1)
        * np.clip((alpha - 150) / 100, 0, 1)
    )
    for channel, lift in enumerate(face_lift):
        rgb[..., channel] += lift * face

    opaque = np.clip((alpha - 140) / 110, 0, 1)
    blue = np.clip((rgb[..., 2] - rgb[..., 0] - 15) / 85, 0, 1) * np.clip((rgb[..., 2] - rgb[..., 1] - 5) / 45, 0, 1)
    material = blue * opaque
    wide = np.asarray(frame.convert("RGB").filter(ImageFilter.GaussianBlur(9)), dtype=np.float32)
    fine = np.asarray(frame.convert("RGB").filter(ImageFilter.GaussianBlur(1.1)), dtype=np.float32)
    rgb += (rgb - wide) * .18 * material[..., None] + (rgb - fine) * .15 * opaque[..., None]
    rgb[..., 0] += (8 if name == "drink" else 2) * material
    rgb[..., 1] += (5 if name == "drink" else 2) * material
    pixels[..., :3] = np.clip(rgb, 0, 255)
    return Image.fromarray(pixels.astype("uint8"), "RGBA")


def main() -> None:
    DEST.mkdir(exist_ok=True)
    for name, (scale, speed, loops, saturation, brightness) in TUNING.items():
        source = SOURCE / f"{name}.webp"
        image = Image.open(source)
        frames = []
        durations = []
        for index in range(image.n_frames):
            image.seek(index)
            normalized = normalize(image, scale, saturation, brightness).resize((720, 720), Image.Resampling.LANCZOS)
            frames.append(refine_alarm_material(normalized, name))
            durations.append(max(20, round(image.info.get("duration", 60) * speed)))
        output = DEST / source.name
        frames[0].save(
            output,
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=loops,
            quality=85,
            method=4,
        )
        print(f"{source.name}: {len(frames)} original frames, {sum(durations)} ms per loop, {loops} loops -> {output}")


if __name__ == "__main__":
    main()
