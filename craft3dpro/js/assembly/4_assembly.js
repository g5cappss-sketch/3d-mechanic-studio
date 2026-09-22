// ==========================================
// FILE: 4_assembly.js
// CHỨC NĂNG: Thêm, sửa, xóa linh kiện, đổi màu, tạo và xóa khớp nối (Joint).
// CẬP NHẬT: Đã chuẩn hóa cấu trúc phẳng (Flat Hierarchy) chuẩn bị cho Vật lý.
// ==========================================

function registerPart(name, type, object3D, holes, colorHex, height) {
  const id = `part_${partIdCounter++}`;
  object3D.userData = { partId: id, isModularPart: true };

  const partObj = new PartObject({
    id,
    name: `${name} #${parts.length + 1}`,
    type,
    root: object3D,
    holes: holes || [],
    colorHex,
    height
  });

  parts.push(partObj);
  partsGroup.add(object3D);

  updatePartsCountBadge();
  selectPart(id);
  refreshJoinDropdowns();
  if (typeof recordAssemblyHistory === 'function') recordAssemblyHistory(`Thêm ${partObj.name}`);
  return partObj;
}

// Spawners
function spawnZMROBOBeam(holeCount = 7, color = 0x94a3b8, label = 'Dầm ZMROBO') {
  const mat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.0, roughness: 0.78, flatShading: false });
  const res = buildZMROBOBeamMesh(holeCount, mat, false);
  res.group.position.set(0, res.height / 2, 0);
  findSafeSpawnPosition(res.group);
  return registerPart(`${label} (${holeCount}L / ${holeCount * 47}mm)`, 'zmrobo-beam', res.group, res.holes, color, res.height);
}

function spawnTechnicBeam(holeCount, color, label) {
  return spawnZMROBOBeam(holeCount, color, label);
}

function spawnDVBar(holeCount) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.0, roughness: 0.8 });
  const res = buildZMROBOBeamMesh(holeCount, mat, false);
  res.group.position.set(0, res.height / 2, 0);
  findSafeSpawnPosition(res.group);
  return registerPart(`Thanh DV Nhựa (${holeCount}L / ${holeCount * 47}mm)`, 'dv-bar', res.group, res.holes, 0xcfd8dc, res.height);
}

function spawnYellowBracket() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.0, roughness: 0.75 });
  const res = buildZMROBOBeamMesh(3, mat, true); 
  res.group.position.set(0, res.height / 2, 0);
  findSafeSpawnPosition(res.group);
  return registerPart('Nẹp Nhựa Vàng (3L / 141mm)', 'yellow-bracket', res.group, res.holes, 0xf59e0b, res.height);
}

function spawnStandalonePin() {
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.0, roughness: 0.85 });
  const pinRadius = (14 / 47) * 0.98;
  const pinLength = 1.6;
  const pin = buildPinGeometry(pinMat, pinLength, pinRadius);
  pin.position.set(0, 1.2, 0);
  findSafeSpawnPosition(pin);
  const part = registerPart('Chốt Trục Nhựa Đàn Hồi (Ø28mm)', 'pin', pin, [], 0x1e293b, pinLength);
  part.addSocket({ id: 'pin_top', type: 'male', radius: pinRadius, pos: [0, pinLength / 2, 0], axis: [0, 1, 0], insertionDepth: pinLength / 2, locking: true });
  part.addSocket({ id: 'pin_bottom', type: 'male', radius: pinRadius, pos: [0, -pinLength / 2, 0], axis: [0, -1, 0], insertionDepth: pinLength / 2, locking: true });
  selectPart(part.id);
  return part;
}

