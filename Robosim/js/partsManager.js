function registerPart(name, type, object3D, holes, colorHex, height, joinKey = 'standard_beam') {
  const id = `part_${partIdCounter++}`;
  object3D.userData = { partId: id, isModularPart: true };

  const partObj = {
    id: id,
    name: `${name} #${parts.length + 1}`,
    type: type,
    root: object3D,
    holes: holes,
    colorHex: colorHex,
    height: height || 0.8,
    joinKey: joinKey // Key quản lý tương thích khớp nối
  };

  parts.push(partObj);
  partsGroup.add(object3D);

  updatePartsCountBadge();
  selectPart(id);
  refreshJoinDropdowns();
  return partObj;
}

function spawnZMROBOBeam(holeCount = 7, color = 0x94a3b8, label = 'Dầm ZMROBO') {
  const mat = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.0,
    roughness: 0.78,
    flatShading: false
  });
  const res = buildZMROBOBeamMesh(holeCount, mat, false);
  const offset = (parts.length % 5) * 1.4 - 2.5;
  res.group.position.set(offset, res.height / 2, offset * 0.7);
  // Gắn mác 'standard_beam'
  return registerPart(`${label} (${holeCount}L / ${holeCount * 47}mm)`, 'zmrobo-beam', res.group, res.holes, color, res.height, 'standard_beam');
}

// Tương thích ngược với các lệnh cũ
function spawnTechnicBeam(holeCount, color, label) {
  return spawnZMROBOBeam(holeCount, color, label);
}

function spawnDVBar(holeCount) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.0, roughness: 0.8 });
  const res = buildZMROBOBeamMesh(holeCount, mat, false);
  const offset = (parts.length % 5) * 1.5 - 2.5;
  res.group.position.set(offset, res.height / 2, offset * 0.8);
  return registerPart(`Thanh DV Nhựa (${holeCount}L / ${holeCount * 47}mm)`, 'dv-bar', res.group, res.holes, 0xcfd8dc, res.height, 'standard_beam');
}

function spawnYellowBracket() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.0, roughness: 0.75 });
  const res = buildZMROBOBeamMesh(3, mat, true); 
  res.group.position.set(0, res.height / 2, 0);
  // Nẹp dập mỏng có key 'thin_bracket'
  return registerPart('Nẹp Nhựa Vàng (3L / 141mm)', 'yellow-bracket', res.group, res.holes, 0xf59e0b, res.height, 'thin_bracket');
}

function spawnStandalonePin() {
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.0, roughness: 0.85 });
  const pin = buildPinGeometry(pinMat, 1.6, (14 / 47) * 0.98);
  pin.position.set(0, 1.2, 0);
  return registerPart('Chốt Trục Nhựa Đàn Hồi (Ø28mm)', 'pin', pin, [], 0x1e293b, 1.6, 'connector_pin');
}

function spawnPresetAssembly() {
  clearAllParts();

  // Lower Beam (Grey 7 holes: 329mm)
  const b1 = spawnZMROBOBeam(7, 0x94a3b8, 'Dầm Cơ Sở 7L');
  b1.root.position.set(0, b1.height / 2, 0);

  // Upper Beam (Yellow 3 holes: 141mm)
  const b2 = spawnZMROBOBeam(3, 0xf59e0b, 'Dầm Vàng 3L');
  b2.root.position.set(0, b1.height + b2.height / 2, 0);

  // Ghép nối khít hoàn toàn: Hole 0 của b1 với Hole 0 của b2
  createJointBetweenHoles(b1.id, 0, b2.id, 0, 45);
}

function spawnAssemblyCombo(type) {
  clearAllParts();

  if (type === 'parallel') {
    const b1 = spawnZMROBOBeam(7, 0x94a3b8, 'Dầm Dưới (7DV)');
    b1.root.position.set(0, b1.height / 2, 0);

    const b2 = spawnZMROBOBeam(5, 0x0284c7, 'Dầm Trên (5DV)');
    b2.root.position.set(0, b1.height + b2.height / 2, 0);

    createJointBetweenHoles(b1.id, 1, b2.id, 1, 0);
  } else if (type === 'l-shape') {
    const b1 = spawnZMROBOBeam(7, 0x94a3b8, 'Dầm Ngang (7DV)');
    b1.root.position.set(0, b1.height / 2, 0);

    const b2 = spawnZMROBOBeam(3, 0xe8a716, 'Dầm Vuông (3DV)');
    b2.root.position.set(0, b1.height + b2.height / 2, 0);

    createJointBetweenHoles(b1.id, 0, b2.id, 0, 90);
  } else if (type === 'scissor') {
    const b1 = spawnZMROBOBeam(5, 0x0284c7, 'Thanh A (5DV)');
    b1.root.position.set(0, b1.height / 2, 0);

    const b2 = spawnZMROBOBeam(5, 0xa855f7, 'Thanh B (5DV)');
    b2.root.position.set(0, b1.height + b2.height / 2, 0);

    createJointBetweenHoles(b1.id, 2, b2.id, 2, 50);
  }
}

