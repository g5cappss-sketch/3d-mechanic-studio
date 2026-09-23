// ==========================================
// FILE: 17_free_assembly.js
// CHỨC NĂNG: Lắp ráp tuần tự 4 Bước, Tinh chỉnh Live Preview, Tháo rời & Xoay bản lề.
// ==========================================

let directAssemblyState = { step: 0, sourcePartId: null, sourceSocketId: null, targetPartId: null };

// ----------------------------------------------------
// POPUP XÁC NHẬN CẮM VÀO (MÀU XANH)
// ----------------------------------------------------
function promptAssemblyConfirmation(sourceType, sourceLabel, targetType, targetLabel, onConfirm, onCancel) {
  const existing = document.getElementById('custom-assembly-popup');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'custom-assembly-popup';
  overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm';
  
  overlay.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200">
      <h3 class="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <i data-lucide="link-2" class="w-5 h-5 text-cyan-400"></i> Xác nhận lắp ghép
      </h3>
      <p class="text-sm text-slate-300 mb-6 leading-relaxed">
        Xác nhận cắm <b class="text-cyan-400 bg-cyan-900/30 px-1.5 py-0.5 rounded">${sourceType} ${sourceLabel}</b> 
        vào <b class="text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded">${targetType} ${targetLabel}</b>?
      </p>
      <div class="flex gap-3 justify-end">
        <button id="btn-popup-cancel" class="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-700 transition-all">Hủy</button>
        <button id="btn-popup-confirm" class="px-5 py-2 rounded-xl text-sm font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all">Cắm Ngay</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('btn-popup-confirm').onclick = () => { overlay.remove(); if (onConfirm) onConfirm(); };
  document.getElementById('btn-popup-cancel').onclick = () => { overlay.remove(); if (onCancel) onCancel(); };
}

// ----------------------------------------------------
// POPUP XÁC NHẬN THÁO RA (MÀU ĐỎ)
// ----------------------------------------------------
function promptDetachConfirmation(type, label, onConfirm, onCancel) {
  const existing = document.getElementById('custom-assembly-popup');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'custom-assembly-popup';
  overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm';
  
  overlay.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200">
      <h3 class="text-lg font-bold text-rose-400 mb-3 flex items-center gap-2">
        <i data-lucide="unlink" class="w-5 h-5"></i> Tháo khớp nối
      </h3>
      <p class="text-sm text-slate-300 mb-6 leading-relaxed">
        Bạn có muốn rút <b class="text-rose-400 bg-rose-900/30 px-1.5 py-0.5 rounded">${type} ${label}</b> ra khỏi liên kết hiện tại không?
      </p>
      <div class="flex gap-3 justify-end">
        <button id="btn-popup-cancel" class="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-700 transition-all">Hủy</button>
        <button id="btn-popup-confirm" class="px-5 py-2 rounded-xl text-sm font-bold bg-rose-500 text-white hover:bg-rose-400 transition-all">Tháo Ra</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('btn-popup-confirm').onclick = () => { overlay.remove(); if (onConfirm) onConfirm(); };
  document.getElementById('btn-popup-cancel').onclick = () => { overlay.remove(); if (onCancel) onCancel(); };
}

// ----------------------------------------------------
// HIỂN THỊ HUY HIỆU (SỐ) TRÊN LINH KIỆN
// ----------------------------------------------------
function clearDirectAssemblyMode() {
  directAssemblyState = { step: 0, sourcePartId: null, sourceSocketId: null, targetPartId: null };
  while (holeBadgesGroup.children.length > 0) holeBadgesGroup.remove(holeBadgesGroup.children[0]);
  const banner = document.getElementById('snap-guide-banner');
  if (banner) banner.classList.add('hidden');
}

window.cancelFreeAssembly = clearDirectAssemblyMode;

function showAssemblyBadges(part) {
  while (holeBadgesGroup.children.length > 0) holeBadgesGroup.remove(holeBadgesGroup.children[0]);
  if (typeof addSocketBadgesForPart === 'function') addSocketBadgesForPart(part);
}

