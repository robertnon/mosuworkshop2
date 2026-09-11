/* =====================================================================
 * controller-3d.js — พรีวิวคอนโทรลเลอร์ PS4 แบบ 3 มิติ (three.js)
 * ---------------------------------------------------------------------
 * โมเดลถูก "ปั้นด้วยโค้ด" ทั้งตัว (procedural) ไม่ต้องโหลดไฟล์ .glb/.fbx
 * จากภายนอก — เว็บนี้เป็น static HTML ล้วน ไม่มี build step และเจ้าของร้าน
 * อัปโหลดไฟล์เอง การมีไฟล์โมเดลก้อนใหญ่เพิ่มอีกจะยุ่งกว่าเดิม
 *
 * ใช้ได้ 2 ที่:
 *   - บนเบราว์เซอร์  -> window.MosuController3D.createViewer(el)
 *   - บน Node (เทสต์) -> require('./controller-3d.js').createControllerModel(THREE, state)
 *     (ส่วนสร้างรูปทรงไม่แตะ DOM เลย จึงเรียกจาก Node เพื่อตรวจรูปทรงได้)
 *
 * หน่วยที่ใช้ = เซนติเมตร (DS4 จริง ~16.2 x 9.8 x 5.2 ซม.)
 * ระบบแกน: x = ซ้าย-ขวา, y = ขึ้น-ลง (ผิวบนของจอย = +y), z = ไกล-ใกล้
 *          (-z = ขอบบนฝั่งปุ่มไหล่ L1/R1, +z = ปลายด้ามจับที่ชี้เข้าหาคนเล่น)
 * ===================================================================== */