function deleteSelectedPart() {
  if (!selectedPartId) return;
  const connectedJoints = joints.filter(j => j.partAId === selectedPartId || j.partBId === selectedPartId);
  connectedJoints.forEach(j => removeJoint(j.id));

  const idx = parts.findIndex(p => p.id === selectedPartId);
  if (idx !== -1) {
    partsGroup.remove(parts[idx].root);
    parts.splice(idx, 1);
  }
  highlightBox.visible = false;
  document.getElementById('floating-part-hud').classList.add('hidden');
  while (holeBadgesGroup.children.length > 0) holeBadgesGroup.remove(holeBadgesGroup.children[0]);
  selectedPartId = null;
  document.getElementById('inspector-no-selection').classList.remove('hidden');
  document.getElementById('inspector-active-panel').classList.add('hidden');
  updatePartsCountBadge();
  refreshJoinDropdowns();
}

function clearAllParts() {
  while (joints.length > 0) removeJoint(joints[0].id);
  while (parts.length > 0) {
    partsGroup.remove(parts[0].root);
    parts.shift();
  }
  highlightBox.visible = false;
  document.getElementById('floating-part-hud').classList.add('hidden');
  while (holeBadgesGroup.children.length > 0) holeBadgesGroup.remove(holeBadgesGroup.children[0]);
  selectedPartId = null;
  cancelSnapMode();
  updatePartsCountBadge();
  document.getElementById('inspector-no-selection').classList.remove('hidden');
  document.getElementById('inspector-active-panel').classList.add('hidden');
  refreshJoinDropdowns();
}

function duplicateSelectedPart() {
  const part = parts.find(p => p.id === selectedPartId);
  if (!part) return;
  spawnZMROBOBeam(part.holes.length, part.colorHex, part.name.split(' #')[0]);
}

function applyPreset(presetKey) {
  const part = parts.find(p => p.id === selectedPartId);
  const targetParts = part ? [part] : parts;

  targetParts.forEach(p => {
    if (!p.root) return;
    p.root.traverse(node => {
      if (node.isMesh && node.material && !node.userData.isHoleAnchor) {
        if (presetKey === 'matte-plastic') {
          // Nhựa mờ đặc tiêu chuẩn (Pure ABS plastic)
          node.material.metalness = 0.0;
          node.material.roughness = 0.8;
          if (node.material.clearcoat !== undefined) node.material.clearcoat = 0.0;
          node.material.map = null;
          node.material.needsUpdate = true;
        } else if (presetKey === 'flat-2d') {
          // Màu phẳng 2D/Toon (không phản quang, màu mảng rõ ràng)
          node.material.metalness = 0.0;
          node.material.roughness = 1.0;
          if (node.material.clearcoat !== undefined) node.material.clearcoat = 0.0;
          node.material.map = null;
          node.material.needsUpdate = true;
        } else if (presetKey === 'smooth-plastic') {
          // Nhựa bóng nhẹ (LEGO/ZMROBO finish)
          node.material.metalness = 0.0;
          node.material.roughness = 0.35;
          if (node.material.clearcoat !== undefined) node.material.clearcoat = 0.0;
          node.material.map = null;
          node.material.needsUpdate = true;
        }
      }
    });
  });
}

function setPartColor(colorHex) {
  const part = parts.find(p => p.id === selectedPartId);
  if (part && part.root) {
    part.colorHex = colorHex;
    part.root.traverse(node => {
      if (node.isMesh && node.material && !node.userData.isHoleAnchor) {
        node.material.color.set(colorHex);
        node.material.metalness = 0.0;
      }
    });
  }
}