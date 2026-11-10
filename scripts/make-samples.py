"""Buat foto contoh untuk Polesin: public/sample.jpg (640x480) untuk tombol
"Coba foto contoh" dan scripts/sample-test.jpg (320x240) untuk tes e2e.
Foto dibuat dari gradien + bentuk + teks supaya hasil upscale bisa dinilai
secara visual dan dimensinya bisa diverifikasi."""
from PIL import Image, ImageDraw, ImageFont
import random

random.seed(7)

def make(path, w, h):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            r = int(40 + 180 * x / w)
            g = int(60 + 120 * y / h)
            b = int(120 + 100 * (1 - x / w))
            px[x, y] = (r, g, b)
    d = ImageDraw.Draw(img)
    # bangunan / bentuk tegas supaya ketajaman terlihat
    d.rectangle([40, h // 3, w - 40, h - 40], fill=(30, 30, 40), outline=(255, 220, 90), width=4)
    d.ellipse([w // 4, 30, w // 2, h // 3], fill=(255, 200, 60))
    d.rectangle([60, h // 2, w // 2, h - 60], fill=(200, 60, 60))
    d.line([(0, h - 1), (w, 0)], fill=(255, 255, 255), width=3)
    # noise supaya ada tekstur
    for _ in range(w * h // 25):
        x, y = random.randrange(w), random.randrange(h)
        v = random.randrange(256)
        px[x, y] = (v, v, v)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", max(20, w // 16))
    except OSError:
        font = ImageFont.load_default()
    d.text((w // 8, h // 8), "POLESIN", fill=(255, 255, 255), font=font)
    img.save(path, "JPEG", quality=88)
    print(f"{path}: {w}x{h}")

if __name__ == "__main__":
    make("public/sample.jpg", 640, 480)
    make("scripts/sample-test.jpg", 320, 240)
