// ==========================================
// FILE: 15_assembly_history.js
// CHỨC NĂNG: Lịch sử snapshot, Undo/Redo và xem lại từng bước lắp ghép.
// ==========================================

const assemblyHistory = [];
let assemblyHistoryIndex = -1;
let isRestoringAssemblyHistory = false;

function initAssemblyHistory() {
  if (assemblyHistory.length === 0) recordAssemblyHistory('Trạng thái ban đầu', true);
}

function getSocketSnapshot(socket) {
  return {
    id: socket.id,
    type: socket.type,
    radius: socket.radius,
    pos: socket.position.toArray(),
    axis: socket.axis.toArray(),
    legacyIndex: socket.legacyIndex
  };
}

function createAssemblySnapshot(label) {
  return {
    label,
    parts: parts.map(part => {
      part.root.updateMatrixWorld(true);
      return {
        id: part.id,
        name: part.name,
        type: part.type,
        holes: part.holes.map(hole => ({ ...hole })),
        sockets: part.sockets.map(getSocketSnapshot),
        colorHex: part.colorHex,
        height: part.height,
        customSourceId: part.customSourceId,
        root: part.root.clone(true),
        position: part.root.getWorldPosition(new THREE.Vector3()).toArray(),
        quaternion: part.root.getWorldQuaternion(new THREE.Quaternion()).toArray(),
        scale: part.root.getWorldScale(new THREE.Vector3()).toArray()
      };
    }),
    joints: joints.map(joint => ({
      id: joint.id,
      partAId: joint.partAId,
      holeAIdx: joint.holeAIdx,
      partBId: joint.partBId,
      holeBIdx: joint.holeBIdx,
      angle: joint.angle,
      pinMesh: joint.pinMesh ? joint.pinMesh.clone(true) : null
    }))
  };
}

function getSnapshotSignature(snapshot) {
  return {
    parts: snapshot.parts.map(part => ({
      id: part.id,
      position: part.position,
      quaternion: part.quaternion,
      scale: part.scale,
      colorHex: part.colorHex
    })),
    joints: snapshot.joints.map(joint => ({
      partAId: joint.partAId,
      holeAIdx: joint.holeAIdx,
      partBId: joint.partBId,
      holeBIdx: joint.holeBIdx,
      angle: joint.angle
    }))
  };
}

function recordAssemblyHistory(label, force = false) {
  if (isRestoringAssemblyHistory && !force) return;
  const snapshot = createAssemblySnapshot(label);
  const current = assemblyHistory[assemblyHistoryIndex];
  if (current && JSON.stringify(getSnapshotSignature(current)) === JSON.stringify(getSnapshotSignature(snapshot))) return;

  assemblyHistory.splice(assemblyHistoryIndex + 1);
  assemblyHistory.push(snapshot);
  assemblyHistoryIndex = assemblyHistory.length - 1;
  renderAssemblyHistory();
}

function undoAssembly() {
  if (assemblyHistoryIndex <= 0) return;
  assemblyHistoryIndex -= 1;
  restoreAssemblySnapshot(assemblyHistory[assemblyHistoryIndex]);
}

function redoAssembly() {
  if (assemblyHistoryIndex >= assemblyHistory.length - 1) return;
  assemblyHistoryIndex += 1;
  restoreAssemblySnapshot(assemblyHistory[assemblyHistoryIndex]);
}

function jumpToAssemblyHistory(index) {
  const targetIndex = Number(index);
  if (!Number.isInteger(targetIndex) || !assemblyHistory[targetIndex]) return;
  assemblyHistoryIndex = targetIndex;
  restoreAssemblySnapshot(assemblyHistory[targetIndex]);
}

function clearCurrentAssemblyForHistory() {
  if (typeof detachGizmo === 'function') detachGizmo();
  if (typeof unpackCluster === 'function') unpackCluster();
  joints.forEach(joint => {
    if (joint.pinMesh && joint.pinMesh.parent) joint.pinMesh.parent.remove(joint.pinMesh);
  });
  parts.forEach(part => {
    if (part.root && part.root.parent) part.root.parent.remove(part.root);
  });
  joints.length = 0;
  parts.length = 0;
  socketConnections = [];
}

function restoreAssemblySnapshot(snapshot) {
  isRestoringAssemblyHistory = true;
  clearCurrentAssemblyForHistory();

  snapshot.parts.forEach(savedPart => {
    const root = savedPart.root.clone(true);
    const socketMarkers = [];
    root.traverse(node => {
      if (node.userData && node.userData.isSocket) socketMarkers.push(node);
    });
    socketMarkers.forEach(node => {
      if (node.parent) node.parent.remove(node);
    });
    root.position.fromArray(savedPart.position);
    root.quaternion.fromArray(savedPart.quaternion);
    root.scale.fromArray(savedPart.scale);
    root.userData = { partId: savedPart.id, isModularPart: true };

    const restoredPart = new PartObject({
      id: savedPart.id,
      name: savedPart.name,
      type: savedPart.type,
      root,
      holes: savedPart.holes,
      sockets: savedPart.sockets,
      colorHex: savedPart.colorHex,
      height: savedPart.height
    });
    restoredPart.customSourceId = savedPart.customSourceId;
    parts.push(restoredPart);
    partsGroup.add(root);
  });

  snapshot.joints.forEach(savedJoint => {
    const joint = {
      id: savedJoint.id,
      partAId: savedJoint.partAId,
      holeAIdx: savedJoint.holeAIdx,
      partBId: savedJoint.partBId,
      holeBIdx: savedJoint.holeBIdx,
      angle: savedJoint.angle,
      pinMesh: savedJoint.pinMesh ? savedJoint.pinMesh.clone(true) : null
    };
    if (joint.pinMesh) scene.add(joint.pinMesh);
    joints.push(joint);
  });

  selectedPartId = null;
  currentClusterPartIds = [];
  updatePartsCountBadge();
  updateJointsUI();
  refreshJoinDropdowns();
  if (typeof clearSelection === 'function') clearSelection();
  isRestoringAssemblyHistory = false;
  renderAssemblyHistory();
}

function renderAssemblyHistory() {
  const undoButton = document.getElementById('history-undo');
  const redoButton = document.getElementById('history-redo');
  if (undoButton) undoButton.disabled = assemblyHistoryIndex <= 0;
  if (redoButton) redoButton.disabled = assemblyHistoryIndex >= assemblyHistory.length - 1;
}
