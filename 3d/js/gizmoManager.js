// js/gizmoManager.js - Quản lý độc lập Click chọn và Trục Gizmo (Kéo, Xoay) chuẩn xác

let transformControl = null;
let currentToolMode = 'select'; // 'select', 'translate', 'rotate'
let lastSafePosition = new THREE.Vector3();
let lastSafeRotation = new THREE.Euler();
let isReverting = false;

// 1. Khởi tạo toàn bộ hệ thống tương tác & Gizmo 3D (Có cơ chế tự động gọi phòng hờ)
function initGizmoAndInteraction() {
  if (typeof THREE.TransformControls === 'undefined') {
    console.warn("TransformControls chưa được tải!");
    return;
  }

  // Nếu đã khởi tạo trước đó thì dọn dẹp tránh trùng lặp
  if (transformControl) {
    scene.remove(transformControl);
    transformControl.dispose();
  }

  // Khởi tạo TransformControls với camera và canvas thực tế
  const canvasEl = document.getElementById('webgl-canvas') || (typeof renderer !== 'undefined' ? renderer.domElement : null);
  if (!canvasEl || typeof camera === 'undefined') {
    // Nếu Scene chưa sẵn sàng, thử lại sau 200ms
    setTimeout(initGizmoAndInteraction, 200);
    return;
  }

  transformControl = new THREE.TransformControls(camera, canvasEl);
  
  // Tạm khóa OrbitControls (xoay camera) khi người dùng nắm kéo các trục Gizmo
  transformControl.addEventListener('dragging-changed', function (event) {
    if (typeof controls !== 'undefined' && controls) {
      controls.enabled = !event.value;
    }
    
    if (event.value && transformControl.object) {
      lastSafePosition.copy(transformControl.object.position);
      lastSafeRotation.copy(transformControl.object.rotation);
      isReverting = false;
    } else {
      if (typeof finalizeDrop === 'function') finalizeDrop();
    }
  });

  // Lắng nghe sự kiện kéo/xoay để chống va chạm đâm xuyên
  transformControl.addEventListener('change', function () {
    if (typeof selectedPartId !== 'undefined' && selectedPartId && transformControl.object && !isReverting) {
      const obj = transformControl.object;
      
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      if (box.min.y < 0) {
          obj.position.y += (0 - box.min.y);
      }

      if (typeof handleDragPhysics === 'function') {
        handleDragPhysics(selectedPartId);
        
        if (typeof isColliding !== 'undefined' && isColliding) {
          isReverting = true; 
          obj.position.copy(lastSafePosition);
          obj.rotation.copy(lastSafeRotation);
          
          if (typeof showTemporaryNotice === 'function') {
            showTemporaryNotice("Vật lý: Không thể đâm xuyên qua mô hình khác!");
          }
          
          setTimeout(() => { isReverting = false; }, 10);
        } else {
          lastSafePosition.copy(obj.position);
          lastSafeRotation.copy(obj.rotation);
        }
      }

      syncInspectorUI(obj);
    }
  });

  transformControl.setTranslationSnap(0.5); 
  transformControl.setRotationSnap(THREE.MathUtils.degToRad(15)); 
  scene.add(transformControl);

  // Gắn sự kiện chuột trên Canvas
  canvasEl.removeEventListener('pointerdown', onCanvasPointerDown);
  canvasEl.removeEventListener('pointermove', onCanvasPointerMove);
  canvasEl.addEventListener('pointerdown', onCanvasPointerDown);
  canvasEl.addEventListener('pointermove', onCanvasPointerMove);

  updateActiveToolUI('select');
  console.log("GizmoManager đã khởi tạo thành công!");
}

// 2. Chuyển đổi công cụ (Chọn, Kéo, Xoay) trên Toolbar
function setInteractionTool(mode) {
  currentToolMode = mode;
  updateActiveToolUI(mode);
  
  if (!transformControl) {
    initGizmoAndInteraction();
  }

  if (transformControl) {
    if (mode === 'select') {
      transformControl.detach();
    } else if (mode === 'translate') {
      transformControl.setMode('translate');
      attachTransformToSelected();
    } else if (mode === 'rotate') {
      transformControl.setMode('rotate');
      attachTransformToSelected();
    }
  }
}

