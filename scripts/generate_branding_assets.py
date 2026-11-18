"""
TWS MotionForge AI — Visual Branding & Icon Generator
Brand: Tech With Salman
Generates official Windows application icon (.ico), master PNG,
and NSIS installer wizard bitmaps.
"""

import os
from PIL import Image, ImageDraw, ImageFont

BUILD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'build')
os.makedirs(BUILD_DIR, exist_ok=True)

def create_master_icon(size=512):
    # Premium dark background with rounded corners and glowing cyan/blue border
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = 24
    corner_radius = 90
    # Outer background rounded rect
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=corner_radius,
        fill=(12, 16, 23, 255),
        outline=(59, 130, 246, 255),
        width=14
    )

    # Inner subtle glow outline
    draw.rounded_rectangle(
        [margin + 16, margin + 16, size - margin - 16, size - margin - 16],
        radius=corner_radius - 12,
        fill=None,
        outline=(30, 58, 138, 160),
        width=4
    )

    # Stylized motion film & stickman graphics in center
    cx, cy = size // 2, size // 2 - 20

    # Stickman Head (Glowing white with blue halo)
    head_r = 38
    draw.ellipse([cx - head_r, cy - 130 - head_r, cx + head_r, cy - 130 + head_r], fill=(255, 255, 255, 255))

    # Stickman Body
    draw.line([cx, cy - 90, cx, cy + 30], fill=(255, 255, 255, 255), width=18)

    # Stickman Arms (Dynamic action gesture: left holding film slate/star, right pointing)
    draw.line([cx, cy - 60, cx - 75, cy - 100], fill=(255, 255, 255, 255), width=16)
    draw.line([cx - 75, cy - 100, cx - 110, cy - 50], fill=(96, 165, 250, 255), width=16)

    draw.line([cx, cy - 60, cx + 80, cy - 80], fill=(255, 255, 255, 255), width=16)
    draw.line([cx + 80, cy - 80, cx + 125, cy - 110], fill=(59, 130, 246, 255), width=16)

    # Stickman Legs (Walking/dynamic stance)
    draw.line([cx, cy + 30, cx - 65, cy + 120], fill=(255, 255, 255, 255), width=16)
    draw.line([cx, cy + 30, cx + 65, cy + 120], fill=(255, 255, 255, 255), width=16)

    # Golden dynamic play triangle accent in center-bottom
    triangle_pts = [
        (cx - 30, cy + 155),
        (cx + 45, cy + 185),
        (cx - 30, cy + 215)
    ]
    draw.polygon(triangle_pts, fill=(234, 179, 8, 255))

    # Text badge "TWS" at top, "MOTIONFORGE" at bottom
    # Draw simple clean geometric text blocks or accents
    draw.rectangle([cx - 90, cy + 180, cx - 45, cy + 190], fill=(59, 130, 246, 255))
    draw.rectangle([cx + 60, cy + 180, cx + 105, cy + 190], fill=(59, 130, 246, 255))

    return img

def main():
    print("Generating official application icons and NSIS branding assets...")
    master = create_master_icon(512)

    # 1. Master PNG
    master_png = os.path.join(BUILD_DIR, 'icon.png')
    master.save(master_png, format='PNG')
    print(f"Saved: {master_png}")

    # 2. Windows Multi-Size ICO
    ico_path = os.path.join(BUILD_DIR, 'icon.ico')
    icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    master.save(ico_path, format='ICO', sizes=icon_sizes)
    print(f"Saved: {ico_path}")

    # 3. Uninstaller ICO
    uninst_path = os.path.join(BUILD_DIR, 'uninstallerIcon.ico')
    master.save(uninst_path, format='ICO', sizes=icon_sizes)
    print(f"Saved: {uninst_path}")

    # 4. NSIS Header Bitmap (150 x 57)
    header_bmp = Image.new('RGB', (150, 57), (12, 16, 23))
    h_draw = ImageDraw.Draw(header_bmp)
    h_draw.rectangle([0, 0, 150, 57], fill=(12, 16, 23))
    # Small logo on right
    small_logo = master.resize((48, 48), Image.Resampling.LANCZOS)
    header_bmp.paste(small_logo, (95, 5), small_logo)
    header_bmp_path = os.path.join(BUILD_DIR, 'installerHeader.bmp')
    header_bmp.save(header_bmp_path, format='BMP')
    print(f"Saved: {header_bmp_path}")

    # 5. NSIS Sidebar Wizard Bitmap (164 x 314)
    sidebar_bmp = Image.new('RGB', (164, 314), (12, 16, 23))
    s_draw = ImageDraw.Draw(sidebar_bmp)
    s_draw.rectangle([0, 0, 164, 314], fill=(12, 16, 23))
    # Accent top-to-bottom bar
    s_draw.line([163, 0, 163, 314], fill=(59, 130, 246), width=2)
    # Centered logo
    side_logo = master.resize((120, 120), Image.Resampling.LANCZOS)
    sidebar_bmp.paste(side_logo, (22, 60), side_logo)
    # Tech With Salman brand badge
    s_draw.rectangle([20, 220, 144, 250], fill=(23, 37, 84))
    s_draw.rectangle([20, 220, 144, 250], outline=(59, 130, 246), width=1)
    sidebar_bmp_path = os.path.join(BUILD_DIR, 'installerSidebar.bmp')
    sidebar_bmp.save(sidebar_bmp_path, format='BMP')
    print(f"Saved: {sidebar_bmp_path}")

    print("All branding assets generated successfully!")

if __name__ == '__main__':
    main()
