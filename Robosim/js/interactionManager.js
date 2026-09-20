let currentToolMode = 'select'; // 'select', 'translate', 'rotate'

function initInteractionManager() {
  canvas.addEventListener('pointerdown', onPointerDownInteraction);
}

function setInteractionTool(mode) {
  currentToolMode = mode;
  
  if (mode === 'translate' || mode === 'rotate') {
    if (typeof setTransformMode === 'function') {
      setTransformMode(mode);
    }
  } else if (mode === 'select') {
    // Tắt công cụ Gizmo (trục tọa độ) nếu chỉ muốn click chọn thông thường
    if (typeof transformControl !== 'undefined' && transformControl) {
      transformControl.detach();
    }
  }
}

function onPointerDownInteraction(event) {
  if (event.button !== 0) return; // Chỉ xử lý chuột trái

  // Bỏ qua nếu người dùng đang click giữ vao trục Gizmo để kéo/xoay
  if (typeof transformControl !== 'undefined' && transformControl && transformControl.dragging) return;

  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    let hit = intersects[0].object;

    // Ưu tiên 1: Đang ở chế độ Snap Pin (click để cắm chốt 2 lỗ)
    if (pendingSnapSource && hit.userData && hit.userData.isHoleAnchor) {
      let curr = hit.parent;
      while (curr && !curr.userData.partId) curr = curr.parent;
      if (curr && curr.userData.partId !== pendingSnapSource.partId) {
        createJointBetweenHoles(pendingSnapSource.partId, pendingSnapSource.holeIdx, curr.userData.partId, hit.userData.holeIndex, chosenJoinAngle);
        return;
      }
    }

    // Truy tìm object gốc của linh kiện (Part root)
    let partNode = hit;
    while (partNode && !partNode.userData.partId && partNode.parent && partNode.parent !== scene) {
      partNode = partNode.parent;
    }

    // Click ra ngoài không gian (Bỏ chọn)
    if (!partNode || !partNode.userData.partId) {
       if (hit.parent !== transformControl) {
         clearSelection();
       }
       return;
    }

    // Nhấp trúng vật thể
    if (partNode && partNode.userData.partId) {
      selectPart(partNode.userData.partId);
      
      // Bật Gizmo (Trục tọa độ) nếu đang dùng công cụ Kéo / Xoay
      if (currentToolMode === 'translate' || currentToolMode === 'rotate') {
         if (typeof attachTransformToSelected === 'function') {
             attachTransformToSelected();
         }
      }
    }
  }
}

function clearSelection() {
  if (typeof transformControl !== 'undefined' && transformControl) transformControl.detach();
  
  selectedPartId = null;
  if (typeof highlightBox !== 'undefined') highlightBox.visible = false;
  
  while (typeof holeBadgesGroup !== 'undefined' && holeBadgesGroup.children.length > 0) {
      holeBadgesGroup.remove(holeBadgesGroup.children[0]);
  }
  
  const hud = document.getElementById('floating-part-hud');
  if(hud) hud.classList.add('hidden');
  
  const noSel = document.getElementById('inspector-no-selection');
  if(noSel) noSel.classList.remove('hidden');
  
  const actPan = document.getElementById('inspector-active-panel');
  if(actPan) actPan.classList.add('hidden');
}