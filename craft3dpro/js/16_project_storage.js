// ==========================================
// FILE: 16_project_storage.js
// CHUC NANG: Luu va mo trang thai du an Craft3D bang file JSON.
// ==========================================

function serializeTransform(object3D) {
  return {
    position: object3D.position.toArray(),
    quaternion: object3D.quaternion.toArray(),
    scale: object3D.scale.toArray()
  };
}

function restoreTransform(object3D, transform) {
  if (!transform) return;
  if (Array.isArray(transform.position)) object3D.position.fromArray(transform.position);
  if (Array.isArray(transform.quaternion)) object3D.quaternion.fromArray(transform.quaternion);
  if (Array.isArray(transform.scale)) object3D.scale.fromArray(transform.scale);
}

function serializeProject() {
  return {
    format: 'craft3d-project',
    version: 1,
    savedAt: new Date().toISOString(),
    parts: parts.map(part => ({
      id: part.id,
      name: part.name,
      type: part.type,
      colorHex: part.colorHex,
      height: part.height,
      holes: part.holes,
      customSourceId: part.customSourceId || null,
      transform: serializeTransform(part.root)
    })),
    joints: joints.map(joint => ({
      partAId: joint.partAId,
      holeAIdx: joint.holeAIdx,
      partBId: joint.partBId,
      holeBIdx: joint.holeBIdx,
      angle: joint.angle
    })),
    socketConnections: socketConnections.map(connection => ({ ...connection }))
  };
}

function downloadProject(project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `craft3d-project-${new Date().toISOString().slice(0, 10)}.craft3d.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function saveProjectFile() {
  if (!parts.length) {
    showTemporaryNotice('Chua co linh kien de luu thanh du an.');
    return;
  }
  downloadProject(serializeProject());
}

function createPartFromProject(record) {
  let part = null;
  const color = Number.isFinite(record.colorHex) ? record.colorHex : 0x94a3b8;
  const holeCount = Array.isArray(record.holes) && record.holes.length > 0 ? record.holes.length : 7;

  if (record.customSourceId && typeof spawnCustomPart === 'function') {
    const definition = customPartsDatabase.find(item => item.id === record.customSourceId);
    if (definition) {
      spawnCustomPart(record.customSourceId);
      part = parts[parts.length - 1];
    }
  }

  if (!part && record.type === 'pin' && typeof spawnStandalonePin === 'function') part = spawnStandalonePin();
  if (!part && record.type === 'dv-bar' && typeof spawnDVBar === 'function') part = spawnDVBar(holeCount);
  if (!part && record.type === 'yellow-bracket' && typeof spawnYellowBracket === 'function') part = spawnYellowBracket();
  if (!part && record.type === 'zmrobo-beam' && typeof spawnZMROBOBeam === 'function') {
    part = spawnZMROBOBeam(holeCount, color, record.name || 'Dầm Kỹ Thuật');
  }

  if (part) restoreTransform(part.root, record.transform);
  return part;
}

function loadProjectData(project) {
  if (!project || project.format !== 'craft3d-project' || !Array.isArray(project.parts)) {
    showTemporaryNotice('File du an khong dung dinh dang Craft3D.');
    return;
  }

  clearAllParts();
  const idMap = new Map();
  const missingCustomParts = [];

  project.parts.forEach(record => {
    const part = createPartFromProject(record);
    if (!part) {
      if (record.customSourceId) missingCustomParts.push(record.name || record.customSourceId);
      return;
    }
    idMap.set(record.id, part.id);
    part.name = record.name || part.name;
  });

  joints.length = 0;
  socketConnections = [];
  (project.joints || []).forEach(record => {
    const partAId = idMap.get(record.partAId);
    const partBId = idMap.get(record.partBId);
    if (partAId && partBId) createJointBetweenHoles(partAId, record.holeAIdx, partBId, record.holeBIdx, record.angle);
  });

  (project.socketConnections || []).forEach(record => {
    const partAId = idMap.get(record.partAId);
    const partBId = idMap.get(record.partBId);
    if (!partAId || !partBId) return;
    socketConnections.push({
      ...record,
      partAId,
      partBId
    });
  });

  updatePartsCountBadge();
  refreshJoinDropdowns();
  updateJointsUI();
  if (missingCustomParts.length) {
    showTemporaryNotice(`Da mo du an, nhung thieu model tuy chinh: ${missingCustomParts.join(', ')}`);
  } else {
    showTemporaryNotice('Da mo du an Craft3D.');
  }
}

function setupProjectStorage() {
  const input = document.getElementById('project-file-input');
  if (!input || input.dataset.projectReady === 'true') return;
  input.dataset.projectReady = 'true';
  input.addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadProjectData(JSON.parse(reader.result));
      } catch (error) {
        console.error('Khong the mo file du an:', error);
        showTemporaryNotice('Khong the doc file du an.');
      }
    };
    reader.readAsText(file);
    input.value = '';
  });
}
