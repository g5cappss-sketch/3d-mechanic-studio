// ==========================================
// FILE: 5_interaction.js
// CHỨC NĂNG: Xử lý click chuột 3D (Raycaster), chọn vật thể, và các hiệu ứng Camera.
// ==========================================

function onCanvasPointerDown(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  // Bỏ qua click vào các trục của TransformControls để gizmo tự xử lý kéo thả.
  if (intersects.length > 0 && intersects[0].object.parent && intersects[0].object.parent.name === 'TransformControls') {
    return;
  }

  if (intersects.length > 0) {
    let hit = intersects[0].object;

    if (pendingSnapSource && hit.userData && hit.userData.isHoleAnchor) {
      let curr = hit.parent;
      while (curr && !curr.userData.partId) curr = curr.parent;
      if (curr && curr.userData.partId !== pendingSnapSource.partId) {
        createJointBetweenHoles(pendingSnapSource.partId, pendingSnapSource.holeIdx, curr.userData.partId, hit.userData.holeIndex, chosenJoinAngle);
        return;
      }
    }

    while (hit && !hit.userData.partId && hit.parent && hit.parent !== scene && hit.parent !== partsGroup) {
      hit = hit.parent;
    }

    if (hit && hit.userData.partId) {
      selectPart(hit.userData.partId);
    }
  } else {
    // Click khoảng không thì rã cụm và bỏ chọn.
    if (typeof clearSelection === 'function') {
      clearSelection();
      return;
    }
    selectedPartId = null;
    if (typeof unpackCluster === 'function') unpackCluster();
    if (typeof detachGizmo === 'function') detachGizmo();
    highlightBox.visible = false;
    document.getElementById('floating-part-hud').classList.add('hidden');
    while (holeBadgesGroup.children.length > 0) holeBadgesGroup.remove(holeBadgesGroup.children[0]);
    document.getElementById('inspector-no-selection').classList.remove('hidden');
    document.getElementById('inspector-active-panel').classList.add('hidden');
  }
}

function selectPart(id) {
  selectedPartId = id;
  const part = parts.find(p => p.id === id);
  if (!part) return;

  // Gom toàn bộ các linh kiện đang liên kết thành một cụm.
  if (typeof packCluster === 'function') packCluster(id);

  if (typeof currentToolMode !== 'undefined' && currentToolMode !== 'select') {
    if (typeof attachGizmo === 'function') {
      attachGizmo();
      if (transformControl) transformControl.setMode(currentToolMode);
    }
  } else {
    if (typeof detachGizmo === 'function') detachGizmo();
  }

  if (typeof activeClusterGroup !== 'undefined') {
    highlightBox.setFromObject(activeClusterGroup);
  } else {
    highlightBox.setFromObject(part.root);
  }
  highlightBox.visible = true;

  const hud = document.getElementById('floating-part-hud');
  const hudName = document.getElementById('floating-part-name');
  if (hud && hudName) {
    hudName.innerText = part.name;
    hud.classList.remove('hidden');
  }

  update3DHoleBadges(part);

  document.getElementById('inspector-no-selection').classList.add('hidden');
  document.getElementById('inspector-active-panel').classList.remove('hidden');
  document.getElementById('inspect-part-title').innerText = part.name;
  document.getElementById('inspect-part-id').innerText = `Loại: ${part.type} • ID: ${part.id}`;

    const holesContainer = document.getElementById('inspector-holes-list');
    if (holesContainer) holesContainer.innerHTML = '';
  if (holesContainer && part.holes && part.holes.length > 0) {
    part.holes.forEach(h => {
      const btn = document.createElement('button');
      btn.className = 'px-2.5 py-1.5 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 font-mono text-[10px] font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5';
      btn.innerHTML = `<i data-lucide="crosshair" class="w-3 h-3"></i> Lỗ ${h.index + 1}`;
      btn.onclick = () => startHoleSnapping(part.id, h.index);
      holesContainer.appendChild(btn);
    });
    lucide.createIcons();
  } else if (holesContainer) {
    holesContainer.innerHTML = '<span class="text-[10px] text-slate-500">Chi tiết này không có lỗ dập để ghép chốt.</span>';
  }

  refreshJoinDropdowns(part.id);
}

function update3DHoleBadges(part) {
  while (holeBadgesGroup.children.length > 0) {
    holeBadgesGroup.remove(holeBadgesGroup.children[0]);
  }
  if (!part || !part.holes || part.holes.length === 0) return;

  part.holes.forEach(h => {
    const sprite = createTextSprite(`${h.index + 1}`);
    
    // LƯU Ý: Không set cứng vị trí position ngay tại đây nữa.
    // Thay vào đó, lưu tọa độ cục bộ (Local Space) vào userData
    sprite.userData = { 
      localX: h.x, 
      localY: part.height / 2 + 0.6, 
      localZ: h.z || 0 
    };
    
    holeBadgesGroup.add(sprite);
  });
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
        if (node.userData && node.userData.isHoleAnchor) node.material.opacity = 0.85;
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
        if (node.userData && (node.userData.isHoleAnchor || node.userData.isSocket)) node.material.opacity = 0.0;
      });
    }
  });
}

