# Theme Spec — "Orbital Light & Shadow" (ธีมแสงเงาแบบกระจก)

> ธีมที่ใช้บน `index.html` (Controller Mod by Mosu) — แรงบันดาลใจจาก orbital-web-ctrl.pages.dev
> **หลักการ: คงสี/ฟอนต์/โครงสร้างเดิมทั้งหมด เปลี่ยนแค่ "แสง ขอบ เงา ความโค้ง"** เพื่อให้ทุกอย่างดูยกตัว มีมิติ เหมือนอุปกรณ์ฮาร์ดแวร์วางบนเวทีที่มีไฟส่อง

สรุปสั้นๆ สำหรับนำไปใช้ที่อื่น — ก๊อป 3 ส่วน: **(1) ตัวแปร** → **(2) เวทีแสงพื้นหลัง** → **(3) recipe ราย component**

---

## 1. ชื่อธีม

**Orbital Light & Shadow Layer** (ในโค้ดค้นหาคำว่า `ORBITAL LIGHT & SHADOW LAYER` ใน `index.html`)

สไตล์: dark glass / hardware-control-panel — การ์ดเป็น "หน้าต่างกระจก" ที่ขอบจับแสง, ช่องกรอกเป็น "บ่อบุ๋ม", ปุ่มหลักมี "แสงฟุ้งใต้ตัว", พื้นหลังมี "ไฟส่องจากบน + vignette"

---

## 2. พาเลตต์สี (สีเดิมของร้าน — ห้ามเปลี่ยน)

### ธีมหลัก — เขียวมะนาว (default)
```css
:root {
  --bg: #090A07;            /* พื้นหลังเกือบดำ อมเขียวมะกอก */
  --panel: #141812;         /* พาเนล/การ์ด ชั้น 1 */
  --panel-2: #1C2218;       /* พาเนล ชั้น 2 (ในการ์ด) */
  --line: #5C6E1A;          /* เส้นขอบ */
  --copper: #C6FF00;        /* ★ สีแบรนด์ — เขียวมะนาว */
  --copper-dim: #5C6E1A;    /* สีแบรนด์หม่น */
  --copper-text: #D4FF4D;   /* ข้อความสีเน้น */
  --copper-bright: #E3FF8C; /* ไฮไลต์/ปุ่มหลัก */
  --silk: #F2F5EC;          /* ข้อความหลัก */
  --silk-dim: #9AA495;      /* ข้อความรอง */
  --required: #FF4D6D;      /* ผิดพลาด/จำเป็น */
  --ok: #6EE7C9;            /* สำเร็จ */
}
```

### ธีม Gold (สลับได้)
```css
body.gold-theme {
  --bg: #0E0C06;  --panel: #1D1810;  --panel-2: #272115;  --line: #403623;
  --copper: #CBB26A;  --copper-dim: #8A7A50;  --copper-text: #E4D39A;
  --copper-bright: #F3E7C0;  --silk: #FAF6ED;  --silk-dim: #BEB4A2;
  --required: #FF4D6D;  --ok: #B9A24A;
}
```

### ธีม Carbon & Ice (สลับได้)
```css
body.carbon-theme {
  --bg: #090A0C;  --panel: #14171C;  --panel-2: #1C2027;  --line: #262B33;
  --copper: #C6FF00;  --copper-dim: #39414D;  --copper-text: #D8FF63;
  --copper-bright: #E3FF8C;  --silk: #F0F3F6;  --silk-dim: #858E9B;
  --required: #FF4D6D;  --ok: #6EE7C9;
}
/* ตัวเลขราคารวมใช้ #4FD8E8 ให้เด่นจากสีเขียว */
```

---

## 3. Typography

```css
--sans: 'IBM Plex Sans Thai', 'IBM Plex Sans', system-ui, sans-serif;  /* เนื้อหา */
--mono: 'IBM Plex Mono', ui-monospace, monospace;                       /* ตัวเลข/label/รหัส */
```
กติกา: label/eyebrow ใช้ mono ตัวพิมพ์ใหญ่ + `letter-spacing: 0.08–0.14em` / ราคาและเลขออเดอร์ใช้ mono / เนื้อหาไทยใช้ sans

---

## 4. ตัวแปรแกนของธีม (หัวใจ — ก๊อปส่วนนี้ก่อนเสมอ)

