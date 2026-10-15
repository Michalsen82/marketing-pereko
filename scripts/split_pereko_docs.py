# Triggered by source changes and workflow updates.
from __future__ import annotations

import io
import json
import re
import urllib.request
from pathlib import Path

from pypdf import PdfReader, PdfWriter

OUT = Path("docs/pereko-docs/pl")
OUT.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (compatible; PEREKO-docs-builder/1.0)"
BASE = "https://www.pereko.pl/downloads/"


def download(filename: str) -> bytes:
    url = BASE + filename
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    if not data.startswith(b"%PDF"):
        raise RuntimeError(f"Źródło nie jest PDF-em: {url}")
    return data


def write_pdf(data: bytes, ranges: list[tuple[int, int]], output_name: str, expected_pages: int | None = None) -> dict:
    reader = PdfReader(io.BytesIO(data))
    page_count = len(reader.pages)
    if expected_pages is not None and page_count != expected_pages:
        raise RuntimeError(f"{output_name}: źródło ma {page_count} stron, oczekiwano {expected_pages}")

    writer = PdfWriter()
    selected = []
    for start, end in ranges:
        if start < 0 or end >= page_count or start > end:
            raise RuntimeError(f"{output_name}: błędny zakres stron {start}-{end} przy {page_count} stronach")
        for i in range(start, end + 1):
            writer.add_page(reader.pages[i])
            selected.append(i)

    target = OUT / output_name
    with target.open("wb") as f:
        writer.write(f)
    return {"file": output_name, "pages": len(selected), "source_pages": page_count}


def copy_pdf(data: bytes, output_name: str) -> dict:
    reader = PdfReader(io.BytesIO(data))
    target = OUT / output_name
    target.write_bytes(data)
    return {"file": output_name, "pages": len(reader.pages), "source_pages": len(reader.pages)}


def detect_px100_start(data: bytes) -> int:
    reader = PdfReader(io.BytesIO(data))
    for i, page in enumerate(reader.pages):
        text = (page.extract_text() or "").upper()
        normalized = re.sub(r"\s+", " ", text)
        if "PX100" in normalized and "REGULATOR" in normalized and "INSTRUKCJA" in normalized:
            return i
    raise RuntimeError("Nie znaleziono początku instrukcji PX100 w PI")


manifest: dict[str, dict] = {}


def add_split(product: str, source_file: str, expected_pages: int, dtr_ranges, dtr_name, controller_ranges, controller_name):
    data = download(source_file)
    manifest[product] = {
        "source": BASE + source_file,
        "dtr": write_pdf(data, dtr_ranges, dtr_name, expected_pages),
        "controller": write_pdf(data, controller_ranges, controller_name, expected_pages),
    }


add_split(
    "QMPELL EVO",
    "qmpell-evo-dtr.pdf",
    76,
    [(0, 27)],
    "qmpell-evo-dtr-pl.pdf",
    [(28, 75)],
    "qmpell-evo-sterownik-ecomaxx-920p1-touch-pl.pdf",
)

add_split(
    "QMPELL DUO",
    "qmpell-duo-dtr.pdf",
    72,
    [(0, 23)],
    "qmpell-duo-dtr-pl.pdf",
    [(24, 71)],
    "qmpell-duo-sterownik-ecomaxx-920p1-touch-pl.pdf",
)

add_split(
    "COMFORT-PELL",
    "comfort-pell-dtr.pdf",
    88,
    [(0, 39)],
    "comfort-pell-dtr-pl.pdf",
    [(40, 87)],
    "comfort-pell-sterownik-ecomax860p3-c-touch-pl.pdf",
)

add_split(
    "SPARK EVO",
    "spark-evo-dtr.pdf",
    48,
    [(0, 18), (35, 47)],
    "spark-evo-dtr-pl.pdf",
    [(18, 34)],
    "spark-evo-instrukcja-sterowania-pl.pdf",
)

add_split(
    "PELL-STAR",
    "pell-star-dtr.pdf",
    96,
    [(0, 23), (76, 95)],
    "pell-star-dtr-pl.pdf",
    [(24, 75)],
    "pell-star-sterownik-st-976-pl.pdf",
)

add_split(
    "PELL-STAR PRO",
    "pell-star-pro-dtr.pdf",
    92,
    [(0, 23), (76, 91)],
    "pell-star-pro-dtr-pl.pdf",
    [(24, 75)],
    "pell-star-pro-sterownik-st-976-pl.pdf",
)

add_split(
    "KSM",
    "ksm-dtr.pdf",
    72,
    [(0, 23)],
    "ksm-dtr-pl.pdf",
    [(24, 71)],
    "ksm-sterownik-ecomax-910r1-pl.pdf",
)

pi_data = download("pi-dtr.pdf")
pi_reader = PdfReader(io.BytesIO(pi_data))
pi_start = detect_px100_start(pi_data)
manifest["PI"] = {
    "source": BASE + "pi-dtr.pdf",
    "detected_controller_start_page_1_based": pi_start + 1,
    "dtr": write_pdf(pi_data, [(0, pi_start - 1)], "pi-dtr-pl.pdf"),
    "controller": write_pdf(pi_data, [(pi_start, len(pi_reader.pages) - 1)], "pi-sterownik-px100-pl.pdf"),
}

add_split(
    "SONIC",
    "sonic-dtr.pdf",
    52,
    [(0, 11)],
    "sonic-dtr-pl.pdf",
    [(12, 51)],
    "sonic-sterownik-px100-pl.pdf",
)

for product, source_file, output_name in [
    ("RETRO DUO", "retro-duo-dtr.pdf", "retro-duo-dtr-pl.pdf"),
    ("RETRO", "retro-d-dtr.pdf", "retro-dtr-pl.pdf"),
    ("KARBO", "karbo-dtr.pdf", "karbo-dtr-pl.pdf"),
]:
    data = download(source_file)
    manifest[product] = {
        "source": BASE + source_file,
        "dtr": copy_pdf(data, output_name),
        "controller": None,
    }

termostar = {
    "6-18": ("termostar-pro-6-18-dtr.pdf", "termostar-pro-6-18-dtr-pl.pdf"),
    "19-28": ("termostar-pro-19-28-dtr.pdf", "termostar-pro-19-28-dtr-pl.pdf"),
    "38-48": ("termostar-pro-38-48-dtr.pdf", "termostar-pro-38-48-dtr-pl.pdf"),
}
manifest["TERMOSTAR PRO"] = {"dtr": {}, "controller": None}
for key, (source_file, output_name) in termostar.items():
    data = download(source_file)
    manifest["TERMOSTAR PRO"]["dtr"][key] = copy_pdf(data, output_name)
manifest["TERMOSTAR PRO"]["controller"] = copy_pdf(
    download("termostar-pro-sterownik-dtr.pdf"),
    "termostar-pro-sterownik-px300-pl.pdf",
)

(OUT / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

print(json.dumps(manifest, ensure_ascii=False, indent=2))
