function createJointBetweenHoles(partAId, holeAIdx, partBId, holeBIdx, initialAngle = 40) {
  const partA = parts.find(p => p.id === partAId);
  const partB = parts.find(p => p.id === partBId);
  if (!partA || !partB || partA === partB) return;

  if (partA.joinKey === 'connector_pin' || partB.joinKey === 'connector_pin') {
    showTemporaryNotice('Không thể dùng trình ghép tự động cho chốt rời, vui lòng chọn dầm hoặc thanh!');
    return;
  }

  // TÍNH NĂNG KHÓA ĐA ĐIỂM (MULTI-POINT LOCKING)
  // Nếu giữa 2 thanh này đã có 1 chốt, việc cắm thêm chốt thứ 2 sẽ khóa cứng (lock) không cho xoay nữa.
  const existingJoint = joints.find(j => 
    (j.partAId === partAId && j.partBId === partBId) || 
    (j.partAId === partBId && j.partBId === partAId)
  );

  const holeA = partA.holes[holeAIdx];
  const holeB = partB.holes[holeBIdx];
  if (!holeA || !holeB) return;

  const pinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.0, roughness: 0.85 });
  const totalPinLen = partA.height + partB.height;
  const pinRadius = (14 / 47) * 0.98; 
  const pinMesh = buildPinGeometry(pinMat, totalPinLen, pinRadius);

  // Lấy vị trí thế giới tuyệt đối để tránh lỗi ma trận cha con
  partA.root.updateMatrixWorld(true);
  const worldPosA = new THREE.Vector3(holeA.x, 0, holeA.z || 0);
  worldPosA.applyMatrix4(partA.root.matrixWorld);

  if (existingJoint) {
    // KHÓA CỨNG: Đã có chốt, chỉ sinh ra chốt ảo để khóa
    existingJoint.isLocked = true; // Đánh dấu khóa
    pinMesh.position.copy(worldPosA);
    partsGroup.add(pinMesh); // Bỏ pin độc lập vào partsGroup
    
    joints.push({
      id: `joint_${jointIdCounter++}`,
      partAId: partAId, holeAIdx: holeAIdx,
      partBId: partBId, holeBIdx: holeBIdx,
      pinMesh: pinMesh,
      isSecondaryLock: true // Đánh dấu là chốt khóa phụ
    });
    
    updateJointsUI();
    showTemporaryNotice('Đã cắm chốt thứ 2: Thanh đã bị khóa cứng, không thể xoay!');
    return;
  }

  // TẠO BẢN LỀ MỚI (Hinge)
  const pivotGroup = new THREE.Group();
  
  const localPosA = new THREE.Vector3(holeA.x, partA.height / 2, holeA.z);
  pivotGroup.position.copy(localPosA);
  partA.root.add(pivotGroup); 

  const TOLERANCE_GAP = 0.015;
  const flushY = (partB.height / 2) + TOLERANCE_GAP;

  partsGroup.remove(partB.root);
  pivotGroup.add(partB.root);

  partB.root.position.set(-holeB.x, flushY, -holeB.z);
  partB.root.rotation.set(0, 0, 0);

  pinMesh.position.set(0, 0, 0);
  pivotGroup.add(pinMesh);

  pivotGroup.rotation.y = (initialAngle * Math.PI) / 180;

  joints.push({
    id: `joint_${jointIdCounter++}`,
    partAId: partAId, holeAIdx: holeAIdx,
    partBId: partBId, holeBIdx: holeBIdx,
    pinMesh: pinMesh,
    pivotGroup: pivotGroup,
    partBHeight: partB.height,
    partBRoot: partB.root,
    angle: initialAngle,
    isLocked: false
  });

  updateJointsUI();
  cancelSnapMode();
}