// ----------------------------------------------------
// THỰC THI GHÉP NỐI BẰNG TOÁN HỌC CHUẨN XÁC
// ----------------------------------------------------
function executeDirectAssembly(targetPartId, targetSocketId) {
  const sourcePart = parts.find(item => item.id === directAssemblyState.sourcePartId);
  const targetPart = parts.find(item => item.id === targetPartId);
  const sourceSocket = getPartSockets(sourcePart).find(item => item.id === directAssemblyState.sourceSocketId);
  const targetSocket = getPartSockets(targetPart).find(item => item.id === targetSocketId);

  // 1. GÓI TOÀN BỘ CỤM
  if (typeof packCluster === 'function') packCluster(sourcePart.id);
  activeClusterGroup.updateMatrixWorld(true);

  // --- BẮT ĐẦU CÔNG THỨC TOÁN HỌC KINEMATICS ---
  let sData = getSocketWorldData(sourcePart, sourceSocket);
  let tData = getSocketWorldData(targetPart, targetSocket);

  // A. XOAY (ROTATION)
  const alignQuat = new THREE.Quaternion().setFromUnitVectors(sData.axis, tData.axis.clone().negate());
  activeClusterGroup.quaternion.premultiply(alignQuat);
  activeClusterGroup.updateMatrixWorld(true);

  // B. TỊNH TIẾN (TRANSLATION)
  sData = getSocketWorldData(sourcePart, sourceSocket); 
  tData = getSocketWorldData(targetPart, targetSocket);
  
  const offset = tData.position.clone().sub(sData.position);
  activeClusterGroup.position.add(offset);

  // C. ĐÂM XUYÊN (PENETRATION)
  const maleSocket = sourceSocket.type === 'male' ? sourceSocket : targetSocket;
  const pushDepth = maleSocket.insertionDepth || 0.8;

  const pushVector = tData.axis.clone().multiplyScalar(-pushDepth);
  activeClusterGroup.position.add(pushVector);
  
  activeClusterGroup.updateMatrixWorld(true);

  // 2. LƯU LIÊN KẾT VÀO HỆ THỐNG
  const candidate = {
    source: { part: sourcePart, socket: sourceSocket },
    target: { part: targetPart, socket: targetSocket }
  };

  if (connectionManager.connectCandidate(candidate)) {
    showTemporaryNotice(`✅ Lắp ráp thành công! Khối đã được hợp nhất cứng cáp.`);
    if (typeof updateJointsUI === 'function') updateJointsUI();
    if (typeof updatePartsCountBadge === 'function') updatePartsCountBadge();
  } else {
    showTemporaryNotice('Lỗi: Vị trí này đã bị chiếm!');
  }
  
  // 3. ĐÓNG GÓI LẠI
  if (typeof unpackCluster === 'function') unpackCluster();
  if (typeof packCluster === 'function') packCluster(targetPart.id);
  if (typeof selectPart === 'function') selectPart(targetPart.id);

  clearDirectAssemblyMode();
}

// ----------------------------------------------------
// THỰC THI THÁO RỜI KHỚP NỐI (DETACH)
// ----------------------------------------------------
function executeDetachAssembly(partId, socketId) {
  if (typeof connectionManager !== 'undefined') {
    connectionManager.removeConnection(partId, socketId);
  }
  if (typeof unpackCluster === 'function') unpackCluster();
  if (typeof packCluster === 'function') packCluster(partId);
  if (typeof selectPart === 'function') selectPart(partId);
  
  showTemporaryNotice(`🔓 Đã tháo khớp nối thành công! Bạn có thể kéo rời linh kiện.`);
  if (typeof updateJointsUI === 'function') updateJointsUI();
  clearDirectAssemblyMode();
}

