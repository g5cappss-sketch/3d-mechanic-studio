// ==========================================
// FILE: 17_free_assembly.js
// CHỨC NĂNG: Lắp ráp SIÊU TỐC 2 CHẠM, Kinematics chuẩn, Khóa khối, Explode & GIZMO MŨI TÊN XOAY 3D (BẢN HOÀN HẢO).
// ==========================================

let directAssemblyState = { step: 0, sourcePartId: null, sourceSocketId: null, targetPartId: null };

function clearAllBadges() {
  if (typeof holeBadgesGroup !== 'undefined') {
    const children = [...holeBadgesGroup.children];
    children.forEach(child => holeBadgesGroup.remove(child));
  }
}

// ----------------------------------------------------
// POPUP XÁC NHẬN CẮM VÀO / THÁO RA
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
// HIỂN THỊ HUY HIỆU & RADAR SIÊU TỐC
// ----------------------------------------------------
function clearDirectAssemblyMode() {
  directAssemblyState = { step: 0, sourcePartId: null, sourceSocketId: null, targetPartId: null };
  clearAllBadges();
  const banner = document.getElementById('snap-guide-banner');
  if (banner) banner.classList.add('hidden');
}

window.cancelFreeAssembly = clearDirectAssemblyMode;

function showAssemblyBadges(part) {
  clearAllBadges();
  if (typeof addSocketBadgesForPart === 'function') addSocketBadgesForPart(part);
}

function showAllTargetBadges(excludePartId) {
  clearAllBadges();
  parts.forEach(p => {
    if (p.id !== excludePartId) {
      if (typeof addSocketBadgesForPart === 'function') addSocketBadgesForPart(p);
    }
  });
}

// ----------------------------------------------------
// THỰC THI GHÉP NỐI & THÁO RỜI
// ----------------------------------------------------
function executeDirectAssembly(targetPartId, targetSocketId) {
  const sourcePart = parts.find(item => item.id === directAssemblyState.sourcePartId);
  const targetPart = parts.find(item => item.id === targetPartId);
  const sourceSocket = getPartSockets(sourcePart).find(item => item.id === directAssemblyState.sourceSocketId);
  const targetSocket = getPartSockets(targetPart).find(item => item.id === targetSocketId);

  if (!sourcePart || !targetPart || !sourceSocket || !targetSocket ||
      sourceSocket.type === targetSocket.type ||
      connectionManager.isSocketOccupied(sourcePart.id, sourceSocket.id) ||
      connectionManager.isSocketOccupied(targetPart.id, targetSocket.id)) {
    showTemporaryNotice('Lỗi: Socket không tương thích hoặc đã được cắm.');
    return;
  }

  if (typeof packCluster === 'function') packCluster(sourcePart.id);
  activeClusterGroup.updateMatrixWorld(true);

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
  const pushDepth = 0.8; 
  const pushVector = tData.axis.clone().multiplyScalar(-pushDepth);
  activeClusterGroup.position.add(pushVector);
  activeClusterGroup.updateMatrixWorld(true);

  const candidate = {
    source: { part: sourcePart, socket: sourceSocket },
    target: { part: targetPart, socket: targetSocket }
  };

  if (connectionManager.connectCandidate(candidate)) {
    showTemporaryNotice(`✅ Lắp ráp thành công! Cụm đã hợp nhất thành khối thực thể.`);
    if (typeof updateJointsUI === 'function') updateJointsUI();
    if (typeof updatePartsCountBadge === 'function') updatePartsCountBadge();
  } else {
    showTemporaryNotice('Lỗi: Vị trí này đã bị chiếm!');
  }
  
  if (typeof unpackCluster === 'function') unpackCluster();
  if (typeof packCluster === 'function') packCluster(targetPart.id);
  if (typeof refreshHingeHandles === 'function') refreshHingeHandles();
  if (typeof selectPart === 'function') selectPart(targetPart.id);

  clearDirectAssemblyMode();
}