function spawnPresetAssembly() {
  clearAllParts();
  const b1 = spawnZMROBOBeam(7, 0x94a3b8, 'Dầm Cơ Sở 7L');
  b1.root.position.set(0, b1.height / 2, 0);
  const b2 = spawnZMROBOBeam(3, 0xf59e0b, 'Dầm Vàng 3L');
  b2.root.position.set(0, b1.height + b2.height / 2, 0);
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

// ==========================================
// LOGIC KHỚP (JOINTS) - TOÁN HỌC KINEMATICS
// ==========================================

function createJointBetweenHoles(partAId, holeAIdx, partBId, holeBIdx, initialAngle = 40) {
  const partA = parts.find(p => p.id === partAId);
  const partB = parts.find(p => p.id === partBId);
  if (!partA || !partB || partA === partB) return;

  const holeA = partA.holes[holeAIdx];
  const holeB = partB.holes[holeBIdx];
  if (!holeA || !holeB) return;

  // Một lỗ chỉ giữ một chốt. Dọn joint cũ trước khi tạo joint mới.
  joints
    .filter(joint =>
      (joint.partAId === partAId && joint.holeAIdx === holeAIdx) ||
      (joint.partBId === partAId && joint.holeBIdx === holeAIdx) ||
      (joint.partAId === partBId && joint.holeAIdx === holeBIdx) ||
      (joint.partBId === partBId && joint.holeBIdx === holeBIdx)
    )
    .map(joint => joint.id)
    .forEach(jointId => removeJoint(jointId));

  // 1. Tạo hình cái chốt (Pin) hiển thị ở tâm khớp
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.0, roughness: 0.85 });
  const totalPinLen = partA.height + partB.height;
  const pinRadius = (14 / 47) * 0.98; 
  const pinMesh = buildPinGeometry(pinMat, totalPinLen, pinRadius);

  // 2. Lưu lại object khớp
  const joint = {
    id: `joint_${jointIdCounter++}`,
    partAId: partAId, holeAIdx: holeAIdx,
    partBId: partBId, holeBIdx: holeBIdx,
    pinMesh: pinMesh,
    angle: initialAngle,
    // Dữ liệu Local Offset cho Cannon-es sau này
    pivotA_Local: new THREE.Vector3(holeA.x, partA.height / 2, holeA.z),
    pivotB_Local: new THREE.Vector3(holeB.x, -partB.height / 2, holeB.z)
  };

  joints.push(joint);
  scene.add(pinMesh);

  // 3. Kích hoạt tính toán vị trí lần đầu tiên
  setJointAngle(joint.id, initialAngle);

  // Khớp mới tạo phải lập tức được gom cùng hai linh kiện và pin.
  if (typeof packCluster === 'function') packCluster(partAId);
  if (typeof currentToolMode !== 'undefined' && currentToolMode !== 'select' && typeof attachGizmo === 'function') {
    attachGizmo();
    if (transformControl) transformControl.setMode(currentToolMode);
  }

  updateJointsUI();
  cancelSnapMode();
  if (typeof recordAssemblyHistory === 'function') recordAssemblyHistory('Tạo khớp nối');
}

function executeDirectJoin() {
  const partAId = document.getElementById('select-join-part-a').value;
  const partBId = document.getElementById('select-join-part-b').value;
  const holeAIdx = parseInt(document.getElementById('select-join-hole-a').value) || 0;
  const holeBIdx = parseInt(document.getElementById('select-join-hole-b').value) || 0;

  if (!partAId || !partBId) return showTemporaryNotice('Vui lòng chọn đủ cả Thanh 1 và Thanh 2 để ghép!');
  if (partAId === partBId) return showTemporaryNotice('Không thể ghép một thanh với chính nó!');

  createJointBetweenHoles(partAId, holeAIdx, partBId, holeBIdx, chosenJoinAngle);
  setSidebarTab('joints');
  showTemporaryNotice(`Đã ghép thành công: Lỗ ${holeAIdx + 1} ↔ Lỗ ${holeBIdx + 1} với góc ${chosenJoinAngle}°!`);
}