```css
:root {
  --glow-rgb: 198, 255, 0;               /* สีแสงเรือง = สีแบรนด์ แยกเป็น RGB เพื่อปรับ alpha ได้ */
  --edge-hi: rgba(255, 255, 255, 0.065); /* ไฮไลต์แสงขอบบนในการ์ด (เส้นแสง 1px) */
  --card-sheen: linear-gradient(180deg,
    rgba(255,255,255,0.05),
    rgba(255,255,255,0.015) 42%,
    rgba(0,0,0,0.08));                   /* แสงอาบการ์ดบน→ล่าง (บนสว่าง ล่างหนัก) */
  --shadow-rest: 0 1px 2px rgba(0,0,0,0.40),
                 0 12px 28px -14px rgba(0,0,0,0.55);   /* เงาพัก: contact + ambient */
  --shadow-raised: 0 2px 4px rgba(0,0,0,0.40),
                   0 18px 40px -16px rgba(0,0,0,0.60); /* เงาชู้ตอน hover */
}
body.gold-theme   { --glow-rgb: 203, 178, 106; }
body.carbon-theme { --glow-rgb: 198, 255, 0; }
```

**เคล็ดลับ:** ทุกที่ที่ต้องการแสงเรืองสีแบรนด์ ใช้ `rgba(var(--glow-rgb), 0.XX)` — ธีมจะสลับสีเองตาม class บน body ไม่ต้อง hardcode ซ้ำ

---

## 5. เวทีแสงพื้นหลัง (stage lighting)

ไฟส่องจากด้านบน + มุมจอมืดลง (vignette) วางไว้หลัง content:

```css
body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  background:
    radial-gradient(130% 80% at 50% -10%, rgba(255,255,255,0.05), transparent 55%),
    radial-gradient(150% 120% at 50% 60%, transparent 55%, rgba(0,0,0,0.45) 100%);
}
```

(พื้นหลังเดิมยังมี dot grid และแสงมุม `--corner-glow-*` อยู่ใน `body` — เลเยอร์นี้ซ้อนเพิ่มเท่านั้น)

---

## 6. สเกลความโค้ง (radius scale)

| ขนาด | ใช้กับ |
|---|---|
| `16px` | การ์ด/แผงใหญ่, แผงสรุป sticky, การ์ดโหมด, กล่องลอย |
| `14px` | step tracker, การ์ด QR |
| `12px` | option/preset/การ์ดเลือก, dropdown frame, ปุ่มหลัก, แท็บ login, รูปในการ์ด |
| `10px` | ช่องกรอก, select, ปุ่มรอง |
| `999px` | pill (แถบวิซาร์ด, ปุ่มภาษา, badge) |

---

## 7. Recipes ราย component (สูตรแสงเงา)

### 7.1 การ์ด/แผงทั่วไป — "กระจกยกตัว"
ขอบสว่างโปร่งแสง + แสงอาบบน→ล่าง + เส้นแสงขอบบนใน + เงา 2 ชั้น

```css
.การ์ด {
  background-color: var(--panel);
  background-image: var(--card-sheen);
  border: 1px solid rgba(var(--glow-rgb), 0.20);
  border-radius: 16px;
  box-shadow: inset 0 1px 0 var(--edge-hi), var(--shadow-rest);
}
```

### 7.2 แผงเด่น (sticky summary) — "ขอบเรืองแสง"
เพิ่มวงแหวนแสง + แสงฟุ้งรอบๆ + เงาลึก:

```css
box-shadow:
  inset 0 1px 0 var(--edge-hi),
  0 0 0 1px rgba(var(--glow-rgb), 0.10),        /* วงแหวนบาง */
  0 0 30px -8px rgba(var(--glow-rgb), 0.16),    /* แสงฟุ้ง */
  0 2px 4px rgba(0,0,0,0.35),
  0 28px 60px -24px rgba(0,0,0,0.60);           /* เงาลอยสูง */
border: 1px solid rgba(var(--glow-rgb), 0.45);
```

### 7.3 การ์ดตัวเลือก (option/preset/รายการเลือกได้) — "hover ลอย / selected เรือง"

