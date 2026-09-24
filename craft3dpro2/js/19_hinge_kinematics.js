// ==========================================
// FILE: 19_hinge_kinematics.js
// CHỨC NĂNG: Xử lý Động học (Kinematics) xoay bản lề độc lập.
// ==========================================

window.setSocketAngle = function(connId, angleDeg, movingPartId = null) {
  const conn = socketConnections.find(c => c.id === connId);
  if (!conn) return;

    if (typeof isRigidSocketConnection === 'function' && isRigidSocketConnection(conn)) {
        showTemporaryNotice('Khớp cứng có từ hai chốt, không thể xoay.');
        return;
    }

    const pinId = [conn.partAId, conn.partBId]
        .find(id => parts.find(part => part.id === id)?.type === 'pin');
    if (!pinId) return;

    const barIds = socketConnections
        .filter(candidate => candidate.partAId === pinId || candidate.partBId === pinId)
        .map(candidate => candidate.partAId === pinId ? candidate.partBId : candidate.partAId)
        .filter(id => parts.find(part => part.id === id)?.type !== 'pin');
    if (new Set(barIds).size !== 2) return;

    const connectedBarId = movingPartId && barIds.includes(movingPartId)
        ? barIds.find(id => id !== movingPartId)
        : [conn.partAId, conn.partBId].find(id => id !== pinId);
    const rootPart = parts.find(part => part.id === connectedBarId);
    const leafPart = parts.find(part =>
        barIds.includes(part.id) && (movingPartId ? part.id === movingPartId : part.id !== connectedBarId)
    );
    if (!rootPart || !leafPart) return;

  if (conn.angle === undefined) conn.angle = 0;
  const deltaAngle = angleDeg - conn.angle;
  conn.angle = angleDeg;

    // Rã cụm trước khi xoay để các root trở lại cùng hệ tọa độ partsGroup.
  if (typeof unpackCluster === 'function') unpackCluster();

        // Chốt là trục cố định; socket trên thanh Gốc là pivot vật lý.
        rootPart.root.updateMatrixWorld(true);
        const pivotConnection = socketConnections.find(candidate =>
            (candidate.partAId === pinId && candidate.partBId === rootPart.id) ||
            (candidate.partBId === pinId && candidate.partAId === rootPart.id)
        );
        if (!pivotConnection) return;
        const rootSocketId = pivotConnection.partAId === rootPart.id
            ? pivotConnection.socketAId
            : pivotConnection.socketBId;
    const rootSocket = getPartSockets(rootPart).find(socket => socket.id === rootSocketId);
        if (!rootSocket) return;
    const pivotData = getSocketWorldData(rootPart, rootSocket);
  const pivotWorld = pivotData.position.clone();
  const axisWorld = pivotData.axis.clone();

  // Tính toán góc xoay Quaternion
  const q = new THREE.Quaternion();
  q.setFromAxisAngle(axisWorld, THREE.MathUtils.degToRad(deltaAngle));

    // Quét nhánh Lá nhưng không đi xuyên qua Gốc hoặc chính chốt bản lề.
  const visited = new Set();
  const visitedJoints = new Set();
    const queue = [leafPart.id];
    visited.add(leafPart.id);
    visited.add(rootPart.id);
    visited.add(pinId);

  while (queue.length > 0) {
      const currentId = queue.shift();
      
      // Quét các khớp nối ốc vít cũ
      joints.forEach(j => {
          if (j.partAId === currentId && !visited.has(j.partBId)) { visited.add(j.partBId); queue.push(j.partBId); visitedJoints.add(j); }
          if (j.partBId === currentId && !visited.has(j.partAId)) { visited.add(j.partAId); queue.push(j.partAId); visitedJoints.add(j); }
      });
      
      // Quét các chốt ngàm (Sockets)
      socketConnections.forEach(c => {
          if (c.partAId === currentId && !visited.has(c.partBId)) { visited.add(c.partBId); queue.push(c.partBId); }
          if (c.partBId === currentId && !visited.has(c.partAId)) { visited.add(c.partAId); queue.push(c.partAId); }
      });
  }
  // Xoay theo world transform để không phụ thuộc parent/cluster trước đó.
  visited.forEach(id => {
      const p = parts.find(item => item.id === id);
      if (p && p.root) {
          p.root.updateMatrixWorld(true);
          const worldPosition = p.root.getWorldPosition(new THREE.Vector3());
          const worldQuaternion = p.root.getWorldQuaternion(new THREE.Quaternion());
          worldPosition.sub(pivotWorld).applyQuaternion(q).add(pivotWorld);
          worldQuaternion.premultiply(q);

          const parent = p.root.parent;
          if (parent) {
              const parentQuaternion = parent.getWorldQuaternion(new THREE.Quaternion());
              p.root.position.copy(parent.worldToLocal(worldPosition));
              p.root.quaternion.copy(parentQuaternion.invert().multiply(worldQuaternion));
          } else {
              p.root.position.copy(worldPosition);
              p.root.quaternion.copy(worldQuaternion);
          }
          p.root.updateMatrixWorld(true);
      }
  });

  // Chốt vật lý vẫn là một Part cố định; chỉ các pinMesh của joint cũ cần xoay theo Lá.
  visitedJoints.forEach(j => {
      if (j.pinMesh) {
          j.pinMesh.position.sub(pivotWorld);
          j.pinMesh.position.applyQuaternion(q);
          j.pinMesh.position.add(pivotWorld);
          j.pinMesh.quaternion.premultiply(q);
          j.pinMesh.updateMatrixWorld(true);
      }
  });

  const valEl = document.getElementById(`val-socket-${conn.id}`);
  if (valEl) valEl.innerText = `${angleDeg}°`;

  // Tái đóng gói thành khối thực thể để Box Selection và Drag hoạt động mượt
    if (typeof packCluster === 'function') packCluster(rootPart.id);
  if (selectedPartId && typeof selectPart === 'function') selectPart(selectedPartId);
    refreshHingeHandles();
};

