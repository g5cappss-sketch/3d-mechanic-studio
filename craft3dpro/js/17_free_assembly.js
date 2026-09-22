// ==========================================
// FILE: 17_free_assembly.js
// CHUC NANG: Lap ghep tu do bang cach click socket/lỗ truc tiep tren mo hinh.
// ==========================================

let directAssemblyState = null;

function getDirectSocketHit(intersects) {
  const hit = intersects.find(item => {
    const data = item.object && item.object.userData;
    return data && data.isSocket;
  });
  if (!hit) return null;

  let partId = hit.object.userData.partId || null;
  let current = hit.object.parent;
  while (!partId && current && current !== scene) {
    partId = current.userData && current.userData.partId;
    current = current.parent;
  }
  if (!partId) partId = getSelectionPartId(hit.object);

  const part = parts.find(item => item.id === partId);
  if (!part) return null;
  const socketId = hit.object.userData.socketId;
  const socket = getPartSockets(part).find(item => item.id === socketId);
  if (!socket) return null;
  return { part, socket, object: hit.object };
}

function setDirectSocketMarkers(visible) {
  parts.forEach(part => {
    if (!part.root) return;
    part.root.traverse(node => {
      if (!node.userData || !node.userData.isSocket || !node.material) return;
      node.material.opacity = visible && node.userData.partId !== directAssemblyState?.partId ? 0.8 : 0;
    });
  });
}

function clearDirectAssemblyMode() {
  directAssemblyState = null;
  setDirectSocketMarkers(false);
  const banner = document.getElementById('snap-guide-banner');
  if (banner && !pendingSnapSource) banner.classList.add('hidden');
}

function beginDirectAssembly(hit) {
  if (typeof unpackCluster === 'function') unpackCluster();
  if (typeof connectionManager !== 'undefined') {
    // Giải phóng đúng socket đang chọn để có thể đổi lỗ mà không phá các socket khác.
    connectionManager.removeConnection(hit.part.id, hit.socket.id);
  }

  directAssemblyState = {
    partId: hit.part.id,
    socketId: hit.socket.id
  };
  setDirectSocketMarkers(true);
  const banner = document.getElementById('snap-guide-banner');
  const text = document.getElementById('snap-guide-text');
  if (banner && text) {
    text.innerText = `Đã chọn ${hit.socket.type === 'male' ? 'đầu chốt' : 'lỗ'} ${hit.socket.id}. Chọn socket đối ứng để lắp.`;
    banner.classList.remove('hidden');
  }
}

function completeDirectAssembly(hit) {
  const sourcePart = parts.find(item => item.id === directAssemblyState.partId);
  if (!sourcePart || sourcePart.id === hit.part.id) {
    showTemporaryNotice('Hãy chọn socket trên một chi tiết khác.');
    return;
  }

  const sourceSocket = getPartSockets(sourcePart).find(item => item.id === directAssemblyState.socketId);
  const targetOccupied = typeof connectionManager !== 'undefined' && connectionManager.isSocketOccupied(hit.part.id, hit.socket.id);
  if (!sourceSocket || targetOccupied || sourceSocket.type === hit.socket.type || !sourceSocket.locking || !hit.socket.locking) {
    if (targetOccupied) showTemporaryNotice('Lỗ này đã có chốt. Hãy chọn một lỗ khác.');
    else showTemporaryNotice('Socket không tương thích. Cần một đầu male và một lỗ female hợp lệ.');
    return;
  }

  if (typeof packCluster === 'function') packCluster(sourcePart.id);
  const candidate = {
    source: { part: sourcePart, socket: sourceSocket, world: getSocketWorldData(sourcePart, sourceSocket) },
    target: { part: hit.part, socket: hit.socket, world: getSocketWorldData(hit.part, hit.socket) }
  };

  if (!connectionManager.snapCandidate(candidate, activeClusterGroup)) {
    showTemporaryNotice('Không thể đưa socket vào vị trí này.');
    return;
  }

  if (!connectionManager.connectCandidate(candidate)) {
    showTemporaryNotice('Socket này đã được sử dụng. Hãy chọn socket khác.');
    return;
  }
  packCluster(sourcePart.id);
  clearDirectAssemblyMode();
  showTemporaryNotice(`Đã lắp ${sourceSocket.id} vào ${hit.socket.id}.`);
}

function handleFreeAssemblyPointerDown(event) {
  if (!canvas || !camera || event.button !== 0) return false;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const roots = parts.map(part => part.root).filter(root => root && root.visible);
  const intersects = raycaster.intersectObjects(roots, true);
  const socketHit = getDirectSocketHit(intersects);
  if (!socketHit) return false;

  if (!directAssemblyState) beginDirectAssembly(socketHit);
  else completeDirectAssembly(socketHit);
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}

const previousCanvasPointerDown = window.onCanvasPointerDown;
window.onCanvasPointerDown = function(event) {
  if (handleFreeAssemblyPointerDown(event)) return;
  previousCanvasPointerDown(event);
};

window.cancelFreeAssembly = clearDirectAssemblyMode;
