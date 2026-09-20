window.onload = function () {
  // Initialize Lucide icons
  lucide.createIcons();
  
  // Khởi tạo không gian 3D
  initScene();
  
  // Ráp các hàm lắng nghe sự kiện UI
  setupEventListeners();
};