function executeDetachAssembly(partId, socketId) {
  if (typeof connectionManager !== 'undefined') {
    connectionManager.removeConnection(partId, socketId);
  }
  if (typeof unpackCluster === 'function') unpackCluster();
  if (typeof packCluster === 'function') packCluster(partId);
  if (typeof refreshHingeHandles === 'function') refreshHingeHandles();
  if (typeof selectPart === 'function') selectPart(partId);
  
  showTemporaryNotice(`🔓 Đã tháo khớp nối thành công! Bạn có thể kéo rời linh kiện.`);
  if (typeof updateJointsUI === 'function') updateJointsUI();
  clearDirectAssemblyMode();
}

// ----------------------------------------------------
// BẮT CLICK SIÊU NHẠY 2D (BẤM SỐ)
// ----------------------------------------------------
function getSmartBadgeHit(event) {
  const rect = canvas.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;

  let closestSprite = null;
  let minDistance = 45; 

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
// LUỒNG CLICK CHUỘT (UX 2-CHẠM SIÊU TỐC)
// ----------------------------------------------------
function handleFreeAssemblyPointerDown(event) {
  if (!canvas || !camera || event.button !== 0) return false;
  if (document.getElementById('custom-assembly-popup')) return true; 

  // 1. ƯU TIÊN KIỂM TRA CLICK MŨI TÊN XOAY (GIZMO) TRƯỚC TIÊN
  const hingeHandle = typeof getHingeHandleHit === 'function' ? getHingeHandleHit(event) : null;
  if (hingeHandle && typeof beginHingeHandleDrag === 'function') {
    if (beginHingeHandleDrag(event, hingeHandle.connectionId)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }
  }

  const badgeHit = getSmartBadgeHit(event);

  if (badgeHit) {
    if (badgeHit.isOccupied) {
      const type = badgeHit.socket.type === 'male' ? 'Đầu chốt' : 'Lỗ';
      const label = badgeHit.socket.displayIndex || badgeHit.socket.id;
      promptDetachConfirmation(type, label, 
        () => { executeDetachAssembly(badgeHit.part.id, badgeHit.socket.id); },
        () => { showTemporaryNotice("Đã hủy thao tác tháo."); } 
      );
      event.preventDefault(); event.stopImmediatePropagation(); return true;
    }

    if (directAssemblyState.step === 0 || (directAssemblyState.step === 1 && badgeHit.part.id === directAssemblyState.sourcePartId)) {
      directAssemblyState.sourcePartId = badgeHit.part.id;
      directAssemblyState.sourceSocketId = badgeHit.socket.id;
      directAssemblyState.step = 3; 
      
      showAllTargetBadges(directAssemblyState.sourcePartId);
      
      const sType = badgeHit.socket.type === 'male' ? 'Đầu chốt' : 'Lỗ';
      showTemporaryNotice(`👉 Đã khóa ${sType} ${badgeHit.socket.displayIndex || badgeHit.socket.id}. HÃY BẤM TRỰC TIẾP VÀO LỖ ĐÍCH TRÊN THANH KHÁC!`);
      event.preventDefault(); event.stopImmediatePropagation(); return true;
    }

    if (directAssemblyState.step === 3 && badgeHit.part.id !== directAssemblyState.sourcePartId) {
      const sourcePart = parts.find(p => p.id === directAssemblyState.sourcePartId);
      const sourceSocket = getPartSockets(sourcePart).find(s => s.id === directAssemblyState.sourceSocketId);
      
      if (sourceSocket.type === badgeHit.socket.type) {
        showTemporaryNotice("⛔ Lỗi: Phải cắm Đầu chốt vào Lỗ (hoặc ngược lại)!");
        event.preventDefault(); event.stopImmediatePropagation(); return true;
      }

      directAssemblyState.targetPartId = badgeHit.part.id;

      const sType = sourceSocket.type === 'male' ? 'Đầu' : 'Lỗ';
      const sLabel = sourceSocket.displayIndex || sourceSocket.id;
      const tType = badgeHit.socket.type === 'male' ? 'Đầu' : 'Lỗ';
      const tLabel = badgeHit.socket.displayIndex || badgeHit.socket.id;

      promptAssemblyConfirmation(sType, sLabel, tType, tLabel, 
        () => { executeDirectAssembly(badgeHit.part.id, badgeHit.socket.id); },
        () => { 
          showTemporaryNotice("Đã hủy ghép. Trở về trạng thái tự do."); 
          clearDirectAssemblyMode(); 
        }
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
    if (directAssemblyState.step > 0 && directAssemblyState.step < 3 && partHit.id === directAssemblyState.sourcePartId) {
      directAssemblyState.step = 1;
      directAssemblyState.sourceSocketId = null;
      showAssemblyBadges(partHit);
      showTemporaryNotice(`📌 Đã mở lại số: Hãy chọn lại vị trí trên linh kiện này.`);
      event.preventDefault(); event.stopImmediatePropagation(); return true;
    }

    if (directAssemblyState.step === 0 || (directAssemblyState.step === 1 && partHit.id !== directAssemblyState.sourcePartId)) {
      directAssemblyState = { step: 1, sourcePartId: partHit.id, sourceSocketId: null, targetPartId: null };
      showAssemblyBadges(partHit); 
      const itemType = partHit.type === 'pin' ? 'chốt' : 'thanh';
      showTemporaryNotice(`📌 Bắt đầu: Hãy bấm chọn 1 SỐ TRỐNG trên ${itemType} ${partHit.name}.`);
      if (typeof selectPart === 'function') selectPart(partHit.id);
      event.preventDefault(); event.stopImmediatePropagation(); return true;
    }
  } 

  if (!badgeHit && !partHit) {
    if (directAssemblyState.step > 0) {
      showTemporaryNotice("Đã hủy thao tác ghép, trở về trạng thái tự do.");
      clearDirectAssemblyMode();
    }
    return false; // Nhường quyền cho Box Selection
  }

  return false;
}

const previousCanvasPointerDown = window.onCanvasPointerDown;
window.onCanvasPointerDown = function(event) {
  if (handleFreeAssemblyPointerDown(event)) return;
  if (previousCanvasPointerDown) previousCanvasPointerDown(event);
};

// ==========================================
// MỞ RỘNG: XOAY BẢN LỀ QUA MENU UI
// ==========================================
window.setLegacySocketAngle = function(connId, angleDeg) {
  const conn = socketConnections.find(c => c.id === connId);
  if (!conn) return;

  const partA = parts.find(p => p.id === conn.partAId); // Lá
  const partB = parts.find(p => p.id === conn.partBId); // Gốc
  if (!partA || !partB) return;

  if (conn.angle === undefined) conn.angle = 0;
  const deltaAngle = angleDeg - conn.angle;
  conn.angle = angleDeg;

  if (typeof unpackCluster === 'function') unpackCluster();

  partB.root.updateMatrixWorld(true);
  const socketB = getPartSockets(partB).find(s => s.id === conn.socketBId);
  const pivotData = getSocketWorldData(partB, socketB);
  const pivotWorld = pivotData.position.clone();
  const axisWorld = pivotData.axis.clone();

  const q = new THREE.Quaternion();
  q.setFromAxisAngle(axisWorld, THREE.MathUtils.degToRad(deltaAngle));

  const visited = new Set();
  const visitedJoints = new Set();
  const queue = [partA.id];
  visited.add(partA.id);
  visited.add(partB.id);

  while (queue.length > 0) {
      const currentId = queue.shift();
      joints.forEach(j => {
          if (j.partAId === currentId && !visited.has(j.partBId)) { visited.add(j.partBId); queue.push(j.partBId); visitedJoints.add(j); }
          if (j.partBId === currentId && !visited.has(j.partAId)) { visited.add(j.partAId); queue.push(j.partAId); visitedJoints.add(j); }
      });
      socketConnections.forEach(c => {
          if (c.partAId === currentId && !visited.has(c.partBId)) { visited.add(c.partBId); queue.push(c.partBId); }
          if (c.partBId === currentId && !visited.has(c.partAId)) { visited.add(c.partAId); queue.push(c.partAId); }
      });
  }
  visited.delete(partB.id);

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

  visitedJoints.forEach(j => {
      if (j.pinMesh) {
          j.pinMesh.position.sub(pivotWorld);
          j.pinMesh.position.applyQuaternion(q);
          j.pinMesh.position.add(pivotWorld);
          j.pinMesh.quaternion.premultiply(q);
          j.pinMesh.updateMatrixWorld(true);
      }
  });

  const valEl = document.getElementById(`val-socket-${conn.id}`);
  if (valEl) valEl.innerText = `${Math.round(angleDeg)}°`;

  if (typeof packCluster === 'function') packCluster(partA.id);
};

// ==========================================
// CẬP NHẬT MENU UI (KHỚP NỐI)
// ==========================================
window.updateJointsUI = function() {
  const totalJoints = typeof socketConnections !== 'undefined' ? socketConnections.length : 0;
  const countEl = document.getElementById('count-joints');
  if (countEl) countEl.innerText = totalJoints;
  
  const emptyMsg = document.getElementById('joints-empty-msg');
  const list = document.getElementById('joints-list-container');
  if (!list) return;
  list.innerHTML = '';

  if (totalJoints === 0) {
    if (emptyMsg) emptyMsg.classList.remove('hidden');
    if (typeof refreshHingeHandles === 'function') refreshHingeHandles();
    return;
  }
  if (emptyMsg) emptyMsg.classList.add('hidden');

  if (typeof socketConnections !== 'undefined') {
    const processedConnections = new Set();
    const beamPairs = {};

    parts.filter(p => p.type === 'pin').forEach(pin => {
      const conns = socketConnections.filter(c => c.partAId === pin.id || c.partBId === pin.id);
      if (conns.length === 2) {
        const b1 = conns[0].partAId === pin.id ? conns[0].partBId : conns[0].partAId;
        const b2 = conns[1].partAId === pin.id ? conns[1].partBId : conns[1].partAId;
        const key = b1 < b2 ? `${b1}_${b2}` : `${b2}_${b1}`;

        if (!beamPairs[key]) beamPairs[key] = { beam1: b1, beam2: b2, pins: [], conns: [] };
        beamPairs[key].pins.push(pin);
        beamPairs[key].conns.push(conns[0], conns[1]);
      }
    });

    Object.keys(beamPairs).forEach(key => {
      const pair = beamPairs[key];
      const isRigid = pair.pins.length > 1; 

      const partA = parts.find(p => p.id === pair.beam1);
      const partB = parts.find(p => p.id === pair.beam2);
      if(!partA || !partB) return;

      pair.conns.forEach(c => processedConnections.add(c.id));
      const nameA = partA.name.split(' #')[0];
      const nameB = partB.name.split(' #')[0];

      let pinsHtml = '';
      pair.pins.forEach((pin, idx) => {
        const c1 = pair.conns[idx * 2];
        const sA = c1.partAId === pin.id ? c1.socketBId : c1.socketAId;
        const iA = sA.match(/\d+/) ? sA.match(/\d+/)[0] : '';
        pinsHtml += `
          <div class="flex items-center justify-between text-[10px] bg-slate-900/60 p-1.5 rounded-lg border border-slate-700/50 mb-1">
            <span class="text-slate-300">Chốt ${idx + 1}: Cắm ở Lỗ ${iA}</span>
            <button onclick="executeDetachAssembly('${partA.id}', '${sA}')" class="text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500 rounded px-1.5 py-0.5 transition-all">Tháo</button>
          </div>
        `;
      });

      const connToRotate = pair.conns[1];
      const currentAngle = connToRotate.angle || 0;

      const sliderHtml = isRigid
        ? `<div class="mt-2 pt-2 border-t border-rose-500/30 text-[11px] text-rose-400 font-bold flex items-center justify-center gap-1"><i data-lucide="lock" class="w-3 h-3"></i> KHỚP CỨNG (${pair.pins.length} Chốt)</div>`
        : `<div class="flex justify-between text-[11px] text-emerald-300 mt-2 pt-1 border-t border-emerald-500/30">
             <span>Xoay Bản Lề:</span>
             <span id="val-socket-${connToRotate.id}" class="font-mono text-emerald-400 font-bold">${Math.round(currentAngle)}°</span>
           </div>
           <input type="range" min="-180" max="180" value="${currentAngle}" step="2" oninput="setSocketAngle('${connToRotate.id}', parseFloat(this.value))" class="w-full h-1.5 bg-slate-700 rounded-lg cursor-pointer accent-emerald-500">`;

      const card = document.createElement('div');
      card.className = `bg-slate-800/80 p-3 rounded-2xl border-2 ${isRigid ? 'border-rose-500/40' : 'border-emerald-500/40'} space-y-2 mb-3 shadow-lg`;
      card.innerHTML = `
        <div class="flex items-center justify-between pb-1">
          <span class="text-[11px] font-bold ${isRigid ? 'text-rose-400' : 'text-emerald-400'} flex items-center gap-1.5 truncate">
            <i data-lucide="${isRigid ? 'lock' : 'scan-line'}" class="w-3.5 h-3.5"></i> CỤM ${isRigid ? 'CỨNG' : 'BẢN LỀ'} (${nameA} ↔ ${nameB})
          </span>
        </div>
        <div class="space-y-1">${pinsHtml}</div>
        ${sliderHtml}
      `;
      list.appendChild(card);
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
          <span id="val-socket-${conn.id}" class="font-mono">${Math.round(currentAngle)}°</span>
        </div>
        <input type="range" min="-180" max="180" value="${currentAngle}" step="2" oninput="setSocketAngle('${conn.id}', parseFloat(this.value))" class="w-full h-1.5 bg-slate-700 rounded-lg cursor-pointer accent-slate-400">
      `;
      list.appendChild(card);
    });
  }

  if (typeof refreshHingeHandles === 'function') refreshHingeHandles();
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ==========================================
// TÍNH NĂNG EXPLODE (BẮN TUNG TÓE MÔ HÌNH)
// ==========================================
window.toggleAssemblyExplode = function() {
  if (typeof isExploded === 'undefined') window.isExploded = false;
  if (window.isExploded) {
    const targets = [];
    explodedPartStates.parts.forEach(state => {
      const part = parts.find(item => item.id === state.id);
      if (part) targets.push({ part, position: state.position, quaternion: state.quaternion });
    });

    animatePartTransforms(targets, () => { explodedPartStates = null; });
    window.isExploded = false;
    document.getElementById('label-explode').innerText = 'Tách Rời (Explode)';
    return;
  }

  if (typeof unpackCluster === 'function') unpackCluster();
  if (typeof detachGizmo === 'function') detachGizmo();

  window.explodedPartStates = { parts: parts.map(p => ({ id: p.id, position: p.root.position.clone(), quaternion: p.root.quaternion.clone() })) };

  const targets = [];
  const center = new THREE.Vector3();
  parts.forEach(p => center.add(p.root.position));
  center.multiplyScalar(1 / parts.length);

  parts.forEach((part, index) => {
    const angle = (index / parts.length) * Math.PI * 2;
    const dist = 3.0 + (index % 3); 
    const offset = new THREE.Vector3(Math.cos(angle) * dist, (index % 3) * 1.5, Math.sin(angle) * dist);

    targets.push({ part, position: part.root.position.clone().add(offset), quaternion: part.root.quaternion.clone() });
  });

  if (targets.length === 0) {
    showTemporaryNotice('Chưa có linh kiện nào để tách rời.');
    return;
  }

  window.isExploded = true;
  document.getElementById('label-explode').innerText = 'Lắp Khít (Assemble)';
  animatePartTransforms(targets);
};

function animatePartTransforms(targets, onComplete) {
  const startTime = performance.now();
  const starts = targets.map(target => ({
    part: target.part,
    position: target.part.root.position.clone(),
    quaternion: target.part.root.quaternion.clone()
  }));

  function step(now) {
    const progress = Math.min((now - startTime) / 450, 1);
    const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
    starts.forEach((start, index) => {
      start.part.root.position.lerpVectors(start.position, targets[index].position, eased);
      start.part.root.quaternion.slerpQuaternions(start.quaternion, targets[index].quaternion, eased);
    });
    if (progress < 1) requestAnimationFrame(step);
    else if (onComplete) onComplete();
  }
  requestAnimationFrame(step);
}

// ==========================================
// MŨI TÊN XOAY TRỰC TIẾP TRÊN MÔ HÌNH (GIZMO)
// Đã fix: Hitbox bằng opacity=0 để dễ bắt chuột, dời ra tận đầu mũi thanh kim loại.
// ==========================================
let hingeGizmosGroup;
if (typeof scene !== 'undefined') {
    hingeGizmosGroup = scene.children.find(c => c.name === 'hingeGizmosGroup');
    if (!hingeGizmosGroup) {
        hingeGizmosGroup = new THREE.Group();
        hingeGizmosGroup.name = 'hingeGizmosGroup';
        scene.add(hingeGizmosGroup);
    }
}

window.refreshLegacyHingeHandles = function() {
    if (!hingeGizmosGroup) return;
    hingeGizmosGroup.clear();

    if (typeof socketConnections === 'undefined') return;

    const beamPairs = {};
    parts.filter(p => p.type === 'pin').forEach(pin => {
        const conns = socketConnections.filter(c => c.partAId === pin.id || c.partBId === pin.id);
        if (conns.length === 2) {
            const b1 = conns[0].partAId === pin.id ? conns[0].partBId : conns[0].partAId;
            const b2 = conns[1].partAId === pin.id ? conns[1].partBId : conns[1].partAId;
            const key = b1 < b2 ? `${b1}_${b2}` : `${b2}_${b1}`;
            if (!beamPairs[key]) beamPairs[key] = { pins: [], conns: [] };
            beamPairs[key].pins.push(pin);
            beamPairs[key].conns.push(conns[0], conns[1]);
        }
    });

    Object.keys(beamPairs).forEach(key => {
        const pair = beamPairs[key];
        if (pair.pins.length > 1) return; // Khớp cứng không vẽ mũi tên

        const connToRotate = pair.conns[1]; 
        const partA = parts.find(p => p.id === connToRotate.partAId); // Lá (Thanh xoay)
        const partB = parts.find(p => p.id === connToRotate.partBId); // Gốc (Tâm xoay)
        if (!partA || !partB) return;

        partA.root.updateMatrixWorld(true);
        partB.root.updateMatrixWorld(true);

        const socketB = getPartSockets(partB).find(s => s.id === connToRotate.socketBId);
        const pivotData = getSocketWorldData(partB, socketB);
        const pivotPos = pivotData.position.clone();
        
        // Thuật toán: Tìm lỗ xa nhất trên tất cả các linh kiện đang dính vào "Lá" (BFS)
        const visited = new Set();
        const queue = [partA.id];
        visited.add(partA.id);
        visited.add(partB.id); // Trừ điểm gốc

        while (queue.length > 0) {
            const currentId = queue.shift();
            socketConnections.forEach(c => {
                if (c.partAId === currentId && !visited.has(c.partBId)) { visited.add(c.partBId); queue.push(c.partBId); }
                if (c.partBId === currentId && !visited.has(c.partAId)) { visited.add(c.partAId); queue.push(c.partAId); }
            });
        }
        visited.delete(partB.id);

        let maxDist = 0;
        let tailPos = pivotPos.clone();
        visited.forEach(id => {
            const p = parts.find(item => item.id === id);
            if (p && p.type !== 'pin') { // Chỉ lấy lỗ của thanh dầm, bỏ qua chốt ngắn
                p.root.updateMatrixWorld(true);
                const sockets = getPartSockets(p);
                sockets.forEach(s => {
                    const sWorld = getSocketWorldData(p, s);
                    const dist = sWorld.position.distanceTo(pivotPos);
                    if (dist > maxDist) {
                        maxDist = dist;
                        tailPos = sWorld.position.clone();
                    }
                });
            }
        });

        // Nếu không có lỗ xa hơn, đặt mặc định ngay tại tâm xoay
        if (maxDist === 0) tailPos.copy(pivotPos);

        // Nâng đuôi lên 1 chút xíu để ko lún vào thanh
        const upVector = pivotData.axis.clone().normalize().multiplyScalar(1.5);
        tailPos.add(upVector);

        const gizmoGroup = new THREE.Group();
        gizmoGroup.position.copy(tailPos);

        const defaultAxis = new THREE.Vector3(0, 0, 1);
        const alignQuat = new THREE.Quaternion().setFromUnitVectors(defaultAxis, pivotData.axis);
        gizmoGroup.quaternion.copy(alignQuat);

        // Bán kính nhỏ lại vì đã đặt ở đuôi rồi
        const arcRadius = 1.2; 
        const arcGeom = new THREE.TorusGeometry(arcRadius, 0.15, 12, 48, Math.PI); 
        const arcMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, depthTest: false, transparent: true, opacity: 0.9 });
        const arc = new THREE.Mesh(arcGeom, arcMat);
        arc.renderOrder = 999;
        gizmoGroup.add(arc);

        const coneGeom = new THREE.ConeGeometry(0.4, 0.8, 16);
        const cone1 = new THREE.Mesh(coneGeom, arcMat);
        cone1.position.set(arcRadius, 0, 0);
        cone1.rotation.x = Math.PI / 2;
        cone1.renderOrder = 999;
        gizmoGroup.add(cone1);

        const cone2 = new THREE.Mesh(coneGeom, arcMat);
        cone2.position.set(-arcRadius, 0, 0);
        cone2.rotation.x = -Math.PI / 2;
        cone2.renderOrder = 999;
        gizmoGroup.add(cone2);

        // HITBOX tàng hình cực lớn: Fix lỗi bấm không dính chuột (dùng opacity: 0 thay vì visible: false)
        const hitGeom = new THREE.TorusGeometry(arcRadius, 1.5, 8, 24, Math.PI);
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false });
        const hitbox = new THREE.Mesh(hitGeom, hitMat);
        hitbox.userData = { isHingeHitbox: true, connectionId: connToRotate.id };
        gizmoGroup.add(hitbox);

        hingeGizmosGroup.add(gizmoGroup);
    });
};

window.getLegacyHingeHandleHit = function(event) {
    if (!hingeGizmosGroup || hingeGizmosGroup.children.length === 0) return null;
    
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const hitboxes = [];
    hingeGizmosGroup.children.forEach(g => {
        g.children.forEach(c => {
            if (c.userData && c.userData.isHingeHitbox) hitboxes.push(c);
        });
    });

    // Bắt sự kiện với hitbox
    const intersects = raycaster.intersectObjects(hitboxes, false);
    if (intersects.length > 0) {
        return { connectionId: intersects[0].object.userData.connectionId };
    }
    return null;
};

let isDraggingHinge = false;
window.beginLegacyHingeHandleDrag = function(event, connectionId) {
    const conn = socketConnections.find(c => c.id === connectionId);
    if (!conn) return false;

    isDraggingHinge = true;
    if (typeof controls !== 'undefined') controls.enabled = false; // Tắt quay camera

    let startX = event.clientX;
    let startY = event.clientY;
    let startAngle = conn.angle || 0;

    function onPointerMove(e) {
        if (!isDraggingHinge) return;
        
        let deltaX = e.clientX - startX;
        let deltaY = e.clientY - startY;
        let delta = deltaX - deltaY * 0.5; 

        let newAngle = startAngle + delta;
        
        while(newAngle > 180) newAngle -= 360;
        while(newAngle < -180) newAngle += 360;
        
        window.setSocketAngle(connectionId, newAngle);
        
        const slider = document.querySelector(`input[oninput*="${connectionId}"]`);
        if (slider) slider.value = newAngle;
    }

    function onPointerUp() {
        isDraggingHinge = false;
        if (typeof controls !== 'undefined') controls.enabled = true; // Bật lại camera
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    
    return true;
};