function isRigidSocketConnection(connection) {
    const endpoints = [connection.partAId, connection.partBId];
    const pinId = endpoints.find(id => parts.find(part => part.id === id)?.type === 'pin');
    if (!pinId) return false;

    const pinBarIds = new Set(socketConnections
        .filter(candidate => candidate.partAId === pinId || candidate.partBId === pinId)
        .map(candidate => candidate.partAId === pinId ? candidate.partBId : candidate.partAId)
        .filter(id => parts.find(part => part.id === id)?.type !== 'pin'));

    if (pinBarIds.size < 2) return false;

    const barPair = Array.from(pinBarIds).sort().join('|');
    const pinIds = new Set();
    parts.filter(part => part.type === 'pin').forEach(pin => {
        const connectedBars = new Set(socketConnections
            .filter(candidate => candidate.partAId === pin.id || candidate.partBId === pin.id)
            .map(candidate => candidate.partAId === pin.id ? candidate.partBId : candidate.partAId)
            .filter(id => parts.find(part => part.id === id)?.type !== 'pin'));
        if (Array.from(connectedBars).sort().join('|') === barPair) pinIds.add(pin.id);
    });

    return pinIds.size >= 2;
}

let activePinDepthDrag = null;
let activeHingeDrag = null;
let hingeHandlesGroup = null;

function initHingeHandles() {
    if (hingeHandlesGroup || typeof scene === 'undefined') return;
    hingeHandlesGroup = new THREE.Group();
    hingeHandlesGroup.name = 'HingeHandles';
    scene.add(hingeHandlesGroup);
}

function clearHingeHandles() {
    if (!hingeHandlesGroup) return;
    while (hingeHandlesGroup.children.length > 0) {
        const child = hingeHandlesGroup.children[0];
        hingeHandlesGroup.remove(child);
        child.traverse(node => {
            node.geometry?.dispose();
            if (Array.isArray(node.material)) node.material.forEach(material => material.dispose());
            else node.material?.dispose();
        });
    }
}

