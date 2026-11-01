# テスト用の署名画像（テスト 太郎）を作り base64 を出力。testSamplePdf が使う
import base64, io, sys
from PIL import Image, ImageDraw, ImageFont
W, H = 600, 200
img = Image.new('RGBA', (W, H), (255, 255, 255, 0))
d = ImageDraw.Draw(img)
font = ImageFont.truetype('/System/Library/Fonts/ヒラギノ明朝 ProN.ttc', 96)
d.text((40, 45), 'テスト 太郎', font=font, fill=(20, 20, 60, 255))
buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True)
print(base64.b64encode(buf.getvalue()).decode())
