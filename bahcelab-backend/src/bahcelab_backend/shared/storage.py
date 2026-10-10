"""Dosya depolama arayüzü. Yerelde diske yazar; S3/R2 için aynı arayüzü uygulayan sınıf yazılır."""

import shutil
from pathlib import Path
from typing import Protocol

from bahcelab_backend.config import get_settings


class StorageBackend(Protocol):
    def save(self, key: str, data: bytes) -> None: ...

    def read(self, key: str) -> bytes: ...

    def exists(self, key: str) -> bool: ...

    def delete(self, key: str) -> None: ...

    def delete_prefix(self, prefix: str) -> None: ...


class LocalStorage:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents and path != self.root:
            raise ValueError(f"Geçersiz depolama anahtarı: {key}")
        return path

    def save(self, key: str, data: bytes) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_bytes(data)
        tmp.replace(path)  # yarım dosya okunmasın

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def delete_prefix(self, prefix: str) -> None:
        shutil.rmtree(self._path(prefix), ignore_errors=True)


def get_storage() -> StorageBackend:
    root = Path(get_settings().storage_dir)
    if not root.is_absolute():
        # Göreli yol backend klasörüne göre çözülür (çalışma dizininden bağımsız)
        root = Path(__file__).resolve().parents[3] / root
    return LocalStorage(root)
