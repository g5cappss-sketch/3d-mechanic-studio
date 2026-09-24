// ==========================================
// FILE: 13_import.js
// CHỨC NĂNG: Nhập mô hình GLB/GLTF và quản lý kho model tùy chỉnh.
// ==========================================

const customPartsDatabase = [];

function setupModelImport() {
  const input = document.getElementById('model-file-input');
  const metadataInput = document.getElementById('model-metadata-input');
  if (!input) return;
  if (input.dataset.importReady === 'true') return;
  input.dataset.importReady = 'true';

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

  restoreCustomInventory();
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
      gltf => registerImportedModel(gltf.scene, file.name, gltf.scene.userData, {
        sourceData: data,
        sourceType: extension,
        persist: true
      }),
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
      const definitions = metadata.sockets || metadata.connections;
      if (!Array.isArray(definitions)) {
        showTemporaryNotice('JSON phải có mảng sockets hoặc connections.');
        return;
      }

      const customPart = part.customSourceId
        ? customPartsDatabase.find(item => item.id === part.customSourceId)
        : null;
      const targetParts = customPart
        ? parts.filter(item => item.customSourceId === customPart.id)
        : [part];
      targetParts.forEach(item => applySocketMetadata(item, metadata));

      if (customPart) {
        customPart.metadata = metadata;
        persistCustomPartMetadata(customPart);
      }
      showTemporaryNotice(`Đã nạp ${definitions.length} socket cho ${customPart ? customPart.name : part.name}.`);
    } catch (error) {
      console.error('Metadata socket không hợp lệ:', error);
      showTemporaryNotice('Không thể đọc metadata socket JSON.');
    }
  };
  reader.readAsText(file);
}

function registerImportedModel(model, filename, embeddedMetadata = {}, options = {}) {
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

  // Chuẩn hóa template một lần để mọi instance có cùng hitbox và tâm xoay.
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

  const discoveredSockets = discoverSocketNodes(model);
  const embeddedSockets = embeddedMetadata && (embeddedMetadata.sockets || embeddedMetadata.connections);
  const metadata = Array.isArray(embeddedSockets) && embeddedSockets.length > 0
    ? embeddedMetadata
    : { sockets: discoveredSockets };
  model.position.sub(normalizedCenter);
  model.position.y += normalizedSize.y / 2;
  const customPart = {
    id: options.id || `custom_${Date.now()}_${customPartsDatabase.length}`,
    name: model.name,
    model,
    metadata,
    height: Math.max(normalizedSize.y, 0.1),
    thumbnail: createModelThumbnail(model),
    sourceData: options.sourceData,
    sourceType: options.sourceType,
    metadata
  };
  customPartsDatabase.push(customPart);
  renderCustomInventory();
  if (options.persist && options.sourceData && typeof saveCustomInventoryModel === 'function') {
    saveCustomInventoryModel({
      id: customPart.id,
      name: filename,
      sourceData: options.sourceData,
      sourceType: options.sourceType,
      metadata
    }).catch(error => console.error('Không thể lưu model vào kho:', error));
  }
  const socketCount = Array.isArray(metadata.sockets)
    ? metadata.sockets.length
    : Array.isArray(metadata.connections) ? metadata.connections.length : 0;
  showTemporaryNotice(`Đã thêm [${model.name}] vào Kho Của Tôi: ${socketCount} socket.`);
}

function restoreCustomInventory() {
  if (typeof loadCustomInventoryModels !== 'function') return;

  loadCustomInventoryModels().then(records => {
    records.forEach(record => {
      const loader = new THREE.GLTFLoader();
      loader.parse(
        record.sourceData,
        '',
        gltf => registerImportedModel(gltf.scene, record.name, record.metadata || gltf.scene.userData, {
          id: record.id,
          persist: false,
          sourceData: record.sourceData,
          sourceType: record.sourceType
        }),
        error => console.error(`Không thể khôi phục model ${record.name}:`, error)
      );
    });
  }).catch(error => console.error('Không thể đọc kho model đã lưu:', error));
}

function persistCustomPartMetadata(customPart) {
  if (!customPart.sourceData || typeof saveCustomInventoryModel !== 'function') return;
  saveCustomInventoryModel({
    id: customPart.id,
    name: customPart.name,
    sourceData: customPart.sourceData,
    sourceType: customPart.sourceType,
    metadata: customPart.metadata
  }).catch(error => console.error('Không thể lưu metadata socket:', error));
}

