#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
เปลี่ยนสีไลต์บาร์ (แถบไฟ) ในรูปตัวอย่างปุ่มหลัง จาก "ฟ้า" เป็น "ขาว"

ใช้ตอนไหน
  รูป *-paddles.png เป็นภาพถ่ายจอย DS4 ด้านหลัง ซึ่งแถบไฟเดิมเป็นสีฟ้า
  ถ้าอยากเปลี่ยนเป็นสีอื่นให้แก้ค่าในส่วน CONFIG แล้วรันไฟล์นี้

วิธีรัน
  python3 tools/png-recolor-lightbar.py

ทำงานยังไง (สรุปสั้นๆ)
  1. หาพิกเซลที่ "ฟ้าเด่น" (ค่า B สูงกว่า R และ G ชัดเจน) เพื่อกำหนดกรอบไลต์บาร์
  2. ในกรอบนั้น เปลี่ยนเฉพาะพิกเซลฟ้า โดย "คงน้ำหนักแสงเงาเดิมไว้"
     ไม่ได้ถมสีขาวทับทื่อๆ ไม่งั้นจะแบนดูเป็นสติกเกอร์
  3. ขอบไลต์บาร์ที่ไล่เบลอกับพลาสติกดำ จะค่อยๆ ผสม (feather) กันรอยหยัก

