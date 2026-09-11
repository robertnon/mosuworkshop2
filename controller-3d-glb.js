/* =====================================================================
 * controller-3d-glb.js — ตัวโหลดโมเดล DualShock 4 ของจริง (ไฟล์ .glb)
 * ---------------------------------------------------------------------
 * ใช้โมเดล "DualShock 4 PlayStation Controller" โดย shaielwolf (CC BY 4.0)
 * https://sketchfab.com/3d-models/dualshock-4-playstation-controller-e3c2f0dc16524fc19cdde45bad1de1a9
 *
 * ไฟล์นี้ทำ 2 หน้าที่
 *   1) โหลด models/ds4.glb แล้วจัดแกน/สเกล/แยกชิ้นส่วนให้พร้อมใช้
 *   2) "ย้อมสีเชลล์" — เรื่องนี้สำคัญ อ่านคำอธิบายด้านล่าง
 *
 * ทำไมย้อมสีตรงๆ ไม่ได้:
 *   เทกซ์เจอร์ของโมเดลต้นฉบับ "ทาสีดำ" มาแล้ว (ค่าความสว่างเกือบ 0)
 *   three.js เอา material.color ไป "คูณ" กับเทกซ์เจอร์ -> ดำ x ขาว = ดำ
 *   ต่อให้ตั้งสีขาวก็ยังได้จอยสีดำ ลูกค้าจะไม่เห็นสีที่เลือกเลย
 *
 * วิธีที่ใช้จริง:
 *   วาดเทกซ์เจอร์เดิมลง canvas แล้วสร้างเทกซ์เจอร์ใหม่ทีละพิกเซล
 *   - พิกเซลที่เป็น "เนื้อสีดำ" (สว่างน้อย)  -> เปลี่ยนเป็นสีที่ลูกค้าเลือก
 *   - พิกเซลที่เป็นตัวหนังสือ/ขีดสีขาว      -> คงไว้เป็นสีขาวเหมือนเดิม
 *   ผลคือได้เชลล์สีจริง แต่ยังมีคำว่า SHARE / OPTIONS / EXT ครบเหมือนของจริง
 *
 * โครงสร้างโมเดล (ตรวจด้วย tools/glb-inspect.py):
 *   MAT_1 -> เชลล์ฝาบน (หน้าจอย)        <- ย้อมสี
 *   MAT_2 -> เชลล์ฝาล่าง + ขอบไลต์บาร์   <- ย้อมสี + มีไฟไลต์บาร์อบมาในตัว
 *   MAT_8 -> ฝาหลัง/ช่องแบต             <- ย้อมสี
 *   MAT_7 -> ลำโพง   MAT_6 -> l1 l2 r1 r2
 *   MAT_5 -> ปุ่มหน้า/D-pad   MAT_4 -> ก้านอนาล็อก   MAT_3 -> ทัชแพด
 *
 * แกนต้นฉบับเป็น Z-up ต้องหมุน -90° รอบ X ให้เป็น Y-up ตามระบบของเว็บ
 * ===================================================================== */
