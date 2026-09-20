/**
 * KÍCH THƯỚC CHUẨN ZMROBO THEO HỆ 1DV (KichThuoc.docx):
 * 1DV = 47mm (Quy đổi tỉ lệ mô phỏng: 1DV = 1.0 đơn vị tương đương 1 lỗ = 1 cm).
 * Bề rộng thanh W = 1DV = 1.0 (47 mm).
 * Hai đầu bo tròn hoàn toàn R = DV / 2 = 0.5 (23.5 mm).
 * Chiều dài L = n * DV = n * 1.0 (n * 47 mm).
 * Đường kính lỗ = 28mm -> Bán kính r = 14mm = (14/47) * 1.0 ≈ 0.298 DV.
 * Khoảng cách tâm-tâm giữa các lỗ liên tiếp = 1DV = 1.0 (47 mm).
 * Chiều cao/độ dày cố định: dầm chuẩn = 0.8 DV (khối hộp đặc); thanh nẹp dập = 0.25 DV.
 */
function buildZMROBOBeamMesh(holeCount = 7, material, isThinBracket = false) {
  const pitch = 1.0; // 1DV = 1.0 unit (tỉ lệ 1 lỗ = 1 cm = 47mm)
  const beamW = 1.0; // W = 1DV
  const R = beamW / 2; // R = DV / 2 = 0.5 (23.5mm)
  const halfSpan = ((holeCount - 1) * pitch) / 2;
  const totalH = isThinBracket ? 0.25 : 0.8; // Độ dày cố định theo tài liệu

  // 2D Shape với 2 đầu bo tròn hoàn toàn R = 23.5mm
  const shape = new THREE.Shape();
  shape.moveTo(-halfSpan, -R);
  shape.lineTo(halfSpan, -R);
  shape.absarc(halfSpan, 0, R, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-halfSpan, R);
  shape.absarc(-halfSpan, 0, R, Math.PI / 2, (3 * Math.PI) / 2, false);
  shape.closePath();

  // Bố trí các lỗ Ø28mm (bán kính r = 14/47 = 0.298DV)
  const holesData = [];
  const holeRadius = (14 / 47) * pitch; // Đúng 28mm đường kính

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

  // Vành bo định vị khoét chìm miệng lỗ (sunken counterbore) theo hình ảnh CAD trong Word
  const ringOuterR = (30 / 47 / 2) * pitch; // 30mm đường kính ngoài (0.319DV)
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

    // Raycast anchor sphere cho thao tác click chọn lỗ
    const anchorGeo = new THREE.SphereGeometry(holeRadius * 0.95, 12, 12);
    const anchorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      wireframe: true
    });
    const anchorMesh = new THREE.Mesh(anchorGeo, anchorMat);
    anchorMesh.position.set(h.x, totalH / 2, 0);
    anchorMesh.userData = { isHoleAnchor: true, holeIndex: h.index };
    group.add(anchorMesh);
  });

  return { group, holes: holesData, height: totalH };
}

/**
 * Builds snap connector pin with central collar flange,
 * dual split arms at each end, expansion gap, and retaining ridge lips.
 * Fits completely flush inside the assembled beams with zero excess protrusion.
 */
function buildPinGeometry(material, totalLen = 1.6, pinR = (14 / 47) * 0.98) {
  const pinGroup = new THREE.Group();
  const halfLen = totalLen / 2;

  // Center collar / flange ring (fits into the recessed counterbores between touching beams)
  const flangeR = pinR * 1.08;
  const flangeH = 0.04;
  const flangeGeo = new THREE.CylinderGeometry(flangeR, flangeR, flangeH, 24);
  const flangeMesh = new THREE.Mesh(flangeGeo, material);
  flangeMesh.castShadow = true;
  pinGroup.add(flangeMesh);

  // Two halves (Upper & Lower shaft) that match the exact depth of each beam
  [-1, 1].forEach(side => {
    const shaftLen = halfLen - flangeH / 2;
    const shaftCenterY = side * (flangeH / 2 + shaftLen / 2);

    // Split elastic tines separated by central expansion slit
    const armW = pinR * 0.82;
    const armThick = pinR * 0.42;
    [-1, 1].forEach(tine => {
      const tineGeo = new THREE.BoxGeometry(armW, shaftLen * 0.98, armThick);
      const tineMesh = new THREE.Mesh(tineGeo, material);
      tineMesh.position.set(0, shaftCenterY, tine * (pinR * 0.42));
      tineMesh.castShadow = true;
      pinGroup.add(tineMesh);
    });

    // Retention lip that rests flush inside the outer counterbore (never protruding)
    const lipH = Math.min(shaftLen * 0.25, 0.12);
    const lipGeo = new THREE.CylinderGeometry(pinR * 0.92, pinR * 1.02, lipH, 24);
    const lipMesh = new THREE.Mesh(lipGeo, material);
    lipMesh.position.set(0, side * (halfLen - lipH / 2), 0);
    lipMesh.castShadow = true;
    pinGroup.add(lipMesh);
  });

  // Hollow center core (characteristic of Technic snap pins)
  const coreGeo = new THREE.CylinderGeometry(pinR * 0.45, pinR * 0.45, totalLen + 0.01, 16);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  pinGroup.add(coreMesh);

  return pinGroup;
}