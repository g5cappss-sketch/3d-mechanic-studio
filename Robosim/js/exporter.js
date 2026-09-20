/**
 * Xuất mô hình 3D sang file nhị phân .GLB
 * @param {boolean} onlySelected - true: chỉ xuất chi tiết đang chọn, false: xuất toàn bộ cụm lắp ghép
 */
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

    // Nhân bản chi tiết đang chọn
    target = part.root.clone(true);
    const safeName = part.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    filename = `${safeName}.glb`;
  } else {
    if (parts.length === 0) {
      showTemporaryNotice('Không có linh kiện nào trên sàn để xuất!');
      return;
    }

    // Tạo container gom toàn bộ cụm lắp ráp
    target = new THREE.Group();
    target.name = 'ZMROBO_Modular_Assembly';

    // Sao chép tất cả linh kiện cơ sở
    partsGroup.children.forEach(child => {
      target.add(child.clone(true));
    });

    // Sao chép các cụm khớp nối pivot (chứa thanh xoay và chốt ngàm)
    joints.forEach(j => {
      if (j.pivotGroup) {
        target.add(j.pivotGroup.clone(true));
      }
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    filename = `cum_lap_ghep_zmrobo_${timestamp}.glb`;
  }

  // Làm sạch mô hình: Loại bỏ các mesh va chạm tàng hình (hole anchors) và sprite số thứ tự
  const objectsToRemove = [];
  target.traverse(node => {
    if (node.userData && (node.userData.isHoleAnchor || node.isSprite || node.isAxesHelper || node.isBoxHelper)) {
      objectsToRemove.push(node);
    }
  });
  objectsToRemove.forEach(node => {
    if (node.parent) node.parent.remove(node);
  });

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
    function (error) {
      console.error('Lỗi khi xuất GLB:', error);
      showTemporaryNotice('Không thể xuất file GLB, vui lòng kiểm tra Console.');
    },
    {
      binary: true,
      onlyVisible: true,
      embedImages: true
    }
  );
}