function refreshHingeHandles() {
    initHingeHandles();
    clearHingeHandles();
    if (!hingeHandlesGroup) return;

    const seen = new Set();
    parts.filter(part => part.type !== 'pin').forEach(part => {
        const connection = getHingeConnectionForPart(part.id);
        if (!connection) return;

        const pinId = [connection.partAId, connection.partBId]
            .find(id => parts.find(item => item.id === id)?.type === 'pin');
        const barIds = [...new Set(socketConnections
            .filter(item => item.partAId === pinId || item.partBId === pinId)
            .map(item => item.partAId === pinId ? item.partBId : item.partAId)
            .filter(id => parts.find(item => item.id === id)?.type !== 'pin'))];
        if (barIds.length !== 2) return;

        const hingeKey = `${pinId}|${barIds.sort().join('|')}`;
        if (seen.has(hingeKey)) return;
        seen.add(hingeKey);

        const rootPart = parts.find(item => item.id === barIds[0]);
        const rootConnection = socketConnections.find(item =>
            (item.partAId === pinId && item.partBId === rootPart.id) ||
            (item.partBId === pinId && item.partAId === rootPart.id)
        );
        if (!rootConnection) return;
        const leafPart = parts.find(item => item.id === barIds[1]);
        const leafConnection = socketConnections.find(item =>
            (item.partAId === pinId && item.partBId === leafPart.id) ||
            (item.partBId === pinId && item.partAId === leafPart.id)
        );
        if (!leafConnection) return;
        const rootSocketId = rootConnection.partAId === rootPart.id
            ? rootConnection.socketAId
            : rootConnection.socketBId;
        const rootSocket = getPartSockets(rootPart).find(socket => socket.id === rootSocketId);
        if (!rootSocket) return;

        const pivot = getSocketWorldData(rootPart, rootSocket);
        const axis = pivot.axis.clone().normalize();
        const basisA = new THREE.Vector3(0, 1, 0);
        if (Math.abs(axis.dot(basisA)) > 0.9) basisA.set(1, 0, 0);
        basisA.projectOnPlane(axis).normalize();
        const basisB = new THREE.Vector3().crossVectors(axis, basisA).normalize();
        const radius = 1.45;
        const handleQuaternion = new THREE.Quaternion()
            .setFromRotationMatrix(new THREE.Matrix4().makeBasis(basisA, basisB, axis));
        const handleCenter = pivot.position.clone();
        const handleGroup = new THREE.Group();
        handleGroup.position.copy(handleCenter);
        handleGroup.quaternion.copy(handleQuaternion);
        handleGroup.userData = { isHingeHandle: true, connectionId: leafConnection.id };
        handleGroup.renderOrder = 1000;

        const visualMaterial = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.98,
            depthTest: false,
            depthWrite: false
        });
        const visualArc = new THREE.Mesh(
            new THREE.TorusGeometry(radius, 0.075, 14, 64, Math.PI),
            visualMaterial
        );
        visualArc.rotation.z = -Math.PI / 2;
        visualArc.userData = { isHingeHandle: true, connectionId: leafConnection.id };
        visualArc.renderOrder = 1001;
        handleGroup.add(visualArc);

        const hitMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false
        });
        const hitArc = new THREE.Mesh(
            new THREE.TorusGeometry(radius, 0.4, 10, 48, Math.PI),
            hitMaterial
        );
        hitArc.rotation.z = -Math.PI / 2;
        hitArc.userData = { isHingeHandle: true, connectionId: leafConnection.id, isHingeHitbox: true };
        hitArc.renderOrder = 1002;
        handleGroup.add(hitArc);

        const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ee, depthTest: false, depthWrite: false });
        [-1, 1].forEach(side => {
            const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.52, 16), arrowMaterial.clone());
            arrow.position.set(side * radius, 0, 0);
            arrow.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            arrow.userData = { isHingeHandle: true, connectionId: leafConnection.id };
            arrow.renderOrder = 1003;
            handleGroup.add(arrow);
        });
        hingeHandlesGroup.add(handleGroup);
    });
}

function getHingeHandleHit(event) {
    if (!hingeHandlesGroup) return null;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const previousThreshold = raycaster.params.Line.threshold;
    raycaster.params.Line.threshold = 0.35;
    const hit = raycaster.intersectObjects(hingeHandlesGroup.children, true)[0];
    raycaster.params.Line.threshold = previousThreshold;
    return hit?.object?.userData?.isHingeHandle ? hit.object.userData : null;
}

function beginHingeHandleDrag(event, connectionId) {
    const connection = socketConnections.find(item => item.id === connectionId);
    if (!connection || isRigidSocketConnection(connection)) return false;
    const pinId = [connection.partAId, connection.partBId]
        .find(id => parts.find(part => part.id === id)?.type === 'pin');
    const barId = [connection.partAId, connection.partBId]
        .find(id => id !== pinId);
    if (!pinId || !barId) return false;
    activeHingeDrag = {
        connection,
        partId: barId,
        startX: event.clientX,
        startAngle: Number(connection.angle) || 0,
        pointerId: event.pointerId
    };
    if (typeof controls !== 'undefined' && controls) controls.enabled = false;
    canvas.setPointerCapture?.(event.pointerId);
    showTemporaryNotice('Giữ mũi tên cong và kéo ngang để xoay bản lề.');
    return true;
}

function getHingeConnectionForPart(partId) {
    const candidates = socketConnections.filter(connection =>
        connection.partAId === partId || connection.partBId === partId
    );

    for (const connection of candidates) {
        const pinId = [connection.partAId, connection.partBId]
            .find(id => parts.find(part => part.id === id)?.type === 'pin');
        if (!pinId || isRigidSocketConnection(connection)) continue;

        const barIds = new Set(socketConnections
            .filter(candidate => candidate.partAId === pinId || candidate.partBId === pinId)
            .map(candidate => candidate.partAId === pinId ? candidate.partBId : candidate.partAId)
            .filter(id => parts.find(part => part.id === id)?.type !== 'pin'));
        if (barIds.size === 2 && barIds.has(partId)) return connection;
    }
    return null;
}

