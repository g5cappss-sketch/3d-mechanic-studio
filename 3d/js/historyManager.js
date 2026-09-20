let historyStack = [];
let currentStepIndex = -1;
let isRestoringHistory = false;

// Lưu lại trạng thái của toàn bộ bản vẽ
function saveHistoryStep(actionName) {
  if (isRestoringHistory) return; // Không lưu nếu đang trong quá trình undo/redo

  // Nếu đang ở giữa lịch sử mà có thao tác mới, cắt bỏ tương lai
  if (currentStepIndex < historyStack.length - 1) {
    historyStack = historyStack.slice(0, currentStepIndex + 1);
  }

  // Chụp ảnh (Snapshot) toàn bộ dữ liệu hiện tại
  const state = {
    action: actionName,
    partsData: parts.map(p => ({
      id: p.id,
      name: p.name.split(' #')[0], // Lấy tên gốc
      type: p.type,
      holesCount: p.holes.length,
      colorHex: p.colorHex,
      joinKey: p.joinKey,
      height: p.height,
      pos: { x: p.root.position.x, y: p.root.position.y, z: p.root.position.z },
      rot: { y: p.root.rotation.y }
    })),
    jointsData: joints.map(j => ({
      id: j.id,
      partAId: j.partAId, holeAIdx: j.holeAIdx,
      partBId: j.partBId, holeBIdx: j.holeBIdx,
      angle: j.angle,
      isLocked: j.isLocked,
      isSecondaryLock: j.isSecondaryLock
    }))
  };

  historyStack.push(state);
  currentStepIndex++;
  updateTimelineUI();
}

function undoHistory() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    restoreState(historyStack[currentStepIndex]);
  } else {
    showTemporaryNotice('Đã về bước đầu tiên!');
  }
}

function redoHistory() {
  if (currentStepIndex < historyStack.length - 1) {
    currentStepIndex++;
    restoreState(historyStack[currentStepIndex]);
  } else {
    showTemporaryNotice('Đang ở bước mới nhất!');
  }
}

function restoreState(state) {
  isRestoringHistory = true;
  clearSelection();

  // 1. Xóa sạch màn hình (âm thầm)
  while (joints.length > 0) {
    const j = joints[0];
    if (j.isSecondaryLock) partsGroup.remove(j.pinMesh);
    else if (j.pivotGroup && j.pivotGroup.parent) j.pivotGroup.parent.remove(j.pivotGroup);
    joints.shift();
  }
  while (parts.length > 0) {
    const p = parts[0];
    if (p.root.parent) p.root.parent.remove(p.root);
    else partsGroup.remove(p.root);
    parts.shift();
  }
  partIdCounter = 1;
  jointIdCounter = 1;

  // 2. Tái tạo lại các Parts
  state.partsData.forEach(pd => {
    let pObj;
    if (pd.type === 'zmrobo-beam') {
      const mat = new THREE.MeshStandardMaterial({ color: pd.colorHex, metalness: 0.0, roughness: 0.78 });
      const res = buildZMROBOBeamMesh(pd.holesCount, mat, false);
      pObj = registerPart(pd.name, pd.type, res.group, res.holes, pd.colorHex, res.height, pd.joinKey);
    } else if (pd.type === 'dv-bar') {
      const mat = new THREE.MeshStandardMaterial({ color: pd.colorHex, metalness: 0.0, roughness: 0.8 });
      const res = buildZMROBOBeamMesh(pd.holesCount, mat, false);
      pObj = registerPart(pd.name, pd.type, res.group, res.holes, pd.colorHex, res.height, pd.joinKey);
    } else if (pd.type === 'yellow-bracket') {
      const mat = new THREE.MeshStandardMaterial({ color: pd.colorHex, metalness: 0.0, roughness: 0.75 });
      const res = buildZMROBOBeamMesh(3, mat, true);
      pObj = registerPart(pd.name, pd.type, res.group, res.holes, pd.colorHex, res.height, pd.joinKey);
    } else if (pd.type === 'pin') {
      const pinMat = new THREE.MeshStandardMaterial({ color: pd.colorHex, metalness: 0.0, roughness: 0.85 });
      const pin = buildPinGeometry(pinMat, 1.6, (14 / 47) * 0.98);
      const dummyAnchor = [{ x: 0, y: 0, z: 0, index: 0 }];
      pObj = registerPart(pd.name, pd.type, pin, dummyAnchor, pd.colorHex, 1.6, pd.joinKey);
    }
    
    // Ép lại ID và Tọa độ cũ
    pObj.id = pd.id;
    pObj.root.userData.partId = pd.id;
    pObj.root.position.set(pd.pos.x, pd.pos.y, pd.pos.z);
    pObj.root.rotation.y = pd.rot.y;
    const currentMaxId = parseInt(pd.id.split('_')[1]);
    if (currentMaxId >= partIdCounter) partIdCounter = currentMaxId + 1;
  });

  // 3. Tái tạo lại các Joints
  state.jointsData.forEach(jd => {
    createJointBetweenHoles(jd.partAId, jd.holeAIdx, jd.partBId, jd.holeBIdx, jd.angle);
    // Hàm createJointBetweenHoles sẽ tự thêm vào mảng joints
    const newJoint = joints[joints.length - 1];
    newJoint.id = jd.id;
    newJoint.isLocked = jd.isLocked;
    newJoint.isSecondaryLock = jd.isSecondaryLock;
    const currentMaxJId = parseInt(jd.id.split('_')[1]);
    if (currentMaxJId >= jointIdCounter) jointIdCounter = currentMaxJId + 1;
  });

  updatePartsCountBadge();
  updateJointsUI();
  updateTimelineUI();
  showTemporaryNotice(`Phục hồi bước: ${state.action}`);
  
  setTimeout(() => { isRestoringHistory = false; }, 100);
}

function updateTimelineUI() {
  const list = document.getElementById('timeline-list');
  if (!list) return;
  list.innerHTML = '';
  
  historyStack.forEach((step, idx) => {
    const isCurrent = idx === currentStepIndex;
    const li = document.createElement('li');
    li.className = `p-2 rounded-lg text-[11px] font-medium border-l-2 transition-all cursor-pointer ${isCurrent ? 'bg-cyan-900/40 border-cyan-400 text-cyan-300' : 'border-slate-700 text-slate-500 hover:bg-slate-800'}`;
    li.innerHTML = `<span class="opacity-50 mr-2">${idx + 1}.</span> ${step.action}`;
    li.onclick = () => {
      currentStepIndex = idx;
      restoreState(historyStack[currentStepIndex]);
    };
    list.appendChild(li);
  });
  // Tự động cuộn xuống cuối
  list.scrollTop = list.scrollHeight;
}

function toggleTimelinePanel() {
  const panel = document.getElementById('timeline-panel');
  if (panel) panel.classList.toggle('hidden');
}

// Khởi tạo điểm neo gốc khi load app
window.addEventListener('load', () => {
  setTimeout(() => saveHistoryStep('Khởi tạo Studio'), 1000);
});