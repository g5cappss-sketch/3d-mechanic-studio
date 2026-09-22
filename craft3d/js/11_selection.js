// ==========================================
// FILE: 11_selection.js
// CHỨC NĂNG: Xử lý click chọn vật thể chuẩn xác & Hiệu ứng phát sáng (Glow)
// ==========================================

let currentlyHighlightedMeshes = [];
let glowTime = 0;

function getSelectionPartId(object) {
  let current = object;
  while (current && current !== scene) {
    if (current.userData && current.userData.partId) return current.userData.partId;
    current = current.parent;
  }
  return null;
}

function getPartFromSelectionHit() {
  const hitPoint = new THREE.Vector3();
  let closestPart = null;
  let closestDistance = Infinity;

  parts.forEach(part => {
    if (!part.root || !part.root.visible) return;

    const bounds = new THREE.Box3().setFromObject(part.root);
    bounds.expandByScalar(0.12);
    if (raycaster.ray.intersectBox(bounds, hitPoint)) {
      const distance = hitPoint.distanceTo(raycaster.ray.origin);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPart = part;
      }
    }
  });

  return closestPart;
}

function getHoleFromPointer(event, excludedPartId) {
  const rect = canvas.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const projected = new THREE.Vector3();
  let closestHole = null;
  let closestDistance = 28;

  parts.forEach(part => {
    if (part.id === excludedPartId || !part.root || !part.root.visible || !part.holes) return;

    part.root.updateMatrixWorld(true);
    part.holes.forEach(hole => {
      projected.set(hole.x, part.height / 2, hole.z || 0);
      projected.applyMatrix4(part.root.matrixWorld).project(camera);

      const screenX = (projected.x * 0.5 + 0.5) * rect.width;
      const screenY = (-projected.y * 0.5 + 0.5) * rect.height;
      const distance = Math.hypot(screenX - pointerX, screenY - pointerY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestHole = { partId: part.id, holeIndex: hole.index };
      }
    });
  });

  return closestHole;
}

// 1. GHI ĐÈ HÀM BẮT CLICK CHUỘT
window.onCanvasPointerDown = function(event) {
  if (!canvas || !camera) return;

  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  if (typeof transformControl !== 'undefined' && transformControl && transformControl.dragging) return;

  const selectableRoots = parts
    .map(part => part.root)
    .filter(root => root && root.visible);
  const intersects = raycaster.intersectObjects(selectableRoots, true);

  if (pendingSnapSource) {
    const anchorHit = intersects.find(hit => hit.object.userData && hit.object.userData.isHoleAnchor);
    const fallbackHole = getHoleFromPointer(event, pendingSnapSource.partId);
    const targetPartId = anchorHit
      ? getSelectionPartId(anchorHit.object)
      : fallbackHole && fallbackHole.partId;
    const targetHoleIndex = anchorHit
      ? anchorHit.object.userData.holeIndex
      : fallbackHole && fallbackHole.holeIndex;

    if (targetPartId && targetHoleIndex !== undefined && targetPartId !== pendingSnapSource.partId) {
      createJointBetweenHoles(
        pendingSnapSource.partId,
        pendingSnapSource.holeIdx,
        targetPartId,
        targetHoleIndex,
        chosenJoinAngle
      );
    }
    return;
  }

  const partHit = intersects
    .map(hit => getSelectionPartId(hit.object))
    .find(partId => partId);
  const hitboxPart = getPartFromSelectionHit();

  if (partHit || hitboxPart) {
    selectPart(partHit || hitboxPart.id);
  } else {
    clearSelection();
  }
};

// 2. GHI ĐÈ HÀM CHỌN VẬT THỂ
window.selectPart = function(id) {
  selectedPartId = id;
  const part = parts.find(p => p.id === id);
  if (!part) return;

  // Gói cụm & Kích hoạt Gizmo
  if (typeof packCluster === 'function') packCluster(id);
  
  if (typeof currentToolMode !== 'undefined' && currentToolMode !== 'select') {
    if (typeof attachGizmo === 'function') {
      attachGizmo(); 
      transformControl.setMode(currentToolMode);
    }
  } else {
    if (typeof detachGizmo === 'function') detachGizmo();
  }

  // TẮT KHUNG HỘP CŨ - BẬT HIỆU ỨNG PHÁT SÁNG MỚI
  if (highlightBox) highlightBox.visible = false; 
  applyGlowEffect(typeof currentClusterPartIds !== 'undefined' ? currentClusterPartIds : [id]);

  // Cập nhật UI Menu bên phải
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
  
  if (typeof refreshJoinDropdowns === 'function') refreshJoinDropdowns(part.id);
};

// 3. HÀM XÓA CHỌN (KHI CLICK RA NGOÀI)
function clearSelection() {
  selectedPartId = null;
  if (typeof unpackCluster === 'function') unpackCluster();
  if (typeof detachGizmo === 'function') detachGizmo();
  
  removeGlowEffect();
  if (highlightBox) highlightBox.visible = false;
  
  document.getElementById('floating-part-hud').classList.add('hidden');
  while (holeBadgesGroup.children.length > 0) holeBadgesGroup.remove(holeBadgesGroup.children[0]);
  document.getElementById('inspector-no-selection').classList.remove('hidden');
  document.getElementById('inspector-active-panel').classList.add('hidden');
}

// ==========================================
// LOGIC HIỆU ỨNG PHÁT SÁNG (GLOWING)
// ==========================================

function applyGlowEffect(partIds) {
  removeGlowEffect(); // Xóa sáng các vật cũ

  partIds.forEach(id => {
    const p = parts.find(it => it.id === id);
    if (p && p.root) {
      p.root.traverse(node => {
        // Tìm các bề mặt (mesh) và bỏ qua các chốt tàng hình (holeAnchor)
        if (node.isMesh && node.material && node.material.emissive && !node.userData.isHoleAnchor) {
          // Mỗi mesh chỉ lưu material gốc một lần để chọn lại không làm đổi trạng thái vật thể.
          const glowMaterial = node.material.clone();
          glowMaterial.emissive.setHex(0x0284c7);
          glowMaterial.emissiveIntensity = 0.1;
          node.userData.glowOriginalMaterial = node.material;
          node.material = glowMaterial;
          currentlyHighlightedMeshes.push(node);
        }
      });
    }
  });
}

function removeGlowEffect() {
  currentlyHighlightedMeshes.forEach(node => {
    if (node.userData.glowOriginalMaterial) {
      node.material.dispose();
      node.material = node.userData.glowOriginalMaterial;
      delete node.userData.glowOriginalMaterial;
    }
  });
  currentlyHighlightedMeshes = [];
}

// Hàm này sẽ được gọi liên tục mỗi khung hình (60fps) để tạo nhịp thở sáng (Pulse)
window.pulseGlowEffect = function() {
  if (currentlyHighlightedMeshes.length > 0) {
    glowTime += 0.08;
    // Dùng sóng sin để cường độ sáng chạy lên xuống mượt mà từ 0.1 đến 0.6
    const intensity = 0.1 + Math.abs(Math.sin(glowTime)) * 0.5; 
    
    currentlyHighlightedMeshes.forEach(node => {
      if (node.material) {
        node.material.emissiveIntensity = intensity;
      }
    });
  }
};