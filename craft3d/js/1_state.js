// ==========================================
// FILE: 1_state.js
// CHỨC NĂNG: Khai báo các biến trạng thái toàn cục (Global State).
// Mọi file khác sẽ dùng chung các biến này.
// ==========================================

let scene, camera, renderer, controls, container, canvas;
let partsGroup;
let parts = [];
let joints = [];
let partIdCounter = 1;
let jointIdCounter = 1;

let selectedPartId = null;
let pendingSnapSource = null;
let isExploded = false;
let autoRotate = false;
let chosenJoinAngle = 45;

let highlightBox;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let axesHelper;
let brushedTexture;

// Group chứa các huy hiệu (badge) đánh số lỗ 2D trên Canvas
let holeBadgesGroup = new THREE.Group();

// ==========================================
// CÁC BIẾN CHO VẬT LÝ (Thêm vào cuối 1_state.js)
// ==========================================
let physicsWorld;
let isSimulating = false; 
let originalStates = new Map(); // Lưu lại vị trí tĩnh để khi Stop sẽ quay về chỗ cũ
let cannonMeshes = []; // Danh sách các vật thể đang chịu tác động vật lý