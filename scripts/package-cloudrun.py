from __future__ import annotations

from datetime import datetime
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
OUT = ROOT / "backups" / f"contract-guardian-cloudrun-minimal-posix-{STAMP}.zip"

ROOT_FILES = [
    "Dockerfile",
    ".dockerignore",
    "package.json",
    "package-lock.json",
]

SERVER_SUFFIXES = {".mjs"}
SRC_DATA_SUFFIXES = {".js"}


def add_file(zip_file: ZipFile, path: Path) -> None:
    zip_file.write(path, path.relative_to(ROOT).as_posix())


OUT.parent.mkdir(exist_ok=True)
with ZipFile(OUT, "w", ZIP_DEFLATED) as zip_file:
    for name in ROOT_FILES:
        add_file(zip_file, ROOT / name)

    for path in sorted((ROOT / "server").rglob("*")):
        if path.is_file() and path.suffix in SERVER_SUFFIXES:
            add_file(zip_file, path)

    for path in sorted((ROOT / "src" / "data").rglob("*")):
        if path.is_file() and path.suffix in SRC_DATA_SUFFIXES:
            add_file(zip_file, path)

print(OUT)
