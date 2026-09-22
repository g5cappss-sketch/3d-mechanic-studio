// ==========================================
// FILE: 10_cluster.js
// CHỨC NĂNG: Quản lý Cụm chi tiết (Cluster)
// CẬP NHẬT: Fix lỗi sai lệch tọa độ khung Highlight Bounding Box
// ==========================================
let activeClusterGroup;
let currentClusterPartIds = [];

function initClusterManager() {
  activeClusterGroup = new THREE.Group();
  activeClusterGroup.name = "ActiveClusterGroup";
  scene.add(activeClusterGroup);
}

function getConnectedPartIds(startPartId) {
  const visited = new Set();
  const queue = [startPartId];
  visited.add(startPartId);

  while (queue.length > 0) {
    const currentId = queue.shift();
    joints.forEach(j => {
      if (j.partAId === currentId && !visited.has(j.partBId)) {
        visited.add(j.partBId);
        queue.push(j.partBId);
      }
      if (j.partBId === currentId && !visited.has(j.partAId)) {
        visited.add(j.partAId);
        queue.push(j.partAId);
      }
    });
  }
  return Array.from(visited);
}

function packCluster(clickedPartId) {
  unpackCluster(); 

  currentClusterPartIds = getConnectedPartIds(clickedPartId);
  const clickedPart = parts.find(p => p.id === clickedPartId);
  if (!clickedPart) return;

  // Reset Group về trung tâm trước
  activeClusterGroup.position.set(0, 0, 0);
  activeClusterGroup.rotation.set(0, 0, 0);
  activeClusterGroup.scale.set(1, 1, 1);
  activeClusterGroup.updateMatrixWorld(true);

  // Ép ma trận của linh kiện được click cập nhật mới nhất
  clickedPart.root.updateMatrixWorld(true);
  
  // Đưa tâm của cụm về đúng vị trí và góc nghiêng của linh kiện đó
  activeClusterGroup.position.copy(clickedPart.root.position);
  activeClusterGroup.quaternion.copy(clickedPart.root.quaternion);
  activeClusterGroup.updateMatrixWorld(true);

  // Gom linh kiện vào cụm
  currentClusterPartIds.forEach(id => {
    const p = parts.find(it => it.id === id);
    if (p && p.root) {
        activeClusterGroup.attach(p.root);
    }
  });

  // Gom chốt khóa
  joints.forEach(j => {
    if (currentClusterPartIds.includes(j.partAId)) {
        if (j.pinMesh) activeClusterGroup.attach(j.pinMesh);
    }
  });

  // FIX QUAN TRỌNG: Cập nhật lại toàn bộ ma trận sau khi gom
  // Tránh lỗi khung highlight bay lơ lửng lệch mô hình
  activeClusterGroup.updateMatrixWorld(true);
}

function unpackCluster() {
  if (currentClusterPartIds.length === 0) return;

  activeClusterGroup.updateMatrixWorld(true);

  currentClusterPartIds.forEach(id => {
    const p = parts.find(it => it.id === id);
    if (p && p.root) {
        partsGroup.attach(p.root);
    }
  });

  joints.forEach(j => {
    if (currentClusterPartIds.includes(j.partAId)) {
        if (j.pinMesh) scene.attach(j.pinMesh);
    }
  });

  currentClusterPartIds = [];
}