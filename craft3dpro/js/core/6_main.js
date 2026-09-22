// ==========================================
// FILE: 6_main.js
// CHỨC NĂNG: Khởi tạo Scene Three.js, chạy vòng lặp Render, Export GLB.
// ==========================================

function exportToGLB(onlySelected = false) {
  if (typeof THREE.GLTFExporter === 'undefined') {
    showTemporaryNotice('Đang tải mô-đun xuất file, vui lòng thử lại sau vài giây!');
    return;
  }

  const exporter = new THREE.GLTFExporter();
  let target;
  let filename = 'cum_lap_ghep_zmrobo.glb';

  if (onlySelected) {
    if (!selectedPartId) {
      showTemporaryNotice('Vui lòng chọn một chi tiết trước khi xuất!');
      return;
    }
    const part = parts.find(p => p.id === selectedPartId);
    if (!part || !part.root) return;

    target = part.root.clone(true);
    const safeName = part.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    filename = `${safeName}.glb`;
  } else {
    if (parts.length === 0) return showTemporaryNotice('Không có linh kiện nào trên sàn để xuất!');

    target = new THREE.Group();
    target.name = 'ZMROBO_Modular_Assembly';
    partsGroup.children.forEach(child => target.add(child.clone(true)));
    joints.forEach(j => {
      if (j.pivotGroup) target.add(j.pivotGroup.clone(true));
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    filename = `cum_lap_ghep_zmrobo_${timestamp}.glb`;
  }

  const objectsToRemove = [];
  target.traverse(node => {
    if (node.userData && (node.userData.isHoleAnchor || node.isSprite || node.isAxesHelper || node.isBoxHelper)) {
      objectsToRemove.push(node);
    }
  });
  objectsToRemove.forEach(node => { if (node.parent) node.parent.remove(node); });

  showTemporaryNotice('Đang tạo và đóng gói dữ liệu file .GLB...');
  exporter.parse(
    target,
    function (result) {
      if (result instanceof ArrayBuffer) {
        saveArrayBuffer(result, filename);
        showTemporaryNotice(`Xuất file thành công: ${filename}`);
      } else {
        const output = JSON.stringify(result, null, 2);
        const blob = new Blob([output], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename.replace('.glb', '.gltf');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        showTemporaryNotice(`Xuất file thành công: ${link.download}`);
      }
    },
    function (error) { showTemporaryNotice('Không thể xuất file GLB, vui lòng kiểm tra Console.'); },
    { binary: true, onlyVisible: true, embedImages: true }
  );
}

function saveArrayBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function initScene() {
  container = document.getElementById('canvas-container');
  canvas = document.getElementById('webgl-canvas');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1d);
  scene.fog = new THREE.FogExp2(0x0a0f1d, 0.025);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(10, 11, 14);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxDistance = 120;
  controls.minDistance = 2;
  controls.target.set(0, 0.8, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.88);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.6);
  dirLight1.position.set(15, 25, 15);
  dirLight1.castShadow = true;
  dirLight1.shadow.mapSize.width = 2048;
  dirLight1.shadow.mapSize.height = 2048;
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.5);
  dirLight2.position.set(-15, 12, -10);
  scene.add(dirLight2);

  const rimLight = new THREE.DirectionalLight(0xffeedd, 0.4);
  rimLight.position.set(0, -8, 12);
  scene.add(rimLight);

  const gridHelper = new THREE.GridHelper(50, 50, 0x0284c7, 0x1e293b);
  gridHelper.position.y = -0.02;
  scene.add(gridHelper);

  const groundGeo = new THREE.PlaneGeometry(120, 120);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.45 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  scene.add(ground);

  axesHelper = new THREE.AxesHelper(4);
  axesHelper.visible = false;
  scene.add(axesHelper);

  highlightBox = new THREE.BoxHelper(new THREE.Mesh(), 0x38bdf8);
  highlightBox.visible = false;
  scene.add(highlightBox);

  scene.add(holeBadgesGroup);

  partsGroup = new THREE.Group();
  scene.add(partsGroup);

  if (typeof initPhysics === 'function') initPhysics();
  if (typeof initClusterManager === 'function') initClusterManager();
  if (typeof initTransformControls === 'function') initTransformControls();
  if (typeof initSelectionBox === 'function') initSelectionBox();
  if (typeof initDragSocketAssembly === 'function') initDragSocketAssembly();
  if (typeof setupModelImport === 'function') setupModelImport();
  if (typeof initAssemblyHistory === 'function') initAssemblyHistory();

  window.addEventListener('resize', onWindowResize);
  if (typeof window.onCanvasPointerDown === 'function') {
    canvas.onpointerdown = window.onCanvasPointerDown;
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      toggleSimulation();
    }
  });

  animate();
}

function onWindowResize() {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updatePhysics();
  
  if (selectedPartId) {
    const p = parts.find(it => it.id === selectedPartId);
    if (p && p.root) {
      // 1. Cập nhật khung viền highlight bám theo cụm đang chọn
      if (highlightBox && highlightBox.visible) {
        if (typeof activeClusterGroup !== 'undefined' && currentClusterPartIds.length > 0) {
          highlightBox.setFromObject(activeClusterGroup);
        } else {
          highlightBox.setFromObject(p.root);
        }
      }
      
      // 2. Cập nhật các con số (badges) bám theo lỗ khi linh kiện di chuyển/xoay
      p.root.updateMatrixWorld(true);
      holeBadgesGroup.children.forEach(sprite => {
        if (sprite.userData && sprite.userData.localX !== undefined) {
          const localPos = new THREE.Vector3(
            sprite.userData.localX, 
            sprite.userData.localY, 
            sprite.userData.localZ
          );
          // Ép tọa độ local chạy theo ma trận xoay/dịch chuyển của thanh kim loại
          localPos.applyMatrix4(p.root.matrixWorld);
          sprite.position.copy(localPos);
        }
      });
    }
  }

  if (typeof updateAssemblySocketBadgePositions === 'function') updateAssemblySocketBadgePositions();

  if (typeof pulseGlowEffect === 'function') pulseGlowEffect();
  
  renderer.render(scene, camera);
}

// KHỞI ĐỘNG ỨNG DỤNG
window.onload = function () {
  initScene();
  setupEventListeners();
};