from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "public/assets/fonts")

font_title    = ImageFont.truetype(os.path.join(FONTS, "CrimsonText-SemiBoldItalic.ttf"), 46)
font_desc     = ImageFont.truetype(os.path.join(FONTS, "CrimsonText-SemiBold.ttf"), 28)
font_deck     = ImageFont.truetype(os.path.join(FONTS, "CrimsonText-SemiBoldItalic.ttf"), 27)

# Colors from reference
WHITE    = (255, 255, 255, 255)
GOLD     = (210, 180, 100, 255)
MAGENTA  = (200, 100, 220, 255)  # Mage title
CREAM    = (230, 220, 200, 255)

def draw_centered(draw, text, y, font, color, width):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    x = (width - w) // 2
    draw.text((x, y), text, font=font, fill=color)

def process(src_path, dst_path, title, title_color, desc_lines, deck_lines):
    img = Image.open(src_path).convert("RGBA")
    draw = ImageDraw.Draw(img)
    W, H = img.size

    # Title (e.g. "Warrior") — topo do painel
    draw_centered(draw, title, 22, font_title, title_color, W)

    # Description lines — abaixo do título, acima das barras
    y = 78
    for line in desc_lines:
        draw_centered(draw, line, y, font_desc, CREAM, W)
        y += 32

    # Deck label — abaixo das barras, acima do ornamento inferior
    deck_y = H - 96
    for line in deck_lines:
        draw_centered(draw, line, deck_y, font_deck, GOLD, W)
        deck_y += 30

    img.save(dst_path)
    print(f"Saved: {dst_path}")

panels_dir = os.path.join(ROOT, "public/assets/ui/panels")

# Warrior
process(
    src_path=os.path.join(panels_dir, "warrior_status_panel.png"),
    dst_path=os.path.join(panels_dir, "warrior_status_panel_text.png"),
    title="Warrior",
    title_color=WHITE,
    desc_lines=["Balanced melee fighter.", "High HP and stamina."],
    deck_lines=["Deck: Strikes, Defends,", "Heavy Hit"],
)

# Mage
process(
    src_path=os.path.join(panels_dir, "mage_status_panel.png"),
    dst_path=os.path.join(panels_dir, "mage_status_panel_text.png"),
    title="Mage",
    title_color=MAGENTA,
    desc_lines=["Powerful spellcaster.", "High Mana, Low HP."],
    deck_lines=["Deck: Fireballs, Heals,", "Mana Drain"],
)
