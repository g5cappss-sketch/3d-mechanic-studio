// js/ui.js - Cập nhật hàm selectPart để kích hoạt trục kéo/xoay ngay lập tức

function selectPart(id) {
  selectedPartId = id;
  const part = parts.find(p => p.id === id);
  if (!part) return;

  // QUAN TRỌNG: Tự động gắn Gizmo (trục tọa độ) vào mô hình ngay khi click chọn
  if (typeof currentToolMode !== 'undefined' && (currentToolMode === 'translate' || currentToolMode === 'rotate')) {
    if (typeof attachTransformToSelected === 'function') {
      attachTransformToSelected();
    }
  } else {
    // Mặc định nếu đang ở mode chọn thì bật mode translate hoặc gắn trực tiếp nếu cần
    if (typeof transformControl !== 'undefined' && transformControl) {
      // Giữ nguyên hoặc tự động gán vào root assembly
      let rootAssembly = part.root;
      while (rootAssembly.parent && rootAssembly.parent !== partsGroup && rootAssembly.parent !== scene) {
        rootAssembly = rootAssembly.parent;
      }
      transformControl.attach(rootAssembly);
    }
  }

  // Hiệu ứng phát sáng mô hình được chọn
  if (typeof update3DHoleBadges === 'function') update3DHoleBadges(part);

  // Hiển thị bảng Thuộc Tính (Inspector)
  const noSel = document.getElementById('inspector-no-selection');
  const actPan = document.getElementById('inspector-active-panel');
  if (noSel) noSel.classList.add('hidden');
  if (actPan) actPan.classList.remove('hidden');

  const titleEl = document.getElementById('inspect-part-title');
  const idEl = document.getElementById('inspect-part-id');
  if (titleEl) titleEl.innerText = part.name;
  if (idEl) idEl.innerText = `ID: ${part.id}`;

  // Đồng bộ thông số tọa độ lên ô nhập
  const inX = document.getElementById('inp-pos-x');
  const inY = document.getElementById('inp-pos-y');
  const inZ = document.getElementById('inp-pos-z');
  if (inX) inX.value = part.root.position.x.toFixed(2);
  if (inY) inY.value = part.root.position.y.toFixed(2);
  if (inZ) inZ.value = part.root.position.z.toFixed(2);

  const rotInp = document.getElementById('inp-part-rot');
  const rotVal = document.getElementById('val-part-rot');
  const deg = Math.round((part.root.rotation.y * 180) / Math.PI);
  if (rotInp) rotInp.value = deg;
  if (rotVal) rotVal.innerText = `${deg}°`;

  // Cập nhật HUD nổi
  const hud = document.getElementById('floating-part-hud');
  const hudName = document.getElementById('floating-part-name');
  if (hud && hudName) {
    hudName.innerText = part.name;
    hud.classList.remove('hidden');
  }

  if (typeof refreshJoinDropdowns === 'function') refreshJoinDropdowns(part.id);
}

// Các hàm phụ trợ giữ nguyên
function showHoverPreview(event, description, imageUrl) {
  const tooltip = document.getElementById('hover-preview-tooltip');
  const img = document.getElementById('preview-image');
  const desc = document.getElementById('preview-desc');
  if(tooltip && img && desc) {
    img.src = imageUrl;
    desc.innerText = description;
    const btnRect = event.target.closest('button').getBoundingClientRect();
    tooltip.style.left = `${btnRect.left + (btnRect.width / 2)}px`;
    tooltip.style.top = `${btnRect.top}px`;
    tooltip.classList.remove('hidden');
  }
}

function hideHoverPreview() {
  const tooltip = document.getElementById('hover-preview-tooltip');
  if(tooltip) tooltip.classList.add('hidden');
}

function openJoinWizardForSelected() {
  setSidebarTab('joinwizard');
  if (selectedPartId && typeof refreshJoinDropdowns === 'function') {
    refreshJoinDropdowns(selectedPartId);
  }
}

function refreshJoinDropdowns(defaultPartAId = null) {
  const selA = document.getElementById('select-join-part-a');
  const selB = document.getElementById('select-join-part-b');
  if (!selA || !selB) return;
  const currentValA = defaultPartAId || selA.value;
  const currentValB = selB.value;
  selA.innerHTML = '<option value="">-- Chọn Thanh 1 --</option>';
  selB.innerHTML = '<option value="">-- Chọn Thanh 2 --</option>';
  const filterBars = parts.filter(p => p.holes && p.holes.length > 0);
  filterBars.forEach(p => {
    const optA = document.createElement('option');
    optA.value = p.id; optA.text = p.name;
    if (currentValA && p.id === currentValA) optA.selected = true;
    selA.appendChild(optA);
    const optB = document.createElement('option');
    optB.value = p.id; optB.text = p.name;
    if (currentValB && p.id === currentValB) optB.selected = true;
    selB.appendChild(optB);
  });
  if (currentValA && filterBars.length > 1 && (!selB.value || selB.value === currentValA)) {
    const second = filterBars.find(p => p.id !== currentValA);
    if (second) selB.value = second.id;
  }
  onJoinPartAChange();
  onJoinPartBChange();
}

function onJoinPartAChange() {
  const partId = document.getElementById('select-join-part-a').value;
  const holeSel = document.getElementById('select-join-hole-a');
  const badge = document.getElementById('badge-join-part-a');
  if (!holeSel || !badge) return;
  holeSel.innerHTML = '';
  const part = parts.find(p => p.id === partId);
  if (part && part.holes && part.holes.length > 0) {
    badge.innerText = part.name;
    part.holes.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.index; opt.text = `Lỗ số ${h.index + 1}`;
      holeSel.appendChild(opt);
    });
  } else {
    badge.innerText = 'Chưa chọn';
    holeSel.innerHTML = '<option value="0">-- Chưa có lỗ --</option>';
  }
}