// 3. Hiệu ứng Hover đổi chuột
function onCanvasPointerMove(event) {
  const canvasEl = document.getElementById('webgl-canvas');
  if (!canvasEl) return;

  const rect = canvasEl.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  
  if (transformControl && transformControl.axis !== null) {
    document.body.style.cursor = 'pointer';
    return;
  }

  if (typeof partsGroup !== 'undefined' && partsGroup) {
    const intersects = raycaster.intersectObject(partsGroup, true);
    if (intersects.length > 0) {
      document.body.style.cursor = 'pointer';
      return;
    }
  }
  document.body.style.cursor = 'default';
}

// 4. Xử lý click chọn vật thể trên màn hình 3D
function onCanvasPointerDown(event) {
  if (event.button !== 0) return; // Chỉ nhận chuột trái
  const canvasEl = document.getElementById('webgl-canvas');
  if (!canvasEl) return;

  if (transformControl && (transformControl.dragging || transformControl.axis !== null)) {
    return; 
  }

  const rect = canvasEl.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  
  if (typeof partsGroup === 'undefined' || !partsGroup) return;
  const intersects = raycaster.intersectObject(partsGroup, true);

  if (intersects.length > 0) {
    let hit = intersects[0].object;

    let partNode = hit;
    while (partNode && !partNode.userData.partId && partNode.parent && partNode.parent !== scene) {
      partNode = partNode.parent;
    }

    if (partNode && partNode.userData.partId) {
      if (typeof selectPart === 'function') {
        selectPart(partNode.userData.partId);
      }
      // BẮT BUỘC GẮN GIZMO NGAY LẬP TỨC KHI CLICK CHỌN
      attachTransformToSelected();
    } else {
      clearSelectionCustom();
    }
  } else {
    clearSelectionCustom();
  }
}

// 5. Gắn Gizmo vào vật thể đang chọn (Hỗ trợ cả chế độ Kéo và Xoay)
function attachTransformToSelected() {
  if (!transformControl) {
    initGizmoAndInteraction();
  }
  
  if (!transformControl) return;

  if (typeof selectedPartId !== 'undefined' && selectedPartId) {
    const p = parts.find(it => it.id === selectedPartId);
    if (p && p.root) {
      let rootAssembly = p.root;
      while (rootAssembly.parent && rootAssembly.parent !== partsGroup && rootAssembly.parent !== scene) {
        rootAssembly = rootAssembly.parent;
      }
      transformControl.attach(rootAssembly);
      transformControl.enabled = true;
      transformControl.visible = true;
    } else {
      transformControl.detach();
    }
  } else {
    transformControl.detach();
  }
}

function clearSelectionCustom() {
  if (transformControl) transformControl.detach();
  if (typeof clearSelection === 'function') clearSelection();
}

function updateActiveToolUI(mode) {
  const tools = ['select', 'translate', 'rotate'];
  tools.forEach(t => {
    const btn = document.getElementById(`tool-btn-${t}`);
    if (btn) {
      if (t === mode) {
        btn.classList.add('bg-slate-800', 'border-slate-500', 'text-white', 'shadow-md');
        btn.classList.remove('border-transparent', 'text-slate-400');
      } else {
        btn.classList.remove('bg-slate-800', 'border-slate-500', 'text-white', 'shadow-md');
        btn.classList.add('border-transparent', 'text-slate-400');
      }
    }
  });
}

function resetSelectedRotation() {
  if (selectedPartId && transformControl && transformControl.object) {
    transformControl.object.rotation.y = 0;
    syncInspectorUI(transformControl.object);
    if (typeof saveHistoryStep === 'function') saveHistoryStep('Reset góc xoay');
  }
}

function syncInspectorUI(obj) {
  const inX = document.getElementById('inp-pos-x');
  const inY = document.getElementById('inp-pos-y');
  const inZ = document.getElementById('inp-pos-z');
  if (inX) inX.value = obj.position.x.toFixed(2);
  if (inY) inY.value = obj.position.y.toFixed(2);
  if (inZ) inZ.value = obj.position.z.toFixed(2);
  
  const deg = Math.round((obj.rotation.y * 180) / Math.PI);
  const rotInp = document.getElementById('inp-part-rot');
  const rotVal = document.getElementById('val-part-rot');
  if (rotInp) rotInp.value = deg;
  if (rotVal) rotVal.innerText = `${deg}°`;
}

// Tự động kích hoạt ngay khi trang web tải xong
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(initGizmoAndInteraction, 300);
});