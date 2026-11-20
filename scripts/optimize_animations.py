"""Retiming and color/size normalization of the original Shenshi WebP frames.

The source files in src/assets/animations stay untouched. This script does not
generate poses: each output frame comes from the matching source frame.
Requires Pillow (python3 -m pip install pillow).
"""

from pathlib import Path
from PIL import Image, ImageEnhance

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


def main() -> None:
    DEST.mkdir(exist_ok=True)
    for name, (scale, speed, loops, saturation, brightness) in TUNING.items():
        source = SOURCE / f"{name}.webp"
        image = Image.open(source)
        frames = []
        durations = []
        for index in range(image.n_frames):
            image.seek(index)
            frames.append(normalize(image, scale, saturation, brightness).resize((720, 720), Image.Resampling.LANCZOS))
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
