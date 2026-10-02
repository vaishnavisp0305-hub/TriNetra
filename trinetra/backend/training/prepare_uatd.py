"""Convert UATD (BMP images + XML annotations) into YOLO format.

Usage:  python prepare_uatd.py <path-to-unzipped-UATD_Training> <output_dir>
Classes are discovered from the XML files themselves, so no names are hard-coded.
Assumes VOC-style <object><name/><bndbox><xmin/><ymin/><xmax/><ymax/></bndbox></object>;
if your XML differs, the script prints a sample so the parser can be adjusted.
"""
import random
import shutil
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2


def parse(xml_path):
    objs = []
    for o in ET.parse(xml_path).getroot().iter("object"):
        name = (o.findtext("name") or "").strip()
        bb = o.find("bndbox")
        if not name or bb is None:
            continue
        objs.append((name, *[float(bb.findtext(k)) for k in ("xmin", "ymin", "xmax", "ymax")]))
    return objs


def main(src, out, val_frac=0.1, seed=0):
    src, out = Path(src), Path(out)
    xmls = {p.stem: p for p in src.rglob("*.xml")}
    imgs = [p for p in sorted(src.rglob("*.bmp")) if p.stem in xmls]
    if not imgs:
        sys.exit("No matching .bmp/.xml pairs found. Check the path.")

    parsed = {p.stem: parse(xmls[p.stem]) for p in imgs}
    classes = sorted({o[0] for objs in parsed.values() for o in objs})
    if not classes:
        print(xmls[imgs[0].stem].read_text()[:1500])
        sys.exit("Could not read objects from the XML (sample above). Adjust parse().")
    cid = {c: i for i, c in enumerate(classes)}

    random.Random(seed).shuffle(imgs)
    n_val = max(1, int(len(imgs) * val_frac))
    for i, img in enumerate(imgs):
        split = "val" if i < n_val else "train"
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)
        h, w = cv2.imread(str(img), cv2.IMREAD_GRAYSCALE).shape
        shutil.copy(img, out / "images" / split / img.name)
        lines = []
        for name, x1, y1, x2, y2 in parsed[img.stem]:
            cx, cy = (x1 + x2) / 2 / w, (y1 + y2) / 2 / h
            lines.append(f"{cid[name]} {cx:.6f} {cy:.6f} {(x2 - x1) / w:.6f} {(y2 - y1) / h:.6f}")
        (out / "labels" / split / f"{img.stem}.txt").write_text("\n".join(lines))

    yaml = f"path: {out.resolve()}\ntrain: images/train\nval: images/val\nnames:\n"
    yaml += "".join(f"  {i}: {c}\n" for i, c in enumerate(classes))
    (out / "uatd.yaml").write_text(yaml)
    print(f"{len(imgs)} images, classes: {classes}\nWrote {out / 'uatd.yaml'}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
