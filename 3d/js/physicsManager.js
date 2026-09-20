let isColliding = false;

function initPhysicsManager() {
  // Đã gỡ bỏ toàn bộ tia laser và bóng ma nam châm theo yêu cầu
}

function handleDragPhysics(draggedPartId) {
  if (!draggedPartId) return;
  const draggedPart = parts.find(p => p.id === draggedPartId);
  if (!draggedPart || !draggedPart.root) return;

  isColliding = false;
  
  // Thu nhỏ bounding box một chút xíu (-0.15) để bạn vẫn có thể xếp các mô hình sát mép nhau
  const draggedBox = new THREE.Box3().setFromObject(draggedPart.root);
  draggedBox.expandByScalar(-0.15); 

  for (let i = 0; i < parts.length; i++) {
    const other = parts[i];
    if (other.id !== draggedPartId && other.root) {
      const otherBox = new THREE.Box3().setFromObject(other.root);
      otherBox.expandByScalar(-0.15);
      
      // Nếu 2 hình hộp đè vào nhau
      if (draggedBox.intersectsBox(otherBox)) {
        
        // LUẬT NGOẠI LỆ: Cho phép đi xuyên nếu 2 thanh này ĐÃ ĐƯỢC CHỐT VÀO NHAU
        let isJoined = false;
        if (typeof joints !== 'undefined') {
          isJoined = joints.some(j => 
            (j.partAId === draggedPartId && j.partBId === other.id) || 
            (j.partAId === other.id && j.partBId === draggedPartId)
          );
        }
        
        // Nếu không có khớp nối nào bảo kê, cấm tuyệt đối đâm xuyên!
        if (!isJoined) {
          isColliding = true; 
          break; 
        }
      }
    }
  }
}

function finalizeDrop() {
  // Không cần xử lý nam châm khi drop nữa
}