```css
/* พัก */
.option {
  background-color: var(--panel);
  background-image: var(--card-sheen);
  box-shadow: inset 0 1px 0 var(--edge-hi);
  transition: border-color .18s ease, transform .18s ease, box-shadow .22s ease;
}
/* hover — ลอยขึ้น 2px */
.option:hover {
  transform: translateY(-2px);
  border-color: rgba(var(--glow-rgb), 0.40);
  box-shadow: inset 0 1px 0 var(--edge-hi),
              0 2px 4px rgba(0,0,0,0.35),
              0 14px 30px -12px rgba(0,0,0,0.55),
              0 0 18px -6px rgba(var(--glow-rgb), 0.22);
}
/* selected — ขอบสว่าง + พื้นอมสีแบรนด์ + เรือง */
.option.selected {
  border-color: rgba(var(--glow-rgb), 0.85);
  background-image: linear-gradient(180deg,
    rgba(var(--glow-rgb), 0.10),
    rgba(var(--glow-rgb), 0.03) 55%,
    rgba(0,0,0,0.06));
  box-shadow: inset 0 1px 0 rgba(var(--glow-rgb), 0.22),
              inset 0 0 22px -6px rgba(var(--glow-rgb), 0.10),
              0 0 16px -4px rgba(var(--glow-rgb), 0.30),
              0 12px 28px -14px rgba(0,0,0,0.55);
}
/* ⚠️ ของหมด/ปิดใช้งาน — ห้ามเด้ง ห้ามเรือง */
.option.soldout, .option.soldout:hover {
  transform: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}
```

### 7.4 ช่องกรอก — "บ่อบุ๋ม (recessed well)"
พื้นเข้มด้านบน→จางล่าง เหมือนแกะสลักลงไปในพื้น:

```css
.text-input {
  background-color: var(--panel);
  background-image: linear-gradient(180deg, rgba(0,0,0,0.22), rgba(0,0,0,0.05));
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.30),
              inset 0 0 0 1px rgba(0,0,0,0.12),
              0 1px 0 rgba(255,255,255,0.03);
}
/* โฟกัส — วงแสงล้อมรอบแทน outline แข็งๆ */
.text-input:focus-visible {
  outline: none;
  border-color: rgba(var(--glow-rgb), 0.65);
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.22),
              0 0 0 3px rgba(var(--glow-rgb), 0.22),
              0 0 18px -4px rgba(var(--glow-rgb), 0.35);
}
```

### 7.5 ปุ่มหลัก — "แสงไล่ + เรืองใต้ตัว + กดยุบ"

```css
.submit-btn {
  background-color: var(--copper-bright);        /* พื้นสีเดิม */
  background-image: linear-gradient(180deg,
    rgba(255,255,255,0.28), rgba(255,255,255,0.04) 46%, rgba(0,0,0,0.08));
  color: #12180C;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.45),
              0 1px 2px rgba(0,0,0,0.45),
              0 10px 22px -8px rgba(var(--glow-rgb), 0.45);   /* แสงฟุ้งใต้ปุ่ม */
  transition: filter .15s ease, transform .12s ease, box-shadow .2s ease;
}
.submit-btn:hover  { transform: translateY(-1px);  /* เงาขยายขึ้น */ }
.submit-btn:active { transform: translateY(1px);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.4),
              0 6px 14px -8px rgba(var(--glow-rgb), 0.35); }  /* กดแล้วยุบลง */
```

### 7.6 ปุ่มรอง — "แกะสลักตื้น + วงเรืองตอน hover"

```css
.btn-secondary {
  background-color: var(--panel);
  background-image: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.35);
}
.btn-secondary:hover {
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06),
              0 2px 5px rgba(0,0,0,0.4),
              0 0 12px -4px rgba(var(--glow-rgb), 0.30);
}
```

### 7.7 แถบ pill / toggle — "ร่องบุ๋ม + ก้อนที่กดอยู่ยกเด่น"

```css
/* ตัวร่อง (container) */
.pill-track {
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.3);
}
/* ก้อนที่ active อยู่ในร่อง */
.pill-active {
  background-image: linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.08));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.4),
              0 2px 6px rgba(0,0,0,0.4),
              0 4px 14px -6px rgba(var(--glow-rgb), 0.4);
}
/* จุดเลขขั้นตอนที่ active */
.step-dot-active {
  box-shadow: 0 0 0 3px rgba(var(--glow-rgb), 0.15),
              0 0 14px -2px rgba(var(--glow-rgb), 0.45),
              0 2px 4px rgba(0,0,0,0.4);
}
```

