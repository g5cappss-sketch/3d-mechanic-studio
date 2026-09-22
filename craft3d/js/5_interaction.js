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
  holesContainer.innerHTML = '';
  if (part.holes && part.holes.length > 0) {
    part.holes.forEach(h => {
      const btn = document.createElement('button');
      btn.className = 'px-2.5 py-1.5 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 font-mono text-[10px] font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5';
      btn.innerHTML = `<i data-lucide="crosshair" class="w-3 h-3"></i> Lỗ ${h.index + 1}`;
      btn.onclick = () => startHoleSnapping(part.id, h.index);
      holesContainer.appendChild(btn);
    });
    lucide.createIcons();
  } else {
    holesContainer.innerHTML = '<span class="text-[10px] text-slate-500">Chi tiết này không có lỗ dập để ghép chốt.</span>';
  }

  document.getElementById('inp-pos-x').value = part.root.position.x.toFixed(1);
  document.getElementById('inp-pos-y').value = part.root.position.y.toFixed(1);
  document.getElementById('inp-pos-z').value = part.root.position.z.toFixed(1);
  document.getElementById('inp-part-rot').value = Math.round((part.root.rotation.y * 180) / Math.PI);
  document.getElementById('val-part-rot').innerText = `${Math.round((part.root.rotation.y * 180) / Math.PI)}°`;

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
        if (node.userData && node.userData.isHoleAnchor) node.material.opacity = 0.0;
      });
    }
  });
}

function toggleAssemblyExplode() {
  isExploded = !isExploded;
  const label = document.getElementById('label-explode');
  label.innerText = isExploded ? 'Lắp Khít (Assemble)' : 'Tách Rời (Explode)';

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

function resetCamera() {
  setCameraView('iso');
}

function toggleAutoRotate() {
  autoRotate = !autoRotate;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 2.0;
  const btn = document.getElementById('toggle-autorotate');
  if (autoRotate) btn.classList.add('text-cyan-400', 'bg-slate-800');
  else btn.classList.remove('text-cyan-400', 'bg-slate-800');
}