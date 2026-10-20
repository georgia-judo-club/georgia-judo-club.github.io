#!/usr/bin/env python3
"""Re-encodes every photo under assets/source/ (gitignored) into public/photos/.

Output is <rel-dir>/<slug>-<sha256[:8]>.jpg with no EXIF/XMP/ICC; older versions of the
same slug are deleted, so a replaced photo always gets a new URL.
Usage: images.py [--self-test]
"""
import hashlib, io, re, sys, tempfile
from pathlib import Path
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()
R = Path(__file__).resolve().parents[1]
SRC, OUT = R / "assets/source", R / "public/photos"
PHOTO = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"}
EDGE, BUDGET = 2560, 2 * 1024 * 1024  # BUDGET mirrors LIMIT in check-assets.mjs


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "photo"


def encode(src):
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    im.thumbnail((EDGE, EDGE), Image.LANCZOS)
    # a fresh image carries no EXIF/XMP/ICC from the source
    clean = Image.new("RGB", im.size)
    clean.paste(im)
    for q in (82, 76, 70, 64):
        buf = io.BytesIO()
        clean.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        if buf.tell() <= BUDGET:
            return buf.getvalue()
    sys.exit(f"{src}: still over budget at quality 64")


def publish(src, src_root=SRC, out_root=OUT):
    data = encode(src)
    rel = src.relative_to(src_root)
    name = slug(rel.stem)
    folder = out_root.joinpath(*map(slug, rel.parent.parts))
    dest = folder / f"{name}-{hashlib.sha256(data).hexdigest()[:8]}.jpg"
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob(f"{name}-????????.jpg"):
        if old != dest and re.fullmatch(r"[0-9a-f]{8}", old.stem[-8:]):
            old.unlink()
    dest.write_bytes(data)
    return dest


def app_markers(b):
    """APPn/COM markers before the image data."""
    found, o = [], 2
    while o + 4 <= len(b) and b[o] == 0xFF and b[o + 1] not in (0xDA, 0xD9):
        if 0xE0 <= b[o + 1] <= 0xEF or b[o + 1] == 0xFE:
            found.append(b[o + 1])
        o += 2 + int.from_bytes(b[o + 2 : o + 4], "big")
    return found


def self_test():
    with tempfile.TemporaryDirectory() as t:
        src, out = Path(t, "src"), Path(t, "out")
        (src / "Club Day").mkdir(parents=True)
        exif = Image.Exif()
        exif[0x010F] = "Apple"
        exif[0x0112] = 6
        exif.get_ifd(0x8825).update({1: "N", 2: (41.0, 42.0, 0.0)})
        jpg = src / "Club Day/Mat Work.jpg"
        Image.new("RGB", (300, 200), (200, 30, 40)).save(jpg, exif=exif.tobytes())
        assert 0xE1 in app_markers(jpg.read_bytes()), "fixture has no EXIF"
        rot = Image.Exif()
        rot[0x0112] = 6
        heic = src / "throw.heic"
        Image.new("RGB", (300, 200), (20, 30, 120)).save(heic, exif=rot.tobytes())

        a = publish(jpg, src, out)
        assert a.parent == out / "club-day" and a.name.startswith("mat-work-"), a
        h = publish(heic, src, out)
        for p in (a, h):
            bad = [hex(m) for m in app_markers(p.read_bytes()) if m not in (0xE0, 0xEE)]
            assert not bad, f"{p.name} keeps {bad}"
            assert Image.open(p).size == (200, 300), f"{p.name} not rotated"

        im = Image.open(jpg)
        im.putpixel((0, 0), (0, 0, 0))
        im.save(jpg)
        b = publish(jpg, src, out)
        assert b != a and not a.exists() and b.exists(), (a, b)
    print("images.py self-test: OK")


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    else:
        for f in sorted(p for p in SRC.rglob("*") if p.suffix.lower() in PHOTO):
            print(f"{f.relative_to(R)} -> {publish(f).relative_to(R)}")