(function (root, factory) {
  'use strict';
  var lib = factory();
  if (typeof module === 'object' && module.exports) { module.exports = lib; }
  if (root) { root.MosuDS4Model = lib; }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var TARGET_WIDTH_CM = 16.2;   // ความกว้างจริงของ DS4

  var MAT_ROLE = {
    MAT_1: 'shell',      // ฝาบน
    MAT_2: 'shellBack',  // ฝาล่าง (มี emissive ไลต์บาร์)
    MAT_8: 'shellInner', // ฝาหลัง
    MAT_7: 'speaker',
    MAT_6: 'trigger',
    MAT_5: 'button',
    MAT_4: 'stick',
    MAT_3: 'touchpad'
  };

  // กลุ่มวัสดุที่ถือว่าเป็น "เชลล์" และต้องเปลี่ยนสีตามที่ลูกค้าเลือก
  var SHELL_ROLES = ['shell', 'shellBack', 'shellInner'];

  var FACE_BUTTONS = ['Triangle', 'Circle', 'Cross', 'Square'];
  var TRIGGER_MESHES = ['l1', 'l2', 'r1', 'r2'];

  var loaderPromise = null;

  function loadGLTFLoader(THREE, sources) {
    if (THREE.GLTFLoader) return Promise.resolve(THREE.GLTFLoader);
    if (loaderPromise) return loaderPromise;
    var list = (sources && sources.length) ? sources.slice() : ['vendor/GLTFLoader.js'];
    loaderPromise = new Promise(function (resolve, reject) {
      (function next(i) {
        if (i >= list.length) { reject(new Error('โหลด GLTFLoader ไม่สำเร็จ')); return; }
        var s = document.createElement('script');
        s.src = list[i]; s.async = true;
        s.onload = function () { if (THREE.GLTFLoader) resolve(THREE.GLTFLoader); else next(i + 1); };
        s.onerror = function () { s.remove(); next(i + 1); };
        document.head.appendChild(s);
      })(0);
    });
    return loaderPromise;
  }

  /* ---------------------------------------------------------------
   * ส่วนย้อมสีเทกซ์เจอร์ (ทำงานบนเบราว์เซอร์เท่านั้น ต้องมี canvas)
   * --------------------------------------------------------------- */

  function smoothstep(e0, e1, x) {
    var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  // อ่านพิกเซลของเทกซ์เจอร์ต้นฉบับออกมาเก็บไว้ (ทำครั้งเดียวแล้ว cache)
  function readPixels(image) {
    var w = image.width, h = image.height;
    if (!w || !h) return null;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, w, h);
    try { return ctx.getImageData(0, 0, w, h); }
    catch (e) { return null; }   // canvas โดน taint (ไม่น่าเกิด เพราะโหลดจาก origin เดียวกัน)
  }

  /* สร้างตารางแปลงสี 256 ช่อง: ความสว่างเดิม -> สีใหม่
   * - สว่างน้อย (เนื้อสีที่ทาไว้) -> สีที่ลูกค้าเลือก (ไล่เฉดตามความสว่างเดิมนิดหน่อย
   *   เพื่อให้ยังเห็นมิติของผิว ไม่แบนเป็นสีเดียว)
   * - สว่างมาก (ตัวหนังสือ SHARE/OPTIONS, ขีดขาว, พื้นที่ UV ที่ไม่ได้ใช้) -> คงความขาว */
  function buildLut(hex, vivid) {
    var tr = (hex >> 16) & 255, tg = (hex >> 8) & 255, tb = hex & 255;
    /* จุดที่เริ่ม "กลายเป็นสีขาว"
     *  - เชลล์ (vivid=false): เริ่มไวหน่อย เพราะต้องเก็บตัวหนังสือ
     *    SHARE / OPTIONS / EXT และขีดขาวบนฝาหลังไว้ให้อ่านออก
     *  - ชิ้นเน้นสีอย่างก้านอนาล็อก/ปุ่ม (vivid=true): เริ่มช้ากว่ามาก
     *    ไม่งั้นสีจะจางเป็นพาสเทล ลูกค้าดูไม่ออกว่าเลือกอะไรไป */
    var e0 = vivid ? 0.62 : 0.10;
    var e1 = vivid ? 0.88 : 0.45;
    var lut = new Uint8Array(768);
    for (var L = 0; L < 256; L++) {
      var x = L / 255;
      var shade = vivid
        ? 0.42 + 0.38 * Math.min(x / 0.45, 1)   // ชิ้นเน้นสี: กดให้เข้ม สีจะได้ไม่ซีด
        : 0.85 + 0.30 * Math.min(x / 0.25, 1);  // เชลล์: คงมิติของผิวเดิมไว้
      var t = smoothstep(e0, e1, x);
      lut[L * 3]     = Math.min(255, tr * shade * (1 - t) + 255 * t);
      lut[L * 3 + 1] = Math.min(255, tg * shade * (1 - t) + 255 * t);
      lut[L * 3 + 2] = Math.min(255, tb * shade * (1 - t) + 255 * t);
    }
    return lut;
  }

  // คัดลอกค่าตั้งต้นของเทกซ์เจอร์เดิม (flipY / wrap / color space) มาให้ครบ
  function cloneTexSettings(THREE, src, dst) {
    dst.flipY = src.flipY;
    dst.wrapS = src.wrapS; dst.wrapT = src.wrapT;
    dst.offset.copy(src.offset); dst.repeat.copy(src.repeat);
    dst.center.copy(src.center); dst.rotation = src.rotation;
    dst.magFilter = src.magFilter; dst.minFilter = src.minFilter;
    dst.anisotropy = src.anisotropy;
    if (src.encoding !== undefined) dst.encoding = src.encoding;
    if (src.colorSpace !== undefined) dst.colorSpace = src.colorSpace;
    dst.needsUpdate = true;
    return dst;
  }

  /* สร้าง "ตัวย้อมสี" ผูกกับวัสดุหนึ่งตัว
   * เก็บพิกเซลต้นฉบับไว้ แล้วสร้างเทกซ์เจอร์ใหม่เมื่อสีเปลี่ยน */
  function makeShellTinter(THREE, material, vivid) {
    if (typeof document === 'undefined') return null;
    var srcTex = material.map;
    if (!srcTex || !srcTex.image) return null;
    var srcData = readPixels(srcTex.image);
    if (!srcData) return null;

    var w = srcData.width, h = srcData.height;
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var out = ctx.createImageData(w, h);
    var tex = cloneTexSettings(THREE, srcTex, new THREE.CanvasTexture(canvas));
    var lastHex = null;

    return function tint(hex) {
      if (hex === lastHex) return;
      lastHex = hex;
      // ส่ง null = คืนเทกซ์เจอร์เดิมจากไฟล์ (ใช้ตอนลูกค้ายังไม่ได้เลือกอ็อปชัน)
      if (hex === null || hex === undefined) {
        if (material.map !== srcTex) { material.map = srcTex; material.needsUpdate = true; }
        material.color.setRGB(1, 1, 1);
        return;
      }
      var lut = buildLut(hex, vivid);
      var s = srcData.data, d = out.data;
      for (var i = 0; i < s.length; i += 4) {
        // ความสว่างแบบจำนวนเต็ม (0.2126 / 0.7152 / 0.0722 คูณ 256)
        var L = (54 * s[i] + 183 * s[i + 1] + 18 * s[i + 2]) >> 8;
        var k = L * 3;
        d[i] = lut[k]; d[i + 1] = lut[k + 1]; d[i + 2] = lut[k + 2]; d[i + 3] = s[i + 3];
      }
      ctx.putImageData(out, 0, 0);
      tex.needsUpdate = true;
      if (material.map !== tex) { material.map = tex; material.needsUpdate = true; }
      // สีวัสดุต้องเป็นขาว ไม่งั้นจะไปคูณทับสีที่เราเพิ่งวาด
      material.color.setRGB(1, 1, 1);
    };
  }

  /* ไลต์บาร์: โมเดลมีไฟอบมาในเทกซ์เจอร์ emissive อยู่แล้ว (เป็นสีน้ำเงิน)
   * ถ้าใช้ emissive คูณจะเปลี่ยนเป็นสีอื่นไม่ได้ (น้ำเงินคูณอะไรก็ยังน้ำเงิน)
   * จึงวาดเทกซ์เจอร์ใหม่ ให้บริเวณที่ติดไฟกลายเป็นสีของบอร์ด PCB ที่เลือก */
  function makeLightbarTinter(THREE, material) {
    if (typeof document === 'undefined') return null;
    var srcTex = material.emissiveMap;
    if (!srcTex || !srcTex.image) return null;
    var srcData = readPixels(srcTex.image);
    if (!srcData) return null;

    var w = srcData.width, h = srcData.height;
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var out = ctx.createImageData(w, h);
    var tex = cloneTexSettings(THREE, srcTex, new THREE.CanvasTexture(canvas));
    var lastHex = null;

    return function tint(hex) {
      if (hex === lastHex) return;
      lastHex = hex;
      var tr = (hex >> 16) & 255, tg = (hex >> 8) & 255, tb = hex & 255;
      var s = srcData.data, d = out.data;
      for (var i = 0; i < s.length; i += 4) {
        // ความเข้มของไฟเดิม (เก็บขอบฟุ้งไว้) แล้วทาสีใหม่ทับ
        var v = Math.max(s[i], s[i + 1], s[i + 2]) / 255;
        d[i] = tr * v; d[i + 1] = tg * v; d[i + 2] = tb * v; d[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      tex.needsUpdate = true;
      if (material.emissiveMap !== tex) { material.emissiveMap = tex; material.needsUpdate = true; }
      material.emissive.setRGB(1, 1, 1);
    };
  }

  /* ---------------------------------------------------------------
   * จัดโมเดลให้เข้าระบบแกน/สเกลของเว็บ แล้วแยกชิ้นส่วน
   * (ส่วนนี้ไม่แตะ DOM เรียกจาก Node เพื่อทดสอบได้)
   * --------------------------------------------------------------- */
  function prepareScene(THREE, scene) {
    var root = new THREE.Group();
    var fix = new THREE.Group();
    fix.rotation.x = -Math.PI / 2;      // Z-up -> Y-up
    fix.add(scene);
    root.add(fix);

    /* สเกล/จัดกึ่งกลาง — ใส่ค่าไว้ที่ fix ไม่ใช่ root โดยตั้งใจ
     * เพราะ root จะถูกเอาไปใส่ชิ้นที่ปั้นเพิ่มทีหลัง (ปุ่มหลัง) ด้วย
     * ถ้า root ถูกสเกล 0.53 ชิ้นพวกนั้นจะหดตามไปด้วยแล้วลอยผิดที่
     * ให้ root เป็นหน่วยเซนติเมตร 1:1 ตลอด ตำแหน่งที่วัดมาจะใช้ได้ตรงๆ */
    root.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(root);
    var size = box.getSize(new THREE.Vector3());
    var scale = TARGET_WIDTH_CM / size.x;
    fix.scale.setScalar(scale);
    root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(root);
    var c = box.getCenter(new THREE.Vector3());
    fix.position.sub(c);
    root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(root);

    var parts = { faceButtons: {}, triggers: {}, sticks: [], dpad: [] };
    var mats = {};
    var byRole = {};

    scene.traverse(function (o) {
      if (!o.isMesh) return;
      var role = MAT_ROLE[o.material && o.material.name];
      if (role) {
        if (!byRole[role]) byRole[role] = [];
        byRole[role].push(o);
        if (!mats[role]) mats[role] = o.material;
        else o.material = mats[role];      // ใช้ instance เดียว เปลี่ยนทีเดียวติดทั้งกลุ่ม
      }
      if (FACE_BUTTONS.indexOf(o.name) >= 0) parts.faceButtons[o.name] = o;
      if (TRIGGER_MESHES.indexOf(o.name) >= 0) parts.triggers[o.name] = o;
      if (o.name === 'left-stick' || o.name === 'right-stick') parts.sticks.push(o);
      if (o.name.indexOf('D-Pad') === 0) parts.dpad.push(o);
      if (o.name === 'Touchpad') parts.touchpad = o;
    });

    parts.byRole = byRole;
    return { root: root, parts: parts, materials: mats, bbox: box };
  }

  /* เตรียมตัวย้อมสีให้ทุกชิ้นเชลล์ + ไลต์บาร์ (เรียกหลัง prepareScene) */
  function makeTinters(THREE, prepared) {
    var shell = [];
    SHELL_ROLES.forEach(function (role) {
      var m = prepared.materials[role];
      if (!m) return;
      var fn = makeShellTinter(THREE, m);
      if (fn) shell.push({ role: role, apply: fn });
    });
    var lightbar = null;
    SHELL_ROLES.forEach(function (role) {
      if (lightbar) return;
      var m = prepared.materials[role];
      if (m && m.emissiveMap) lightbar = makeLightbarTinter(THREE, m);
    });
    /* ก้านอนาล็อกกับไกปืนก็ทาสีดำมาเหมือนกัน ใช้วิธีเดียวกับเชลล์
     * ส่งสีเข้าไป = ย้อมสี, ส่ง null = กลับไปใช้เทกซ์เจอร์เดิมจากไฟล์ */
    var accent = {};
    ['stick', 'trigger', 'button'].forEach(function (role) {
      var m = prepared.materials[role];
      if (!m) return;
      var fn = makeShellTinter(THREE, m, true);
      if (fn) accent[role] = fn;
    });
    return { shell: shell, lightbar: lightbar, accent: accent };
  }

  function load(THREE, opts) {
    opts = opts || {};
    var url = opts.url || 'models/ds4.glb';
    return loadGLTFLoader(THREE, opts.loaderSources).then(function () {
      return new Promise(function (resolve, reject) {
        new THREE.GLTFLoader().load(url, function (gltf) {
          try {
            var prepared = prepareScene(THREE, gltf.scene);
            prepared.tinters = makeTinters(THREE, prepared);
            resolve(prepared);
          } catch (e) { reject(e); }
        }, opts.onProgress, function (err) {
          reject(err || new Error('โหลดไฟล์โมเดลไม่สำเร็จ: ' + url));
        });
      });
    });
  }

  return {
    load: load,
    prepareScene: prepareScene,
    makeTinters: makeTinters,
    TARGET_WIDTH_CM: TARGET_WIDTH_CM,
    MAT_ROLE: MAT_ROLE,
    SHELL_ROLES: SHELL_ROLES
  };
});
