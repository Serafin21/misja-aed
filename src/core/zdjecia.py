"""Photo metadata removal on the server (MODEL_ROL K14): the browser already re-encodes photos, but the API must not
rely on it. Removes EXIF (incl. GPS position), XMP, IPTC and comments without re-encoding the image:
- JPEG: APP1–APP15 and COM segments (APP0/JFIF kept);
- PNG: tEXt, zTXt, iTXt, eXIf, tIME chunks;
- WebP: EXIF and XMP chunks (VP8X flags and RIFF size updated).
"""
from __future__ import annotations

import base64
import struct
import zlib


def _jpeg(b: bytes) -> bytes:
    if not b.startswith(b"\xff\xd8"):
        raise ValueError("To nie jest plik JPEG.")
    out, i = bytearray(b"\xff\xd8"), 2
    while i < len(b):
        if b[i] != 0xFF:
            raise ValueError("Uszkodzony plik JPEG.")
        marker = b[i + 1]
        if marker == 0xD9:  # EOI
            out += b[i:i + 2]
            break
        if marker == 0xDA:  # start of scan: the rest is image data
            out += b[i:]
            break
        if 0xD0 <= marker <= 0xD7 or marker == 0x01:
            out += b[i:i + 2]
            i += 2
            continue
        (length,) = struct.unpack(">H", b[i + 2:i + 4])
        seg = b[i:i + 2 + length]
        if not (0xE1 <= marker <= 0xEF or marker == 0xFE):
            out += seg
        i += 2 + length
    return bytes(out)


_PNG_DROP = {b"tEXt", b"zTXt", b"iTXt", b"eXIf", b"tIME"}


def _png(b: bytes) -> bytes:
    sig = b"\x89PNG\r\n\x1a\n"
    if not b.startswith(sig):
        raise ValueError("To nie jest plik PNG.")
    out, i = bytearray(sig), 8
    while i < len(b):
        (length,) = struct.unpack(">I", b[i:i + 4])
        typ = b[i + 4:i + 8]
        chunk = b[i:i + 12 + length]
        if typ not in _PNG_DROP:
            out += chunk
        i += 12 + length
        if typ == b"IEND":
            break
    return bytes(out)


def _webp(b: bytes) -> bytes:
    if not (b.startswith(b"RIFF") and b[8:12] == b"WEBP"):
        raise ValueError("To nie jest plik WebP.")
    chunks, i = [], 12
    while i + 8 <= len(b):
        typ = b[i:i + 4]
        (size,) = struct.unpack("<I", b[i + 4:i + 8])
        data = b[i + 8:i + 8 + size]
        i += 8 + size + (size & 1)
        if typ in (b"EXIF", b"XMP "):
            continue
        if typ == b"VP8X" and data:
            data = bytes([data[0] & ~0x0C]) + data[1:]  # clear EXIF (0x08) and XMP (0x04) flags
        chunks.append(typ + struct.pack("<I", len(data)) + data + (b"\x00" if len(data) & 1 else b""))
    body = b"WEBP" + b"".join(chunks)
    return b"RIFF" + struct.pack("<I", len(body)) + body


def bez_metadanych(mime: str, raw: bytes) -> bytes:
    return {"image/jpeg": _jpeg, "image/png": _png, "image/webp": _webp}[mime](raw)


def data_uri(mime: str, raw: bytes) -> str:
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


def _crc(typ: bytes, data: bytes) -> bytes:  # helper for tests building PNG files
    return struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
