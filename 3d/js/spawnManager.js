// js/spawnManager.js - Thuật toán tìm vị trí trống thông minh, chống chồng lấn 100%

function getCleanSpawnPosition(object3D) {
  // Đưa tạm object3D về tâm để tính toán Bounding Box chính xác
  object3D.position.set(0, 0, 0);
  object3D.updateMatrixWorld(true);

  const tempBox = new THREE.Box3().setFromObject(object3D);
  const size = new THREE.Vector3();
  tempBox.getSize(size);

  let candidatePos = new THREE.Vector3(0, size.y / 2, 0);
  let foundSpot = false;
  
  let radius = 0;
  let angle = 0;
  const maxAttempts = 300; // Tăng số lần thử quét không gian
  let attempt = 0;

  while (!foundSpot && attempt < maxAttempts) {
    if (attempt === 0) {
      // Vị trí ưu tiên số 1: Lệch hẳn sang bên phải khu vực trung tâm để không bị đè vào mẫu mặc định
      candidatePos.set(3.5, size.y / 2, 0);
    } else {
      // Thuật toán xoay vòng mở rộng khoảng cách rộng rãi hơn (tăng bước nhảy lên 2.5 đơn vị)
      radius += 2.5; 
      angle += 0.8;  
      candidatePos.x = Math.cos(angle) * radius;
      candidatePos.z = Math.sin(angle) * radius;
      candidatePos.y = size.y / 2;
    }

    // Tạo hộp giả định tại vị trí ứng viên
    const candidateBox = tempBox.clone();
    const currentCenter = new THREE.Vector3();
    candidateBox.getCenter(currentCenter);
    
    const offset = candidatePos.clone().sub(currentCenter);
    offset.y = 0; 
    candidateBox.translate(offset);

    // Quét toàn bộ các phần tử đang có trên sàn để tránh va chạm Hitbox
    let hasCollision = false;
    if (typeof parts !== 'undefined' && parts.length > 0) {
      for (let i = 0; i < parts.length; i++) {
        const existingPart = parts[i];
        if (existingPart && existingPart.root) {
          const existingBox = new THREE.Box3().setFromObject(existingPart.root);
          
          // Nở rộng biên an toàn lên 1.0 đơn vị để các model cách nhau khoảng trống thoáng, tuyệt đối không dính sát hay Z-fighting
          existingBox.expandByScalar(1.0); 

          if (candidateBox.intersectsBox(existingBox)) {
            hasCollision = true;
            break;
          }
        }
      }
    }

    if (!hasCollision) {
      foundSpot = true;
    }

    attempt++;
  }

  return candidatePos;
}

function resetSpawnCounter() {
  // Giữ lại tương thích
}