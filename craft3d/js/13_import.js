// ==========================================
// FILE: 13_import.js
// CHỨC NĂNG: Nhập mô hình GLB/GLTF từ máy người dùng.
// ==========================================

function setupModelImport() {
  const input = document.getElementById('model-file-input');
  const metadataInput = document.getElementById('model-metadata-input');
  if (!input) return;

  input.addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    if (file) importModelFile(file);
    input.value = '';
  });

  if (metadataInput) {
    metadataInput.addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      if (file) importSocketMetadataFile(file);
      metadataInput.value = '';
    });
  }
}

function importModelFile(file) {
  if (typeof THREE.GLTFLoader === 'undefined') {
    showTemporaryNotice('Chưa tải được mô-đun đọc GLB/GLTF. Vui lòng tải lại trang.');
    return;
  }

  const extension = file.name.split('.').pop().toLowerCase();
  if (extension !== 'glb' && extension !== 'gltf') {
    showTemporaryNotice('Chỉ hỗ trợ file .GLB hoặc .GLTF.');
    return;
  }

  showTemporaryNotice(`Đang đọc mô hình ${file.name}...`);

  const reader = new FileReader();
  reader.onload = event => {
    const loader = new THREE.GLTFLoader();
    const data = event.target.result;

    loader.parse(
      data,
      '',
      gltf => registerImportedModel(gltf.scene, file.name, gltf.scene.userData),
      error => {
        console.error('Không thể đọc mô hình GLB/GLTF:', error);
        showTemporaryNotice('Không thể đọc file. Với GLTF, hãy dùng bản có texture nhúng hoặc chuyển sang GLB.');
      }
    );
  };
  reader.onerror = () => showTemporaryNotice('Không thể đọc file từ máy tính.');
  if (extension === 'gltf') {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
}

function importSocketMetadataFile(file) {
  if (!file.name.toLowerCase().endsWith('.json')) {
    showTemporaryNotice('File socket phải có định dạng .JSON.');
    return;
  }

  const reader = new FileReader();
  reader.onload = event => {
    try {
      const metadata = JSON.parse(event.target.result);
      const part = selectedPartId ? parts.find(item => item.id === selectedPartId) : null;
      if (!part) {
        showTemporaryNotice('Hãy nhập và chọn model 3D trước khi nạp metadata socket.');
        return;
      }
      applySocketMetadata(part, metadata);
      showTemporaryNotice(`Đã nạp ${part.sockets.length} socket cho ${part.name}.`);
    } catch (error) {
      console.error('Metadata socket không hợp lệ:', error);
      showTemporaryNotice('Không thể đọc metadata socket JSON.');
    }
  };
  reader.readAsText(file);
}

function registerImportedModel(model, filename, embeddedMetadata = {}) {
  if (!model) {
    showTemporaryNotice('File không chứa scene 3D hợp lệ.');
    return;
  }

  model.name = filename.replace(/\.(glb|gltf)$/i, '');
  model.traverse(node => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  // Đưa model về kích thước và vị trí dễ quan sát trong sàn làm việc.
  const bounds = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  const largestDimension = Math.max(size.x, size.y, size.z);
  if (largestDimension > 0) {
    const scale = Math.min(8 / largestDimension, 1);
    model.scale.multiplyScalar(scale);
  }

  model.updateMatrixWorld(true);
  const normalizedBounds = new THREE.Box3().setFromObject(model);
  const normalizedCenter = new THREE.Vector3();
  const normalizedSize = new THREE.Vector3();
  normalizedBounds.getCenter(normalizedCenter);
  normalizedBounds.getSize(normalizedSize);

  model.position.sub(normalizedCenter);
  model.position.y += normalizedSize.y / 2;
  findSafeSpawnPosition(model);

  const part = registerPart(
    model.name,
    'imported-model',
    model,
    [],
    null,
    Math.max(normalizedSize.y, 0.1)
  );

  const metadata = embeddedMetadata && (embeddedMetadata.sockets || embeddedMetadata.connections)
    ? embeddedMetadata
    : { sockets: discoverSocketNodes(model) };
  applySocketMetadata(part, metadata);

  const socketCount = part.sockets.length;
  showTemporaryNotice(socketCount > 0
    ? `Đã nhập mô hình: ${part.name} (${socketCount} socket).`
    : `Đã nhập mô hình: ${part.name}. Chưa có metadata socket.`);
}

function applySocketMetadata(part, metadata) {
  const definitions = metadata.sockets || metadata.connections || [];
  if (!Array.isArray(definitions)) return;

  part.sockets.forEach(socket => {
    if (socket.object3D && socket.object3D.parent) socket.object3D.parent.remove(socket.object3D);
  });
  part.sockets = [];

  definitions.forEach((definition, index) => {
    part.addSocket({
      ...definition,
      id: definition.id || `socket_${index + 1}`,
      pos: definition.pos || definition.position
    });
  });
}

function discoverSocketNodes(model) {
  const sockets = [];
  model.updateMatrixWorld(true);
  model.traverse(node => {
    const name = (node.name || '').toLowerCase();
    if (!/^((socket|hole|pin)[_-])/.test(name)) return;

    const position = model.worldToLocal(node.getWorldPosition(new THREE.Vector3())).toArray();
    const worldAxis = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
    const axis = worldAxis.transformDirection(model.matrixWorld.clone().invert()).toArray();
    sockets.push({
      id: node.name,
      type: name.startsWith('pin') ? 'male' : 'female',
      radius: Number(node.userData.radius) || (14 / 47) * 0.98,
      pos: position,
      axis
    });
  });
  return sockets;
}
