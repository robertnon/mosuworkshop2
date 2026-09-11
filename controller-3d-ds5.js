/* =====================================================================
 * controller-3d-ds5.js — ตัวโหลดโมเดล DualSense (PS5) ของจริง (ไฟล์ .glb)
 * ---------------------------------------------------------------------
 * โมเดล "PS5 Controller" โดย Taohid Animation (CC BY 4.0)
 * https://sketchfab.com/3d-models/ps5-controller-b7bb9c5102a04cb0b1966c6d02bad7d6
 *
 * แนวทางวัสดุ/แสง อ้างอิงจากโปรเจกต์ dualsense-studio ของ SafaElmali
 * https://github.com/SafaElmali/dualsense-studio  (controller/controller-view.js)
 * ซึ่งใช้โมเดลตัวเดียวกันนี้ และปรับค่า metalness/roughness ของแต่ละวัสดุไว้แล้ว
 *
 * ต่างจาก DS4 ยังไง (สำคัญ):
 *   DS4 -> เทกซ์เจอร์ "ทาสีดำ" มาในไฟล์ ต้องวาดเทกซ์เจอร์ใหม่ทีละพิกเซล
 *   DS5 -> เชลล์ใช้ baseColorFactor เปล่าๆ ไม่มีเทกซ์เจอร์สีทับ
 *          จึงย้อมสีด้วย material.color.set() ได้ตรงๆ เลย ง่ายและเร็วกว่ามาก
 *
 * โครงสร้างโมเดล (ตรวจด้วย tools/glb-inspect.py):
 *   front_body      -> เชลล์ขาวฝาหน้า (ซ้าย/ขวา/ทัชแพด)  <- ย้อมสี
 *   VRayMtl55       -> เชลล์ฝาหลัง                        <- ย้อมสี
 *   front_body.001  -> พลาสติกดำกลางตัว (ไม่ย้อม)
 *   front_body.002  -> ขอบหลุมก้านอนาล็อก
 *   VRayMtl33       -> ก้านอนาล็อก      VRayMtl37 -> ไกปืน L1/L2/R1/R2
 *   Material.002    -> ปุ่มหน้า         Material.008 -> ไฟรอบทัชแพด (ไลต์บาร์)
 *
 * ไฟล์นี้ export API ชุดเดียวกับ controller-3d-glb.js (load/prepareScene/
 * makeTinters) เพื่อให้ wrapGlbModel() ใน controller-3d.js ใช้ต่อได้เลย
 * ===================================================================== */
