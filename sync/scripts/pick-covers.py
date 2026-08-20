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
MAX_TRY = 8            # скільки фото авто максимум аналізуємо
HERO_GALLERY = 10      # для hero/featured дивимось глибше, щоб зібрати чисту галерею
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


def sig_of(sources):
    return hashlib.sha1(";".join(sources).encode()).hexdigest()[:16]


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


def is_banner(raw, source):
    if source.split("/")[-1] in SHARED:
        return True
    try:
        im = Image.open(BytesIO(raw)).convert("RGB").resize((160, 110), Image.LANCZOS)
    except Exception:
        return False  # не змогли прочитати — не відкидаємо
    a = np.asarray(im).astype(float)
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

    limit = min(len(sources), max(MAX_TRY, HERO_GALLERY))
    banner = {}  # index -> bool, лише для проаналізованих
    for i in range(limit):
        raw = fetch(sources[i])
        banner[i] = is_banner(raw, sources[i]) if raw is not None else False
        # рання зупинка: для обкладинки досить знайти перше чисте у перших MAX_TRY
        if i + 1 >= MAX_TRY and any(not banner[j] for j in banner):
            break

    clean = [i for i in banner if not banner[i]]
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