let explodedPartStates = null;

function getPartComponents() {
  const remaining = new Set(parts.map(part => part.id));
  const components = [];

  while (remaining.size > 0) {
    const startId = remaining.values().next().value;
    const connectedIds = getConnectedPartIds(startId);
    connectedIds.forEach(id => remaining.delete(id));
    components.push(connectedIds);
  }

  return components;
}

function getJointHoleWorldPosition(partId, holeIndex) {
  const part = parts.find(item => item.id === partId);
  const hole = part && part.holes ? part.holes[holeIndex] : null;
  if (!part || !hole) return null;

  part.root.updateMatrixWorld(true);
  return new THREE.Vector3(hole.x, part.height / 2, hole.z || 0).applyMatrix4(part.root.matrixWorld);
}

function updateExplodedPins() {
  joints.forEach(joint => {
    if (!joint.pinMesh) return;
    const pointA = getJointHoleWorldPosition(joint.partAId, joint.holeAIdx);
    const pointB = getJointHoleWorldPosition(joint.partBId, joint.holeBIdx);
    if (!pointA || !pointB) return;
    joint.pinMesh.position.copy(pointA).add(pointB).multiplyScalar(0.5);
  });
}

function animatePartTransforms(targets, onComplete) {
  const startTime = performance.now();
  const starts = targets.map(target => ({
    part: target.part,
    position: target.part.root.position.clone(),
    quaternion: target.part.root.quaternion.clone()
  }));

  function step(now) {
    const progress = Math.min((now - startTime) / 450, 1);
    const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
    starts.forEach((start, index) => {
      const target = targets[index];
      start.part.root.position.lerpVectors(start.position, target.position, eased);
      start.part.root.quaternion.slerpQuaternions(start.quaternion, target.quaternion, eased);
    });
    updateExplodedPins();
    if (progress < 1) requestAnimationFrame(step);
    else if (onComplete) onComplete();
  }

  requestAnimationFrame(step);
}

function toggleAssemblyExplode() {
  if (isExploded) {
    const targets = [];
    explodedPartStates.parts.forEach(state => {
      const part = parts.find(item => item.id === state.id);
      if (part) targets.push({ part, position: state.position, quaternion: state.quaternion });
    });

    animatePartTransforms(targets, () => {
      explodedPartStates.pins.forEach(state => {
        if (state.pinMesh) {
          state.pinMesh.position.copy(state.position);
          state.pinMesh.quaternion.copy(state.quaternion);
        }
      });
      explodedPartStates = null;
    });
    isExploded = false;
    document.getElementById('label-explode').innerText = 'Tách Rời (Explode)';
    return;
  }

  if (typeof unpackCluster === 'function') unpackCluster();
  if (typeof detachGizmo === 'function') detachGizmo();

  explodedPartStates = {
    parts: parts.map(part => ({
      id: part.id,
      position: part.root.position.clone(),
      quaternion: part.root.quaternion.clone()
    })),
    pins: joints.map(joint => ({
      pinMesh: joint.pinMesh,
      position: joint.pinMesh ? joint.pinMesh.position.clone() : null,
      quaternion: joint.pinMesh ? joint.pinMesh.quaternion.clone() : null
    }))
  };

  const targets = [];
  getPartComponents().forEach(component => {
    if (component.length < 2) return;
    const center = new THREE.Vector3();
    component.forEach(id => {
      const part = parts.find(item => item.id === id);
      if (part) center.add(part.root.position);
    });
    center.multiplyScalar(1 / component.length);

    component.forEach((id, index) => {
      const part = parts.find(item => item.id === id);
      if (!part) return;
      const angle = (index / component.length) * Math.PI * 2;
      const offset = new THREE.Vector3(Math.cos(angle) * 3.5, 1.2 + (index % 2) * 0.8, Math.sin(angle) * 3.5);
      targets.push({ part, position: part.root.position.clone().sub(center).add(center).add(offset), quaternion: part.root.quaternion.clone() });
    });
  });

  if (targets.length === 0) {
    explodedPartStates = null;
    showTemporaryNotice('Chưa có cụm trục nào được ghép để tách rời.');
    return;
  }

  isExploded = true;
  document.getElementById('label-explode').innerText = 'Lắp Khít (Assemble)';
  animatePartTransforms(targets);
}

function setCameraView(view) {
  const targetPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3(0, 0.8, 0);
  if (view === 'top') targetPos.set(0, 20, 0.001);
  else if (view === 'front') targetPos.set(0, 2, 16);
  else targetPos.set(10, 11, 14);

  const startPosition = camera.position.clone();
  const startTime = performance.now();
  function step(now) {
    const p = Math.min((now - startTime) / 500, 1);
    camera.position.lerpVectors(startPosition, targetPos, p);
    controls.target.lerp(lookAt, p);
    controls.update();
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function toggleAutoRotate() {
  autoRotate = !autoRotate;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 2.0;
  const btn = document.getElementById('toggle-autorotate');
  if (autoRotate) btn.classList.add('text-cyan-400', 'bg-slate-800');
  else btn.classList.remove('text-cyan-400', 'bg-slate-800');
}