function setJointAngle(jointId, angleDeg) {
  const j = joints.find(item => item.id === jointId);
  if (j && j.pivotGroup && !j.isLocked && !j.isSecondaryLock) {
    j.angle = angleDeg;
    j.pivotGroup.rotation.y = (angleDeg * Math.PI) / 180;
    const valEl = document.getElementById(`val-joint-${jointId}`);
    if (valEl) valEl.innerText = `${angleDeg}°`;
  }
}

// TÍNH NĂNG RESET VỀ GỐC
function resetJointAngle(jointId) {
  setJointAngle(jointId, 0);
  const slider = document.querySelector(`input[data-joint-id="${jointId}"]`);
  if (slider) slider.value = 0;
}

function removeJoint(jointId) {
  const idx = joints.findIndex(j => j.id === jointId);
  if (idx !== -1) {
    const j = joints[idx];
    
    // Xóa chốt khóa phụ
    if (j.isSecondaryLock) {
      partsGroup.remove(j.pinMesh);
      // Mở khóa cho chốt chính
      const mainJoint = joints.find(m => m.partAId === j.partAId && m.partBId === j.partBId && !m.isSecondaryLock);
      if (mainJoint) mainJoint.isLocked = false;
    } 
    // Xóa chốt chính (Bản lề)
    else if (j.partBRoot && j.pivotGroup) {
      // BẢO TỒN TỌA ĐỘ KHI THÁO: Dùng ma trận thế giới để vật thể không bị bay mất
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      j.partBRoot.getWorldPosition(worldPos);
      j.partBRoot.getWorldQuaternion(worldQuat);

      j.pivotGroup.remove(j.partBRoot);
      partsGroup.add(j.partBRoot);
      
      j.partBRoot.position.copy(worldPos);
      j.partBRoot.quaternion.copy(worldQuat);
      
      // HỦY DIỆT RÁC: Xóa sổ hoàn toàn pivot và pin
      if(j.pivotGroup.parent) j.pivotGroup.parent.remove(j.pivotGroup);
    }
    
    joints.splice(idx, 1);
    updateJointsUI();
  }
}

function startHoleSnapping(partId, holeIdx) {
  pendingSnapSource = { partId, holeIdx };
  const banner = document.getElementById('snap-guide-banner');
  const text = document.getElementById('snap-guide-text');
  const part = parts.find(p => p.id === partId);
  text.innerText = `Đã chọn Lỗ ${holeIdx + 1} của ${part.name}. Nhấp chuột vào một lỗ trên thanh khác để ghép chốt!`;
  banner.classList.remove('hidden');

  parts.forEach(p => {
    if (p.id !== partId && p.root) {
      p.root.traverse(node => {
        if (node.userData && node.userData.isHoleAnchor) {
          node.material.opacity = 0.85;
        }
      });
    }
  });
}

function cancelSnapMode() {
  pendingSnapSource = null;
  document.getElementById('snap-guide-banner').classList.add('hidden');
  parts.forEach(p => {
    if (p.root) {
      p.root.traverse(node => {
        if (node.userData && node.userData.isHoleAnchor) node.material.opacity = 0.0;
      });
    }
  });
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

function toggleAssemblyExplode() {
  isExploded = !isExploded;
  document.getElementById('label-explode').innerText = isExploded ? 'Lắp Khít (Assemble)' : 'Tách Rời (Explode)';

  const targetLift = isExploded ? 3.0 : 0.0;
  joints.forEach(j => {
    if (j.partBRoot) {
      const startY = j.partBRoot.position.y;
      const endY = (j.baseFlushY !== undefined ? j.baseFlushY : (j.partBHeight / 2)) + targetLift;
      const startPinY = j.pinMesh ? j.pinMesh.position.y : 0;
      const endPinY = targetLift * 0.5;
      const startTime = performance.now();
      function step(now) {
        const p = Math.min((now - startTime) / 400, 1);
        const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
        j.partBRoot.position.y = startY + (endY - startY) * ease;
        if (j.pinMesh) j.pinMesh.position.y = startPinY + (endPinY - startPinY) * ease;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
  });
}