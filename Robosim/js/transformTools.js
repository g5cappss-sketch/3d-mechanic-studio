/**
 * Khởi tạo bộ công cụ di chuyển và xoay vật thể (Gizmo)
 */
function initTransformTools() {
  if (typeof THREE.TransformControls === 'undefined') {
    console.warn("TransformControls module is missing!");
    return;
  }

  transformControl = new THREE.TransformControls(camera, renderer.domElement);
  
  // Vô hiệu hóa xoay camera (OrbitControls) khi người dùng đang nắm kéo Gizmo
  transformControl.addEventListener('dragging-changed', function (event) {
    controls.enabled = !event.value;
  });

  // Đồng bộ hóa tọa độ trên thanh công cụ UI khi vật thể bị kéo/xoay
  transformControl.addEventListener('change', function () {
    if (selectedPartId && transformControl.object) {
      const obj = transformControl.object;
      
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
  });

  // TÍNH NĂNG "LEGO SNAP": 
  // Khoảng cách tâm các lỗ là 1.0. Set cữ nhảy là 0.5 giúp trượt vật thể tự động căn hàng các lỗ chuẩn xác.
  transformControl.setTranslationSnap(0.5); 
  // Xoay khấc 45 độ chuẩn xác để ngàm chốt không bị lệch
  transformControl.setRotationSnap(THREE.MathUtils.degToRad(45)); 

  scene.add(transformControl);
}

function attachTransformToSelected() {
  if (!transformControl) return;
  
  if (selectedPartId) {
    const p = parts.find(it => it.id === selectedPartId);
    if (p && p.root) {
      // Tìm cụm root cha cao nhất (nếu thanh này đang nằm trong 1 khớp liên kết)
      let rootAssembly = p.root;
      while (rootAssembly.parent && rootAssembly.parent !== partsGroup && rootAssembly.parent !== scene) {
        rootAssembly = rootAssembly.parent;
      }
      transformControl.attach(rootAssembly);
    }
  } else {
    transformControl.detach();
  }
}

function setTransformMode(mode) {
  if (!transformControl) return;
  transformControl.setMode(mode);
  attachTransformToSelected();
}