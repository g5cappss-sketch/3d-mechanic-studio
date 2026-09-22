// ==========================================
// FILE: 12_inventory.js
// CHỨC NĂNG: Phân loại linh kiện (Thanh cấu trúc vs Chốt liên kết)
// ==========================================

// Từ điển phân loại
const PART_CATEGORIES = {
  BEAM: 'beam', // Thanh, dầm, nẹp (Các chi tiết có lỗ để cắm chốt)
  PIN: 'pin',   // Chốt, trục, ốc (Các chi tiết dùng để liên kết)
  COMBO: 'combo' // Các cụm được sinh ra có sẵn cả thanh và chốt
};

// Hàm lọc linh kiện theo loại
function getPartsByCategory(category) {
  return parts.filter(p => p.category === category);
}

function getBeams() {
  return getPartsByCategory(PART_CATEGORIES.BEAM);
}

function getPins() {
  return getPartsByCategory(PART_CATEGORIES.PIN);
}

// GHI ĐÈ HÀM ĐẾM SỐ LƯỢNG TRÊN GIAO DIỆN CŨ (File 3_ui.js)
// Nâng cấp: Hiển thị tách biệt số lượng Thanh và Chốt
window.updatePartsCountBadge = function() {
  const badge = document.getElementById('badge-parts-count');
  if (badge) {
    const beamCount = getBeams().length;
    const pinCount = getPins().length;
    
    // Nếu không có gì
    if (parts.length === 0) {
      badge.innerText = `0 Linh kiện`;
      return;
    }

    // Hiển thị chi tiết ví dụ: "5 Thanh | 2 Chốt"
    let text = [];
    if (beamCount > 0) text.push(`${beamCount} Thanh`);
    if (pinCount > 0) text.push(`${pinCount} Chốt`);
    
    badge.innerText = text.join(' • ');
  }
};