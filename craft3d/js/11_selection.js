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
    const socketHit = intersects.find(hit => hit.object.userData && (hit.object.userData.isSocket || hit.object.userData.isHoleAnchor));
    if (pendingSnapSource.socketId && socketHit) {
      const targetPartId = getSelectionPartId(socketHit.object);
      const targetSocketId = socketHit.object.userData.socketId;
      if (targetPartId && targetSocketId && targetPartId !== pendingSnapSource.partId) {
        const sourcePart = parts.find(part => part.id === pendingSnapSource.partId);
        const targetPart = parts.find(part => part.id === targetPartId);
        const sourceSocket = getPartSockets(sourcePart).find(socket => socket.id === pendingSnapSource.socketId);
        const targetSocket = getPartSockets(targetPart).find(socket => socket.id === targetSocketId);
        if (sourceSocket && targetSocket && sourceSocket.type !== targetSocket.type) {
          connectionManager.snapCandidate({
            source: { part: sourcePart, socket: sourceSocket, world: getSocketWorldData(sourcePart, sourceSocket) },
            target: { part: targetPart, socket: targetSocket, world: getSocketWorldData(targetPart, targetSocket) }
          }, activeClusterGroup);
          connectionManager.connectCandidate({
            source: { part: sourcePart, socket: sourceSocket },
            target: { part: targetPart, socket: targetSocket }
          });
          if (typeof packCluster === 'function') packCluster(sourcePart.id);
          showTemporaryNotice(`Đã hít socket: ${sourceSocket.id} ↔ ${targetSocket.id}`);
          cancelSnapMode();
        }
      }
      return;
    }

    const anchorHit = socketHit;
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

  const socketsContainer = document.getElementById('inspector-holes-list');
  if (socketsContainer) {
    socketsContainer.innerHTML = '';
    const sockets = typeof getPartSockets === 'function' ? getPartSockets(part) : [];
    if (sockets.length > 0) {
      sockets.forEach((socket, index) => {
        const button = document.createElement('button');
        const label = socket.type === 'male' ? 'Chốt' : 'Lỗ';
        button.className = 'px-2.5 py-1.5 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 font-mono text-[10px] font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5';
        button.innerHTML = `<i data-lucide="crosshair" class="w-3 h-3"></i> ${label} ${index + 1}`;
        button.onclick = () => startSocketSnapping(part.id, socket.id);
        socketsContainer.appendChild(button);
      });
      lucide.createIcons();
    } else {
      socketsContainer.innerHTML = '<span class="text-[10px] text-slate-500">Chi tiết này chưa có socket kết nối.</span>';
    }
  }

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

function startSocketSnapping(partId, socketId) {
  const part = parts.find(item => item.id === partId);
  const socket = part && getPartSockets(part).find(item => item.id === socketId);
  if (!part || !socket) return;

  pendingSnapSource = { partId, socketId };
  const banner = document.getElementById('snap-guide-banner');
  const text = document.getElementById('snap-guide-text');
  text.innerText = `Đã chọn socket ${socket.id} của ${part.name}. Chọn socket đối ứng trên chi tiết khác.`;
  banner.classList.remove('hidden');

  parts.forEach(otherPart => {
    if (otherPart.id === partId) return;
    getPartSockets(otherPart).forEach(otherSocket => {
      if (otherSocket.object3D && otherSocket.object3D.material) otherSocket.object3D.material.opacity = 0.85;
    });
  });
}