from PIL import Image, ImageDraw, ImageFont
import os

ASSETS = "/Users/munshi/.cursor/projects/Users-munshi-Downloads-Run/assets"
OUT_67 = "/Users/munshi/Downloads/Run/screenshots/6.7"
OUT_65 = "/Users/munshi/Downloads/Run/screenshots/6.5"

SIZES = {
    "6.7": (1290, 2796),
    "6.5": (1242, 2688),
}

BG_COLOR = (250, 247, 242)  # matches app background #FAF7F2

screenshots = [
    ("Screenshot_2026-03-28_at_17.48.07-9ef8b4ab-ed5e-4718-b9b4-73554a14e223.png", "01_home"),
    ("Screenshot_2026-03-28_at_17.49.35-c10b99a5-7bf6-40b6-9344-40f451105730.png", "02_milestones"),
    ("Screenshot_2026-03-28_at_17.51.04-437fec8d-d296-4ead-890a-ace769604363.png", "03_stats"),
    ("Screenshot_2026-03-28_at_17.48.52-ad49542a-0a9d-4fb6-bfbe-e40b89bc83d6.png", "04_goals_pbs"),
    ("Screenshot_2026-03-28_at_17.51.58-65bc87ad-6bbe-478f-b285-6fd0c5007e3c.png", "05_profile"),
    ("Screenshot_2026-03-28_at_17.50.18-49a0cedf-dd49-4445-97d9-182cc51fd3be.png", "06_scenic_runs"),
]

for src_name, out_name in screenshots:
    src_path = os.path.join(ASSETS, src_name)
    img = Image.open(src_path).convert("RGBA")

    for label, (tw, th) in SIZES.items():
        canvas = Image.new("RGB", (tw, th), BG_COLOR)

        scale = min((tw * 0.85) / img.width, (th * 0.85) / img.height)
        new_w = int(img.width * scale)
        new_h = int(img.height * scale)
        resized = img.resize((new_w, new_h), Image.LANCZOS)

        x = (tw - new_w) // 2
        y = (th - new_h) // 2

        canvas.paste(resized, (x, y), resized if resized.mode == "RGBA" else None)

        out_dir = OUT_67 if label == "6.7" else OUT_65
        out_path = os.path.join(out_dir, f"{out_name}.png")
        canvas.save(out_path, "PNG", quality=95)
        print(f"  {label}: {tw}x{th} -> {out_path}")

print("\nDone! All screenshots prepared.")
