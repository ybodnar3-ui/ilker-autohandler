#!/usr/bin/env python3
"""
Вибір чистої обкладинки: willhaben віддає фото машини й рекламні вставки дилера
(MEGA PREIS, Finanzierungsbeispiel) упереміш, і в JSON вони не позначені. Тут
візуальний детектор банерів обирає перше «чисте» фото як обкладинку.

Вхід:  DATA_DIR/catalog.json (сток) + DATA_DIR/covers.json (кеш, необовʼязково)
Вихід: DATA_DIR/covers.json = { carId: {sig, cover, gallery} }
        cover   — індекс чистого фото для обкладинки,
        gallery — індекси фото без банерів (обкладинка першою).

Кеш за підписом списку фото (sig): аналізуємо лише авто, чиї фото змінились —
щоб не качати весь сток кожні 30 хв.
"""
import hashlib
import json
import os
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

import numpy as np
from PIL import Image

DATA_DIR = os.environ.get("DATA_DIR", "web/data")
BASE = "https://cache.willhaben.at/mmo/"
UA = {"User-Agent": os.environ.get("USER_AGENT", "HayatGruppeSync/1.0 (+https://hayatgruppe.com)")}
MAX_TRY = 8            # мінімальне вікно, яке переглядаємо завжди
HERO_GALLERY = 10      # скільки чистих фото хочемо набрати для галереї
DEEP_SCAN = 30         # межа пошуку, якщо початок списку — суцільна реклама
THREADS = 24

catalog = json.load(open(os.path.join(DATA_DIR, "catalog.json"), encoding="utf-8"))
cars = catalog["cars"]

cache_path = os.path.join(DATA_DIR, "covers.json")
cache = {}
if os.path.exists(cache_path):
    try:
        cache = json.load(open(cache_path, encoding="utf-8"))
    except Exception:
        cache = {}

# Спільні шаблони: якщо той самий файл трапляється у ≥3 авто — це рекламна
# вставка з шаблону, а не фото машини.
counter = Counter()
for car in cars:
    for img in car["images"][:MAX_TRY]:
        counter[img["source"].split("/")[-1]] += 1
SHARED = {name for name, n in counter.items() if n >= 3}


# Версія логіки детектора: зміна ⇒ кеш недійсний і сток переаналізується.
DETECTOR_VERSION = "4-frame"


def sig_of(sources):
    payload = DETECTOR_VERSION + "|" + ";".join(sources)
    return hashlib.sha1(payload.encode()).hexdigest()[:16]


def hoved(source):
    """Легкий 400px-варіант для аналізу; є не завжди — з фолбеком на повний."""
    if "." in source:
        stem, ext = source.rsplit(".", 1)
        return stem + "_hoved." + ext
    return source


def fetch(source):
    for path in (hoved(source), source):  # спершу легкий, потім повний
        try:
            req = urllib.request.Request(BASE + path, headers=UA)
            return urllib.request.urlopen(req, timeout=25).read()
        except Exception:
            continue
    return None


def panel_ratio(a):
    """
    Частка суцільної заливки у правій частині кадру.

    Рекламний макет дилера — це фото ліворуч + суцільна панель «Finanzierungs-
    beispiel» праворуч. Панель дає домінантний колір на пів-смуги, тоді як у
    справжньому фото праворуч звичайний фон (небо, асфальт, дерева).

    Ознака структурна, не колірна, тож ловить панель будь-якого кольору —
    і темно-червону, і чорну (Taycan), яку колірні евристики пропускали.
    Беремо мінімум по двох ширинах: справжня панель тримається на обох,
    випадкова рівна стіна — зазвичай ні.
    """
    w = a.shape[1]
    out = []
    for frac in (0.72, 0.62):
        strip = a[:, int(w * frac):].astype(int) // 20  # квантуємо до ~20 рівнів
        key = strip[:, :, 0] * 10000 + strip[:, :, 1] * 100 + strip[:, :, 2]
        _, counts = np.unique(key, return_counts=True)
        out.append(counts.max() / key.size)
    return min(out)