function setJointAngle(jointId, angleDeg) {
  const j = joints.find(item => item.id === jointId);
  if (!j) return;

  const partA = parts.find(p => p.id === j.partAId);
  const partB = parts.find(p => p.id === j.partBId);
  if (!partA || !partB) return;

  const holeA = partA.holes[j.holeAIdx];
  const holeB = partB.holes[j.holeBIdx];

  j.angle = angleDeg;

  // Lấy tọa độ thế giới (World Position) của Lỗ A
  partA.root.updateMatrixWorld(true);
  const worldPosA = new THREE.Vector3(holeA.x, partA.height / 2, holeA.z);
  worldPosA.applyMatrix4(partA.root.matrixWorld);

  // Đặt chốt (Pin) vào đúng Lỗ A
  if (j.pinMesh) {
    const pinLocalPosition = worldPosA.clone();
    const pinWorldQuaternion = new THREE.Quaternion();
    partA.root.getWorldQuaternion(pinWorldQuaternion);

    if (j.pinMesh.parent) {
      j.pinMesh.parent.worldToLocal(pinLocalPosition);
      const pinParentWorldQuaternion = new THREE.Quaternion();
      j.pinMesh.parent.getWorldQuaternion(pinParentWorldQuaternion);
      j.pinMesh.quaternion.copy(pinParentWorldQuaternion.invert().multiply(pinWorldQuaternion));
    } else {
      j.pinMesh.quaternion.copy(pinWorldQuaternion);
    }
    j.pinMesh.position.copy(pinLocalPosition);
  }

  // Tính góc xoay Quaternion của bản lề
  const angleRad = (angleDeg * Math.PI) / 180;
  const jointQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleRad);

  // Góc xoay của Thanh B = Góc của Thanh A + Góc của Bản lề
  const worldQuatA = new THREE.Quaternion();
  partA.root.getWorldQuaternion(worldQuatA);
  const worldQuatB = worldQuatA.clone().multiply(jointQuat);

  // Khoảng cách từ tâm Thanh B đến Lỗ B (Mặt dưới)
  const flushY = partB.height / 2;
  const localHoleB = new THREE.Vector3(holeB.x, -flushY, holeB.z);

  // Xoay vector khoảng cách này theo góc của Thanh B
  const rotatedHoleB = localHoleB.applyQuaternion(worldQuatB);

  // Tịnh tiến Thanh B trong hệ tọa độ của parent để Lỗ B trùng khít Lỗ A.
  const worldPositionB = worldPosA.clone().sub(rotatedHoleB);
  if (partB.root.parent) {
    const parentWorldQuaternion = new THREE.Quaternion();
    partB.root.parent.getWorldQuaternion(parentWorldQuaternion);
    const parentInverseQuaternion = parentWorldQuaternion.invert();
    const localPositionB = partB.root.parent.worldToLocal(worldPositionB);
    partB.root.position.copy(localPositionB);
    partB.root.quaternion.copy(parentInverseQuaternion.multiply(worldQuatB));
  } else {
    partB.root.position.copy(worldPositionB);
    partB.root.quaternion.copy(worldQuatB);
  }

  // Cập nhật UI
  const valEl = document.getElementById(`val-joint-${jointId}`);
  if (valEl) valEl.innerText = `${angleDeg}°`;
}