(function (root, factory) {
  'use strict';
  var lib = factory();
  if (typeof module === 'object' && module.exports) { module.exports = lib; }
  if (root) { root.MosuController3D = lib; }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /* ===================================================================
   * 1) ค่าสี / ค่าคงที่
   * =================================================================== */

  // สีกรอบ — คีย์ตรงกับ data-color ของปุ่มเลือกสีในช่อง 05 ของ index.html
  var SHELL_COLORS = {
    white:        { body: 0xE9EAE6, grip: 0xDCDDD8, rough: 0.42, metal: 0.03, label: 'White' },
    crystal:      { body: 0xBFD4E2, grip: 0xB2C7D6, rough: 0.08, metal: 0.00, label: 'Crystal',
                    transparent: true, opacity: 0.42 },
    titaniumBlue: { body: 0x73909F, grip: 0x62808F, rough: 0.26, metal: 0.62, label: 'Titanium Blue' },
    berryBlue:    { body: 0x2C55B8, grip: 0x24469B, rough: 0.34, metal: 0.18, label: 'Berry Blue' },
    alpineGreen:  { body: 0x4A7A55, grip: 0x3E6848, rough: 0.40, metal: 0.10, label: 'Alpine Green' },
    purple:       { body: 0x6B3FA0, grip: 0x5A3489, rough: 0.38, metal: 0.14, label: 'Purple' },
    roseGold:     { body: 0xD8A08E, grip: 0xC79080, rough: 0.24, metal: 0.62, label: 'Rose Gold' },
    sunsetOrange: { body: 0xDF6E3B, grip: 0xC65D2E, rough: 0.34, metal: 0.16, label: 'Sunset Orange' },
    // ยังไม่เลือกสี / ลูกค้าส่งจอยของตัวเองมา -> ใช้สีดำโรงงานเป็นค่าเริ่มต้น
    __default:    { body: 0x24272B, grip: 0x1D2024, rough: 0.46, metal: 0.08, label: 'Jet Black' }
  };

  // สีวงแหวนก้านอนาล็อกตามชนิดโมดูล (ให้ลูกค้าเห็นว่าเลือกอันไหนอยู่)
  var STICK_ACCENT = {
    alps: { color: 0x8A939E, label: 'ALPS' },
    he:   { color: 0x2ED3A5, label: 'HE (Hall Effect)' },
    tmr:  { color: 0xFFC44D, label: 'TMR' }
  };

  // สีไฟ Light Bar — ใช้ "สีขาว" ทุกกรณี
  // (เดิมเปลี่ยนสีตามบอร์ด PCB: suiovoi ฟ้า / hyperstrike ชมพู / ค่าเริ่มต้นน้ำเงิน
  //  แต่ทางร้านขอให้เป็นสีขาวหมด จึงตั้งเป็นขาวทั้ง 3 ค่า)
  // ยังแยกความสว่างอยู่ (เลือกบอร์ดแล้วไฟจะสว่างขึ้น) ดูที่ emissiveIntensity ด้านล่าง
  // ถ้าวันหลังอยากให้ไฟเปลี่ยนสีตามบอร์ดอีก แค่ใส่ค่าสีกลับเข้าไปในนี้
  var PCB_LIGHT = {
    suiovoi:    0xFFFFFF,
    hyperstrike: 0xFFFFFF,
    __default:  0xFFFFFF
  };

  var ACCENT_LIME = 0xC6FF00;   // สีเน้นของเว็บ ใช้บอกชิ้นที่ "อัปเกรดแล้ว"

  // ความสูงปุ่มหลังแต่ละระดับ (ค่า medium ในฟอร์ม = "ต่ำ")
  var PADDLE_HEIGHT = { standard: 0.62, medium: 0.44, high: 0.92 };

  /* ===================================================================
   * 2) เงาคอนโทรลเลอร์มองจากด้านบน (ครึ่งขวา แล้วสะท้อนเป็นครึ่งซ้าย)
   *    แกน 2 มิติ: y บวก = ขอบไกล (ฝั่งปุ่มไหล่), y ลบ = ปลายด้ามจับ
   *    ตอน extrude เสร็จจะหมุน -90° รอบแกน x ทำให้ y(2มิติ) -> -z
   * =================================================================== */
  /* เส้นขอบนี้ "ลอก" มาจากไฟล์เวกเตอร์ DualShock 4 ของจริงในโปรเจกต์
   * (ds4-color-tool.html -> path id="rect4272-5-1-3" ซึ่งเป็นเงาตัวเครื่อง)
   * ไม่ได้เดาสัดส่วนเอง: สเกลจาก viewBox ให้กว้าง 16.2 ซม. ตามสเปกจริง
   * (162 x 98 มม.) แล้วเก็บเฉพาะครึ่งขวา (x >= 0) โค้ดจะสะท้อนเป็นครึ่งซ้ายให้เอง
   *
   * จุดสำคัญที่เดาผิดมาตลอด: DS4 "กว้างที่สุดตรงด้ามจับ" (y ≈ -3.1)
   * ไม่ใช่ตรงบ่า/ปุ่มไหล่ ขอบไกลฝั่งไลต์บาร์กว้างแค่ ~12.2 ซม. เท่านั้น */
  var OUTLINE_PTS = [
    [0,4.636], [0.509,4.636], [1.019,4.636], [1.528,4.636], [2.037,4.636],
    [2.547,4.636], [3.056,4.636], [3.566,4.636], [3.861,4.753], [4.183,4.837],
    [4.521,4.888], [4.866,4.906], [5.206,4.89], [5.533,4.84], [5.836,4.756],
    [6.105,4.636], [6.359,4.233], [6.614,3.829], [6.741,3.579], [6.869,3.33],
    [6.994,2.981], [7.107,2.567], [7.22,2.154], [7.334,1.741], [7.454,1.216],
    [7.574,0.69], [7.653,0.261], [7.731,-0.169], [7.81,-0.598], [7.862,-0.977],
    [7.914,-1.357], [7.966,-1.736], [8.011,-2.195], [8.055,-2.654], [8.1,-3.113],
    [8.048,-3.543], [7.9,-3.937], [7.668,-4.28], [7.366,-4.56], [7.005,-4.765],
    [6.598,-4.882], [6.188,-4.902], [5.848,-4.851], [5.535,-4.74], [5.254,-4.571],
    [5.01,-4.348], [4.808,-4.072], [4.653,-3.746], [4.498,-3.301], [4.343,-2.856],
    [4.188,-2.41], [4.034,-1.965], [3.879,-1.52], [3.745,-1.39], [3.567,-1.307],
    [3.333,-1.256], [2.857,-1.256], [2.381,-1.256], [1.905,-1.256], [1.428,-1.256],
    [0.952,-1.256], [0.476,-1.256], [0,-1.256]
  ];

  var BODY_EXTRUDE = 1.40;   // ความหนาก่อนลบมุม
  var BODY_BEVEL   = 0.52;   // ลบมุมทั้งบนและล่าง -> หนารวม 2.44
  var BODY_TOP_Y   = BODY_EXTRUDE / 2 + BODY_BEVEL;  // ผิวบน ~1.22

  /* ===================================================================
   * 3) เครื่องมือสร้างรูปทรง (ไม่แตะ DOM — เรียกจาก Node ได้)
   * =================================================================== */

  // Shape เงาคอนโทรลเลอร์ (ครึ่งขวาจากตาราง + สะท้อนครึ่งซ้ายอัตโนมัติ)
  function buildBodyShape(THREE) {
    var s = new THREE.Shape();
    var i, n = OUTLINE_PTS.length;
    s.moveTo(OUTLINE_PTS[0][0], OUTLINE_PTS[0][1]);
    for (i = 1; i < n; i++) s.lineTo(OUTLINE_PTS[i][0], OUTLINE_PTS[i][1]);
    // ไล่ย้อน + กลับด้าน x = ครึ่งซ้าย (หัว-ท้ายอยู่บนแกน x=0 จึงต่อกันพอดี)
    for (i = n - 2; i >= 1; i--) s.lineTo(-OUTLINE_PTS[i][0], OUTLINE_PTS[i][1]);
    s.closePath();
    return s;
  }

  // รายการจุดขอบครบวง (ครึ่งขวา + ครึ่งซ้ายสะท้อน) ในระบบพิกัด X/Z ของโมเดล
  function bodyOutlineXZ() {
    var poly = [], i, n = OUTLINE_PTS.length;
    for (i = 0; i < n; i++) poly.push([OUTLINE_PTS[i][0], -OUTLINE_PTS[i][1]]);
    for (i = n - 2; i >= 1; i--) poly.push([-OUTLINE_PTS[i][0], -OUTLINE_PTS[i][1]]);
    return poly;
  }

  // สี่เหลี่ยมมุมมน (ใช้กับทัชแพด/ปุ่มไหล่/ปุ่มหลัง)
  function roundedRectShape(THREE, w, h, r) {
    var s = new THREE.Shape();
    var x = -w / 2, y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    s.closePath();
    return s;
  }

  // กล่องมุมมน = extrude สี่เหลี่ยมมุมมนพร้อมลบมุม
  function roundedBoxGeo(THREE, w, h, d, r, bevel) {
    bevel = bevel === undefined ? Math.min(0.12, d / 3) : bevel;
    var geo = new THREE.ExtrudeGeometry(roundedRectShape(THREE, w, h, r), {
      depth: Math.max(0.001, d - bevel * 2), bevelEnabled: bevel > 0,
      bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10
    });
    geo.center();
    return geo;
  }

  /* ท่อโค้งหน้าตัดวงรีที่รัศมีเปลี่ยนได้ตามความยาว — ใช้ปั้น "ด้ามจับ"
   * (TubeGeometry ของ three รัศมีคงที่ เลยต้องเขียนเอง)
   * radius(t) คืนรัศมี ณ ตำแหน่ง t (0..1) — ถ้าปลายเรียวเป็น 0 จะได้หัวมน */
  function sweptTubeGeo(THREE, curve, opts) {
    var tubular = opts.segments || 48;
    var radial = opts.radial || 24;
    var radiusFn = opts.radius;
    var sx = opts.scaleX === undefined ? 1 : opts.scaleX;
    var sy = opts.scaleY === undefined ? 1 : opts.scaleY;
    var frames = curve.computeFrenetFrames(tubular, false);
    var positions = [], uvs = [], indices = [];
    var P = new THREE.Vector3();
    var i, j;

    for (i = 0; i <= tubular; i++) {
      var t = i / tubular;
      curve.getPointAt(t, P);
      var N = frames.normals[i], B = frames.binormals[i];
      var r = radiusFn(t);
      for (j = 0; j <= radial; j++) {
        var v = j / radial * Math.PI * 2;
        var cs = Math.cos(v) * r * sx, sn = Math.sin(v) * r * sy;
        positions.push(
          P.x + cs * N.x + sn * B.x,
          P.y + cs * N.y + sn * B.y,
          P.z + cs * N.z + sn * B.z
        );
        uvs.push(t, j / radial);
      }
    }
    for (i = 1; i <= tubular; i++) {
      for (j = 1; j <= radial; j++) {
        var a = (radial + 1) * (i - 1) + (j - 1);
        var b = (radial + 1) * i + (j - 1);
        var c = (radial + 1) * i + j;
        var d = (radial + 1) * (i - 1) + j;
        indices.push(a, b, d, b, c, d);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  // เรียวปลายให้มนแบบครึ่งวงกลม (ใช้กับ radius(t) ของ sweptTubeGeo)
  function capFalloff(t, head, tail) {
    var f = 1;
    if (head > 0 && t < head) { var a = t / head; f *= Math.sqrt(Math.max(0, 1 - (1 - a) * (1 - a))); }
    if (tail > 0 && t > 1 - tail) { var b = (1 - t) / tail; f *= Math.sqrt(Math.max(0, 1 - (1 - b) * (1 - b))); }
    return f;
  }

  /* ---------- ตัวเครื่อง: ปั้นเป็นก้อนเดียวแบบ "สนามความสูง" (heightfield) ----------
   * แนวคิด: เอาเงามองจากด้านบน (OUTLINE) มาแบ่งเป็นตาข่ายสามเหลี่ยมละเอียด
   * แล้วดันแต่ละจุดขึ้น/ลงตามฟังก์ชันความหนา -> ได้ตัวเครื่อง+ด้ามจับเป็นชิ้นเดียว
   * ไม่มีรอยต่อ (วิธีเดิมที่เอาท่อมาแปะเป็นด้ามจับ เห็นเป็นก้อนแยกชัดเจน)
   */

  function smoothstep(e0, e1, x) {
    var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  /* แกนกลางของด้ามจับ (จากไฟล์เวกเตอร์จริง): วงกลมในสุดที่บรรจุได้ในเงาด้ามจับ
   * ไล่จาก (5.90, z=1.0) ไปถึง (6.45, z=4.6) — เอียงออกจากแกน z ราว 8.6°
   * ใช้ระยะจาก "แกน" เส้นนี้เป็นตัวกำหนดความพองของด้ามจับ ทำให้ก้อนด้ามจับ
   * วางตัวตามเงาจริง ไม่ใช่ก้อนกลมๆ ที่เดาตำแหน่งเอง */
  var GRIP_A = [5.90, 1.00], GRIP_B = [6.45, 4.60];

  function gripAxisDist(ax, Z) {
    var vx = GRIP_B[0] - GRIP_A[0], vz = GRIP_B[1] - GRIP_A[1];
    var wx = ax - GRIP_A[0], wz = Z - GRIP_A[1];
    var L2 = vx * vx + vz * vz;
    var t = L2 > 0 ? (wx * vx + wz * vz) / L2 : 0;
    var tc = Math.max(0, Math.min(1, t));
    var dx = ax - (GRIP_A[0] + tc * vx), dz = Z - (GRIP_A[1] + tc * vz);
    return { d: Math.sqrt(dx * dx + dz * dz), t: t };
  }

  /* ความสูงผิวบน ณ พิกัด (X, Z) — ยังไม่รวมการมนขอบ
   * ผิวบนของ DS4 แทบจะ "แบนเป็นระนาบ" ตรงกลาง แล้วค่อยลาดลงที่ปลายด้ามจับ
   * กับขอบไกลฝั่งไลต์บาร์ ถ้าทำเป็นโดมจะดูอ้วนเหมือนจอยเด็กเล่นทันที */
  function topCore(X, Z) {
    var ax = Math.abs(X);
    var h = 1.26;
    // นูนกลางเล็กน้อยบริเวณแผงปุ่ม (ระหว่างทัชแพดกับก้านอนาล็อก)
    var dx = X / 5.6, dz = (Z + 1.4) / 3.6;
    h += 0.07 * Math.exp(-(dx * dx + dz * dz));
    // ปลายด้ามจับลาดลงชัดเจน (คนถือแล้วนิ้วโป้งพาดได้)
    var g = gripAxisDist(ax, Z);
    h -= 0.62 * smoothstep(0.15, 1.05, g.t) * smoothstep(2.35, 0.95, g.d);
    h -= 0.16 * smoothstep(2.6, 4.9, Z);
    // ขอบไกลฝั่งไลต์บาร์ลาดลงหาแนวปุ่มไหล่
    h -= 0.22 * smoothstep(3.4, 4.95, -Z);
    // บ่าตรงโคนปุ่มไหล่หนาขึ้นนิดเดียว
    h += 0.05 * Math.exp(-(Math.pow((ax - 5.0) / 1.7, 2) + Math.pow((Z + 4.1) / 1.1, 2)));
    return h;
  }

  /* ความหนาด้านล่าง ณ พิกัด (X, Z) — ด้ามจับพองลงมาเป็นก้อนยาวตามแกน GRIP_A→GRIP_B
   * โปรไฟล์ตัดขวางใช้ cosine falloff (ไม่ใช่เกาส์เซียน) เพราะขอบก้อนด้ามจับ
   * ของจริงจบเร็วกว่า ทำให้ได้สันที่คมกำลังดี ไม่บวมกลมจนดูเป็นหยดน้ำ */
  function botCore(X, Z) {
    var ax = Math.abs(X);
    var h = 1.06;
    var g = gripAxisDist(ax, Z);
    // ความพองสูงสุดของด้ามจับ ค่อยๆ ลดลงเมื่อเข้าใกล้ปลายด้าม
    var along = smoothstep(-0.34, 0.12, g.t) * smoothstep(1.30, 0.82, g.t);
    var radial = 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, g.d / 2.42));
    h += 2.44 * along * radial * radial;
    // ใต้บ่า/ปุ่มไหล่หนาขึ้นเล็กน้อย (ที่เก็บมอเตอร์สั่น)
    var sx = X / 6.2, sz = (Z + 4.05) / 1.55;
    h += 0.34 * Math.exp(-(sx * sx + sz * sz));
    // แอ่งตื้นๆ กลางฝาหลัง (ช่องแบตเตอรี่)
    h -= 0.10 * Math.exp(-(Math.pow(X / 2.6, 2) + Math.pow((Z + 1.1) / 2.2, 2)));
    return h;
  }

  // ระดับผิวบนจริง (รวมการมนขอบแล้ว) — ใช้วางปุ่มต่างๆ ให้แนบผิวพอดี
  var EDGE_R_TOP = 0.40, EDGE_R_BOT = 0.44, WALL_BULGE = 0.10;

  function rollTop(core, d) {
    var u = Math.min(1, Math.max(0, d) / EDGE_R_TOP);
    return core - EDGE_R_TOP * (1 - Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))));
  }
  function rollBot(core, d) {
    var u = Math.min(1, Math.max(0, d) / EDGE_R_BOT);
    return core - EDGE_R_BOT * (1 - Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))));
  }

  // ระยะจากจุดถึงส่วนของเส้นตรง (2 มิติ)
  function distToSeg(px, py, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay;
    var wx = px - ax, wy = py - ay;
    var len2 = vx * vx + vy * vy;
    var t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
    var dx = px - (ax + t * vx), dy = py - (ay + t * vy);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* สร้างตัวเครื่องทั้งก้อน
   * วิธี: ทำ "สนามระยะห่างจากขอบ" (signed distance field) บนตารางสี่เหลี่ยม
   * แล้วเดินตารางแบบ marching squares เพื่อได้ตาข่ายที่แนบขอบพอดี
   * ข้อดี: สามเหลี่ยมขนาดสม่ำเสมอทั้งใบ + ได้ระยะห่างจากขอบมาใช้มนขอบฟรีๆ
   */
  function buildBodySolid(THREE) {
    // --- 1) เงามองจากด้านบน (เส้นขอบ DS4 ของจริง แปลงเป็นระบบ X/Z แล้ว) ---
    var i;
    var poly = bodyOutlineXZ();
    var PN = poly.length;

    // --- 2) ฟังก์ชันระยะห่างแบบมีเครื่องหมาย (ลบ = อยู่ข้างใน) ---
    function sdf(x, z) {
      var best = Infinity, inside = false;
      for (var k = 0, j = PN - 1; k < PN; j = k++) {
        var ax = poly[j][0], az = poly[j][1], bx = poly[k][0], bz = poly[k][1];
        var d = distToSeg(x, z, ax, az, bx, bz);
        if (d < best) best = d;
        if ((az > z) !== (bz > z)) {
          var xx = ax + (z - az) / (bz - az) * (bx - ax);
          if (x < xx) inside = !inside;
        }
      }
      return inside ? -best : best;
    }

    // --- 3) ตารางสุ่มค่า ---
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (i = 0; i < PN; i++) {
      if (poly[i][0] < minX) minX = poly[i][0];
      if (poly[i][0] > maxX) maxX = poly[i][0];
      if (poly[i][1] < minZ) minZ = poly[i][1];
      if (poly[i][1] > maxZ) maxZ = poly[i][1];
    }
    /* ผนังข้างจะ "ป่อง" ออกไป WALL_BULGE ตรงกลางความหนา ถ้าเดินตารางที่ขอบจริง
     * เป๊ะๆ ตัวเครื่องจะกว้างเกินของจริงไป 2*WALL_BULGE ดังนั้นหดขอบเข้ามาก่อน
     * เท่ากับความป่อง แล้วผนังจะป่องออกไปพอดีเส้นขอบ DS4 ของจริง */
    var ISO = WALL_BULGE;
    var H = 0.15;
    minX -= H * 2; maxX += H * 2; minZ -= H * 2; maxZ += H * 2;
    var NX = Math.ceil((maxX - minX) / H) + 1;
    var NZ = Math.ceil((maxZ - minZ) / H) + 1;
    var gx = function (ix) { return minX + ix * H; };
    var gz = function (iz) { return minZ + iz * H; };
    var field = new Float32Array(NX * NZ);
    for (var ix = 0; ix < NX; ix++) {
      for (var iz = 0; iz < NZ; iz++) field[ix * NZ + iz] = sdf(gx(ix), gz(iz)) + ISO;
    }
    function fieldAt(ix, iz) { return field[ix * NZ + iz]; }

    // --- 4) เก็บจุด (dedupe) + ระยะห่างจากขอบของแต่ละจุด ---
    var pts2 = [], dist2 = [], vmap = {};
    function vert(key, x, z, d) {
      var got = vmap[key];
      if (got !== undefined) return got;
      var id = pts2.length;
      pts2.push([x, z]); dist2.push(d);
      vmap[key] = id;
      return id;
    }
    function nodeV(ix, iz) {
      return vert('n' + ix + '_' + iz, gx(ix), gz(iz), -fieldAt(ix, iz));
    }
    // จุดตัดขอบบนเส้นตาราง (อินเทอร์โพเลตให้ตรงขอบจริง) — d = 0
    function edgeV(ix, iz, horiz) {
      var key = (horiz ? 'h' : 'v') + ix + '_' + iz;
      var got = vmap[key];
      if (got !== undefined) return got;
      var a = fieldAt(ix, iz);
      var b = horiz ? fieldAt(ix + 1, iz) : fieldAt(ix, iz + 1);
      var t = Math.abs(a - b) < 1e-9 ? 0.5 : a / (a - b);
      t = Math.max(0, Math.min(1, t));
      var x = horiz ? gx(ix) + t * H : gx(ix);
      var z = horiz ? gz(iz) : gz(iz) + t * H;
      return vert(key, x, z, 0);
    }

    // --- 5) เดินตาราง: สร้างสามเหลี่ยมเฉพาะส่วนที่อยู่ในรูป ---
    var tris = [], boundary = [];
    for (ix = 0; ix < NX - 1; ix++) {
      for (iz = 0; iz < NZ - 1; iz++) {
        var c = [
          { ix: ix, iz: iz }, { ix: ix + 1, iz: iz },
          { ix: ix + 1, iz: iz + 1 }, { ix: ix, iz: iz + 1 }
        ];
        var s = [fieldAt(ix, iz) < 0, fieldAt(ix + 1, iz) < 0,
                 fieldAt(ix + 1, iz + 1) < 0, fieldAt(ix, iz + 1) < 0];
        if (!s[0] && !s[1] && !s[2] && !s[3]) continue;
        var ring = [], crossings = [];
        for (var e = 0; e < 4; e++) {
          var n2 = (e + 1) % 4;
          if (s[e]) ring.push(nodeV(c[e].ix, c[e].iz));
          if (s[e] !== s[n2]) {
            var id;
            if (e === 0) id = edgeV(ix, iz, true);
            else if (e === 1) id = edgeV(ix + 1, iz, false);
            else if (e === 2) id = edgeV(ix, iz + 1, true);
            else id = edgeV(ix, iz, false);
            ring.push(id);
            crossings.push(id);
          }
        }
        for (var t3 = 1; t3 + 1 < ring.length; t3++) tris.push([ring[0], ring[t3], ring[t3 + 1]]);
        if (crossings.length === 2) boundary.push([crossings[0], crossings[1]]);
      }
    }

    // --- 6) ดันขึ้น/ลงเป็นก้อน 3 มิติ ---
    var position = [], color = [], index = [];
    var VN = pts2.length;

    function gripMask(X, Z) {
      var g = gripAxisDist(Math.abs(X), Z);
      var along = smoothstep(-0.30, 0.15, g.t) * smoothstep(1.25, 0.80, g.t);
      return Math.min(1, along * Math.max(0, 1 - g.d / 2.5));
    }
    function pushVert(X, Y, Z, tint) {
      position.push(X, Y, Z);
      color.push(tint, tint, tint);
    }

    for (var a1 = 0; a1 < VN; a1++) {   // ผิวบน
      var X1 = pts2[a1][0], Z1 = pts2[a1][1];
      pushVert(X1, rollTop(topCore(X1, Z1), dist2[a1]), Z1, 1 - 0.09 * gripMask(X1, Z1));
    }
    for (var a2 = 0; a2 < VN; a2++) {   // ผิวล่าง
      var X2 = pts2[a2][0], Z2 = pts2[a2][1];
      pushVert(X2, -rollBot(botCore(X2, Z2), dist2[a2]), Z2, 0.9 - 0.09 * gripMask(X2, Z2));
    }
    for (var ti = 0; ti < tris.length; ti++) {
      var tr = tris[ti];
      index.push(tr[0], tr[2], tr[1]);                    // ผิวบนหันขึ้น
      index.push(VN + tr[0], VN + tr[1], VN + tr[2]);     // ผิวล่างหันลง
    }

    /* --- 7) ผนังข้าง ---
     * ต้องเรียงจุดขอบให้เป็น "วง" ตามลำดับก่อน แล้วค่อยคำนวณทิศพุ่งออก
     * จากเพื่อนบ้านซ้าย-ขวาในวง (ถ้าใช้เกรเดียนต์ของ SDF ตรงๆ ทิศจะกระตุก
     * เพราะจุดขอบจาก marching squares ห่างไม่เท่ากัน -> ผนังเป็นรอยย่น) */
    var nbrs = {};
    function linkB(a, b) {
      (nbrs[a] || (nbrs[a] = [])).push(b);
      (nbrs[b] || (nbrs[b] = [])).push(a);
    }
    for (var bi = 0; bi < boundary.length; bi++) linkB(boundary[bi][0], boundary[bi][1]);

    var loops = [], seenB = {};
    Object.keys(nbrs).forEach(function (startKey) {
      var start = +startKey;
      if (seenB[start]) return;
      var chain = [], cur = start, prev = -1, guard = 0;
      while (cur !== undefined && !seenB[cur] && guard++ < 20000) {
        seenB[cur] = 1; chain.push(cur);
        var list = nbrs[cur] || [], nxt;
        for (var q = 0; q < list.length; q++) {
          if (list[q] !== prev && !seenB[list[q]]) { nxt = list[q]; break; }
        }
        prev = cur; cur = nxt;
      }
      if (chain.length > 8) loops.push(chain);
    });

    var ROWS = 7;
    for (var lp = 0; lp < loops.length; lp++) {
      var chain2 = loops[lp];
      var CL = chain2.length;
      // ทิศพุ่งออกจากเส้นสัมผัส (เพื่อนบ้านหน้า-หลัง) แล้วเกลี่ยให้เรียบ
      var nrm = [];
      for (var ci = 0; ci < CL; ci++) {
        var pA = pts2[chain2[(ci - 1 + CL) % CL]], pB = pts2[chain2[(ci + 1) % CL]];
        var tx = pB[0] - pA[0], tz = pB[1] - pA[1];
        var tl = Math.hypot(tx, tz) || 1;
        nrm.push([tz / tl, -tx / tl]);
      }
      // ให้ทุกเส้นตั้งฉากชี้ออกนอกรูปเหมือนกัน (เช็คด้วย SDF จุดเดียว)
      var probe = 0, votes = 0;
      for (ci = 0; ci < CL; ci += Math.max(1, Math.floor(CL / 24))) {
        var pp = pts2[chain2[ci]];
        votes++;
        if (sdf(pp[0] + nrm[ci][0] * 0.08, pp[1] + nrm[ci][1] * 0.08) > sdf(pp[0], pp[1])) probe++;
      }
      var flip = probe < votes / 2 ? -1 : 1;
      for (var sm = 0; sm < 6; sm++) {   // เกลี่ยทิศตั้งฉาก
        var copy = nrm.map(function (n) { return [n[0], n[1]]; });
        for (ci = 0; ci < CL; ci++) {
          var a3 = copy[(ci - 1 + CL) % CL], b3 = copy[(ci + 1) % CL], c3 = copy[ci];
          var sx2 = a3[0] + b3[0] + c3[0] * 2, sz2 = a3[1] + b3[1] + c3[1] * 2;
          var ll = Math.hypot(sx2, sz2) || 1;
          nrm[ci] = [sx2 / ll, sz2 / ll];
        }
      }

      var wallStart = position.length / 3;
      for (ci = 0; ci < CL; ci++) {
        var vid = chain2[ci];
        var Xw = pts2[vid][0], Zw = pts2[vid][1];
        var nx = nrm[ci][0] * flip, nz = nrm[ci][1] * flip;
        var yTop = topCore(Xw, Zw) - EDGE_R_TOP;
        var yBot = -(botCore(Xw, Zw) - EDGE_R_BOT);
        var tint = 0.95 - 0.09 * gripMask(Xw, Zw);
        for (var r = 0; r <= ROWS; r++) {
          var tt = r / ROWS;
          var bulge = WALL_BULGE * Math.sin(Math.PI * tt);
          pushVert(Xw + nx * bulge, yTop + (yBot - yTop) * tt, Zw + nz * bulge, tint);
        }
      }
      for (ci = 0; ci < CL; ci++) {
        var cA = wallStart + ci * (ROWS + 1);
        var cB = wallStart + ((ci + 1) % CL) * (ROWS + 1);
        for (var rr = 0; rr < ROWS; rr++) {
          index.push(cA + rr, cB + rr, cA + rr + 1);
          index.push(cB + rr, cB + rr + 1, cA + rr + 1);
        }
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setIndex(index);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    geo.computeVertexNormals();
    return geo;
  }

  // ผิวบนอยู่สูงเท่าไรที่พิกัดนี้ (ใช้วางปุ่ม/ทัชแพดให้แนบผิว)
  function topAt(X, Z) { return topCore(X, Z); }

  // ก้านอนาล็อก: หมุนโปรไฟล์รอบแกน y ได้หัวเว้าแบบ DS4
  function buildStickCapGeo(THREE) {
    var p = [];
    p.push(new THREE.Vector2(0.00, 0.00));
    p.push(new THREE.Vector2(0.46, 0.02));
    p.push(new THREE.Vector2(0.50, 0.30));
    p.push(new THREE.Vector2(0.54, 0.62));
    p.push(new THREE.Vector2(0.74, 0.80));
    p.push(new THREE.Vector2(0.96, 0.94));
    p.push(new THREE.Vector2(1.04, 1.06));
    p.push(new THREE.Vector2(1.02, 1.14));   // ขอบบนของฝาครอบ
    p.push(new THREE.Vector2(0.88, 1.10));
    p.push(new THREE.Vector2(0.60, 1.00));   // แอ่งเว้ากลาง
    p.push(new THREE.Vector2(0.30, 0.955));
    p.push(new THREE.Vector2(0.00, 0.95));
    return new THREE.LatheGeometry(p, 40);
  }

  // แป้นทิศทาง (D-pad) รูปกากบาทมุมมน
  function buildDpadGeo(THREE) {
    var arm = 1.31, w = 0.89, r = 0.17;
    var s = new THREE.Shape();
    var a = w / 2;
    s.moveTo(-a, -arm + r);
    s.quadraticCurveTo(-a, -arm, -a + r, -arm);
    s.lineTo(a - r, -arm);
    s.quadraticCurveTo(a, -arm, a, -arm + r);
    s.lineTo(a, -a);
    s.lineTo(arm - r, -a);
    s.quadraticCurveTo(arm, -a, arm, -a + r);
    s.lineTo(arm, a - r);
    s.quadraticCurveTo(arm, a, arm - r, a);
    s.lineTo(a, a);
    s.lineTo(a, arm - r);
    s.quadraticCurveTo(a, arm, a - r, arm);
    s.lineTo(-a + r, arm);
    s.quadraticCurveTo(-a, arm, -a, arm - r);
    s.lineTo(-a, a);
    s.lineTo(-arm + r, a);
    s.quadraticCurveTo(-arm, a, -arm, a - r);
    s.lineTo(-arm, -a + r);
    s.quadraticCurveTo(-arm, -a, -arm + r, -a);
    s.lineTo(-a, -a);
    s.closePath();
    var geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.16, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.09,
      bevelSegments: 3, curveSegments: 6
    });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  // ปุ่มไหล่ L1/R1 — แผ่นมุมมนบางๆ วางแนบขอบไกลของไหล่
  function buildBumperGeo(THREE) {
    var geo = roundedBoxGeo(THREE, 1.99, 0.66, 0.40, 0.24, 0.16);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  // ไกปืน L2/R2 — แผ่นโค้งเว้าอยู่ด้านหลัง/ใต้ปุ่มไหล่ (มองจากบนเห็นแค่นิดเดียว)
  function buildTriggerGeo(THREE) {
    var s = new THREE.Shape();
    s.moveTo(-1.18, -1.05);
    s.bezierCurveTo(-1.30, -0.30, -1.10, 0.52, -0.60, 1.02);
    s.bezierCurveTo(-0.24, 1.34, 0.24, 1.34, 0.60, 1.02);
    s.bezierCurveTo(1.10, 0.52, 1.30, -0.30, 1.18, -1.05);
    s.bezierCurveTo(0.80, -1.36, -0.80, -1.36, -1.18, -1.05);
    s.closePath();
    var geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.3, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.18,
      bevelSegments: 4, curveSegments: 12
    });
    geo.center();
    return geo;
  }

  /* ปุ่มหลัง (rear paddle) — ครีบยาวติดใต้ฝาหลัง ยื่นลงมาให้นิ้วกลาง/นางเกี่ยว
   * ระนาบ XY ของ shape: x = แนวยาวตามตัวจอย, y = ความสูงที่ยื่นพ้นฝาหลังลงมา
   * ค่า height คือระยะยื่น (ซม.) ตามระดับที่ลูกค้าเลือก */
  function buildPaddleGeo(THREE, height) {
    var halfLen = 1.55;
    var s = new THREE.Shape();
    s.moveTo(-halfLen, 0.14);
    s.lineTo(halfLen, 0.14);                                     // ฐานที่แนบฝาหลัง
    s.bezierCurveTo(halfLen + 0.12, -height * 0.35, halfLen * 0.86, -height, halfLen * 0.42, -height);
    s.bezierCurveTo(-halfLen * 0.30, -height, -halfLen * 0.80, -height * 0.72, -halfLen, -height * 0.18);
    s.closePath();
    var geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.62, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14,
      bevelSegments: 3, curveSegments: 14
    });
    geo.center();
    return geo;
  }

  /* ===================================================================
   * 4) พื้นผิว (texture) — ต้องใช้ canvas จึงข้ามไปเมื่อรันบน Node
   * =================================================================== */
  var HAS_DOM = (typeof document !== 'undefined' && !!document.createElement);

  function makeCanvas(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }

  // สัญลักษณ์ปุ่มหน้า △ ○ ✕ ☐ วาดลง canvas แล้วแปะเป็นแผ่นบางบนปุ่ม
  function makeSymbolTexture(THREE, kind) {
    if (!HAS_DOM) return null;
    var S = 160, c = makeCanvas(S), ctx = c.getContext('2d');
    var colors = { triangle: '#4FD8A8', circle: '#F2545B', cross: '#56B8F5', square: '#F07AC0' };
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = colors[kind] || '#ffffff';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var m = S / 2, r = S * 0.27;
    ctx.beginPath();
    if (kind === 'triangle') {
      ctx.moveTo(m, m - r); ctx.lineTo(m + r * 0.92, m + r * 0.62); ctx.lineTo(m - r * 0.92, m + r * 0.62); ctx.closePath();
    } else if (kind === 'circle') {
      ctx.arc(m, m, r * 0.9, 0, Math.PI * 2);
    } else if (kind === 'cross') {
      ctx.moveTo(m - r * 0.78, m - r * 0.78); ctx.lineTo(m + r * 0.78, m + r * 0.78);
      ctx.moveTo(m + r * 0.78, m - r * 0.78); ctx.lineTo(m - r * 0.78, m + r * 0.78);
    } else {
      var q = r * 0.76;
      ctx.rect(m - q, m - q, q * 2, q * 2);
    }
    ctx.stroke();
    var tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  }

  // ลายจุดของทัชแพด + ช่องลำโพง ให้ผิวไม่เรียบโล้น
  function makeDotTexture(THREE, rep) {
    if (!HAS_DOM) return null;
    var S = 64, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1c20'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#33373d';
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.16, 0, Math.PI * 2); ctx.fill();
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rep || 26, rep || 26);
    if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // ฉากสะท้อนแสง (environment) แบบไล่สี ทำให้พลาสติกดูมีเงาวาว
  function makeEnvTexture(THREE) {
    if (!HAS_DOM) return null;
    var W = 512, H = 256;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.00, '#f3f7ff');
    g.addColorStop(0.42, '#9fb0c4');
    g.addColorStop(0.55, '#2b3038');
    g.addColorStop(1.00, '#0a0c0f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // ไฟสตูดิโอ 2 ดวง (ทำให้เกิดไฮไลต์ยาวบนผิวโค้ง)
    function blob(cx, cy, rx, ry, alpha) {
      var rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      rg.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    blob(W * 0.26, H * 0.20, 110, 62, 0.95);
    blob(W * 0.74, H * 0.26, 90, 44, 0.55);
    var tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }

  // เงาใต้ตัวเครื่อง (แผ่นไล่สีแบบวงรี — เบากว่าเงาจริงเยอะ)
  function makeShadowTexture(THREE) {
    if (!HAS_DOM) return null;
    var S = 256, c = makeCanvas(S), ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    return new THREE.CanvasTexture(c);
  }

  /* ===================================================================
   * 5) ประกอบโมเดล + ฟังก์ชันอัปเดตตามตัวเลือกในฟอร์ม
   * =================================================================== */
  /* three.js r149 ยังตั้ง legacyMode = true มาให้ (ตีความค่าสีเป็น linear ตรงๆ)
   * ทำให้สีที่ใส่เป็น hex แบบ sRGB ออกมาซีดจาง — ต้องปิดโหมดเก่าก่อนสร้างวัสดุ
   * เรียกครั้งเดียวพอ และต้องเรียกก่อน new THREE.Color/Material ทุกครั้ง */
  function enableColorManagement(THREE) {
    if (THREE.ColorManagement && THREE.ColorManagement.legacyMode !== false) {
      THREE.ColorManagement.legacyMode = false;
    }
    if (THREE.ColorManagement && 'enabled' in THREE.ColorManagement) {
      THREE.ColorManagement.enabled = true;
    }
  }

  /* ===================================================================
   * 5b) โมเดลจากไฟล์ .glb ของจริง (DualShock 4 โดย shaielwolf, CC BY 4.0)
   * -------------------------------------------------------------------
   * ห่อ scene ที่โหลดมาให้มีหน้าตา API เหมือน createControllerModel()
   * ทุกอย่าง (group / parts / materials / applyState / dispose)
   * ตัวเรียกจึงสลับไปมาได้โดยไม่ต้องรู้ว่าข้างในเป็นโมเดลแบบไหน
   * =================================================================== */
  /* จัดครีบปุ่มหลังให้ "ฐานจมในเปลือกนิดเดียว ปลายยื่นออกมา"
   * buildPaddleGeo() ทำ geo.center() ไว้ ครีบจึงมีจุดกึ่งกลางอยู่ที่ 0
   * ถ้าวางดื้อๆ ครีบครึ่งบนจะจมหายเข้าไปในตัวจอย
   * ฟังก์ชันนี้เลื่อนครีบลงครึ่งความสูง แล้วเผื่อให้ฐานจมไว้ 0.10 ซม. */
  function seatPaddle(THREE, mesh) {
    mesh.geometry.computeBoundingBox();
    var bb = mesh.geometry.boundingBox;
    mesh.position.y = -(bb.max.y) + 0.10;
    return mesh;
  }

  function wrapGlbModel(THREE, prepared) {
    var group = prepared.root;
    var mats = prepared.materials;
    var parts = prepared.parts;
    var tinters = prepared.tinters || null;
    var current = {};

    /* ปุ่มหลัง (rear paddle) — ไฟล์ต้นฉบับไม่มี เพราะเป็นของที่ร้านติดตั้งเอง
     * จึงปั้นเพิ่มด้วยโค้ดแล้ววางบนฝาหลังตรงด้ามจับ */
    var paddleMat = new THREE.MeshPhysicalMaterial({
      color: 0x1E2126, roughness: 0.4, metalness: 0.3, clearcoat: 0.5
    });
    mats.paddle = paddleMat;
    parts.paddles = {};
    [-1, 1].forEach(function (s) {
      var key = s < 0 ? 'left' : 'right';
      var holder = new THREE.Group();
      holder.position.set(s * 5.05, -2.62, 2.05);
      holder.rotation.set(0.05, s * 0.16, s * 0.30);
      holder.visible = false;
      group.add(holder);
      var mesh = new THREE.Mesh(buildPaddleGeo(THREE, PADDLE_HEIGHT.standard), paddleMat);
      mesh.rotation.y = Math.PI / 2;
      holder.add(mesh);
      parts.paddles[key] = { holder: holder, mesh: mesh, height: 'standard' };
    });

    /* ไลต์บาร์ — โมเดลต้นฉบับ "อบ" ไฟไว้ในเทกซ์เจอร์ emissive ของ MAT_2 อยู่แล้ว
     * (เป็นแถบสีน้ำเงินตรงขอบบน) จึงไม่ต้องแปะแท่งเรืองแสงเพิ่ม
     * แค่วาดเทกซ์เจอร์นั้นใหม่เป็นสีของบอร์ด PCB ที่ลูกค้าเลือก */
    var lbMat = mats.shellBack || null;
    if (lbMat) mats.lightbar = lbMat;

    function shellDefLocal(state) {
      var key = state && state.shellColor;
      if (state && state.shell === 'withController') return SHELL_COLORS.__default;
      return (key && SHELL_COLORS[key]) || SHELL_COLORS.__default;
    }

    function applyState(state, instant) {
      state = state || {};
      var def = shellDefLocal(state);
      var tweens = [];
      function setColor(mat, hex, prop) {
        if (!mat) return;
        prop = prop || 'color';
        if (!mat[prop]) return;
        if (instant) { mat[prop].setHex(hex); return; }
        tweens.push({ mat: mat, prop: prop, to: new THREE.Color(hex) });
      }

      /* 1) สีกรอบ — เทกซ์เจอร์ต้นฉบับทาสีดำมา คูณสีทับไม่ขึ้น
       *    จึงต้องวาดเทกซ์เจอร์ใหม่ (ดู makeShellTinter ใน controller-3d-glb.js) */
      var shellHex = { shell: def.body, shellBack: def.grip, shellInner: def.grip };
      if (tinters && tinters.shell) {
        tinters.shell.forEach(function (t) { t.apply(shellHex[t.role] || def.body); });
      }
      Object.keys(shellHex).forEach(function (role) {
        var m = mats[role];
        if (!m) return;
        m.roughness = def.rough;
        m.metalness = def.metal;
        var wantTransparent = !!def.transparent;
        if (m.transparent !== wantTransparent) {
          m.transparent = wantTransparent;
          m.needsUpdate = true;
        }
        m.opacity = wantTransparent ? def.opacity : 1;
      });

      // 2) ก้านอนาล็อก — ย้อมสีตามชนิดโมดูลที่เลือก
      var stickKey = state.stick && STICK_ACCENT[state.stick] ? state.stick : null;
      if (mats.stick) {
        if (tinters && tinters.accent && tinters.accent.stick) {
          // วาดเทกซ์เจอร์ใหม่ (คูณสีทับไม่ขึ้น เพราะต้นฉบับทาดำมา)
          tinters.accent.stick(stickKey ? STICK_ACCENT[stickKey].color : null);
        } else {
          setColor(mats.stick, stickKey ? STICK_ACCENT[stickKey].color : 0x2A2D33);
        }
        mats.stick.metalness = stickKey ? 0.55 : 0.1;
      }

      // 3) Trigger / Face buttons — ชิ้นที่อัปเกรดเป็นสีเน้นของร้าน
      var tf = state.triggerFace;
      var trigUp = (tf === 'clicky' || tf === 'full');
      var faceUp = (tf === 'full');
      if (mats.trigger) {
        if (tinters && tinters.accent && tinters.accent.trigger) {
          tinters.accent.trigger(trigUp ? ACCENT_LIME : null);
        } else {
          setColor(mats.trigger, trigUp ? ACCENT_LIME : 0x24272C);
        }
        mats.trigger.metalness = trigUp ? 0.45 : 0.1;
      }
      if (mats.button) {
        if (tinters && tinters.accent && tinters.accent.button) {
          tinters.accent.button(faceUp ? ACCENT_LIME : null);
        } else {
          setColor(mats.button, faceUp ? ACCENT_LIME : 0x2A2D33);
        }
        mats.button.metalness = faceUp ? 0.4 : 0.1;
      }

      // 4) ปุ่มหลัง — จำนวน / ด้าน / ความสูง
      var count = state.paddles, side = state.paddleSide;
      var h = PADDLE_HEIGHT[state.paddleHeight] || PADDLE_HEIGHT.standard;
      var show = { left: false, right: false };
      if (count === 'two') { show.left = show.right = true; }
      else if (count === 'one') {
        if (side === 'left') show.left = true;
        else if (side === 'right') show.right = true;
      }
      Object.keys(parts.paddles).forEach(function (k) {
        var p = parts.paddles[k];
        p.holder.visible = show[k];
        if (show[k] && p.height !== (state.paddleHeight || 'standard')) {
          p.mesh.geometry.dispose();
          p.mesh.geometry = buildPaddleGeo(THREE, h);
          seatPaddle(THREE, p.mesh);   // ครีบสูงขึ้น/เตี้ยลง ต้องจัดให้แนบผิวใหม่
          p.height = state.paddleHeight || 'standard';
        }
      });

      // 5) Light bar ตามบอร์ด PCB (วาดทับเทกซ์เจอร์ไฟที่อบมากับโมเดล)
      var lb = (state.pcb && PCB_LIGHT[state.pcb]) || PCB_LIGHT.__default;
      if (tinters && tinters.lightbar) tinters.lightbar(lb);
      if (lbMat) lbMat.emissiveIntensity = state.pcb ? 2.2 : 1.0;

      current = state;
      return tweens;
    }

    applyState({}, true);

    return {
      group: group,
      parts: parts,
      materials: mats,
      applyState: applyState,
      isGlb: true,
      getState: function () { return current; },
      dispose: function () {
        group.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            var list = Array.isArray(o.material) ? o.material : [o.material];
            list.forEach(function (m) {
              Object.keys(m).forEach(function (k) {
                var v = m[k];
                if (v && v.isTexture) v.dispose();
              });
              m.dispose();
            });
          }
        });
      }
    };
  }

  function createControllerModel(THREE, opts) {
    opts = opts || {};
    enableColorManagement(THREE);
    var group = new THREE.Group();
    var mats = {};
    var parts = {};

    function physical(cfg) {
      var m = new THREE.MeshPhysicalMaterial(cfg);
      return m;
    }

    // ---- วัสดุหลัก ----
    mats.shell = physical({
      color: SHELL_COLORS.__default.body, roughness: 0.46, metalness: 0.08,
      clearcoat: 0.55, clearcoatRoughness: 0.28
    });
    mats.dark = physical({ color: 0x16181C, roughness: 0.55, metalness: 0.15, clearcoat: 0.3 });
    mats.rubber = physical({ color: 0x1A1C20, roughness: 0.85, metalness: 0.02 });
    mats.button = physical({ color: 0x2A2D33, roughness: 0.35, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    mats.trigger = physical({ color: 0x24272C, roughness: 0.42, metalness: 0.1, clearcoat: 0.4 });
    mats.stickRing = physical({ color: STICK_ACCENT.alps.color, roughness: 0.3, metalness: 0.7, clearcoat: 0.6 });
    mats.paddle = physical({ color: 0x1E2126, roughness: 0.4, metalness: 0.3, clearcoat: 0.5 });
    mats.touchpad = physical({
      color: 0x202329, roughness: 0.28, metalness: 0.12, clearcoat: 0.9, clearcoatRoughness: 0.12
    });
    mats.lightbar = new THREE.MeshStandardMaterial({
      color: 0x0b0d10, emissive: PCB_LIGHT.__default, emissiveIntensity: 2.6, roughness: 0.25
    });

    var dotTex = makeDotTexture(THREE, 30);
    if (dotTex) { mats.touchpad.roughnessMap = dotTex; mats.touchpad.roughness = 0.42; }

    function add(geo, mat, pos, rot, name) {
      var mesh = new THREE.Mesh(geo, mat);
      if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
      if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
      if (name) { mesh.name = name; parts[name] = mesh; }
      group.add(mesh);
      return mesh;
    }

    // ---- ตัวเครื่อง (ก้อนเดียวรวมด้ามจับ) ----
    mats.shell.vertexColors = true;   // ใช้ไล่เฉดให้ด้ามจับเข้มกว่าตัวเครื่องนิดหน่อย
    add(buildBodySolid(THREE), mats.shell, null, null, 'body');

    // ---- ทัชแพด (แผ่นดำเงาบนกลางค่อนไปด้านไกล) ----
    var tpZ = -3.05;
    var tpGeo = new THREE.ExtrudeGeometry(roundedRectShape(THREE, 5.36, 2.58, 0.32), {
      depth: 0.14, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07,
      bevelSegments: 3, curveSegments: 10
    });
    tpGeo.rotateX(-Math.PI / 2);
    add(tpGeo, mats.touchpad, [0, topAt(0, tpZ) + 0.05, tpZ], null, 'touchpad');

    // ---- Light Bar (ขอบไกลสุด เหนือทัชแพด) ----
    var lbGeo = roundedBoxGeo(THREE, 5.08, 0.38, 0.24, 0.12, 0.08);
    add(lbGeo, mats.lightbar, [0, topAt(0, -4.45) - 0.17, -4.60], [-0.58, 0, 0], 'lightbar');

    // ---- ปุ่มไหล่ L1/R1 + ไกปืน L2/R2 ----
    // ต้องอยู่ในเงาไหล่: ที่ z=-4.6 ตัวเครื่องกว้างถึง |x|~7.0 เท่านั้น
    // (ถ้าดันออกไปกว่านี้ มุมปุ่มจะโผล่พ้นขอบกรอบเวลามองจากด้านบน)
    var bumpZ = -4.80, bumpX = 4.94;
    add(buildBumperGeo(THREE), mats.trigger, [-bumpX, topAt(-bumpX, bumpZ) + 0.01, bumpZ], [0.42, 0.10, 0], 'bumperL');
    add(buildBumperGeo(THREE), mats.trigger, [bumpX, topAt(bumpX, bumpZ) + 0.01, bumpZ], [0.42, -0.10, 0], 'bumperR');
    add(buildTriggerGeo(THREE), mats.trigger, [-4.93, -0.34, -4.66], [-1.16, 0.16, 0], 'triggerL');
    add(buildTriggerGeo(THREE), mats.trigger, [4.93, -0.34, -4.66], [-1.16, -0.16, 0], 'triggerR');

    // ---- D-pad ----
    var dpadX = -5.07, dpadZ = -2.33;
    var dpadBase = new THREE.CylinderGeometry(1.82, 1.88, 0.16, 36);
    add(dpadBase, mats.dark, [dpadX, topAt(dpadX, dpadZ) - 0.02, dpadZ], null, 'dpadBase');
    add(buildDpadGeo(THREE), mats.button, [dpadX, topAt(dpadX, dpadZ) + 0.03, dpadZ], null, 'dpad');

    // ---- ปุ่มหน้า 4 ปุ่ม ----
    var faceCx = 5.09, faceCz = -2.33, faceOff = 1.18;
    // แอ่งวงกลมรอบปุ่มหน้า (เส้นผ่านศูนย์กลาง 3.76 ซม. เท่ากับฝั่ง D-pad)
    add(new THREE.CylinderGeometry(1.82, 1.88, 0.16, 36), mats.dark,
        [faceCx, topAt(faceCx, faceCz) - 0.02, faceCz], null, 'faceBase');
    var btnGeo = new THREE.CylinderGeometry(0.505, 0.49, 0.3, 30);
    var btnDefs = [
      ['btnTriangle', faceCx, faceCz - faceOff, 'triangle'],
      ['btnCircle', faceCx + faceOff, faceCz, 'circle'],
      ['btnCross', faceCx, faceCz + faceOff, 'cross'],
      ['btnSquare', faceCx - faceOff, faceCz, 'square']
    ];
    parts.faceSymbols = [];
    btnDefs.forEach(function (d) {
      var by = topAt(d[1], d[2]) + 0.06;
      add(btnGeo, mats.button, [d[1], by, d[2]], null, d[0]);
      var tex = makeSymbolTexture(THREE, d[3]);
      if (tex) {
        var symMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
        var sym = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.74), symMat);
        sym.rotation.x = -Math.PI / 2;
        sym.position.set(d[1], by + 0.17, d[2]);
        sym.renderOrder = 2;
        group.add(sym);
        parts.faceSymbols.push(sym);
      }
    });

    // ---- ก้านอนาล็อกซ้าย/ขวา ----
    var stickX = 2.59, stickZ = -0.14;
    var stickY = topAt(stickX, stickZ);
    var capGeo = buildStickCapGeo(THREE);
    var wellGeo = new THREE.CylinderGeometry(1.38, 1.45, 0.22, 34);
    var ringGeo = new THREE.TorusGeometry(0.95, 0.07, 12, 40);
    parts.stickRings = [];
    [-1, 1].forEach(function (s, idx) {
      add(wellGeo, mats.dark, [s * stickX, stickY - 0.06, stickZ], null, 'stickWell' + idx);
      add(capGeo, mats.rubber, [s * stickX, stickY - 0.02, stickZ], null, 'stick' + idx);
      var ring = add(ringGeo, mats.stickRing, [s * stickX, stickY + 1.10, stickZ], [Math.PI / 2, 0, 0], 'stickRing' + idx);
      parts.stickRings.push(ring);
    });

    // ---- ปุ่ม PS + ลำโพง + Share/Options ----
    var psGeo = new THREE.CylinderGeometry(0.405, 0.405, 0.14, 24);
    add(psGeo, mats.dark, [0, topAt(0, -0.01) + 0.02, -0.01], null, 'psButton');
    var spkGeo = roundedBoxGeo(THREE, 1.29, 0.57, 0.1, 0.2, 0.04);
    spkGeo.rotateX(-Math.PI / 2);
    add(spkGeo, mats.dark, [0, topAt(0, -0.96) + 0.01, -0.96], null, 'speaker');
    var smallGeo = roundedBoxGeo(THREE, 0.52, 0.91, 0.16, 0.16, 0.06);
    smallGeo.rotateX(-Math.PI / 2);
    add(smallGeo, mats.button, [-3.28, topAt(-3.28, -3.89) + 0.02, -3.89], null, 'share');
    add(smallGeo, mats.button, [3.28, topAt(3.28, -3.89) + 0.02, -3.89], null, 'options');

    /* ---- ปุ่มหลัง (ซ่อนไว้ก่อน จะโผล่เมื่อลูกค้าเลือก) ----
     * วางใต้ฝาหลังตรงกลางด้ามจับ: ช่วง x ~ 4.2-5.6, z ~ 1.0-2.6
     * ผิวล่างแถวนั้นอยู่ราว y = -3.3 -> ยกครีบขึ้นไปแตะที่ -3.15
     * ต้องอยู่ในเงาด้ามจับทั้งหมด ไม่งั้นมองจากด้านบนจะเห็นครีบโผล่ออกมาข้างๆ */
    parts.paddles = {};
    [-1, 1].forEach(function (s) {
      var key = s < 0 ? 'left' : 'right';
      var holder = new THREE.Group();
      /* วางแนบผิวฝาหลังด้ามจับ ตรงที่นิ้วกลาง/นางพาดพอดี
       * วัดจากโมเดลจริง: ผิวฝาหลังแถวนี้อยู่ราว y = -3.42
       * (ท้องด้ามขวาลึกสุดที่ x 5.98, y -3.51, z 3.20)
       * จุดหมุนของ holder = "ผิวเปลือก" ส่วนตัวครีบจะถูกเลื่อนลงให้ฐานจมพอดี */
      holder.position.set(s * 6.36, -3.51, 3.23);
      holder.rotation.set(0.05, s * 0.16, s * 0.30);
      holder.visible = false;
      group.add(holder);
      var mesh = new THREE.Mesh(buildPaddleGeo(THREE, PADDLE_HEIGHT.standard), mats.paddle);
      mesh.rotation.y = Math.PI / 2;   // แนวยาวของครีบหันไปตามแกน z
      seatPaddle(THREE, mesh);
      holder.add(mesh);
      parts.paddles[key] = { holder: holder, mesh: mesh, height: 'standard' };
    });

    /* ---------------- อัปเดตตามตัวเลือก ---------------- */
    var current = {};

    function shellDef(state) {
      if (state.shell === 'noController' && state.shellColor && SHELL_COLORS[state.shellColor]) {
        return SHELL_COLORS[state.shellColor];
      }
      return SHELL_COLORS.__default;
    }

    function applyState(state, instant) {
      state = state || {};
      var def = shellDef(state);
      var tweens = [];

      function setColor(mat, hex, prop) {
        prop = prop || 'color';
        if (instant) { mat[prop].setHex(hex); return; }
        tweens.push({ mat: mat, prop: prop, to: new THREE.Color(hex) });
      }

      // 1) สีกรอบ (ตัวเครื่องเป็นก้อนเดียว ด้ามจับเข้มกว่าด้วย vertex color ในตัว)
      setColor(mats.shell, def.body);
      mats.shell.roughness = def.rough;
      mats.shell.metalness = def.metal;
      var wantTransparent = !!def.transparent;
      if (mats.shell.transparent !== wantTransparent) {
        mats.shell.transparent = wantTransparent;
        mats.shell.needsUpdate = true;
      }
      mats.shell.opacity = wantTransparent ? def.opacity : 1;

      // 2) ก้านอนาล็อก — วงแหวนเปลี่ยนสีตามชนิดโมดูล
      var stickKey = state.stick && STICK_ACCENT[state.stick] ? state.stick : null;
      setColor(mats.stickRing, stickKey ? STICK_ACCENT[stickKey].color : 0x4A4F57);
      mats.stickRing.metalness = stickKey ? 0.75 : 0.4;
      parts.stickRings.forEach(function (r) { r.visible = !!stickKey; });

      // 3) Trigger / Face buttons — ชิ้นที่อัปเกรดจะเป็นสีเน้นของร้าน
      var tf = state.triggerFace;
      var trigUp = (tf === 'clicky' || tf === 'full');
      var faceUp = (tf === 'full');
      setColor(mats.trigger, trigUp ? ACCENT_LIME : 0x24272C);
      mats.trigger.metalness = trigUp ? 0.45 : 0.1;
      setColor(mats.trigger, trigUp ? ACCENT_LIME : 0x24272C, 'emissive');
      mats.trigger.emissiveIntensity = trigUp ? 0.16 : 0;
      setColor(mats.button, faceUp ? ACCENT_LIME : 0x2A2D33);
      mats.button.metalness = faceUp ? 0.4 : 0.1;
      setColor(mats.button, faceUp ? ACCENT_LIME : 0x000000, 'emissive');
      mats.button.emissiveIntensity = faceUp ? 0.14 : 0;

      // 4) ปุ่มหลัง — จำนวน/ด้าน/ความสูง
      var count = state.paddles;
      var side = state.paddleSide;
      var h = PADDLE_HEIGHT[state.paddleHeight] || PADDLE_HEIGHT.standard;
      var show = { left: false, right: false };
      if (count === 'two') { show.left = show.right = true; }
      else if (count === 'one') {
        if (side === 'left') show.left = true;
        else if (side === 'right') show.right = true;
        else { show.left = show.right = false; }
      }
      Object.keys(parts.paddles).forEach(function (k) {
        var p = parts.paddles[k];
        p.holder.visible = show[k];
        if (show[k] && p.height !== (state.paddleHeight || 'standard')) {
          p.mesh.geometry.dispose();
          p.mesh.geometry = buildPaddleGeo(THREE, h);
          p.height = state.paddleHeight || 'standard';
        }
      });

      // 5) Light bar ตามบอร์ด PCB
      var lb = (state.pcb && PCB_LIGHT[state.pcb]) || PCB_LIGHT.__default;
      setColor(mats.lightbar, lb, 'emissive');
      mats.lightbar.emissiveIntensity = state.pcb ? 3.1 : 1.4;

      current = state;
      return tweens;
    }

    applyState({}, true);

    return {
      group: group,
      parts: parts,
      materials: mats,
      applyState: applyState,
      getState: function () { return current; },
      dispose: function () {
        group.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            var list = Array.isArray(o.material) ? o.material : [o.material];
            list.forEach(function (m) {
              Object.keys(m).forEach(function (k) {
                var v = m[k];
                if (v && v.isTexture) v.dispose();
              });
              m.dispose();
            });
          }
        });
      }
    };
  }

  /* ===================================================================
   * 6) ตัวแสดงผล (viewer) — ใช้บนเบราว์เซอร์เท่านั้น
   * =================================================================== */

  var VIEWS = {
    hero:  { theta: 0.42, phi: 0.92, dist: 27.5 },
    front: { theta: 0.00, phi: 1.02, dist: 25.5 },
    top:   { theta: 0.00, phi: 0.26, dist: 25.5 },
    // "ปุ่มหลัง" = พลิกดูใต้เครื่อง เพราะเป็นมุมเดียวที่เห็นปุ่มหลัง (จุดขายหลักของร้าน)
    back:  { theta: 0.30, phi: 2.24, dist: 27.0 },
    side:  { theta: 1.28, phi: 1.05, dist: 26.5 }
  };

  function isWebGLAvailable() {
    if (typeof window === 'undefined') return false;
    try {
      var canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  // โหลด three.js แบบ lazy (ไฟล์ในเครื่องก่อน ถ้าไม่มีค่อยไป CDN)
  var threeLoading = null;
  function loadThree(sources) {
    if (typeof window !== 'undefined' && window.THREE) return Promise.resolve(window.THREE);
    if (threeLoading) return threeLoading;
    var list = sources && sources.length ? sources.slice() : [
      'vendor/three.min.js',
      'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js',
      'https://unpkg.com/three@0.149.0/build/three.min.js'
    ];
    threeLoading = new Promise(function (resolve, reject) {
      (function next(i) {
        if (i >= list.length) { reject(new Error('โหลด three.js ไม่สำเร็จ')); return; }
        var s = document.createElement('script');
        s.src = list[i];
        s.async = true;
        s.onload = function () {
          if (window.THREE) resolve(window.THREE); else next(i + 1);
        };
        s.onerror = function () { s.remove(); next(i + 1); };
        document.head.appendChild(s);
      })(0);
    });
    return threeLoading;
  }

  function createViewer(container, options) {
    options = options || {};
    var api = {
      ready: false, failed: false, el: container,
      setState: function (s) { pending = s; },
      setView: function () {}, dispose: function () {},
      onReady: options.onReady || null
    };
    var pending = options.state || {};

    if (!isWebGLAvailable()) {
      api.failed = true;
      if (options.onFail) options.onFail(new Error('อุปกรณ์นี้ไม่รองรับ WebGL'));
      return api;
    }

    /* โหลดแบบ lazy: ไฟล์โมเดลใหญ่ ~6.8MB + three.js อีก 0.6MB
     * ถ้าโหลดตั้งแต่เปิดหน้าแรก คนที่ไม่ได้เข้าหน้าสั่งทำจะเสียเน็ตฟรี
     * จึงรอจนกล่องพรีวิว "ถูกมองเห็นจริง" ก่อนค่อยเริ่มโหลด */
    var visibilityWatcher = null;
    function begin() {
      loadThree(options.threeSources).then(function (THREE) {
        setup(THREE);
      }).catch(function (err) {
        api.failed = true;
        if (options.onFail) options.onFail(err);
      });
    }

    if (options.lazy === false || typeof IntersectionObserver === 'undefined') {
      begin();
    } else {
      visibilityWatcher = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            visibilityWatcher.disconnect();
            visibilityWatcher = null;
            begin();
            return;
          }
        }
      }, { rootMargin: '250px' });
      visibilityWatcher.observe(container);
    }

    // ถ้าโดน dispose ก่อนจะเริ่มโหลด ต้องเลิกเฝ้าด้วย
    api.dispose = function () {
      if (visibilityWatcher) { visibilityWatcher.disconnect(); visibilityWatcher = null; }
    };

    function setup(THREE) {
      enableColorManagement(THREE);
      var width = container.clientWidth || 320;
      var height = container.clientHeight || 300;

      var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'pan-y';
      renderer.domElement.setAttribute('aria-label', 'โมเดลคอนโทรลเลอร์ 3 มิติ — ลากเพื่อหมุน');
      container.appendChild(renderer.domElement);

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(30, width / height, 0.5, 400);

      // แสง: ไล่จากไฟหลัก + ไฟเติมเย็น + ไฟขอบสีเน้นของเว็บ
      scene.add(new THREE.HemisphereLight(0xffffff, 0x101408, 0.55));
      var key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(6, 11, 8); scene.add(key);
      var fill = new THREE.DirectionalLight(0xbcd2ff, 0.85); fill.position.set(-8, 4, 6); scene.add(fill);
      var rim = new THREE.DirectionalLight(0xC6FF00, 1.15); rim.position.set(-3, 5, -10); scene.add(rim);
      var under = new THREE.DirectionalLight(0xffffff, 0.28); under.position.set(0, -8, 3); scene.add(under);

      // environment map ให้ผิวพลาสติกมีเงาสะท้อน
      var envTex = makeEnvTexture(THREE);
      var pmrem = null;
      if (envTex) {
        pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        scene.environment = pmrem.fromEquirectangular(envTex).texture;
        envTex.dispose();
      }

      /* โมเดล: ใช้ไฟล์ DS4 ของจริงก่อน (models/ds4.glb)
       * ถ้าโหลดไม่ได้ (ไฟล์หาย / เน็ตพัง) ค่อยตกไปใช้โมเดลที่ปั้นด้วยโค้ด
       * ลูกค้าจะยังเห็นพรีวิวเสมอ ไม่มีทางเจอกล่องว่าง */
      var model = null;
      var pivot = new THREE.Group();
      scene.add(pivot);
      var dirty = true;   // ประกาศไว้ก่อน installModel จะได้สั่งวาดใหม่ได้

      function installModel(m) {
        if (model) { pivot.remove(model.group); model.dispose(); }
        model = m;
        pivot.add(model.group);
        if (pending) model.applyState(pending, true);
        dirty = true;
      }

      installModel(createControllerModel(THREE, {}));

      var glbLib = (typeof root !== 'undefined' && root.MosuDS4Model) ||
                   (typeof window !== 'undefined' && window.MosuDS4Model) || null;
      if (glbLib && options.useGlb !== false) {
        glbLib.load(THREE, {
          url: options.modelUrl || 'models/ds4.glb?v=3',
          loaderSources: options.loaderSources
        }).then(function (prepared) {
          installModel(wrapGlbModel(THREE, prepared));
          if (options.onModelUpgrade) options.onModelUpgrade('glb');
        }).catch(function (err) {
          // เงียบไว้ — โมเดลที่ปั้นด้วยโค้ดยังแสดงอยู่แล้ว
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[3D] ใช้โมเดลสำรอง (โหลด .glb ไม่สำเร็จ):', err && err.message);
          }
        });
      }

      // เงาใต้เครื่อง
      var shadowTex = makeShadowTexture(THREE);
      if (shadowTex) {
        var shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(26, 20),
          new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.5, depthWrite: false })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(0, -3.65, 0.6);
        shadow.renderOrder = -1;
        scene.add(shadow);
      }

      /* ---------- กล้อง / การหมุน ---------- */
      var view = { theta: VIEWS.hero.theta, phi: VIEWS.hero.phi, dist: VIEWS.hero.dist };
      var target = { theta: view.theta, phi: view.phi, dist: view.dist };
      var autoRotate = options.autoRotate !== false;
      var engaged = false;
      var tweens = [];
      var lookAt = new THREE.Vector3(0, -0.25, 0);

      function clampPhi(p) { return Math.max(0.18, Math.min(Math.PI - 0.42, p)); }

      function applyCamera() {
        var st = Math.sin(view.phi) * view.dist;
        camera.position.set(
          st * Math.sin(view.theta),
          Math.cos(view.phi) * view.dist,
          st * Math.cos(view.theta)
        );
        camera.lookAt(lookAt);
      }

      function setView(name, immediate) {
        var v = VIEWS[name] || VIEWS.hero;
        // เลือกทิศหมุนที่สั้นที่สุด
        var t = v.theta;
        while (t - view.theta > Math.PI) t -= Math.PI * 2;
        while (view.theta - t > Math.PI) t += Math.PI * 2;
        target.theta = t; target.phi = v.phi; target.dist = v.dist;
        if (immediate) { view.theta = t; view.phi = v.phi; view.dist = v.dist; }
        autoRotate = false;
        dirty = true;
        if (options.onViewChange) options.onViewChange(name);
      }
      api.setView = setView;
      api.getViewName = function () { return currentViewName; };
      var currentViewName = 'hero';

      /* ---------- อินพุต: ลากหมุน / ปัดนิ้ว / ซูม ---------- */
      var dragging = false, lastX = 0, lastY = 0, pointers = {};
      var pinchDist = 0;
      var el = renderer.domElement;

      function onDown(e) {
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        var ids = Object.keys(pointers);
        if (ids.length === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
        else if (ids.length === 2) {
          dragging = false;
          pinchDist = pointerDistance();
        }
        engage();
      }
      function pointerDistance() {
        var ids = Object.keys(pointers);
        if (ids.length < 2) return 0;
        var a = pointers[ids[0]], b = pointers[ids[1]];
        return Math.hypot(a.x - b.x, a.y - b.y);
      }
      function onMove(e) {
        if (!pointers[e.pointerId]) return;
        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        var ids = Object.keys(pointers);
        if (ids.length >= 2) {
          var d = pointerDistance();
          if (pinchDist > 0 && d > 0) {
            target.dist = Math.max(15, Math.min(46, target.dist * (pinchDist / d)));
            view.dist = target.dist;
            dirty = true;
          }
          pinchDist = d;
          e.preventDefault();
          return;
        }
        if (!dragging) return;
        var dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        target.theta -= dx * 0.0095;
        target.phi = clampPhi(target.phi - dy * 0.0075);
        view.theta = target.theta; view.phi = target.phi;
        autoRotate = false;
        dirty = true;
        if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();
      }
      function onUp(e) {
        delete pointers[e.pointerId];
        if (Object.keys(pointers).length < 2) pinchDist = 0;
        if (Object.keys(pointers).length === 0) dragging = false;
      }
      function engage() {
        if (engaged) return;
        engaged = true;
        container.classList.add('is-engaged');
        if (options.onEngage) options.onEngage();
      }

      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove, { passive: false });
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('pointerleave', onUp);

      // ล้อเมาส์ซูมได้ "หลังคลิกที่โมเดลแล้ว" เท่านั้น — กันหน้าเว็บเลื่อนค้างโดยไม่ตั้งใจ
      function onWheel(e) {
        if (!engaged) return;
        e.preventDefault();
        target.dist = Math.max(15, Math.min(46, target.dist + e.deltaY * 0.022));
        dirty = true;
      }
      el.addEventListener('wheel', onWheel, { passive: false });

      /* ---------- ลูปวาดภาพ ---------- */
      var visible = true, running = true, lastT = 0;
      var io = null;
      if (typeof IntersectionObserver !== 'undefined') {
        io = new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
        }, { rootMargin: '120px' });
        io.observe(container);
      }

      function tween(dt) {
        if (!tweens.length) return;
        var still = [];
        for (var i = 0; i < tweens.length; i++) {
          var t = tweens[i];
          t.t = Math.min(1, (t.t || 0) + dt * 3.4);
          t.mat[t.prop].lerpColors(t.from, t.to, t.t);
          if (t.t < 1) still.push(t);
        }
        tweens = still;
        dirty = true;
      }

      function frame(now) {
        if (!running) return;
        requestAnimationFrame(frame);
        var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
        lastT = now;
        if (!visible || document.hidden) return;

        if (autoRotate) { target.theta += dt * 0.26; view.theta = target.theta; dirty = true; }

        // ไล่กล้องเข้าหาเป้าหมายแบบนุ่มๆ
        var dTheta = target.theta - view.theta, dPhi = target.phi - view.phi, dDist = target.dist - view.dist;
        if (Math.abs(dTheta) > 0.0005 || Math.abs(dPhi) > 0.0005 || Math.abs(dDist) > 0.002) {
          var k = 1 - Math.pow(0.0016, dt);
          view.theta += dTheta * k; view.phi += dPhi * k; view.dist += dDist * k;
          dirty = true;
        }
        tween(dt);

        if (dirty) {
          applyCamera();
          renderer.render(scene, camera);
          dirty = false;
        }
      }

      /* ---------- ปรับขนาดตามกล่อง ---------- */
      function resize() {
        var w = container.clientWidth || width, h = container.clientHeight || height;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        dirty = true;
      }
      var ro = null;
      if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(resize); ro.observe(container); }
      else { window.addEventListener('resize', resize); }

      /* ---------- API ---------- */
      api.setState = function (state) {
        var list = model.applyState(state || {});
        list.forEach(function (t) {
          t.from = t.mat[t.prop].clone();
          t.t = 0;
          tweens.push(t);
        });
        dirty = true;
      };
      api.setAutoRotate = function (on) { autoRotate = !!on; dirty = true; };
      api.isAutoRotate = function () { return autoRotate; };
      api.zoom = function (delta) {
        target.dist = Math.max(15, Math.min(46, target.dist + delta));
        engage(); dirty = true;
      };
      api.snapshot = function () { applyCamera(); renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); };
      api.dispose = function () {
        running = false;
        if (io) io.disconnect();
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        el.removeEventListener('wheel', onWheel);
        model.dispose();
        if (pmrem) pmrem.dispose();
        renderer.dispose();
        if (el.parentNode) el.parentNode.removeChild(el);
      };
      api.setViewName = function (n) { currentViewName = n; };
      api.ready = true;

      api.setState(pending);
      applyCamera();
      requestAnimationFrame(frame);
      if (options.onReady) options.onReady(api);
    }

    return api;
  }

  return {
    createViewer: createViewer,
    createControllerModel: createControllerModel,
    isWebGLAvailable: isWebGLAvailable,
    loadThree: loadThree,
    SHELL_COLORS: SHELL_COLORS,
    STICK_ACCENT: STICK_ACCENT,
    VIEWS: VIEWS
  };
});