def frame_ratio(a):
    """
    Частка пікселів по периметру, що збігаються з одним кольором.

    Рекламний макет обведений суцільною рамкою (темно-червоною або чорною).
    У фото периметр — це небо, асфальт і дерева, тож однорідним не буває.
    Рахуємо до зменшення кадру: тонка рамка після ресайзу розмивається.
    """
    h, w, _ = a.shape
    t = max(2, int(min(h, w) * 0.012))
    edges = np.concatenate([
        a[:t].reshape(-1, 3), a[-t:].reshape(-1, 3),
        a[:, :t].reshape(-1, 3), a[:, -t:].reshape(-1, 3),
    ]).astype(int)
    return (np.abs(edges - np.median(edges, axis=0)).max(axis=1) < 20).mean()


def is_banner(raw, source):
    if source.split("/")[-1] in SHARED:
        return True
    try:
        full = Image.open(BytesIO(raw)).convert("RGB")
        im = full.resize((160, 110), Image.LANCZOS)
    except Exception:
        return False  # не змогли прочитати — не відкидаємо
    # Дві незалежні структурні ознаки; виміряні на живому стоку пороги лежать
    # посередині розриву між банерами й фото, тож жодна не тримається впритул:
    #   рамка  — банер ≥0.60, фото ≤0.41
    #   панель — банер ≥0.39, фото ≤0.30 (ловить чорну панель Taycan, яку
    #            рамка пропускає)
    if frame_ratio(np.asarray(full)) > 0.50:
        return True
    a = np.asarray(im).astype(float)
    if panel_ratio(a) > 0.35:
        return True
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    reddish = ((R > G + 25) & (R > B + 25) & (R > 55)).mean()  # червоні цінники/штампи
    white = ((R > 226) & (G > 226) & (B > 226)).mean()          # білі фінанс-таблиці
    return reddish > 0.035 or white > 0.05


def analyze(car):
    sources = [img["source"] for img in car["images"]]
    sig = sig_of(sources)
    cached = cache.get(car["id"])
    if cached and cached.get("sig") == sig:
        return car["id"], cached  # фото не змінились — беремо з кешу

    # Деякі авто мають суцільну рекламу на початку списку (у Ford Thunderbird —
    # перші десять фото). Тому не зупиняємось на фіксованому вікні, а шукаємо
    # вглиб, поки не набереться достатньо чистих фото або не вичерпаємо ліміт.
    limit = min(len(sources), DEEP_SCAN)
    banner = {}  # index -> bool, лише для проаналізованих
    clean = []
    for i in range(limit):
        raw = fetch(sources[i])
        banner[i] = is_banner(raw, sources[i]) if raw is not None else False
        if not banner[i]:
            clean.append(i)
        # досить: є обкладинка й галерея, і мінімальне вікно вже переглянуте
        if len(clean) >= HERO_GALLERY and i + 1 >= MAX_TRY:
            break
    cover = clean[0] if clean else 0
    # галерея: чисті проаналізовані (обкладинка першою) + непроаналізований хвіст
    analyzed = set(banner)
    tail = [i for i in range(len(sources)) if i not in analyzed]
    gallery = [cover] + [i for i in clean if i != cover] + tail
    result = {"sig": sig, "cover": cover, "gallery": gallery}
    return car["id"], result


with ThreadPoolExecutor(max_workers=THREADS) as ex:
    results = dict(ex.map(analyze, cars))

json.dump(results, open(cache_path, "w", encoding="utf-8"), ensure_ascii=False)

moved = sum(1 for r in results.values() if r["cover"] != 0)
print(f"covers.json: {len(results)} авто | обкладинку зсунуто з банера: {moved} | shared-шаблонів: {len(SHARED)}")
