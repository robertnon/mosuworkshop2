# THEME.md — Design State ปัจจุบัน

> **Source of truth สำหรับ AI / developer ที่เข้ามาทำงานต่อโปรเจกต์นี้**
> อัปเดต: 2026-09-16 (หลังรอบ 15 "Fusion" + landing direction)
> ประวัติรายรอบ ดูใน `CHANGELOG.md`

---

## 1. ธีมหลัก: "Fusion" (dark เป็นหลัก + carbon ผสม)

ลูกค้าสั่ง: ใช้ **dark (lime) เป็นหลัก** แต่เอา **carbon มาผสม** และ **เอาพื้นหลังจุดๆ ออก**

### Palette (lock ห้ามเปลี่ยนถ้าไม่ได้รับคำสั่ง)

| Token | ค่า | หน้าที่ |
|---|---|---|
| `--bg` | `#090A0C` | พื้น (เทาถ่านเย็นจาก carbon) |
| `--panel` | `#14171C` | พาเนลหลัก |
| `--panel-2` | `#1C2027` | พาเนลชั้น 2 |
| `--line` | `#262B33` | เส้นขอบ (เทาเย็น แทนเขียวมะกอก) |
| `--copper` | `#C6FF00` | **ไลม์แบรนด์** (คopper เดิม — เอกลักษณ์) |
| `--copper-dim` | `#39414D` | เส้นขอบ hover |
| `--copper-text` | `#D4FF4D` | ข้อความเน้น |
| `--copper-bright` | `#E3FF8C` | ไฮไลต์ |
| `--silk` | `#F0F3F6` | ข้อความหลัก |
| `--silk-dim` | `#858E9B` | ข้อความรอง |
| `--glow-rgb` | `198, 255, 0` | **สีแสงเรืองทุกจุด** — แสงใช้ `rgba(var(--glow-rgb), α)` เสมอ |
| `--required` | `#FF4D6D` | ข้อผิดพลาด/บังคับเลือก |
| `--ok` | `#6EE7C9` | สำเร็จ |
| cyan accent | `#4FD8E8` | **เฉพาะตัวเลขราคารวม** (ลายเซ็น carbon: `.float-summary-total`, `.wizard-summary-total-value`) |

### กฎพื้นหลัง
- **ห้ามมี dot grid** (`radial-gradient(circle at 1px 1px, …)`) — ถูกล้างแล้วทั้งธีมหลัก + carbon, `animation: gridMove` ปิด
- พื้นหลัง body เหลือแค่ **corner glow ไลม์ 2 มุมบน** (ใช้ `--corner-glow-*` — แผง `?tune=1` ปรับได้ ต้องคงไว้)
- `body::before` = haze ไลม์จาง (blur 100px), `body::after` = stage light + vignette (L&S) — ทั้งสอง z-index -1 + pointer-events none

### ธีมที่มีในโค้ด (4 ธีม, สลับได้ 2)
| ธีม | class | สลับได้ |
|---|---|---|
| **Fusion** (ค่าเริ่มต้น) | — (ไม่มี class) | ✅ ค่า default |
| **Carbon** | `body.carbon-theme` | ✅ ปุ่ม toggle ใน header (dark ↔ carbon) |
| Gold | `body.gold-theme` | ❌ legacy ซ่อน (เจอได้แค่ใน localStorage) |
| Light | `body.light-theme` | ❌ legacy ซ่อน (อยู่ใน index เท่านั้น) |

ธีมแชร์กันผ่าน `localStorage` key **`mosuTheme`** (index + my-orders เห็นธีมเดียวกัน)

---

## 2. ฟอนต์

- **Body / Display**: `IBM Plex Sans Thai` (400–700)
- **Labels / ตัวเลข / spec line**: `IBM Plex Mono` (400–700)
- Google Fonts link มี 2 family นี้ **เท่านั้น**
- ⚠️ **ห้ามเพิ่ม display font อื่น** — เคยลอง Chakra Petch ลูกค้าไม่เอา (reject แล้วรอบ 14b)

---

## 3. Layout ปัจจุบัน

