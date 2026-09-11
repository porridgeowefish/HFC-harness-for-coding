"""Build the distributable Marketplace snapshot with UTF-8 entry names."""

from __future__ import annotations

import os
import stat
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist" / "ai-market-0.8.0.zip"
INCLUDE_FILES = [ROOT / "README.md"]
INCLUDE_DIRS = [ROOT / ".codebuddy-plugin", ROOT / "plugins" / "coding-harness"]


def iter_entries() -> list[tuple[Path, str]]:
    entries: dict[str, Path] = {}
    for file_path in INCLUDE_FILES:
        entries[file_path.relative_to(ROOT).as_posix()] = file_path
    for directory in INCLUDE_DIRS:
        rel_dir = directory.relative_to(ROOT).as_posix().rstrip("/")
        entries[f"{rel_dir}/"] = directory
        for current, dirs, files in os.walk(directory):
            dirs.sort()
            files.sort()
            current_path = Path(current)
            current_rel = current_path.relative_to(ROOT).as_posix()
            for name in dirs:
                entries[f"{current_rel}/{name}/"] = current_path / name
            for name in files:
                file_path = current_path / name
                entries[file_path.relative_to(ROOT).as_posix()] = file_path
    return [(path, name) for name, path in sorted(entries.items())]


def write_zip() -> list[str]:
    entries = iter_entries()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source, name in entries:
            if source.is_dir():
                info = zipfile.ZipInfo(name)
                info.external_attr = (stat.S_IFDIR | 0o755) << 16
                archive.writestr(info, b"")
            else:
                archive.write(source, name)
    return [name for _, name in entries]


if __name__ == "__main__":
    names = write_zip()
    print(f"wrote={OUTPUT}")
    print(f"entries={len(names)}")
    print(f"non_ascii_entries={sum(any(ord(ch) > 127 for ch in name) for name in names)}")
