// ==========================================
// FILE: 9_transform.js
// CẬP NHẬT: Trượt thông minh (Sliding), xử lý triệt để va chạm
// ==========================================
let transformControl;
let currentToolMode = 'select'; 
let isDraggingGizmo = false;
let lastSafePosition = new THREE.Vector3();
let lastSafeQuaternion = new THREE.Quaternion();
let lastSnapCandidate = null;

function setSnapLockButton(visible) {
  const button = document.getElementById('btn-lock-socket');
  if (!button) return;
  button.classList.toggle('hidden', !visible);
  button.classList.toggle('flex', visible);
}

function unlockSelectedPinForMove() {
  const selectedPart = parts.find(part => part.id === selectedPartId);
  if (!selectedPart || selectedPart.type !== 'pin' || typeof connectionManager === 'undefined') return;
  connectionManager.detachPartConnections(selectedPart.id);
  if (typeof unpackCluster === 'function') unpackCluster();
  if (typeof packCluster === 'function') packCluster(selectedPart.id);
}

function lockCurrentSnap() {
  if (!lastSnapCandidate || typeof connectionManager === 'undefined') return;
  if (!connectionManager.connectCandidate(lastSnapCandidate)) {
    showTemporaryNotice('Socket này đã được sử dụng. Hãy chọn lỗ khác.');
    setSnapLockButton(false);
    return;
  }
  if (typeof packCluster === 'function') packCluster(lastSnapCandidate.source.part.id);
  showTemporaryNotice('Đã khóa chốt vào lỗ.');
  lastSnapCandidate = null;
  setSnapLockButton(false);
}

function initTransformControls() {
  transformControl = new THREE.TransformControls(camera, renderer.domElement);
  transformControl.setTranslationSnap(0.5); 
  transformControl.setRotationSnap(THREE.MathUtils.degToRad(15)); 
  transformControl.setSize(1.2); 
  transformControl.setSpace('local'); 
  
  transformControl.addEventListener('dragging-changed', function (event) {
    controls.enabled = !event.value; 
    isDraggingGizmo = event.value;

    if (isDraggingGizmo && currentClusterPartIds.length > 0) {
      lastSafePosition.copy(activeClusterGroup.position);
      lastSafeQuaternion.copy(activeClusterGroup.quaternion);
      lastSnapCandidate = null;
      setSnapLockButton(false);
    } else if (!event.value && lastSnapCandidate && typeof showTemporaryNotice === 'function') {
      showTemporaryNotice(`Đã hít thử ${lastSnapCandidate.source.socket.id} vào ${lastSnapCandidate.target.socket.id}. Bấm Khóa kết nối để cố định.`);
      setSnapLockButton(true);
    }

    if (!event.value && typeof recordAssemblyHistory === 'function') {
      recordAssemblyHistory(currentToolMode === 'rotate' ? 'Xoay cụm lắp ghép' : 'Di chuyển cụm lắp ghép');
    }
  });

  transformControl.addEventListener('change', function () {
    if (currentClusterPartIds.length === 0) return;

    if (isDraggingGizmo) {
      activeClusterGroup.updateMatrixWorld(true);

      const snapCandidate = typeof connectionManager !== 'undefined'
        ? connectionManager.findCandidate(currentClusterPartIds, activeClusterGroup)
        : null;

      // Ưu tiên hút socket trước kiểm tra va chạm để chốt có thể đi xuyên vào lỗ.
      if (snapCandidate && connectionManager.snapCandidate(snapCandidate, activeClusterGroup)) {
        lastSnapCandidate = snapCandidate;
        activeClusterGroup.updateMatrixWorld(true);
      } else {
        lastSnapCandidate = null;
        setSnapLockButton(false);
      }
      
      // Chỉ chừa khe rất nhỏ để hai bề mặt có thể chạm nhau nhưng không đè lên nhau.
      const currentBox = new THREE.Box3().setFromObject(activeClusterGroup);
      currentBox.expandByScalar(-0.02); 

      let isColliding = false;

      // 1. Chặn rớt đất (Y < 0)
      if (lastSnapCandidate === snapCandidate && snapCandidate) {
        isColliding = false;
      } else if (currentBox.min.y < 0) {
        isColliding = true;
      } else {
        // 2. Chặn đâm xuyên
        for (let i = 0; i < parts.length; i++) {
          const otherPart = parts[i];
          if (currentClusterPartIds.includes(otherPart.id)) continue; 

          const otherBox = new THREE.Box3().setFromObject(otherPart.root);
          otherBox.expandByScalar(-0.02);

          if (currentBox.intersectsBox(otherBox)) {
            isColliding = true;
            break;
          }
        }
      }

      if (isColliding) {
        // Trả về vị trí an toàn trước khi đâm
        activeClusterGroup.position.copy(lastSafePosition);
        activeClusterGroup.quaternion.copy(lastSafeQuaternion);
        activeClusterGroup.updateMatrixWorld(true);
      } else {
        // Đi tiếp an toàn
        lastSafePosition.copy(activeClusterGroup.position);
        lastSafeQuaternion.copy(activeClusterGroup.quaternion);
      }

    }

    // Đồng bộ lại khung viền xanh ngay lập tức
    if (highlightBox && highlightBox.visible) {
        activeClusterGroup.updateMatrixWorld(true);
        highlightBox.setFromObject(activeClusterGroup);
    }
    
    currentClusterPartIds.forEach(id => {
      const p = parts.find(it => it.id === id);
      if (p && p.debugBox) p.debugBox.update();
    });
  });

  scene.add(transformControl);

  renderer.domElement.addEventListener('dblclick', function(event) {
    if (currentToolMode === 'rotate' && currentClusterPartIds.length > 0) {
      activeClusterGroup.rotation.set(0, 0, 0); 
      activeClusterGroup.updateMatrixWorld(true);
      if (transformControl) transformControl.updateMatrixWorld();
      if (highlightBox && highlightBox.visible) highlightBox.setFromObject(activeClusterGroup);
      showTemporaryNotice("Đã Reset góc xoay cụm về mặc định (0°, 0°, 0°)");
    }
  });
}

function setToolMode(mode) {
  currentToolMode = mode;
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.className = 'tool-btn text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all';
  });
  const activeBtn = document.getElementById(`btn-tool-${mode}`);
  if (activeBtn) activeBtn.className = 'tool-btn bg-cyan-500 text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all';

  if (mode === 'select') {
    detachGizmo(); 
  } else {
    if (mode === 'translate') unlockSelectedPinForMove();
    if (currentClusterPartIds.length > 0) {
      attachGizmo();
      transformControl.setMode(mode);
    }
  }
}

function attachGizmo() {
  if (transformControl && currentClusterPartIds.length > 0) {
    transformControl.attach(activeClusterGroup);
  }
}

function detachGizmo() {
  if (transformControl) transformControl.detach();
}

window.addEventListener('keydown', function(event) {
  if (document.activeElement.tagName === 'INPUT') return; 
  if (event.key === '1') setToolMode('select');
  if (event.key === '2') setToolMode('translate');
  if (event.key === '3') setToolMode('rotate');
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (typeof deleteSelectedPart === 'function') deleteSelectedPart();
  }
});