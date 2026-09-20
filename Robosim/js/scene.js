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
  dirLight1.shadow.camera.near = 0.5;
  dirLight1.shadow.camera.far = 80;
  dirLight1.shadow.bias = -0.0003;
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

  // Khởi tạo hệ thống công cụ
  if (typeof initTransformTools === 'function') initTransformTools();
  if (typeof initInteractionManager === 'function') initInteractionManager();

  spawnPresetAssembly();

  window.addEventListener('resize', onWindowResize);

  document.getElementById('check-wireframe').addEventListener('change', (e) => {
    const isWire = e.target.checked;
    parts.forEach(p => {
      if (p.root) {
        p.root.traverse(node => {
          if (node.isMesh && node.material && !node.userData.isHoleAnchor) node.material.wireframe = isWire;
        });
      }
    });
  });

  document.getElementById('check-axes').addEventListener('change', (e) => {
    axesHelper.visible = e.target.checked;
  });

  animate();
}

function setCameraView(view) {
  const targetPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3(0, 0.8, 0);
  if (view === 'top') targetPos.set(0, 20, 0.001);
  else if (view === 'front') targetPos.set(0, 2, 16);
  else targetPos.set(10, 11, 14);

  const startPosition = camera.position.clone();
  const startTime = performance.now();
  function step(now) {
    const p = Math.min((now - startTime) / 500, 1);
    camera.position.lerpVectors(startPosition, targetPos, p);
    controls.target.lerp(lookAt, p);
    controls.update();
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function resetCamera() { setCameraView('iso'); }
function onWindowResize() {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}
function toggleAutoRotate() {
  autoRotate = !autoRotate;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 2.0;
  const btn = document.getElementById('toggle-autorotate');
  if (autoRotate) btn.classList.add('text-cyan-400', 'bg-slate-800');
  else btn.classList.remove('text-cyan-400', 'bg-slate-800');
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  
  // FIX: Chốt chặt hộp highlight và số lỗ bám theo vật thể liên tục
  if (selectedPartId) {
    const p = parts.find(it => it.id === selectedPartId);
    if (p && p.root) {
      if (highlightBox && highlightBox.visible) highlightBox.setFromObject(p.root);
      
      if (holeBadgesGroup.children.length > 0) {
        p.root.updateMatrixWorld(true);
        p.holes.forEach((h, idx) => {
          if (holeBadgesGroup.children[idx]) {
            const localPos = new THREE.Vector3(h.x, p.height / 2 + 0.6, h.z || 0);
            localPos.applyMatrix4(p.root.matrixWorld);
            holeBadgesGroup.children[idx].position.copy(localPos);
          }
        });
      }
    }
  }
  renderer.render(scene, camera);
}