"""Foto de perfil con fondo de cancha.

Uso (en un venv con: pip install "rembg[cpu]" pillow scipy):
    python tools/foto_cancha.py original.jpg fotos/nombre.jpg [x0 y0 x1 y1]

1. Recorta un cuadrado (por defecto centrado arriba, donde suele estar la cara).
2. Quita el fondo con rembg (modelo birefnet-portrait).
3. Lo compone sobre un estadio nocturno con cancha y lo guarda a 400x400.
"""
import sys, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from rembg import remove, new_session
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
N = 800
random.seed(7)

original = Image.open(src).convert('RGB')
if len(sys.argv) >= 7:
    box = tuple(int(v) for v in sys.argv[3:7])
else:
    lado = min(original.size)
    x0 = (original.width - lado) // 2
    y0 = max(0, int(original.height * 0.12)) if original.height > original.width else 0
    y0 = min(y0, original.height - lado)
    box = (x0, y0, x0 + lado, y0 + lado)
recorte = remove(original.crop(box), session=new_session('birefnet-portrait'))

# ---------- Fondo ----------
bg = Image.new('RGB', (N, N))
px = np.zeros((N, N, 3), dtype=np.float32)
# Cielo nocturno
for y in range(N):
    t = min(y / 330, 1)
    px[y, :] = (1 - t) * np.array([8, 18, 38]) + t * np.array([24, 52, 82])
# Tribuna
y0, y1 = 250, 400
px[y0:y1, :] = np.array([28, 32, 40])
crowd = Image.fromarray(px.astype(np.uint8))
d = ImageDraw.Draw(crowd)
colores = [(230, 230, 230), (60, 120, 220), (245, 197, 66), (200, 60, 60), (40, 40, 50), (180, 180, 190)]
for _ in range(2600):
    x, y = random.randint(0, N), random.randint(y0 + 6, y1 - 4)
    r = random.randint(2, 4)
    d.ellipse((x - r, y - r, x + r, y + r), fill=random.choice(colores))
# Baranda / cartelería
d.rectangle((0, y1 - 22, N, y1), fill=(14, 60, 30))
for i in range(0, N, 120):
    d.rectangle((i + 8, y1 - 18, i + 104, y1 - 5), fill=(245, 197, 66) if (i // 120) % 2 else (240, 240, 240))
px = np.asarray(crowd).astype(np.float32)

# Césped con franjas en perspectiva
horizonte = y1
franjas = []
y, h = horizonte, 18.0
while y < N:
    franjas.append((int(y), int(y + h)))
    y += h
    h *= 1.28
for i, (a, b) in enumerate(franjas):
    px[a:min(b, N), :] = np.array([34, 135, 63]) if i % 2 == 0 else np.array([28, 115, 54])
img = Image.fromarray(px.clip(0, 255).astype(np.uint8))
d = ImageDraw.Draw(img)
# Líneas de cal: borde del área y círculo central en perspectiva
d.line((0, horizonte + 40, N, horizonte + 40), fill=(240, 245, 240), width=4)
d.ellipse((N * 0.12, 560, N * 0.88, 860), outline=(240, 245, 240), width=6)
d.line((N / 2, horizonte + 40, N / 2, N), fill=(240, 245, 240), width=5)

# Reflectores
luces = Image.new('RGB', (N, N), (0, 0, 0))
dl = ImageDraw.Draw(luces)
for cx, cy in [(90, 70), (710, 70), (260, 30), (540, 30)]:
    dl.ellipse((cx - 26, cy - 26, cx + 26, cy + 26), fill=(255, 250, 225))
glow = luces.filter(ImageFilter.GaussianBlur(45))
nuc = luces.filter(ImageFilter.GaussianBlur(6))
arr = np.asarray(img).astype(np.float32) + np.asarray(glow).astype(np.float32) * 1.6 + np.asarray(nuc).astype(np.float32)
img = Image.fromarray(arr.clip(0, 255).astype(np.uint8))

# Profundidad de campo: el fondo desenfocado hace resaltar al jugador
img = img.filter(ImageFilter.GaussianBlur(4))

# Viñeta
yy, xx = np.mgrid[0:N, 0:N]
dist = np.sqrt(((xx - N / 2) / (N / 2)) ** 2 + ((yy - N / 2) / (N / 2)) ** 2)
vin = np.clip(1 - 0.35 * (dist - 0.6), 0.55, 1)[..., None]
img = Image.fromarray((np.asarray(img).astype(np.float32) * vin).clip(0, 255).astype(np.uint8))

# ---------- Jugador ----------
fg = recorte.convert('RGBA').resize((N, N), Image.LANCZOS)
a = np.asarray(fg)[..., 3]
# Quedarse con la silueta principal: elimina manchas sueltas del recorte
lab, n = ndimage.label(a > 40)
if n > 1:
    tam = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
    keep = 1 + int(np.argmax(tam))
    mask = ndimage.binary_dilation(lab == keep, iterations=3)
    a = np.where(mask, a, 0).astype(np.uint8)
fg.putalpha(Image.fromarray(a))

# Sombra suave detrás para despegarlo del fondo
sombra = Image.new('RGBA', (N, N), (0, 0, 0, 0))
sombra.putalpha(Image.fromarray((a * 0.55).astype(np.uint8)).filter(ImageFilter.GaussianBlur(18)))
base = img.convert('RGBA')
base.alpha_composite(sombra, (0, 10))
base.alpha_composite(fg)
final = base.convert('RGB').resize((400, 400), Image.LANCZOS)
final.save(out, quality=88, optimize=True, progressive=True)
print('ok', out, n, 'componentes')
