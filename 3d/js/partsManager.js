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
    joinKey: joinKey 
  };

  parts.push(partObj);
  partsGroup.add(object3D);

  updatePartsCountBadge();
  selectPart(id);
  refreshJoinDropdowns();
  return partObj;
}

function spawnZMROBOBeam(holeCount = 7, color = 0x94a3b8, label = 'Dầm ZMROBO') {
  const mat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.0, roughness: 0.78, flatShading: false });
  const res = buildZMROBOBeamMesh(holeCount, mat, false);
  
  // TÍCH HỢP THUẬT TOÁN MỚI: Truyền thẳng group vào để quét hitbox trống rồi mới đặt vị trí
  const pos = getCleanSpawnPosition(res.group);
  res.group.position.set(pos.x, pos.y, pos.z);
  
  return registerPart(`${label} (${holeCount}L)`, 'zmrobo-beam', res.group, res.holes, color, res.height, 'standard_beam');
}

function spawnTechnicBeam(holeCount, color, label) {
  return spawnZMROBOBeam(holeCount, color, label);
}

function spawnDVBar(holeCount) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.0, roughness: 0.8 });
  const res = buildZMROBOBeamMesh(holeCount, mat, false);
  
  const pos = getCleanSpawnPosition(res.group);
  res.group.position.set(pos.x, pos.y, pos.z);
  
  return registerPart(`Thanh DV (${holeCount}L)`, 'dv-bar', res.group, res.holes, 0xcfd8dc, res.height, 'standard_beam');
}

function spawnYellowBracket() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.0, roughness: 0.75 });
  const res = buildZMROBOBeamMesh(3, mat, true); 
  
  const pos = getCleanSpawnPosition(res.group);
  res.group.position.set(pos.x, pos.y, pos.z);
  
  return registerPart('Nẹp Nhựa Vàng 3L', 'yellow-bracket', res.group, res.holes, 0xf59e0b, res.height, 'thin_bracket');
}

function spawnStandalonePin() {
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.0, roughness: 0.85 });
  const pin = buildPinGeometry(pinMat, 1.6, (14 / 47) * 0.98);
  
  const pos = getCleanSpawnPosition(pin);
  pin.position.set(pos.x, pos.y, pos.z);
  
  const dummyAnchor = [{ x: 0, y: 0, z: 0, index: 0 }];
  return registerPart('Chốt Trục Đàn Hồi', 'pin', pin, dummyAnchor, 0x1e293b, 1.6, 'connector_pin');
}

function spawnPresetAssembly() {
  clearAllParts();
  if (typeof resetSpawnCounter === 'function') resetSpawnCounter();
  const b1 = spawnZMROBOBeam(7, 0x94a3b8, 'Dầm Cơ Sở 7L');
  b1.root.position.set(0, b1.height / 2, 0);
  const b2 = spawnZMROBOBeam(3, 0xf59e0b, 'Dầm Vàng 3L');
  b2.root.position.set(2.5, b2.height / 2, 0); // Đặt cách ra để không bao giờ đè nhau
  if (typeof createJointBetweenHoles === 'function') createJointBetweenHoles(b1.id, 0, b2.id, 0, 45);
}

function spawnAssemblyCombo(type) {
  clearAllParts();
  if (typeof resetSpawnCounter === 'function') resetSpawnCounter();
  if (type === 'parallel') {
    const b1 = spawnZMROBOBeam(7, 0x94a3b8, 'Dầm Dưới (7DV)');
    b1.root.position.set(0, b1.height / 2, 0);
    const b2 = spawnZMROBOBeam(5, 0x0284c7, 'Dầm Trên (5DV)');
    b2.root.position.set(0, b1.height + b2.height / 2 + 0.2, 0);
    if (typeof createJointBetweenHoles === 'function') createJointBetweenHoles(b1.id, 1, b2.id, 1, 0);
  } else if (type === 'l-shape') {
    const b1 = spawnZMROBOBeam(7, 0x94a3b8, 'Dầm Ngang (7DV)');
    b1.root.position.set(0, b1.height / 2, 0);
    const b2 = spawnZMROBOBeam(3, 0xe8a716, 'Dầm Vuông (3DV)');
    b2.root.position.set(3, b2.height / 2, 0);
    if (typeof createJointBetweenHoles === 'function') createJointBetweenHoles(b1.id, 0, b2.id, 0, 90);
  } else if (type === 'scissor') {
    const b1 = spawnZMROBOBeam(5, 0x0284c7, 'Thanh A (5DV)');
    b1.root.position.set(0, b1.height / 2, 0);
    const b2 = spawnZMROBOBeam(5, 0xa855f7, 'Thanh B (5DV)');
    b2.root.position.set(3, b2.height / 2, 0);
    if (typeof createJointBetweenHoles === 'function') createJointBetweenHoles(b1.id, 2, b2.id, 2, 50);
  }
}

function deleteSelectedPart() {
  if (!selectedPartId) return;
  if (typeof joints !== 'undefined' && typeof removeJoint === 'function') {
    const connectedJoints = joints.filter(j => j.partAId === selectedPartId || j.partBId === selectedPartId);
    connectedJoints.forEach(j => removeJoint(j.id));
  }
  const idx = parts.findIndex(p => p.id === selectedPartId);
  if (idx !== -1) {
    const partToDel = parts[idx];
    if (partToDel.root.parent) partToDel.root.parent.remove(partToDel.root);
    else partsGroup.remove(partToDel.root);
    parts.splice(idx, 1);
  }
  if (typeof clearSelection === 'function') clearSelection();
  updatePartsCountBadge();
  refreshJoinDropdowns();
}

function clearAllParts() {
  if (typeof joints !== 'undefined' && typeof removeJoint === 'function') {
    while (joints.length > 0) removeJoint(joints[0].id);
  }
  while (parts.length > 0) {
    const p = parts[0];
    if (p.root.parent) p.root.parent.remove(p.root);
    else partsGroup.remove(p.root);
    parts.shift();
  }
  if (typeof clearSelection === 'function') clearSelection();
  if (typeof cancelSnapMode === 'function') cancelSnapMode();
  if (typeof resetSpawnCounter === 'function') resetSpawnCounter();
  updatePartsCountBadge();
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
          node.material.metalness = 0.0; node.material.roughness = 0.8;
          node.material.needsUpdate = true;
        } else if (presetKey === 'brushed-steel') {
          node.material.metalness = 0.7; node.material.roughness = 0.3;
          node.material.needsUpdate = true;
        } else if (presetKey === 'yellow-paint') {
          node.material.color.setHex(0xE8A716);
          node.material.metalness = 0.0; node.material.roughness = 0.6;
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