// ----------------------------------------------------
// TÍNH NĂNG MỚI: XOAY BẢN LỀ (QUANH TRỤC CHỐT)
// ----------------------------------------------------
window.setSocketAngle = function(connId, angleDeg) {
  const conn = socketConnections.find(c => c.id === connId);
  if (!conn) return;

  const partA = parts.find(p => p.id === conn.partAId); // Vật thể Cắm (Lá)
  const partB = parts.find(p => p.id === conn.partBId); // Vật thể Bị Cắm (Gốc)
  if (!partA || !partB) return;

  if (conn.angle === undefined) conn.angle = 0;
  const deltaAngle = angleDeg - conn.angle;
  conn.angle = angleDeg;

  if (typeof unpackCluster === 'function') unpackCluster();

  // Dùng tâm của Gốc (PartB) làm trục tọa độ chuẩn
  const socketB = getPartSockets(partB).find(s => s.id === conn.socketBId);
  const pivotData = getSocketWorldData(partB, socketB);
  const pivotWorld = pivotData.position.clone();
  const axisWorld = pivotData.axis.clone();

  // Tính toán Quaternion góc xoay
  const q = new THREE.Quaternion();
  q.setFromAxisAngle(axisWorld, THREE.MathUtils.degToRad(deltaAngle));

  // LỖI NẰM Ở ĐÂY LÚC TRƯỚC: GIỜ ĐÃ ĐẢO LẠI -> Xoay Part A, Giữ Yên Part B
  const visited = new Set();
  const visitedJoints = new Set();
  const queue = [partA.id]; // Queue phần cần xoay (Part A)
  visited.add(partA.id);
  visited.add(partB.id); // Chặn tuyệt đối không cho phép vòng quay lan sang Gốc (Part B)

  while (queue.length > 0) {
      const currentId = queue.shift();
      // Quét khớp xoay cũ
      joints.forEach(j => {
          if (j.partAId === currentId && !visited.has(j.partBId)) { visited.add(j.partBId); queue.push(j.partBId); visitedJoints.add(j); }
          if (j.partBId === currentId && !visited.has(j.partAId)) { visited.add(j.partAId); queue.push(j.partAId); visitedJoints.add(j); }
      });
      // Quét khớp chốt ngàm mới
      socketConnections.forEach(c => {
          if (c.partAId === currentId && !visited.has(c.partBId)) { visited.add(c.partBId); queue.push(c.partBId); }
          if (c.partBId === currentId && !visited.has(c.partAId)) { visited.add(c.partAId); queue.push(c.partAId); }
      });
  }
  visited.delete(partB.id); // Lấy Part B ra khỏi danh sách bị xoay

  // Áp dụng góc xoay cho tất cả cụm linh kiện nằm trên Part A
  visited.forEach(id => {
      const p = parts.find(item => item.id === id);
      if (p && p.root) {
          p.root.position.sub(pivotWorld);
          p.root.position.applyQuaternion(q);
          p.root.position.add(pivotWorld);
          p.root.quaternion.premultiply(q);
          p.root.updateMatrixWorld(true);
      }
  });

  // Áp dụng góc xoay cho các mô hình ốc vít cũ (nếu có)
  visitedJoints.forEach(j => {
      if (j.pinMesh) {
          j.pinMesh.position.sub(pivotWorld);
          j.pinMesh.position.applyQuaternion(q);
          j.pinMesh.position.add(pivotWorld);
          j.pinMesh.quaternion.premultiply(q);
          j.pinMesh.updateMatrixWorld(true);
      }
  });

  // Cập nhật giá trị hiển thị trên UI
  const valEl = document.getElementById(`val-socket-${conn.id}`);
  if (valEl) valEl.innerText = `${angleDeg}°`;

  // Gói lại để Hitbox hoạt động
  if (typeof packCluster === 'function') packCluster(partA.id);
  if (selectedPartId && typeof selectPart === 'function') selectPart(selectedPartId);
};

// ----------------------------------------------------
// BẮT CLICK SIÊU NHẠY 2D (BẤM SỐ)
// ----------------------------------------------------
function getSmartBadgeHit(event) {
  const rect = canvas.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;

  let closestSprite = null;
  let minDistance = 35; 

  holeBadgesGroup.children.forEach(sprite => {
    if (!sprite.visible || !sprite.userData || !sprite.userData.isSocketBadge) return;
    const vector = new THREE.Vector3().setFromMatrixPosition(sprite.matrixWorld).project(camera);
    if (vector.z > 1) return; 

    const screenX = (vector.x * 0.5 + 0.5) * rect.width;
    const screenY = -(vector.y * 0.5 - 0.5) * rect.height;

    const dist = Math.hypot(screenX - pointerX, screenY - pointerY);
    if (dist < minDistance) {
      minDistance = dist;
      closestSprite = sprite;
    }
  });

  if (!closestSprite) return null;

  const uData = closestSprite.userData;
  const isOccupied = uData.clickable === false; 

  const part = parts.find(item => item.id === uData.partId);
  const socket = part ? getPartSockets(part).find(item => item.id === uData.socketId) : null;
  
  return socket ? { part, socket, isOccupied } : null;
}

