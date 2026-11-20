"""Improve eye/drink clock highlights without changing frames, canvas, or timing.

Source animations remain in src/assets/animations. Outputs in material/ are
color-corrected copies of those same frames. Requires Pillow and NumPy.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SOURCE = Path(__file__).resolve().parents[1] / "src/assets/animations"
DEST = SOURCE / "material"


def refine(frame: Image.Image, name: str) -> Image.Image:
    pixels = np.asarray(frame.convert("RGBA"), dtype=np.float32).copy()
    rgb, alpha = pixels[..., :3], pixels[..., 3]
    height, width = alpha.shape
    y, x = np.ogrid[:height, :width]
    scale = width / 960
    cx, cy, rx, ry, face_lift = {
        "eye": (411, 438, 183, 231, (28, 14, 2)),
        "drink": (480, 465, 219, 225, (30, 22, 10)),
    }[name]
    distance = np.sqrt(((x - cx * scale) / (rx * scale)) ** 2 + ((y - cy * scale) / (ry * scale)) ** 2)
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
    wide = np.asarray(frame.convert("RGB").filter(ImageFilter.GaussianBlur(12 * scale)), dtype=np.float32)
    fine = np.asarray(frame.convert("RGB").filter(ImageFilter.GaussianBlur(1.5 * scale)), dtype=np.float32)
    rgb += (rgb - wide) * .18 * material[..., None] + (rgb - fine) * .15 * opaque[..., None]
    rgb[..., 0] += (8 if name == "drink" else 2) * material
    rgb[..., 1] += (5 if name == "drink" else 2) * material
    pixels[..., :3] = np.clip(rgb, 0, 255)
    return Image.fromarray(pixels.astype("uint8"), "RGBA")


def main() -> None:
    DEST.mkdir(exist_ok=True)
    for name in ("eye", "drink"):
        source = Image.open(SOURCE / f"{name}.webp")
        frames = []
        durations = []
        for index in range(source.n_frames):
            source.seek(index)
            original = source.convert("RGBA")
            frames.append(refine(original, name))
            durations.append(source.info["duration"])
        output = DEST / f"{name}.webp"
        frames[0].save(
            output,
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=source.info.get("loop", 0),
            quality=90,
            method=4,
        )
        print(f"{name}: {source.n_frames} frames, {sum(durations)} ms per loop, original canvas and loop count -> {output}")


if __name__ == "__main__":
    main()