function onJoinPartBChange() {
  const partId = document.getElementById('select-join-part-b').value;
  const holeSel = document.getElementById('select-join-hole-b');
  const badge = document.getElementById('badge-join-part-b');
  if (!holeSel || !badge) return;
  holeSel.innerHTML = '';
  const part = parts.find(p => p.id === partId);
  if (part && part.holes && part.holes.length > 0) {
    badge.innerText = part.name;
    part.holes.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.index; opt.text = `Lỗ số ${h.index + 1}`;
      holeSel.appendChild(opt);
    });
  } else {
    badge.innerText = 'Chưa chọn';
    holeSel.innerHTML = '<option value="0">-- Chưa có lỗ --</option>';
  }
}

function setJoinInitialAngle(deg, label) {
  if (typeof chosenJoinAngle !== 'undefined') chosenJoinAngle = deg;
  const lbl = document.getElementById('label-join-angle');
  if(lbl) lbl.innerText = label;
}

function setSidebarTab(tabName) {
  const pLib = document.getElementById('tab-pane-library');
  const pJoin = document.getElementById('tab-pane-joinwizard');
  const pInsp = document.getElementById('tab-pane-inspector');
  const pJoints = document.getElementById('tab-pane-joints');

  const bLib = document.getElementById('nav-btn-library');
  const bJoin = document.getElementById('nav-btn-joinwizard');
  const bInsp = document.getElementById('nav-btn-inspector');
  const bJoints = document.getElementById('nav-btn-joints');

  [pLib, pJoin, pInsp, pJoints].forEach(p => { if(p) p.classList.add('hidden'); });
  [bLib, bJoin, bInsp, bJoints].forEach(b => {
    if(b) {
      b.classList.remove('bg-cyan-500', 'text-slate-950', 'shadow-md');
      b.classList.add('text-slate-400');
    }
  });

  const activeBtn = document.getElementById(`nav-btn-${tabName}`);
  const activePane = document.getElementById(`tab-pane-${tabName}`);
  
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('bg-cyan-500', 'text-slate-950', 'shadow-md');
  }
  if (activePane) activePane.classList.remove('hidden');

  if (tabName === 'joinwizard') refreshJoinDropdowns(selectedPartId);
}

function updatePartsCountBadge() {
  const badge = document.getElementById('badge-parts-count');
  if (badge) badge.innerText = `${parts.length} Linh kiện`;
}

function updateJointsUI() {
  const countEl = document.getElementById('count-joints');
  if(countEl) countEl.innerText = joints.length;
  const emptyMsg = document.getElementById('joints-empty-msg');
  const list = document.getElementById('joints-list-container');
  if(!list) return;
  list.innerHTML = '';
  if (joints.length === 0) {
    if(emptyMsg) emptyMsg.classList.remove('hidden');
    return;
  }
  if(emptyMsg) emptyMsg.classList.add('hidden');

  joints.forEach(j => {
    const isLockTxt = j.isSecondaryLock ? `<span class="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded ml-2">KHÓA TRỤC</span>` : '';
    const disableSlider = (j.isLocked || j.isSecondaryLock) ? 'disabled class="w-full h-1 bg-slate-800 rounded-lg cursor-not-allowed opacity-30"' : `class="w-full h-1 bg-cyan-700 rounded-lg cursor-pointer"`;

    const card = document.createElement('div');
    card.className = 'bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-3';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-cyan-300">
          Lỗ ${j.holeAIdx + 1} ↔ Lỗ ${j.holeBIdx + 1} ${isLockTxt}
        </span>
        <button onclick="removeJoint('${j.id}')" class="text-rose-400 hover:bg-rose-500/20 p-1.5 rounded-md" title="Tháo chốt">
          <i data-lucide="trash" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      <div class="flex justify-between items-center text-xs">
        <button onclick="resetJointAngle('${j.id}')" class="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded font-bold text-slate-300 transition-colors ${j.isLocked || j.isSecondaryLock ? 'hidden' : ''}">Reset Góc</button>
        <span id="val-joint-${j.id}" class="font-mono text-cyan-400 font-bold ml-auto">${j.angle || 0}°</span>
      </div>
      <input type="range" data-joint-id="${j.id}" min="-180" max="180" value="${j.angle || 0}" step="1" oninput="setJointAngle('${j.id}', parseFloat(this.value))" ${disableSlider}>
    `;
    list.appendChild(card);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function setupEventListeners() {
  ['x', 'y', 'z'].forEach(axis => {
    const inp = document.getElementById(`inp-pos-${axis}`);
    if (inp) {
      inp.addEventListener('input', (e) => {
        const part = parts.find(p => p.id === selectedPartId);
        if (part && part.root) {
          part.root.position[axis] = parseFloat(e.target.value) || 0;
        }
      });
    }
  });

  const inRot = document.getElementById('inp-part-rot');
  if (inRot) {
    inRot.addEventListener('input', (e) => {
      const deg = parseFloat(e.target.value);
      const valRot = document.getElementById('val-part-rot');
      if(valRot) valRot.innerText = `${deg}°`;
      const part = parts.find(p => p.id === selectedPartId);
      if (part && part.root) {
        part.root.rotation.y = (deg * Math.PI) / 180;
      }
    });
  }

  const mobileBtn = document.getElementById('mobile-toggle-btn');
  const sidebar = document.getElementById('sidebar');
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
    });
  }
}