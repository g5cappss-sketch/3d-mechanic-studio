// ==========================================
// FILE: 7_physics.js
// CHỨC NĂNG: Khởi tạo trọng lực, va chạm và chuyển đổi mô hình tĩnh thành động.
// CẬP NHẬT: Xử lý chống xuyên thấu (Anti-Penetration), sửa lỗi Hitbox phình to.
// ==========================================

function initPhysics() {
  physicsWorld = new CANNON.World();
  physicsWorld.gravity.set(0, -9.81, 0);
  
  // 1. TĂNG ĐỘ CHÍNH XÁC (SOLVER ITERATIONS)
  // Tính toán va chạm 50 lần mỗi khung hình giúp các vật thể KHÔNG bị lún xuyên qua nhau
  physicsWorld.solver.iterations = 50; 
  physicsWorld.solver.tolerance = 0.001;

  // 2. CÀI ĐẶT CHẤT LIỆU BỀ MẶT (CONTACT MATERIAL)
  // Biến các thanh kim loại thành vật rắn thực sự, có ma sát và ít nảy
  physicsWorld.defaultContactMaterial.friction = 0.6;          // Ma sát (0.0 -> 1.0)
  physicsWorld.defaultContactMaterial.restitution = 0.05;      // Độ nảy cực thấp
  physicsWorld.defaultContactMaterial.contactEquationStiffness = 1e9; // Độ cứng bề mặt siêu cao
  physicsWorld.defaultContactMaterial.contactEquationRelaxation = 3;

  // Mặt đất
  const groundBody = new CANNON.Body({ mass: 0 });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  physicsWorld.addBody(groundBody);
}

function toggleSimulation() {
  isSimulating = !isSimulating;
  
  if (isSimulating) {
    startSimulation();
    showTemporaryNotice("Đã BẬT mô phỏng vật lý! Các chi tiết đã biến thành vật rắn.");
  } else {
    stopSimulation();
    showTemporaryNotice("Đã TẮT mô phỏng. Trở về chế độ lắp ráp.");
  }
}

function startSimulation() {
  originalStates.clear();
  cannonMeshes = [];

  parts.forEach(part => {
    // Lưu trạng thái tĩnh
    originalStates.set(part.id, {
      pos: part.root.position.clone(),
      quat: part.root.quaternion.clone()
    });

    // ==========================================
    // FIX LỖI HITBOX: ĐO KÍCH THƯỚC LOCAL
    // ==========================================
    // Tạm thời đưa thanh kim loại về góc 0 độ để đo chính xác kích thước gốc
    const originalQuat = part.root.quaternion.clone();
    part.root.quaternion.set(0, 0, 0, 1);
    part.root.updateMatrixWorld(true);

    const box3 = new THREE.Box3().setFromObject(part.root);
    const size = new THREE.Vector3();
    box3.getSize(size);

    // Trả lại góc xoay nghiêng ban đầu
    part.root.quaternion.copy(originalQuat);
    part.root.updateMatrixWorld(true);
    // ==========================================

    // Tạo hộp vật lý (Cannon cần kích thước Half-Extents = chia 2)
    const body = new CANNON.Body({
      mass: 1.0, 
      position: new CANNON.Vec3(part.root.position.x, part.root.position.y, part.root.position.z),
      quaternion: new CANNON.Quaternion(originalQuat.x, originalQuat.y, originalQuat.z, originalQuat.w)
    });
    
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));

    // Giảm trượt trên không khí
    body.linearDamping = 0.4;
    body.angularDamping = 0.4;

    physicsWorld.addBody(body);
    part.physicsBody = body; 
    cannonMeshes.push(part);
  });

  // Khóa khớp nối
  joints.forEach(j => {
    const partA = parts.find(p => p.id === j.partAId);
    const partB = parts.find(p => p.id === j.partBId);
    
    if (partA && partB && partA.physicsBody && partB.physicsBody) {
      // LockConstraint giữ 2 vật cố định như hàn chết
      const lockConstraint = new CANNON.LockConstraint(partA.physicsBody, partB.physicsBody);
      physicsWorld.addConstraint(lockConstraint);
      j.physicsConstraint = lockConstraint;
    }
  });
}

function stopSimulation() {
  parts.forEach(part => {
    if (part.physicsBody) {
      physicsWorld.removeBody(part.physicsBody);
      part.physicsBody = null;
    }
  });

  parts.forEach(part => {
    const state = originalStates.get(part.id);
    if (state) {
      part.root.position.copy(state.pos);
      part.root.quaternion.copy(state.quat);
    }
  });

  cannonMeshes = [];
}

function updatePhysics() {
  if (!isSimulating) return;

  // Bước nhảy thời gian 1/60s
  physicsWorld.step(1 / 60);

  // Ép hình ảnh 3D bám sát Hitbox vật lý
  cannonMeshes.forEach(part => {
    part.root.position.copy(part.physicsBody.position);
    part.root.quaternion.copy(part.physicsBody.quaternion);
  });
}