// ----------------------------------------------------
// LUỒNG CLICK CHUỘT
// ----------------------------------------------------
function handleFreeAssemblyPointerDown(event) {
  if (!canvas || !camera || event.button !== 0) return false;
  if (document.getElementById('custom-assembly-popup')) return true; 

  const badgeHit = getSmartBadgeHit(event);

  if (badgeHit) {
    if (badgeHit.isOccupied) {
      const type = badgeHit.socket.type === 'male' ? 'Đầu chốt' : 'Lỗ';
      const label = badgeHit.socket.displayIndex || badgeHit.socket.id;
      promptDetachConfirmation(type, label, 
        () => { executeDetachAssembly(badgeHit.part.id, badgeHit.socket.id); },
        () => { clearDirectAssemblyMode(); }
      );
      event.preventDefault(); event.stopImmediatePropagation(); return true;
    }

    if (directAssemblyState.step === 1 && badgeHit.part.id === directAssemblyState.sourcePartId) {
      directAssemblyState.sourceSocketId = badgeHit.socket.id;
      directAssemblyState.step = 2;
      while (holeBadgesGroup.children.length > 0) holeBadgesGroup.remove(holeBadgesGroup.children[0]);
      
      const sType = badgeHit.socket.type === 'male' ? 'Đầu chốt' : 'Lỗ';
      showTemporaryNotice(`👉 Đã khóa ${sType} số ${badgeHit.socket.displayIndex || badgeHit.socket.id}. BẤM VÀO LINH KIỆN TIẾP THEO ĐỂ GHÉP!`);
      event.preventDefault(); event.stopImmediatePropagation(); return true;
    }

    if (directAssemblyState.step === 3 && badgeHit.part.id === directAssemblyState.targetPartId) {
      const sourcePart = parts.find(p => p.id === directAssemblyState.sourcePartId);
      const sourceSocket = getPartSockets(sourcePart).find(s => s.id === directAssemblyState.sourceSocketId);
      
      if (sourceSocket.type === badgeHit.socket.type) {
        showTemporaryNotice("⛔ Lỗi: Phải cắm Đầu chốt vào Lỗ (hoặc ngược lại)!");
        event.preventDefault(); event.stopImmediatePropagation(); return true;
      }

      const sType = sourceSocket.type === 'male' ? 'Đầu' : 'Lỗ';
      const sLabel = sourceSocket.displayIndex || sourceSocket.id;
      const tType = badgeHit.socket.type === 'male' ? 'Đầu' : 'Lỗ';
      const tLabel = badgeHit.socket.displayIndex || badgeHit.socket.id;

      promptAssemblyConfirmation(sType, sLabel, tType, tLabel, 
        () => { executeDirectAssembly(badgeHit.part.id, badgeHit.socket.id); },
        () => { showTemporaryNotice("Đã hủy thao tác."); clearDirectAssemblyMode(); }
      );
      event.preventDefault(); event.stopImmediatePropagation(); return true;
    }
  }

  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const roots = parts.map(part => part.root).filter(root => root && root.visible);
  const intersects = raycaster.intersectObjects(roots, true);
  
  const partHitId = intersects.map(hit => {
    if (hit.object.isBoxHelper || hit.object.isAxesHelper || (hit.object.userData && hit.object.userData.isHoleAnchor)) return null;
    let curr = hit.object;
    while (curr && !curr.userData.partId && curr.parent) curr = curr.parent;
    return curr ? curr.userData.partId : null;
  }).find(Boolean);

  const partHit = parts.find(p => p.id === partHitId);

  if (partHit) {
    if (directAssemblyState.step === 0) {
      directAssemblyState = { step: 1, sourcePartId: partHit.id, sourceSocketId: null, targetPartId: null };
      showAssemblyBadges(partHit); 
      const itemType = partHit.type === 'pin' ? 'chốt' : 'thanh';
      showTemporaryNotice(`📌 Bắt đầu: Hãy bấm chọn 1 SỐ TRỐNG trên ${itemType} ${partHit.name}.`);
      if (typeof selectPart === 'function') selectPart(partHit.id);
      event.preventDefault(); event.stopImmediatePropagation(); return true;
    }

    if (directAssemblyState.step === 2 && partHit.id !== directAssemblyState.sourcePartId) {
      directAssemblyState.targetPartId = partHit.id;
      directAssemblyState.step = 3;
      showAssemblyBadges(partHit);
      showTemporaryNotice(`🎯 Đã nhắm mục tiêu: Bấm vào một SỐ TRỐNG để cắm.`);
      event.preventDefault(); event.stopImmediatePropagation(); return true;
    }
  } else if (directAssemblyState.step > 0) {
    showTemporaryNotice("Đã hủy thao tác ghép.");
    clearDirectAssemblyMode();
  }

  return false;
}

