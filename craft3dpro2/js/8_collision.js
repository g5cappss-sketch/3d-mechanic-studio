// ==========================================
// FILE: 8_collision.js
// CHỨC NĂNG: Quản lý Hitbox 3D tĩnh, chống xuyên thấu khi spawn linh kiện mới.
// ==========================================

/**
 * Hàm này nhận vào một Object3D mới. 
 * Nó sẽ kiểm tra xem vị trí hiện tại có bị đè lên các linh kiện cũ không.
 * Nếu có, nó tự động dời vật thể lên trên (trục Y) cho đến khi an toàn.
 */
function findSafeSpawnPosition(newPartRoot) {
  // Cập nhật ma trận để lấy tọa độ thực tế
  newPartRoot.updateMatrixWorld(true);
  
  const testBox = new THREE.Box3();
  let isOverlapping = true;
  let attempts = 0;
  const maxAttempts = 50; // Tránh lặp vô hạn
  const spawnGap = 0.04; // Khoảng hở nhỏ để các linh kiện không bị dính hình

  while (isOverlapping && attempts < maxAttempts) {
    testBox.setFromObject(newPartRoot);
    isOverlapping = false;

    // Quét qua toàn bộ linh kiện đã có trên sàn
    for (let i = 0; i < parts.length; i++) {
      const existingPart = parts[i];
      // Bỏ qua nếu là chính nó (phòng hờ)
      if (existingPart.root.uuid === newPartRoot.uuid) continue;

      const existingBox = new THREE.Box3().setFromObject(existingPart.root);

      // Nếu Hitbox chạm nhau (Intersects)
      if (testBox.intersectsBox(existingBox)) {
        isOverlapping = true;
        // Chỉ đẩy vừa đủ vượt qua mặt trên của linh kiện hiện tại.
        newPartRoot.position.y += existingBox.max.y - testBox.min.y + spawnGap;
        newPartRoot.updateMatrixWorld(true);
        break; // Thoát vòng lặp for để kiểm tra lại từ đầu với vị trí mới
      }
    }
    attempts++;
  }
}

/**
 * Hiển thị khung Hitbox của tất cả vật thể để Debug (Nhìn cho rõ)
 * Bạn có thể gọi hàm này trong Console trình duyệt để xem các hộp va chạm
 */
function debugShowAllHitboxes() {
  parts.forEach(p => {
    if (!p.debugBox) {
      p.debugBox = new THREE.BoxHelper(p.root, 0xff0000); // Khung màu đỏ
      scene.add(p.debugBox);
    }
    p.debugBox.update();
  });
}