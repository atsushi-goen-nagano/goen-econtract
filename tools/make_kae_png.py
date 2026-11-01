# 「控」の赤枠スタンプPNGを作り、Template.gs に埋め込む base64 を出力する
import base64, io, sys
from PIL import Image, ImageDraw, ImageFont
W, H = 180, 180
img = Image.new('RGBA', (W, H), (255, 255, 255, 0))
d = ImageDraw.Draw(img)
red = (204, 0, 0, 255)
d.rounded_rectangle([6, 6, W-7, H-7], radius=14, outline=red, width=10)
font = None
for p in ['/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', '/System/Library/Fonts/Hiragino Sans GB.ttc', '/System/Library/Fonts/ヒラギノ明朝 ProN.ttc']:
    try:
        font = ImageFont.truetype(p, 110); break
    except Exception: pass
if font is None: sys.exit('日本語フォントが見つかりません')
bbox = d.textbbox((0, 0), '控', font=font)
tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
d.text(((W-tw)/2-bbox[0], (H-th)/2-bbox[1]), '控', font=font, fill=red)
buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True)
open(sys.argv[1], 'wb').write(buf.getvalue())
print(base64.b64encode(buf.getvalue()).decode())
