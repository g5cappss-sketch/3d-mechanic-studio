// GLOBAL STATE & VARIABLES
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

// Canvas 2D hole badge helper group
let holeBadgesGroup = new THREE.Group();

// Hệ thống công cụ tiện ích Transform (Gizmo)
let transformControl;