// CẬP NHẬT TRONG FILE: 4_assembly.js
function removeJoint(jointId) {
  const idx = joints.findIndex(j => j.id === jointId);
  if (idx !== -1) {
    const j = joints[idx];
    
    // Xóa triệt để chốt (Pin) bất kể nó đang nằm ở Scene hay trong Cụm (Cluster)
    if (j.pinMesh) {
      if (j.pinMesh.parent) {
        j.pinMesh.parent.remove(j.pinMesh);
      }
      
      // Dọn rác bộ nhớ (Dispose) để phần mềm không bị nặng dần theo thời gian
      j.pinMesh.traverse(child => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }
    
    // Xóa data khớp nối khỏi mảng
    joints.splice(idx, 1);
    updateJointsUI();
    if (typeof recordAssemblyHistory === 'function') recordAssemblyHistory('Tháo khớp nối');

    // Rã cụm hiện tại để làm mới lại ma trận không gian, tránh lỗi lệch Gizmo
    if (typeof unpackCluster === 'function') {
      unpackCluster();
    }
    if (typeof detachGizmo === 'function') {
      detachGizmo();
    }
  }
}

// ==========================================
// XÓA VÀ QUẢN LÝ
// ==========================================

function deletePartById(partId) {
  if (!partId) return false;

  if (typeof currentClusterPartIds !== 'undefined' && currentClusterPartIds.includes(partId)) {
    if (typeof detachGizmo === 'function') detachGizmo();
    if (typeof unpackCluster === 'function') unpackCluster();
  }

  const connectedJoints = joints.filter(j => j.partAId === partId || j.partBId === partId);
  connectedJoints.forEach(j => removeJoint(j.id));

  const idx = parts.findIndex(p => p.id === partId);
  if (idx === -1) return false;

  if (parts[idx].root) {
    partsGroup.remove(parts[idx].root);
  }
  parts.splice(idx, 1);
  socketConnections = socketConnections.filter(connection => connection.partAId !== partId && connection.partBId !== partId);

  if (selectedPartId !== partId) {
    updatePartsCountBadge();
    refreshJoinDropdowns();
    if (typeof recordAssemblyHistory === 'function') recordAssemblyHistory('Xóa linh kiện');
    return true;
  }

  highlightBox.visible = false;
  if (typeof removeGlowEffect === 'function') removeGlowEffect();
  document.getElementById('floating-part-hud').classList.add('hidden');
  while (holeBadgesGroup.children.length > 0) holeBadgesGroup.remove(holeBadgesGroup.children[0]);
  selectedPartId = null;
  document.getElementById('inspector-no-selection').classList.remove('hidden');
  document.getElementById('inspector-active-panel').classList.add('hidden');
  const appearanceControls = document.getElementById('appearance-controls');
  if (appearanceControls) appearanceControls.classList.add('hidden');
  updatePartsCountBadge();
  refreshJoinDropdowns();
  if (typeof recordAssemblyHistory === 'function') recordAssemblyHistory('Xóa linh kiện');
  return true;
}

function deleteSelectedPart() {
  return deletePartById(selectedPartId);
}

function clearAllParts() {
  while (joints.length > 0) removeJoint(joints[0].id);
  while (parts.length > 0) {
    partsGroup.remove(parts[0].root);
    parts.shift();
  }
  socketConnections = [];
  highlightBox.visible = false;
  document.getElementById('floating-part-hud').classList.add('hidden');
  while (holeBadgesGroup.children.length > 0) holeBadgesGroup.remove(holeBadgesGroup.children[0]);
  selectedPartId = null;
  cancelSnapMode();
  updatePartsCountBadge();
  document.getElementById('inspector-no-selection').classList.remove('hidden');
  document.getElementById('inspector-active-panel').classList.add('hidden');
  const appearanceControls = document.getElementById('appearance-controls');
  if (appearanceControls) appearanceControls.classList.add('hidden');
  refreshJoinDropdowns();
  if (typeof recordAssemblyHistory === 'function') recordAssemblyHistory('Xóa toàn bộ linh kiện');
}

function duplicateSelectedPart() {
  const part = parts.find(p => p.id === selectedPartId);
  if (!part) return;
  if (part.customSourceId && typeof spawnCustomPart === 'function') {
    spawnCustomPart(part.customSourceId);
    return;
  }
  spawnZMROBOBeam(part.holes.length, part.colorHex, part.name.split(' #')[0]);
}

function setPartColor(colorHex) {
  const part = parts.find(p => p.id === selectedPartId);
  if (!part) return;
  const color = new THREE.Color(colorHex);
  part.colorHex = color.getHex();
  if (!part.root) return;

  part.root.traverse(node => {
    if (!node.isMesh || node.userData.isHoleAnchor) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const originalMaterials = node.userData.glowOriginalMaterial
      ? (Array.isArray(node.userData.glowOriginalMaterial)
        ? node.userData.glowOriginalMaterial
        : [node.userData.glowOriginalMaterial])
      : [];
    [...materials, ...originalMaterials].forEach(material => {
      if (!material || !material.color) return;
      material.color.copy(color);
      material.needsUpdate = true;
    });
  });
  if (typeof recordAssemblyHistory === 'function') recordAssemblyHistory(`Đổi màu ${part.name}`);
}