# アプリアイコン（紺地に「契」）を docs/ に作る
from PIL import Image, ImageDraw, ImageFont
import sys
def make(size, path):
    img = Image.new('RGB', (size, size), (29, 78, 137))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', int(size*0.55))
    b = d.textbbox((0,0), '契', font=f)
    d.text(((size-(b[2]-b[0]))/2-b[0], (size-(b[3]-b[1]))/2-b[1]-size*0.03), '契', font=f, fill=(255,255,255))
    pad = int(size*0.08); d.rounded_rectangle([pad, size-int(size*0.2), size-pad, size-int(size*0.12)], radius=size//40, fill=(230,180,60))
    img.save(path, 'PNG', optimize=True)
make(512, 'docs/icon-512.png'); make(192, 'docs/icon-192.png'); make(180, 'docs/apple-touch-icon.png')