function beginHingeDrag(part, event) {
    const connection = getHingeConnectionForPart(part.id);
    if (!connection || part.type === 'pin') return false;

    activeHingeDrag = {
        connection,
        partId: part.id,
        startX: event.clientX,
        startAngle: Number(connection.angle) || 0,
        pointerId: event.pointerId
    };
    if (canvas && canvas.setPointerCapture && event.pointerId !== undefined) {
        canvas.setPointerCapture(event.pointerId);
    }
    showTemporaryNotice('Giữ và kéo ngang để xoay bản lề.');
    return true;
}

function updateHingeDrag(event) {
    if (!activeHingeDrag) return;
    const deltaX = event.clientX - activeHingeDrag.startX;
    const angle = THREE.MathUtils.clamp(activeHingeDrag.startAngle + deltaX, -180, 180);
    setSocketAngle(activeHingeDrag.connection.id, angle, activeHingeDrag.partId);
}

function finishHingeDrag(event) {
    if (!activeHingeDrag) return;
    if (canvas && canvas.releasePointerCapture && event.pointerId !== undefined) {
        try { canvas.releasePointerCapture(event.pointerId); } catch (error) { /* pointer already released */ }
    }
    activeHingeDrag = null;
    if (typeof controls !== 'undefined' && controls) controls.enabled = true;
}

function getOccupiedPinConnection(partId, socketId) {
    return socketConnections.find(connection =>
        (connection.partAId === partId && connection.socketAId === socketId) ||
        (connection.partBId === partId && connection.socketBId === socketId)
    );
}

function beginPinDepthDrag(badgeHit, event) {
    const connection = getOccupiedPinConnection(badgeHit.part.id, badgeHit.socket.id);
    if (!connection || badgeHit.part.type !== 'pin') return false;

    if (typeof unpackCluster === 'function') unpackCluster();
    badgeHit.part.root.updateMatrixWorld(true);
    const socketData = getSocketWorldData(badgeHit.part, badgeHit.socket);
    const rect = canvas.getBoundingClientRect();
    activePinDepthDrag = {
        part: badgeHit.part,
        axis: socketData.axis.clone().normalize(),
        startPosition: badgeHit.part.root.position.clone(),
        startPointer: new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top),
        startWorldPosition: badgeHit.part.root.getWorldPosition(new THREE.Vector3()),
        connection
    };
    return true;
}

function updatePinDepthDrag(event) {
    if (!activePinDepthDrag) return;
    const rect = canvas.getBoundingClientRect();
    const start = activePinDepthDrag.startWorldPosition.clone().project(camera);
    const axisEnd = activePinDepthDrag.startWorldPosition.clone()
        .add(activePinDepthDrag.axis).project(camera);
    const screenAxis = new THREE.Vector2(
        (axisEnd.x - start.x) * rect.width * 0.5,
        -(axisEnd.y - start.y) * rect.height * 0.5
    );
    const pointer = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top)
        .sub(activePinDepthDrag.startPointer);
    const axisLengthSq = screenAxis.lengthSq();
    if (axisLengthSq < 0.0001) return;
    const screenDistance = pointer.dot(screenAxis) / axisLengthSq;
    const worldDistance = THREE.MathUtils.clamp(screenDistance, -0.48, 0.48);
    const worldPosition = activePinDepthDrag.startWorldPosition.clone()
        .addScaledVector(activePinDepthDrag.axis, worldDistance);
    const parent = activePinDepthDrag.part.root.parent;
    activePinDepthDrag.part.root.position.copy(parent
        ? parent.worldToLocal(worldPosition)
        : worldPosition);
    activePinDepthDrag.part.root.updateMatrixWorld(true);
}

function finishPinDepthDrag() {
    if (!activePinDepthDrag) return;
    const partId = activePinDepthDrag.part.id;
    activePinDepthDrag = null;
    if (typeof packCluster === 'function') packCluster(partId);
    if (typeof updateAllSocketBadges === 'function') updateAllSocketBadges();
    if (typeof updateJointsUI === 'function') updateJointsUI();
}

window.addEventListener('pointermove', updatePinDepthDrag);
window.addEventListener('pointerup', finishPinDepthDrag);
window.addEventListener('pointermove', updateHingeDrag);
window.addEventListener('pointerup', finishHingeDrag);
window.addEventListener('pointercancel', finishHingeDrag);

window.addEventListener('load', refreshHingeHandles);