const previousCanvasPointerDown = window.onCanvasPointerDown;
window.onCanvasPointerDown = function(event) {
  if (handleFreeAssemblyPointerDown(event)) return;
  if (previousCanvasPointerDown) previousCanvasPointerDown(event);
};

// ==========================================
// GHI ĐÈ HÀM QUẢN LÝ UI KHỚP NỐI
// ==========================================
window.updateJointsUI = function() {
  const totalJoints = joints.length + (typeof socketConnections !== 'undefined' ? socketConnections.length : 0);
  const countEl = document.getElementById('count-joints');
  if (countEl) countEl.innerText = totalJoints;
  
  const emptyMsg = document.getElementById('joints-empty-msg');
  const list = document.getElementById('joints-list-container');
  if (!list) return;
  list.innerHTML = '';

  if (totalJoints === 0) {
    if (emptyMsg) emptyMsg.classList.remove('hidden');
    return;
  }
  if (emptyMsg) emptyMsg.classList.add('hidden');

  joints.forEach(j => {
    const card = document.createElement('div');
    card.className = 'bg-slate-800/50 p-3 rounded-2xl border border-slate-700/60 space-y-2 mb-2';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
          <i data-lucide="link" class="w-3.5 h-3.5"></i> Khớp xoay: Lỗ ${j.holeAIdx + 1} ↔ Lỗ ${j.holeBIdx + 1}
        </span>
        <button onclick="removeJoint('${j.id}')" class="text-rose-400 hover:text-rose-300 p-1 text-[10px]" title="Tháo bản lề">
          <i data-lucide="unlink" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      <div class="flex justify-between text-[11px] text-slate-300">
        <span>Góc xoay bản lề:</span>
        <span id="val-joint-${j.id}" class="font-mono text-cyan-400 font-bold">${j.angle}°</span>
      </div>
      <input type="range" min="-180" max="180" value="${j.angle}" step="2" oninput="setJointAngle('${j.id}', parseFloat(this.value))" class="w-full h-1.5 bg-slate-700 rounded-lg cursor-pointer">
    `;
    list.appendChild(card);
  });

  if (typeof socketConnections !== 'undefined') {
    const processedConnections = new Set(); 

    parts.filter(p => p.type === 'pin').forEach(pin => {
      const pinConns = socketConnections.filter(c => c.partAId === pin.id || c.partBId === pin.id);

      if (pinConns.length === 2) {
        const c1 = pinConns[0];
        const c2 = pinConns[1];
        processedConnections.add(c1.id);
        processedConnections.add(c2.id);

        const partAId = c1.partAId === pin.id ? c1.partBId : c1.partAId;
        const socketAId = c1.partAId === pin.id ? c1.socketBId : c1.socketAId;
        const pinSocket1Id = c1.partAId === pin.id ? c1.socketAId : c1.socketBId;
        
        const partBId = c2.partAId === pin.id ? c2.partBId : c2.partAId;
        const socketBId = c2.partAId === pin.id ? c2.socketBId : c2.socketAId;
        const pinSocket2Id = c2.partAId === pin.id ? c2.socketAId : c2.socketBId;

        const partA = parts.find(p => p.id === partAId);
        const partB = parts.find(p => p.id === partBId);

        if (!partA || !partB) return;

        const nameA = partA.name.split(' #')[0]; 
        const nameB = partB.name.split(' #')[0];
        const indexA = socketAId.match(/\d+/) ? socketAId.match(/\d+/)[0] : '';
        const indexB = socketBId.match(/\d+/) ? socketBId.match(/\d+/)[0] : '';
        const pS1 = pinSocket1Id.includes('top') || pinSocket1Id.includes('1') ? '1' : '2';
        const pS2 = pinSocket2Id.includes('top') || pinSocket2Id.includes('1') ? '1' : '2';

        const currentAngle = c2.angle || 0; 

        const card = document.createElement('div');
        card.className = 'bg-slate-800/80 p-3 rounded-2xl border-2 border-emerald-500/40 space-y-2 mb-3 shadow-lg transition-all';
        card.innerHTML = `
          <div class="flex items-center justify-between border-b border-emerald-500/20 pb-2 mb-2">
            <span class="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 truncate">
              <i data-lucide="scan-line" class="w-3.5 h-3.5"></i> CỤM BẢN LỀ (${nameA} ↔ ${nameB})
            </span>
          </div>
          
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-[10px] bg-slate-900/60 p-1.5 rounded-lg border border-slate-700/50">
              <span class="text-slate-300">Thanh 1 <b class="text-white">(Lỗ ${indexA})</b> ↔ Chốt <b class="text-emerald-300">(Đầu ${pS1})</b></span>
              <button onclick="executeDetachAssembly('${partAId}', '${socketAId}')" class="text-rose-400 hover:text-white hover:bg-rose-500 rounded px-1.5 py-0.5 transition-all flex items-center gap-1">
                <i data-lucide="unlink" class="w-3 h-3"></i> Tháo
              </button>
            </div>
            
            <div class="flex items-center justify-between text-[10px] bg-slate-900/60 p-1.5 rounded-lg border border-slate-700/50">
              <span class="text-slate-300">Thanh 2 <b class="text-white">(Lỗ ${indexB})</b> ↔ Chốt <b class="text-emerald-300">(Đầu ${pS2})</b></span>
              <button onclick="executeDetachAssembly('${partBId}', '${socketBId}')" class="text-rose-400 hover:text-white hover:bg-rose-500 rounded px-1.5 py-0.5 transition-all flex items-center gap-1">
                <i data-lucide="unlink" class="w-3 h-3"></i> Tháo
              </button>
            </div>
          </div>

          <div class="flex justify-between text-[11px] text-emerald-300 mt-3 pt-1">
            <span>Xoay quanh chốt:</span>
            <span id="val-socket-${c2.id}" class="font-mono text-emerald-400 font-bold">${currentAngle}°</span>
          </div>
          <input type="range" min="-180" max="180" value="${currentAngle}" step="2" oninput="setSocketAngle('${c2.id}', parseFloat(this.value))" class="w-full h-1.5 bg-slate-700 rounded-lg cursor-pointer accent-emerald-500">
        `;
        list.appendChild(card);
      }
    });

    socketConnections.forEach(conn => {
      if (processedConnections.has(conn.id)) return; 

      const partA = parts.find(p => p.id === conn.partAId);
      const partB = parts.find(p => p.id === conn.partBId);
      if (!partA || !partB) return;

      const nameA = partA.name.split(' #')[0]; 
      const nameB = partB.name.split(' #')[0];
      const labelA = conn.socketAId.includes('pin') ? 'Đầu' : 'Lỗ';
      const indexA = conn.socketAId.match(/\d+/) ? conn.socketAId.match(/\d+/)[0] : (conn.socketAId.split('_')[1] || '');
      const labelB = conn.socketBId.includes('pin') ? 'Đầu' : 'Lỗ';
      const indexB = conn.socketBId.match(/\d+/) ? conn.socketBId.match(/\d+/)[0] : (conn.socketBId.split('_')[1] || '');
      const currentAngle = conn.angle || 0;

      const card = document.createElement('div');
      card.className = 'bg-slate-800/50 p-3 rounded-2xl border border-slate-600/50 space-y-2 mb-2 transition-all';
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 truncate pr-2">
            <i data-lucide="plug" class="w-3.5 h-3.5"></i> ${nameA} ↔ ${nameB}
          </span>
        </div>
        <div class="flex items-center justify-between text-[10px] bg-slate-900/40 p-1.5 rounded-lg border border-slate-700/30">
          <span class="text-slate-400">${labelA} ${indexA} ↔ ${labelB} ${indexB}</span>
          <button onclick="executeDetachAssembly('${conn.partAId}', '${conn.socketAId}')" class="text-rose-400 hover:text-white hover:bg-rose-500 rounded px-1.5 py-0.5 transition-all flex items-center gap-1">
            Tháo
          </button>
        </div>
        <div class="flex justify-between text-[11px] text-slate-400 mt-2 pt-1">
          <span>Xoay độc lập:</span>
          <span id="val-socket-${conn.id}" class="font-mono">${currentAngle}°</span>
        </div>
        <input type="range" min="-180" max="180" value="${currentAngle}" step="2" oninput="setSocketAngle('${conn.id}', parseFloat(this.value))" class="w-full h-1.5 bg-slate-700 rounded-lg cursor-pointer accent-slate-400">
      `;
      list.appendChild(card);
    });
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.executeSocketWizardJoin = function() {};