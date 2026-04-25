from PIL import Image
import os

ASSETS = "/Users/munshi/.cursor/projects/Users-munshi-Downloads-Run/assets"
OUT = "/Users/munshi/Downloads/Run/screenshots/ipad-13"

# iPad Pro 12.9" (6th gen) — 2048 x 2732
IPAD_W, IPAD_H = 2048, 2732
BG_COLOR = (250, 247, 242)

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

    canvas = Image.new("RGB", (IPAD_W, IPAD_H), BG_COLOR)

    scale = min((IPAD_W * 0.55) / img.width, (IPAD_H * 0.85) / img.height)
    new_w = int(img.width * scale)
    new_h = int(img.height * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    x = (IPAD_W - new_w) // 2
    y = (IPAD_H - new_h) // 2

    canvas.paste(resized, (x, y), resized if resized.mode == "RGBA" else None)

    out_path = os.path.join(OUT, f"{out_name}.png")
    canvas.save(out_path, "PNG", quality=95)
    print(f"  {IPAD_W}x{IPAD_H} -> {out_path}")

print("\nDone! iPad 13\" screenshots prepared.")
