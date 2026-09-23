// ==========================================
// FILE: 18_surface_interaction.js
// CHUC NANG: Quet socket tren be mat va ho tro ghep tu dong bang phim tat.
// ==========================================

class SurfaceInteractionScanner {
  constructor() {
    this.maxAutoSnapDistance = 4;
    this.radiusTolerance = SOCKET_RADIUS_TOLERANCE;
  }

  getSockets(part) {
    return getPartSockets(part).filter(socket =>
      (socket.type === 'male' || socket.type === 'female') && socket.locking !== false
    );
  }

  areCompatible(source, target) {
    if (!source || !target || source.type === target.type) return false;
    return Math.abs((Number(source.radius) || 0) - (Number(target.radius) || 0)) <= this.radiusTolerance;
  }

  findNearestTarget(sourcePartId, sourceSocketId) {
    const sourcePart = parts.find(part => part.id === sourcePartId);
    if (!sourcePart) return null;
    const sourceSocket = this.getSockets(sourcePart).find(socket => socket.id === sourceSocketId);
    if (!sourceSocket || connectionManager.isSocketOccupied(sourcePart.id, sourceSocket.id)) return null;

    const sourceWorld = getSocketWorldData(sourcePart, sourceSocket);
    let best = null;
    parts.forEach(part => {
      if (part.id === sourcePart.id || !part.root || !part.root.visible) return;
      this.getSockets(part).forEach(targetSocket => {
        if (connectionManager.isSocketOccupied(part.id, targetSocket.id)) return;
        if (!this.areCompatible(sourceSocket, targetSocket)) return;
        const targetWorld = getSocketWorldData(part, targetSocket);
        const distance = sourceWorld.position.distanceTo(targetWorld.position);
        if (distance > this.maxAutoSnapDistance || (best && distance >= best.distance)) return;
        best = {
          source: { part: sourcePart, socket: sourceSocket, world: sourceWorld },
          target: { part, socket: targetSocket, world: targetWorld },
          distance
        };
      });
    });
    return best;
  }

  rotateActiveSource(partId, axis = 'y', degrees = 90) {
    if (typeof packCluster !== 'function' || typeof activeClusterGroup === 'undefined') return false;
    if (!currentClusterPartIds.includes(partId)) packCluster(partId);
    const radians = THREE.MathUtils.degToRad(degrees);
    activeClusterGroup.rotation[axis] += radians;
    activeClusterGroup.updateMatrixWorld(true);
    if (typeof transformControl !== 'undefined' && transformControl) transformControl.updateMatrixWorld();
    if (typeof highlightBox !== 'undefined' && highlightBox && highlightBox.visible) {
      highlightBox.setFromObject(activeClusterGroup);
    }
    return true;
  }

  clearScan() {
    parts.forEach(part => {
      if (!part.root) return;
      part.root.traverse(node => {
        if (!node.userData || !node.userData.isSocket || !node.material) return;
        node.material.opacity = 0;
      });
    });
  }

  styleSocketBadges(sourcePartId, sourceSocketId) {
    const compatibleKeys = new Set(this.scanCompatibleSockets(sourcePartId, sourceSocketId)
      .map(item => `${item.part.id}:${item.socket.id}`));
    holeBadgesGroup.children.forEach(badge => {
      if (!badge.userData || !badge.userData.isSocketBadge) return;
      const key = `${badge.userData.partId}:${badge.userData.socketId}`;
      const isSource = key === `${sourcePartId}:${sourceSocketId}`;
      const isCompatible = compatibleKeys.has(key);
      badge.material.color.set(isSource ? 0xfacc15 : isCompatible ? 0x22c55e : 0x64748b);
      badge.material.opacity = isSource || isCompatible ? 1 : 0.28;
      badge.scale.setScalar(isSource ? 1.3 : isCompatible ? 1.18 : 1.05);
    });
  }

  resetSocketBadges() {
    holeBadgesGroup.children.forEach(badge => {
      if (!badge.userData || !badge.userData.isSocketBadge) return;
      badge.material.color.set(badge.userData.occupied ? 0x475569 : 0xffffff);
      badge.material.opacity = badge.userData.occupied ? 0.35 : 1;
      badge.scale.setScalar(1.1);
    });
  }

  scanCompatibleSockets(sourcePartId, sourceSocketId) {
    const sourcePart = parts.find(part => part.id === sourcePartId);
    if (!sourcePart) return [];
    const sourceSocket = this.getSockets(sourcePart).find(socket => socket.id === sourceSocketId);
    if (!sourceSocket) return [];
    const matches = [];
    parts.forEach(part => {
      if (part.id === sourcePart.id) return;
      this.getSockets(part).forEach(socket => {
        if (!connectionManager.isSocketOccupied(part.id, socket.id) && this.areCompatible(sourceSocket, socket)) {
          matches.push({ part, socket });
        }
      });
    });
    return matches;
  }
}

const surfaceInteractionScanner = new SurfaceInteractionScanner();

window.addEventListener('keydown', event => {
  if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (typeof directAssemblyState === 'undefined' || !directAssemblyState) return;

  if (event.key === 'Escape') {
    clearDirectAssemblyMode();
    surfaceInteractionScanner.clearScan();
    return;
  }

  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    const axis = event.shiftKey ? 'x' : 'y';
    surfaceInteractionScanner.rotateActiveSource(directAssemblyState.partId, axis, 90);
    showTemporaryNotice(`Đã xoay cụm 90 độ theo trục ${axis.toUpperCase()}. Nhấn Enter để tự ghép.`);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    const candidate = surfaceInteractionScanner.findNearestTarget(
      directAssemblyState.partId,
      directAssemblyState.socketId
    );
    if (!candidate) {
      showTemporaryNotice('Không tìm thấy socket đối ứng còn trống trong phạm vi quét.');
      return;
    }
    completeDirectAssembly(candidate.target);
  }
});
