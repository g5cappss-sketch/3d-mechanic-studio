// ==========================================
// FILE: 2_geometry.js
// CHỨC NĂNG: Xây dựng hình khối (Geometry), tạo vật liệu (Material), Texture.
// ==========================================

/**
 * Tạo huy hiệu số 2D (Sprite) lơ lửng trên không gian 3D
 */
function createTextSprite(text, bgColor = '#0284c7', textColor = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');

  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.font = 'bold 54px Inter, sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 66);

  const texture = new THREE.CanvasTexture(c);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.1, 1.1, 1.1);
  return sprite;
}

/**
 * Tạo texture kim loại phay xước bằng code (Procedural)
 */
function generateBrushedTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#dddddd';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 15 + Math.random() * 70;
    const opacity = 0.03 + Math.random() * 0.08;
    ctx.strokeStyle = Math.random() > 0.5 ? `rgba(255,255,255,${opacity})` : `rgba(0,0,0,${opacity})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

/**
 * Dựng hình Thanh/Dầm ZMROBO chuẩn kích thước
 */
function buildZMROBOBeamMesh(holeCount = 7, material, isThinBracket = false) {
  const pitch = 1.0; 
  const beamW = 1.0; 
  const R = beamW / 2; 
  const halfSpan = ((holeCount - 1) * pitch) / 2;
  const totalH = isThinBracket ? 0.25 : 0.8; 

  const shape = new THREE.Shape();
  shape.moveTo(-halfSpan, -R);
  shape.lineTo(halfSpan, -R);
  shape.absarc(halfSpan, 0, R, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-halfSpan, R);
  shape.absarc(-halfSpan, 0, R, Math.PI / 2, (3 * Math.PI) / 2, false);
  shape.closePath();

  const holesData = [];
  const holeRadius = (14 / 47) * pitch; 

  for (let i = 0; i < holeCount; i++) {
    const cx = -halfSpan + i * pitch;
    const holePath = new THREE.Path();
    holePath.absarc(cx, 0, holeRadius, 0, Math.PI * 2, true);
    shape.holes.push(holePath);
    holesData.push({ x: cx, y: 0, z: 0, index: i });
  }

  const extrudeSettings = {
    steps: 1,
    depth: totalH,
    bevelEnabled: true,
    bevelThickness: isThinBracket ? 0.03 : 0.05,
    bevelSize: isThinBracket ? 0.03 : 0.05,
    bevelSegments: 3,
    curveSegments: 36
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();

  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);

  const ringOuterR = (30 / 47 / 2) * pitch; 
  const ringGeo = new THREE.CylinderGeometry(ringOuterR, ringOuterR, 0.02, 28, 1, true);
  const ringMat = new THREE.MeshStandardMaterial({
    color: material.color.clone().multiplyScalar(0.75),
    metalness: material.metalness,
    roughness: material.roughness
  });

  holesData.forEach(h => {
    const topRing = new THREE.Mesh(ringGeo, ringMat);
    topRing.position.set(h.x, totalH / 2 - 0.01, 0);
    group.add(topRing);

    const botRing = new THREE.Mesh(ringGeo, ringMat);
    botRing.position.set(h.x, -totalH / 2 + 0.01, 0);
    group.add(botRing);

    const anchorGeo = new THREE.SphereGeometry(holeRadius * 0.95, 12, 12);
    const anchorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.0, wireframe: true });
    const anchorMesh = new THREE.Mesh(anchorGeo, anchorMat);
    anchorMesh.position.set(h.x, totalH / 2, 0);
    anchorMesh.userData = { isHoleAnchor: true, holeIndex: h.index };
    group.add(anchorMesh);
  });

  return { group, holes: holesData, height: totalH };
}

/**
 * Dựng hình Chốt nối (Pin) đàn hồi
 */
function buildPinGeometry(material, totalLen = 1.6, pinR = (14 / 47) * 0.98) {
  const pinGroup = new THREE.Group();
  const halfLen = totalLen / 2;

  const flangeR = pinR * 1.08;
  const flangeH = 0.04;
  const flangeGeo = new THREE.CylinderGeometry(flangeR, flangeR, flangeH, 24);
  const flangeMesh = new THREE.Mesh(flangeGeo, material);
  flangeMesh.castShadow = true;
  pinGroup.add(flangeMesh);

  [-1, 1].forEach(side => {
    const shaftLen = halfLen - flangeH / 2;
    const shaftCenterY = side * (flangeH / 2 + shaftLen / 2);

    const armW = pinR * 0.82;
    const armThick = pinR * 0.42;
    [-1, 1].forEach(tine => {
      const tineGeo = new THREE.BoxGeometry(armW, shaftLen * 0.98, armThick);
      const tineMesh = new THREE.Mesh(tineGeo, material);
      tineMesh.position.set(0, shaftCenterY, tine * (pinR * 0.42));
      tineMesh.castShadow = true;
      pinGroup.add(tineMesh);
    });

    const lipH = Math.min(shaftLen * 0.25, 0.12);
    const lipGeo = new THREE.CylinderGeometry(pinR * 0.92, pinR * 1.02, lipH, 24);
    const lipMesh = new THREE.Mesh(lipGeo, material);
    lipMesh.position.set(0, side * (halfLen - lipH / 2), 0);
    lipMesh.castShadow = true;
    pinGroup.add(lipMesh);
  });

  const coreGeo = new THREE.CylinderGeometry(pinR * 0.45, pinR * 0.45, totalLen + 0.01, 16);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  pinGroup.add(coreMesh);

  return pinGroup;
}