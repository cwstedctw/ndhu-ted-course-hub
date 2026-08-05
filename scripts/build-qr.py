# -*- coding: utf-8 -*-
"""產生站上要用的 QR 圖（public/images/qr/）。

兩種用途：
  course-<slug>.png  課程頁：投影或列印時讓現場的人掃
  talk-<id>.png      單場頁：手機接力（電腦看到一半用手機接著看）

QR 一律「程式產生 + 反向解碼驗證」，不是畫的圖；解不回原網址就中止，
不會留下掃不動的假 QR。

用法：python scripts/build-qr.py [--site https://...]
相依：pip install qrcode pillow pyzbar
"""
import argparse, json, pathlib, sys

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image
from pyzbar.pyzbar import decode

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'images' / 'qr'
NAVY = (22, 48, 91)
DEFAULT_SITE = 'https://cwstedctw.github.io/ndhu-ted-course-hub'


def make(url, path, target_px=480, border=3):
    """QR 尺寸取模組數的整數倍，避免縮放導致模組寬窄不一（列印會糊）。"""
    probe = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=1, border=border)
    probe.add_data(url)
    probe.make(fit=True)
    modules = probe.modules_count + border * 2
    box = max(1, round(target_px / modules))

    q = qrcode.QRCode(version=probe.version, error_correction=ERROR_CORRECT_H,
                      box_size=box, border=border)
    q.add_data(url)
    q.make(fit=True)
    img = q.make_image(fill_color=NAVY, back_color='white').convert('RGB')
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)

    back = [r.data.decode('utf-8') for r in decode(Image.open(path))]
    if url not in back:
        print('❌ %s 解碼失敗，實得 %r' % (path.name, back), file=sys.stderr)
        sys.exit(1)
    return img.size[0], probe.version


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--site', default=DEFAULT_SITE)
    args = ap.parse_args()
    site = args.site.rstrip('/')

    made = 0
    for cj in sorted((ROOT / 'content' / 'courses').glob('*/course.json')):
        slug_dir = cj.parent.name
        data = json.loads(cj.read_text(encoding='utf-8'))
        for sec in data.get('sections') or [{}]:
            hub = (sec.get('hubUrl') or '').rstrip('/')
            slug = hub.rsplit('/', 1)[-1] if hub else slug_dir
            url = '%s/courses/%s/' % (site, slug)
            px, ver = make(url, OUT / ('course-%s.png' % slug))
            print('  course-%-22s v%-2d %3dpx  %s' % (slug + '.png', ver, px, url))
            made += 1

        tj = cj.parent / 'talks.json'
        if tj.exists():
            for t in json.loads(tj.read_text(encoding='utf-8'))['talks']:
                url = '%s/courses/%s/talks/%s/' % (site, slug_dir, t['id'])
                px, ver = make(url, OUT / ('talk-%s.png' % t['id']), target_px=300)
                print('  talk-%-24s v%-2d %3dpx  %s' % (t['id'] + '.png', ver, px, url))
                made += 1

    print('\n共 %d 張，全部通過反向解碼驗證 → %s' % (made, OUT.relative_to(ROOT)))


if __name__ == '__main__':
    main()