### Landing (`#modeSelectScreen` / `.mode-select`)
- direction อ้างอิง **headglytch.com/presets** (adapt ไม่ใช่ clone)
- hero typography อย่างเดียว: eyebrow `// CONTROLLER MOD BY MOSU…` + h1 ยักษ์ (clamp 40–72px, ฟอนต์เดิม) + sub
- **ไม่มีรูป controller เลย** (hero image + mode card images ล้างแล้ว — ไฟล์รูปอยู่ใน git history ถ้าจะเอาคืน)
- Mode cards = catalog `01 Custom Build` / `02 เปลี่ยนอนาล็อกอย่างเดียว` — tag + เลข (mono ไลม์) + ชื่อ + spec line (mono) + CTA `↗`
- hairline คั่นระหว่าง hero กับ grid

### Wizard / Configurator (`.wizard-layout`)
- ซ้าย: `aside.summary-col` (3D preview `three.js` + BOM panel) / ขวา: `form.form-col`
- Step tracker = `.wizard-nav` (5 ขั้น: Preset / ชิ้นส่วน / Shell & Keys / ติดต่อ / สรุป)
- ราคารวม = `.float-summary` (fixed มุมขวาล่าง)
- 3D preview: `controller-3d.js` (PS4) + `controller-3d-ds5.js` (PS5) + `controller-3d-glb.js`

---

## 4. CSS Layer System (additive blocks — rollback = ลบบล็อกเดียว)

บล็อกทั้งหมดอยู่**ท้าย `<style>` เรียงตามนี้** (เฉพาะ index.html; my-orders มี L&S + FUSION):

1. **`ORBITAL LIGHT & SHADOW LAYER`** — ระบบแสงเงา: sheen/glow border/edge-hi/shadow-rest บนการ์ด, recessed select, submit underglow, hover -2px / selected 4-layer glow / soldout flat — spec เดิมจาก THEME.md รอบ 12 (marker ×3 ใน index + my-orders)
2. **`HEADGLYTCH LANDING LAYER`** — landing direction (hero + catalog cards 01/02)
3. **`CARBON FUSION LAYER`** — ธีม Fusion (surface เย็น + ล้าง dot + cyan total)

**ต้องรักษาลำดับ**: FUSION อยู่ท้ายสุด (ต้อง override `:root` ของเดิม)

---

## 5. กฎเหล็ก (Don'ts)

- ❌ **ไม่แตะ flow การเลือกสินค้า** — JS/ขั้นตอน/ราคา/validation ทุกอย่างคงเดิม; HTML ที่แก้ได้ = ส่วน visual เท่านั้น, **id/class ที่ JS อ้างต้องครบเสมอ** (เช็คก่อน/หลังแก้ทุกครั้ง: `grep` id + `node --check` ทุก script)
- ❌ ห้าม dot grid กลับมา, ห้าม display font ใหม่, ห้าม palette ใหม่ (ถ้าจะเปลี่ยนต้องลูกค้าสั่งชัด)
- ❌ soldout option = ห้าม hover lift / glow (flat), ห้าม background-image บน `.select-input`
- ✅ แสงเรืองทุกจุดต้องผ่าน `rgba(var(--glow-rgb), α)` เท่านั้น
- ✅ หลังแก้ CSS: ตรวจ braces balance + markers (L&S ×3, FUSION ×1, HG ×1) + `node --check` ทุก script

---

## 6. ไฟล์ & Deployment

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าหลัก (landing + wizard + 3D) — ไฟล์เดียว ~500KB |
| `my-orders.html` | ค้นหาออเดอร์ (แชร์ธีม mosuTheme) |
| `CHANGELOG.md` | ประวัติรายรอบ (ใหม่อยู่บนสุด) |
| `apps-script-order-receiver.gs` | ฝั่ง Google Apps Script (รับออเดอร์/anti-spam/Settings sheet) |
| `CLAUDE.md` / `DESIGN-BRIEF.md` | บริบทโปรเจกต์ / brief เดิม |

**Deploy**: อัปไฟล์เข้า Google Apps Script Web App (host จริง)
- ⚠️ โฟลเดอร์ `SVGDS4/` (รูปจอย lineart สำหรับ frame color picker / 3D) **อยู่บน host ไม่ใช่ repo** — preview ใน sandbox รูปในวิซาร์ดขึ้น 404 เป็นปกติ
- Server ทดลอง: `python3 -m http.server 8080 --bind 0.0.0.0`