function renderCustomInventory() {
  const container = document.getElementById('custom-inventory-list');
  const count = document.getElementById('custom-inventory-count');
  if (!container) return;

  container.innerHTML = '';
  if (count) count.textContent = `${customPartsDatabase.length} model`;
  if (customPartsDatabase.length === 0) {
    const message = document.createElement('div');
    message.id = 'empty-inventory-msg';
    message.className = 'col-span-2 text-center text-[10px] text-slate-500 py-3 bg-slate-800/30 rounded-xl border border-dashed border-slate-700';
    message.textContent = 'Kho trống. Hãy nhập file .GLB hoặc .GLTF';
    container.appendChild(message);
    return;
  }

  customPartsDatabase.forEach(part => {
    const card = document.createElement('div');
    card.className = 'custom-inventory-card w-full min-w-0 bg-slate-800 hover:bg-slate-700 p-1.5 rounded-xl border border-slate-700 transition-all';
    const previewButton = document.createElement('button');
    previewButton.type = 'button';
    previewButton.className = 'block w-full text-left';
    previewButton.title = `Thả ${part.name} ra sàn`;
    const preview = document.createElement('div');
    preview.className = 'custom-inventory-preview';
    if (part.thumbnail) {
      const image = document.createElement('img');
      image.src = part.thumbnail;
      image.alt = `Ảnh xem trước ${part.name}`;
      preview.appendChild(image);
    } else {
      preview.textContent = '3D';
    }
    const title = document.createElement('span');
    title.className = 'block text-[10px] font-bold text-slate-200 truncate px-0.5 mt-1';
    title.title = part.name;
    title.textContent = part.name;
    const subtitle = document.createElement('span');
    subtitle.className = 'block text-[9px] text-cyan-400 mt-0.5 px-0.5';
    const socketCount = Array.isArray(part.metadata && part.metadata.sockets)
      ? part.metadata.sockets.length
      : Array.isArray(part.metadata && part.metadata.connections)
        ? part.metadata.connections.length
        : 0;
    subtitle.textContent = socketCount > 0
      ? `${socketCount} socket đã nhận • Thả ra sàn`
      : 'Chưa nhận socket • Thả ra sàn';
    previewButton.append(preview, title, subtitle);
    previewButton.addEventListener('click', () => spawnCustomPart(part.id));
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-1 mt-1';
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'flex-1 text-[9px] text-rose-300 hover:text-white hover:bg-rose-500/30 rounded py-1 transition-colors';
    deleteButton.textContent = 'Xóa khỏi kho';
    deleteButton.title = `Xóa ${part.name} khỏi kho`;
    deleteButton.addEventListener('click', event => {
      event.stopPropagation();
      deleteCustomPart(part.id);
    });
    actions.appendChild(deleteButton);
    card.append(previewButton, actions);
    container.appendChild(card);
  });
}

function deleteCustomPart(customPartId) {
  const partIndex = customPartsDatabase.findIndex(part => part.id === customPartId);
  if (partIndex === -1) return;

  const part = customPartsDatabase[partIndex];
  const instances = parts.filter(item => item.customSourceId === customPartId);
  instances.forEach(instance => {
    if (typeof deletePartById === 'function') deletePartById(instance.id);
  });
  customPartsDatabase.splice(partIndex, 1);
  renderCustomInventory();
  if (typeof deleteCustomInventoryModel === 'function') {
    deleteCustomInventoryModel(customPartId).catch(error => console.error('Không thể xóa model khỏi kho:', error));
  }
  showTemporaryNotice(`Đã xóa [${part.name}] khỏi Kho Của Tôi.`);
}

function createModelThumbnail(model) {
  if (typeof THREE.WebGLRenderer === 'undefined') return '';

  let previewRenderer;
  try {
    const canvas = document.createElement('canvas');
    previewRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true
    });
    previewRenderer.setPixelRatio(1);
    previewRenderer.setSize(180, 140, false);
    previewRenderer.setClearColor(0x172033, 1);

    const previewScene = new THREE.Scene();
    const previewCamera = new THREE.PerspectiveCamera(30, 180 / 140, 0.01, 1000);
    previewScene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 7, 6);
    previewScene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.8);
    fillLight.position.set(-4, 2, 1);
    previewScene.add(fillLight);

    const previewModel = model.clone(true);
    const bounds = new THREE.Box3().setFromObject(previewModel);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const largestDimension = Math.max(size.x, size.y, size.z, 0.1);
    previewModel.position.sub(center);
    previewScene.add(previewModel);

    const distance = largestDimension * 2.8;
    previewCamera.position.set(distance * 0.9, distance * 0.7, distance);
    previewCamera.lookAt(0, 0, 0);
    previewRenderer.render(previewScene, previewCamera);
    const thumbnail = canvas.toDataURL('image/png');
    previewRenderer.dispose();
    return thumbnail;
  } catch (error) {
    console.warn('Không thể tạo ảnh xem trước model:', error);
    if (previewRenderer) previewRenderer.dispose();
    return '';
  }
}

function spawnCustomPart(customPartId) {
  const definition = customPartsDatabase.find(part => part.id === customPartId);
  if (!definition) return;

  const model = definition.model.clone(true);
  findSafeSpawnPosition(model);
  const part = registerPart(definition.name, 'imported-model', model, [], null, definition.height);
  part.customSourceId = definition.id;
  applySocketMetadata(part, definition.metadata);
  showTemporaryNotice(`Đã lấy [${definition.name}] ra sàn với ${part.sockets.length} socket.`);
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
      displayIndex: definition.number ?? definition.displayIndex ?? definition.index,
      pos: definition.pos || definition.position
    });
  });

  if (typeof selectedPartId !== 'undefined' && selectedPartId === part.id && typeof update3DHoleBadges === 'function') {
    update3DHoleBadges(part);
  }
}

function discoverSocketNodes(model) {
  const sockets = [];
  model.updateMatrixWorld(true);
  model.traverse(node => {
    const name = (node.name || '').toLowerCase();
    if (!/^((socket|hole|pin)[_.-]?\d+)/.test(name)) return;

    const position = model.worldToLocal(node.getWorldPosition(new THREE.Vector3())).toArray();
    const worldAxis = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
    const axis = worldAxis.transformDirection(model.matrixWorld.clone().invert()).toArray();
    const baseName = name.replace(/\.\d+$/, '');
    const typePrefix = baseName.split(/[_.-]/)[0];
    sockets.push({
      id: node.name,
      number: getSocketDisplayIndex({ id: baseName }, sockets.length),
      type: typePrefix === 'pin' ? 'male' : 'female',
      radius: Number(node.userData.radius) || (14 / 47) * 0.98,
      pos: position,
      axis
    });
  });
  return sockets;
}