### 7.8 องค์ประกอบลอย (สรุปมือถือ, dropdown, tooltip) — "เงาลึกสุด"
ลอยสูงกว่าการ์ด = เงายาวและดำกว่า + วงเรืองจาง:

```css
box-shadow: inset 0 1px 0 var(--edge-hi),
            0 2px 6px rgba(0,0,0,0.45),
            0 24px 56px -16px rgba(0,0,0,0.7),
            0 0 28px -10px rgba(var(--glow-rgb), 0.18);
border-color: rgba(var(--glow-rgb), 0.25);
```

### 7.9 Badge / กล่องสถานะ / QR
ใส่แค่มิติเล็กน้อย ไม่แย่งสายตาจากเนื้อหา:

```css
.order-badge   { box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); }
.qr-card       { box-shadow: inset 0 0 0 1px rgba(27,58,107,0.05),
                 0 2px 6px rgba(0,0,0,0.4), 0 16px 36px -12px rgba(0,0,0,0.55); }
```

---

## 8. กฎการใช้ (Do / Don't)

**Do**
- แสงเรืองทุกจุดใช้ `rgba(var(--glow-rgb), α)` เท่านั้น — สลับธีมแล้วเปลี่ยนตามอัตโนมัติ
- เงาแบบ 2 ชั้นเสมอ: ชั้นสั้นชิดตัว (contact) + ชั้นยาวฟุ้ง (ambient) แยกด้วย spread ติดลบ
- ไฮไลต์ขอบบนในการ์ดทุกใบ: `inset 0 1px 0 var(--edge-hi)` — คือ "แสงจากบน" ของทั้งธีม
- transition แยกความเร็ว: transform เร็ว (.12–.18s) / box-shadow ช้ากว่านิด (.2–.22s) ให้ความรู้สึกนุ่ม

**Don't**
- ❌ ของหมด/disabled ห้ามมี hover-lift หรือแสงเรือง (ต้องดูนิ่ง ปิดใช้งาน)
- ❌ อย่าใส่ `background-image` ทับช่อง `.select-input` แบบมีลูกศร — จะไปทับลูกศร SVG (ใช้ box-shadow อย่างเดียว)
- ❌ อย่า hardcode สีเรืองเป็น hex — ธีม gold/carbon จะพัง
- ❌ อย่าให้ z-index ของแสงพื้นหลังสูงกว่าเนื้อหา (ต้อง `-1` + `pointer-events: none`)

---

## 9. วิธีนำไปใช้กับหน้าอื่น (สรุป 3 ขั้น)

1. **ก๊อปตัวแปร** — พาเลตต์ (§2) + ตัวแปรแกน (§4) ไปวางใน `:root`
2. **ก๊อปเวทีแสง** — `body::after` (§5)
3. **จับคู่ class ของหน้าใหม่กับ recipe** (§7):

| หน้าใหม่มีอะไร | ใช้ recipe |
|---|---|
| การ์ดใหญ่/แผง/กล่อง section | 7.1 (+7.2 ถ้าเป็นแผงเด่น) |
| รายการที่คลิกเลือกได้ | 7.3 |
| input / textarea / select | 7.4 |
| ปุ่ม CTA หลัก | 7.5 |
| ปุ่มทั่วไป/รอง | 7.6 |
| tabs / segmented control / toggle | 7.7 |
| dropdown เมนู / modal / กล่องลอย | 7.8 |
| badge / สถานะ / QR | 7.9 |

> ไฟล์จริงทั้งหมดอยู่ใน `index.html` ท้าย `<style>` (ค้นหา `ORBITAL LIGHT & SHADOW LAYER`) — เป็นบล็อก additive แยกจากกฎเดิมทั้งหมด ก๊อปทั้งบล็อกไปใช้ได้เลย ปรับแค่ selector ให้ตรง class ของหน้าใหม่

---

*อัปเดตล่าสุด: 2026-09-11 · สร้างจากงานจริงบน `index.html` (commit "เพิ่มเลเยอร์แสงเงาสไตล์ Orbital")*