(function (root, factory) {
  'use strict';
  var lib = factory();
  if (typeof module === 'object' && module.exports) { module.exports = lib; }
  if (root) { root.MosuDS5Model = lib; }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var TARGET_WIDTH_CM = 16.0;   // ความกว้างจริงของ DualSense

  /* วัสดุไหน = ชิ้นส่วนอะไร (ชื่อวัสดุมาจากในไฟล์ .glb)
   * ค่า metalness/roughness ยืมมาจาก dualsense-studio ที่จูนไว้กับโมเดลนี้แล้ว
   *
   * หมายเหตุเรื่อง "ชิ้นไหนคือส่วนที่เปลี่ยนสีได้":
   *   DualSense ของจริงคือ ปีกซ้าย/ขวาด้านหน้า + ฝาหลัง เป็นพลาสติกสีขาว
   *   ส่วนแผงกลาง (รอบทัชแพด) เป็นสีดำเสมอ ไม่ว่าจะเป็นสีรุ่นไหน
   *   เพราะงั้นเวลาลูกค้าเลือกสี ต้องเปลี่ยนแค่ front_body + VRayMtl55 */
  var MAT_ROLE = {
    'front_body': 'shell',        // ปีกขาวซ้าย/ขวา ด้านหน้า
    'VRayMtl55': 'shellBack',     // เชลล์ฝาหลัง
    'front_body.001': 'shellMid', // แผงดำกลางตัว (คงสีดำเสมอ)
    'front_body.002': 'stickWell',
    'VRayMtl33': 'stick',
    'VRayMtl37': 'trigger',
    'Material.002': 'button',
    'Material.008': 'lightbar',
    'Material.009': 'button2',   // ตัวปุ่ม D-pad
    'Material.007': 'button3',   // ปุ่ม create / options
    'material_0': 'dpadStem',    // ก้าน D-pad (ไฟล์ต้นฉบับเป็นสีขาวล้วน)
    'Material': 'muteButton',    // ปุ่มปิดไมค์ (ใต้ปุ่ม PS)
    'Material.005': 'psButton'   // ฐานปุ่ม PS
  };

  /* ทัชแพดใช้วัสดุร่วมกับปีกขาว (front_body) แต่ของจริงเป็นคนละสี
   * ถ้าปล่อยไว้ ทัชแพดจะเปลี่ยนสีตามเชลล์ไปด้วยซึ่งไม่ตรงกับของจริง
   * จึงแยกวัสดุออกมาต่างหาก */
  var TOUCHPAD_MESH = /^touchpad__/;

  // เชลล์ที่ต้องเปลี่ยนสีตามที่ลูกค้าเลือก (เฉพาะ 2 ชิ้นนี้ ที่เหลือคงสีเดิม)
  var SHELL_ROLES = ['shell', 'shellBack'];

  /* ชิ้นที่ต้องเป็นสีเข้มเสมอ ถึงจะใช้วัสดุเดียวกับเชลล์ก็ตาม
   * (ขอบรอบปุ่ม PS / ปุ่ม mute / ร่องบนเชลล์ขาว) — เช็คจากชื่อ mesh */
  var DARK_DETAIL = /^(ps-mount|mute-mount|white-shell-detail)/;

  /* โลโก้ PlayStation กลางตัวเครื่อง — ซ่อนทิ้งด้วยเหตุผลเดียวกับฝั่ง DS4
   * (ร้านไม่ได้เป็นตัวแทนของ Sony การโชว์โลโก้ในภาพสินค้าอาจทำให้เข้าใจผิด)
   *
   * ชิ้นที่ต้องซ่อน:
   *   ps__logo          = ตัวโลโก้
   *   ps-mount          = เบ้ารอบปุ่ม ก็เป็นรูปโลโก้ตามไปด้วย ถ้าเหลือไว้
   *                       แสงจะตกกระทบขอบจนอ่านเป็นรูปโลโก้อยู่ดี
   *   Object_7-detail-2 = สติกเกอร์แผ่นเรียบ (หนา 0) ทับตำแหน่งเดียวกัน
   * ส่วน ps__button-base (ฐานปุ่ม PS) กับ mute__button เก็บไว้ เพราะเป็น
   * ปุ่มจริงบนเครื่อง แค่ทาสีให้เข้มกลืนกับแผงดำ ไม่ให้เด่นจนดูเหมือนโลโก้ */
  var HIDE_MESH = /^(ps__logo|Object_7-detail-2)/;

  var ACCENT_LIME = 0xC6FF00;

  /* ---------------------------------------------------------------
   * โหลด GLTFLoader (ก๊อปวิธีเดียวกับฝั่ง DS4 เพื่อไม่ให้พึ่งไฟล์นั้น)
   * --------------------------------------------------------------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('โหลดสคริปต์ไม่ได้: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function loadGLTFLoader(THREE, sources) {
    if (THREE.GLTFLoader) return Promise.resolve();
    var list = sources || [
      'vendor/GLTFLoader.js',
      'https://cdn.jsdelivr.net/npm/three@0.137.5/examples/js/loaders/GLTFLoader.js'
    ];
    return new Promise(function (resolve, reject) {
      (function next(i) {
        if (i >= list.length) { reject(new Error('โหลด GLTFLoader ไม่สำเร็จ')); return; }
        loadScript(list[i]).then(function () {
          if (THREE.GLTFLoader) resolve(); else next(i + 1);
        }).catch(function () { next(i + 1); });
      })(0);
    });
  }

  /* ---------------------------------------------------------------
   * จัดแกน/สเกล แล้วแยกชิ้นส่วน
   * โมเดลนี้เป็น Y-up มาอยู่แล้ว (ไม่ต้องหมุนแกนเหมือน DS4)
   * แต่หันหน้าเข้าหากล้องคนละทางกับ DS4 เลยต้องหมุนรอบ Y 180°
   * --------------------------------------------------------------- */
  function prepareScene(THREE, scene) {
    var root = new THREE.Group();
    var fix = new THREE.Group();
    /* โมเดลนี้เป็น Z-up เหมือน DS4 (พิสูจน์จากสัดส่วน bbox:
     * Y/X = 0.650 ตรงกับ ความลึก/ความกว้าง ของ DualSense จริง 106/160 = 0.663
     * Z/X = 0.410 ตรงกับ ความหนา/ความกว้าง 66/160 = 0.413)
     * จึงต้องหมุน -90° รอบแกน X ให้เป็น Y-up ตามระบบของเว็บ */
    fix.rotation.x = -Math.PI / 2;
    fix.add(scene);
    root.add(fix);

    /* สเกล/จัดกึ่งกลางไว้ที่ fix ไม่ใช่ root (เหตุผลเดียวกับฝั่ง DS4)
     * เพราะปุ่มหลังที่ปั้นเพิ่มทีหลังจะถูกใส่ไว้ที่ root
     * ถ้า root โดนสเกล ปุ่มหลังจะหดตามแล้วลอยผิดตำแหน่ง */
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
      if (!o.isMesh || !o.material) return;
      var name = o.material.name;

      // โลโก้ PlayStation -> ซ่อน
      if (HIDE_MESH.test(o.name || '')) { o.visible = false; return; }


      /* ทัชแพด — แยกวัสดุออกจากปีกขาว จะได้ไม่เปลี่ยนสีตามเชลล์
       * (เก็บไว้เป็นสีขาวนวลอมเทาเหมือนของจริง) */
      if (TOUCHPAD_MESH.test(o.name || '')) {
        if (!mats.touchpad) {
          mats.touchpad = o.material.clone();
          // เทาอ่อนอมฟ้านิดๆ + ผิวด้านหน่อย ไม่ให้เป็นแผ่นขาวโพลนแบนๆ
          mats.touchpad.color.set('#c9ccd6');
          mats.touchpad.metalness = 0.02;
          mats.touchpad.roughness = 0.52;
        }
        o.material = mats.touchpad;
        return;
      }

      var isDark = DARK_DETAIL.test(o.name || '');

      /* ชิ้นรายละเอียดสีเข้มใช้วัสดุชื่อเดียวกับเชลล์ ถ้าปล่อยไว้จะโดนย้อมสีไปด้วย
       * จึงโคลนวัสดุแยกออกมาแล้วตั้งเป็นสีเข้มถาวร */
      if (isDark) {
        o.material = o.material.clone();
        o.material.color.set('#16171c');
        o.material.roughness = 0.55;
        o.material.metalness = 0;
        /* เบ้าปุ่ม PS เป็นรูปโลโก้ ถ้าผิวมันวาวแสงจะตกขอบจนอ่านออกว่าเป็นโลโก้
         * ทำให้ด้านสนิทและเข้มขึ้น จะได้ดูเป็นแค่รอยบุ๋มเฉยๆ */
        if (/^ps-mount/.test(o.name)) {
          o.material.color.set('#101116');
          o.material.roughness = 1;
        }
        return;
      }

      var role = MAT_ROLE[name];
      if (!role) return;
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push(o);
      if (!mats[role]) {
        // โคลนครั้งเดียวต่อ role กันไปแก้วัสดุที่ใช้ร่วมกับ mesh อื่น
        mats[role] = o.material.clone();
      }
      o.material = mats[role];
    });

    // ค่าวัสดุตั้งต้น (ยืมจาก dualsense-studio ที่จูนกับโมเดลนี้ไว้แล้ว)
    if (mats.shell) { mats.shell.metalness = 0.015; mats.shell.roughness = 0.43; }
    if (mats.shellBack) { mats.shellBack.metalness = 0.015; mats.shellBack.roughness = 0.55; }
    if (mats.shellMid) { mats.shellMid.metalness = 0; mats.shellMid.roughness = 0.46; mats.shellMid.color.set('#15161b'); }
    if (mats.stickWell) { mats.stickWell.metalness = 0; mats.stickWell.roughness = 0.7; mats.stickWell.color.set('#191a20'); }
    if (mats.stick) { mats.stick.metalness = 0; mats.stick.roughness = 0.78; mats.stick.color.set('#24252b'); }
    if (mats.trigger) { mats.trigger.metalness = 0; mats.trigger.roughness = 0.48; mats.trigger.color.set('#202127'); }
    /* ปุ่มหน้า/D-pad — ของจริงเป็นเทาเข้มกว่าเชลล์ขาวพอสมควร
     * ถ้าใช้สีอ่อนตามไฟล์ต้นฉบับ ปุ่มจะกลืนไปกับเชลล์จนแทบมองไม่เห็น */
    if (mats.button) { mats.button.metalness = 0; mats.button.roughness = 0.34; mats.button.color.set('#9aa0ad'); }
    if (mats.button2) { mats.button2.metalness = 0; mats.button2.roughness = 0.4; mats.button2.color.set('#9aa0ad'); }
    if (mats.button3) { mats.button3.metalness = 0; mats.button3.roughness = 0.4; mats.button3.color.set('#a8aeba'); }
    if (mats.dpadStem) { mats.dpadStem.metalness = 0; mats.dpadStem.roughness = 0.45; mats.dpadStem.color.set('#9aa0ad'); }
    /* ปุ่มปิดไมค์ — อยู่ใต้ปุ่ม PS พอดี ถ้าปล่อยให้สว่างจะดูเหมือนโลโก้ PlayStation
     * ของจริงเป็นปุ่มเล็กสีเข้มกลืนกับแผงดำ */
    if (mats.muteButton) { mats.muteButton.metalness = 0; mats.muteButton.roughness = 0.5; mats.muteButton.color.set('#1b1c22'); }
    if (mats.psButton) { mats.psButton.metalness = 0.15; mats.psButton.roughness = 0.45; mats.psButton.color.set('#1b1c22'); }
    if (mats.lightbar) {
      /* ไฟรอบทัชแพด — ทางร้านขอให้เป็นสีขาว (เหมือนที่แก้ฝั่ง DS4 ไว้)
       * ตั้ง color ให้เข้มไว้ ไม่งั้นตัวพลาสติกจะกลายเป็นแผ่นขาวโพลนบังทัชแพด
       * ความสว่างของ "ไฟ" คุมด้วย emissive อย่างเดียว */
      mats.lightbar.color.set('#20222a');
      mats.lightbar.emissive.set('#ffffff');
      mats.lightbar.emissiveIntensity = 0.55;
      mats.lightbar.toneMapped = false;
    }

    parts.byRole = byRole;
    return { root: root, parts: parts, materials: mats, bbox: box };
  }

  /* ---------------------------------------------------------------
   * ตัวย้อมสี — โมเดลนี้ไม่มีเทกซ์เจอร์สีทับ จึง set สีตรงๆ ได้
   * (ต่างจาก DS4 ที่ต้องวาดเทกซ์เจอร์ใหม่ทีละพิกเซล)
   * --------------------------------------------------------------- */
  function makeTinters(THREE, prepared) {
    var mats = prepared.materials;
    var shell = [];

    SHELL_ROLES.forEach(function (role) {
      var m = mats[role];
      if (!m) return;
      var base = m.color.clone();
      shell.push({
        role: role,
        apply: function (hex) {
          if (hex === null || hex === undefined) { m.color.copy(base); return; }
          m.color.setHex(hex);
        }
      });
    });

    var lightbar = null;
    if (mats.lightbar) {
      lightbar = function (hex) {
        if (hex === null || hex === undefined) return;
        mats.lightbar.color.setHex(hex);
        mats.lightbar.emissive.setHex(hex);
      };
    }

    /* ชิ้นที่ต้อง "เรืองเป็นสีเขียวมะนาว" เวลาลูกค้าเลือกอัปเกรด
     * ส่ง null = กลับไปใช้สีเดิม (เก็บสีตั้งต้นไว้ตอนเรียกครั้งแรก) */
    var accent = {};
    ['stick', 'trigger', 'button'].forEach(function (role) {
      var m = mats[role];
      if (!m) return;
      var base = m.color.clone();
      accent[role] = function (hex) {
        if (hex === null || hex === undefined) { m.color.copy(base); return; }
        m.color.setHex(hex);
      };
    });

    return { shell: shell, lightbar: lightbar, accent: accent };
  }

  function load(THREE, opts) {
    opts = opts || {};
    var url = opts.url || 'models/ds5.glb?v=1';
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
    SHELL_ROLES: SHELL_ROLES,
    ACCENT_LIME: ACCENT_LIME
  };
});