ไม่ใช้ไลบรารีนอก (เครื่องนี้ไม่มี PIL/numpy) เขียน PNG เองทั้งอ่านและเขียน
"""

import os
import sys
import zlib
import struct

# ---------------- CONFIG ----------------
FILES = ['standard-paddles.png', 'low-paddles.png', 'high-paddles.png']

# ช่วงความสว่างของสีใหม่ (0-255) มืดสุด -> สว่างสุด
# 205..255 = ขาวนวล ยังเห็นแสงเงาอยู่บ้าง ไม่แบน
OUT_MIN, OUT_MAX = 205, 255

# เกณฑ์ว่า "ฟ้าแค่ไหนถึงนับว่าเป็นไลต์บาร์"
BLUE_MIN_B    = 110   # ค่าน้ำเงินขั้นต่ำ
BLUE_OVER_R   = 40    # ต้องมากกว่าแดงเท่าไร
BLUE_OVER_G   = 25    # ต้องมากกว่าเขียวเท่าไร
FEATHER       = 55.0  # ยิ่งมาก ขอบยิ่งนุ่ม
PAD           = 6     # ขยายกรอบออกกันขอบขาด
# ----------------------------------------


def read_png(path):
    """อ่าน PNG แบบ 8-bit RGB/RGBA คืน (w, h, nchan, [แถวพิกเซล])"""
    d = open(path, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(path + ' ไม่ใช่ไฟล์ PNG')
    pos, idat = 8, b''
    w = h = bd = ct = 0
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos + 4])[0]
        typ = d[pos + 4:pos + 8]
        if typ == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', d[pos + 8:pos + 18])
        elif typ == b'IDAT':
            idat += d[pos + 8:pos + 8 + ln]
        elif typ == b'IEND':
            break
        pos += 12 + ln
    if bd != 8 or ct not in (2, 6):
        raise ValueError('รองรับเฉพาะ 8-bit RGB/RGBA (ไฟล์นี้ bitdepth=%d colortype=%d)' % (bd, ct))
    nc = 3 if ct == 2 else 4
    raw = zlib.decompress(idat)
    stride = w * nc
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        if f == 1:
            for x in range(nc, stride):
                line[x] = (line[x] + line[x - nc]) & 255
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x - nc] if x >= nc else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - nc] if x >= nc else 0
                b = prev[x]
                c = prev[x - nc] if x >= nc else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        rows.append(bytearray(line))
        prev = line
    return w, h, nc, rows


def write_png(path, w, h, nc, rows):
    """เขียน PNG กลับ เลือก filter ต่อแถวแบบ adaptive ให้ไฟล์ไม่บวม"""
    ct = 2 if nc == 3 else 6
    stride = w * nc
    out = bytearray()
    prev = bytearray(stride)
    for row in rows:
        cands = []
        # 0 None
        cands.append((0, bytes(row)))
        # 1 Sub
        s = bytearray(stride)
        for x in range(stride):
            s[x] = (row[x] - (row[x - nc] if x >= nc else 0)) & 255
        cands.append((1, bytes(s)))
        # 2 Up
        u = bytearray(stride)
        for x in range(stride):
            u[x] = (row[x] - prev[x]) & 255
        cands.append((2, bytes(u)))
        # 4 Paeth
        pth = bytearray(stride)
        for x in range(stride):
            a = row[x - nc] if x >= nc else 0
            b = prev[x]
            c = prev[x - nc] if x >= nc else 0
            p = a + b - c
            pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
            pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
            pth[x] = (row[x] - pr) & 255
        cands.append((4, bytes(pth)))
        ftype, data = min(cands, key=lambda t: sum(v if v < 128 else 256 - v for v in t[1]))
        out.append(ftype)
        out += data
        prev = row

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, ct, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(out), 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def is_blue(r, g, b):
    return b > BLUE_MIN_B and (b - r) > BLUE_OVER_R and (b - g) > BLUE_OVER_G


def recolor(path):
    w, h, nc, rows = read_png(path)

    # 1) หากรอบไลต์บาร์
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        r = rows[y]
        for x in range(w):
            o = x * nc
            if is_blue(r[o], r[o + 1], r[o + 2]):
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx < 0:
        print('  %-24s ไม่พบสีฟ้า (อาจแก้ไปแล้ว) ข้าม' % os.path.basename(path))
        return False

    x0, x1 = max(0, minx - PAD), min(w - 1, maxx + PAD)
    y0, y1 = max(0, miny - PAD), min(h - 1, maxy + PAD)

    # 2) หาช่วงความสว่างเดิม เพื่อคงแสงเงาไว้
    lmin, lmax = 1e9, -1e9
    for y in range(y0, y1 + 1):
        r = rows[y]
        for x in range(x0, x1 + 1):
            o = x * nc
            R, G, B = r[o], r[o + 1], r[o + 2]
            if not is_blue(R, G, B):
                continue
            L = 0.2126 * R + 0.7152 * G + 0.0722 * B
            if L < lmin: lmin = L
            if L > lmax: lmax = L
    span = max(1e-6, lmax - lmin)

    # 3) ย้อมใหม่
    changed = 0
    for y in range(y0, y1 + 1):
        r = rows[y]
        for x in range(x0, x1 + 1):
            o = x * nc
            R, G, B = r[o], r[o + 1], r[o + 2]
            blueness = B - max(R, G)
            if blueness <= 8:
                continue
            L = 0.2126 * R + 0.7152 * G + 0.0722 * B
            t = (L - lmin) / span
            t = 0.0 if t < 0 else (1.0 if t > 1 else t)
            grey = OUT_MIN + (OUT_MAX - OUT_MIN) * t
            # ขอบที่ฟ้าไม่จัด ให้ค่อยๆ ผสมกับสีเดิม กันขอบแข็ง
            a = blueness / FEATHER
            if a > 1.0: a = 1.0
            r[o]     = int(round(R * (1 - a) + grey * a))
            r[o + 1] = int(round(G * (1 - a) + grey * a))
            r[o + 2] = int(round(B * (1 - a) + grey * a))
            changed += 1

    write_png(path, w, h, nc, rows)
    print('  %-24s กรอบ x%d-%d y%d-%d  แก้ %d พิกเซล' %
          (os.path.basename(path), minx, maxx, miny, maxy, changed))
    return True


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print('เปลี่ยนไลต์บาร์ ฟ้า -> ขาว')
    any_done = False
    for f in FILES:
        p = os.path.join(root, f)
        if not os.path.exists(p):
            print('  %-24s ไม่พบไฟล์ ข้าม' % f)
            continue
        any_done |= recolor(p)
    print('เสร็จแล้ว' if any_done else 'ไม่มีอะไรให้แก้')


if __name__ == '__main__':
    sys.exit(main())
