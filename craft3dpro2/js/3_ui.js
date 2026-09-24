// ==========================================
// FILE: 3_ui.js
// CHỨC NĂNG: Cập nhật DOM, quản lý giao diện, Tabs, Event Listeners của HTML.
// ==========================================

// Khởi tạo Icon
lucide.createIcons();

// Mobile sidebar toggle
const mobileBtn = document.getElementById('mobile-toggle-btn');
const sidebar = document.getElementById('sidebar');
let joinObjectPickRole = null;
let joinObjectIds = { first: null, second: null };
if (mobileBtn && sidebar) {
  mobileBtn.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
  });
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

  [pLib, pJoin, pInsp, pJoints].forEach(p => p.classList.add('hidden'));
  [bLib, bJoin, bInsp, bJoints].forEach(b => {
    b.className = 'py-1.5 font-medium rounded-lg text-slate-400 hover:text-slate-200 transition-all flex items-center justify-center gap-1';
  });

  if (tabName === 'library') {
    pLib.classList.remove('hidden');
    bLib.className = 'py-1.5 font-semibold rounded-lg bg-cyan-500 text-slate-950 transition-all flex items-center justify-center gap-1';
  } else if (tabName === 'joinwizard') {
    pJoin.classList.remove('hidden');
    bJoin.className = 'py-1.5 font-semibold rounded-lg bg-cyan-500 text-slate-950 transition-all flex items-center justify-center gap-1';
    refreshJoinDropdowns(selectedPartId);
    refreshJoinSocketControls();
  } else if (tabName === 'inspector') {
    pInsp.classList.remove('hidden');
    bInsp.className = 'py-1.5 font-semibold rounded-lg bg-cyan-500 text-slate-950 transition-all flex items-center justify-center gap-1';
  } else if (tabName === 'joints') {
    pJoints.classList.remove('hidden');
    bJoints.className = 'py-1.5 font-semibold rounded-lg bg-cyan-500 text-slate-950 transition-all flex items-center justify-center gap-1';
  }
}

function updatePartsCountBadge() {
  const badge = document.getElementById('badge-parts-count');
  if (badge) badge.innerText = `${parts.length} Linh kiện`;
}

function updateJointsUI() {
  document.getElementById('count-joints').innerText = joints.length;
  const emptyMsg = document.getElementById('joints-empty-msg');
  const list = document.getElementById('joints-list-container');
  list.innerHTML = '';

  if (joints.length === 0) {
    emptyMsg.classList.remove('hidden');
    return;
  }
  emptyMsg.classList.add('hidden');

  joints.forEach(j => {
    const card = document.createElement('div');
    card.className = 'bg-slate-800/50 p-3 rounded-2xl border border-slate-700/60 space-y-2';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
          <i data-lucide="link" class="w-3.5 h-3.5"></i> Khớp: Lỗ ${j.holeAIdx + 1} ↔ Lỗ ${j.holeBIdx + 1}
        </span>
        <button onclick="removeJoint('${j.id}')" class="text-rose-400 hover:text-rose-300 p-1 text-[10px]" title="Tháo khớp này">
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
  lucide.createIcons();
}

function showTemporaryNotice(msg) {
  const banner = document.getElementById('snap-guide-banner');
  const text = document.getElementById('snap-guide-text');
  text.innerText = msg;
  banner.classList.remove('hidden');
  setTimeout(() => {
    if (!pendingSnapSource) banner.classList.add('hidden');
  }, 3500);
}

// Logic cho Join Wizard (Dropdown chọn 2 thanh)
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
    optA.value = p.id;
    optA.text = p.name;
    if (currentValA && p.id === currentValA) optA.selected = true;
    selA.appendChild(optA);

    const optB = document.createElement('option');
    optB.value = p.id;
    optB.text = p.name;
    if (currentValB && p.id === currentValB) optB.selected = true;
    selB.appendChild(optB);
  });

  if (currentValA && filterBars.length > 1 && (!selB.value || selB.value === currentValA)) {
    const second = filterBars.find(p => p.id !== currentValA);
    if (second) {
      selB.value = second.id;
    }
  }

  onJoinPartAChange();
  onJoinPartBChange();
}

function onJoinPartAChange() {
  const partId = document.getElementById('select-join-part-a').value;
  const holeSel = document.getElementById('select-join-hole-a');
  const badge = document.getElementById('badge-join-part-a');
  holeSel.innerHTML = '';
  const part = parts.find(p => p.id === partId);
  if (part && part.holes && part.holes.length > 0) {
    badge.innerText = part.name;
    part.holes.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.index;
      opt.text = `Lỗ số ${h.index + 1}`;
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
  holeSel.innerHTML = '';
  const part = parts.find(p => p.id === partId);
  if (part && part.holes && part.holes.length > 0) {
    badge.innerText = part.name;
    part.holes.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.index;
      opt.text = `Lỗ số ${h.index + 1}`;
      holeSel.appendChild(opt);
    });
  } else {
    badge.innerText = 'Chưa chọn';
    holeSel.innerHTML = '<option value="0">-- Chưa có lỗ --</option>';
  }
}

function setJoinInitialAngle(deg, label) {
  chosenJoinAngle = deg;
  document.getElementById('label-join-angle').innerText = label;
}

function openJoinWizardForSelected() {
  setSidebarTab('joinwizard');
  if (typeof refreshSocketWizardOptions === 'function') refreshSocketWizardOptions();
  if (selectedPartId) {
    refreshJoinDropdowns(selectedPartId);
  }
}

function beginJoinObjectPick(role) {
  joinObjectPickRole = role;
  showTemporaryNotice(`Hãy bấm vào đối tượng ${role === 'first' ? '1' : '2'} trên khung 3D.`);
}

function selectJoinObject(id) {
  if (!joinObjectPickRole) return false;
  if (joinObjectPickRole === 'second' && id === joinObjectIds.first) {
    showTemporaryNotice('Đối tượng 1 và 2 phải là hai vật thể khác nhau.');
    return true;
  }
  joinObjectIds[joinObjectPickRole] = id;
  const part = parts.find(item => item.id === id);
  const label = document.getElementById(`join-object-${joinObjectPickRole}`);
  if (label) label.textContent = part ? part.name : 'Chưa chọn';
  joinObjectPickRole = null;
  refreshJoinSocketControls();
  showTemporaryNotice(`Đã chọn đối tượng ${id === joinObjectIds.first ? '1' : '2'}.`);
  return true;
}

function refreshJoinSocketControls() {
  ['first', 'second'].forEach(role => {
    const select = document.getElementById(`join-socket-${role}`);
    if (!select) return;
    select.innerHTML = '<option value="">-- Chọn socket --</option>';
    const part = parts.find(item => item.id === joinObjectIds[role]);
    if (!part) return;
    getPartSockets(part).forEach((socket, index) => {
      const option = document.createElement('option');
      option.value = socket.id;
      option.textContent = `${socket.type === 'male' ? 'Đầu chốt' : 'Lỗ'} ${socket.displayIndex || index + 1}`;
      select.appendChild(option);
    });
  });
}

function executeSelectedObjectJoin() {
  const firstPart = parts.find(item => item.id === joinObjectIds.first);
  const secondPart = parts.find(item => item.id === joinObjectIds.second);
  const firstSocket = firstPart && getPartSockets(firstPart).find(item => item.id === document.getElementById('join-socket-first')?.value);
  const secondSocket = secondPart && getPartSockets(secondPart).find(item => item.id === document.getElementById('join-socket-second')?.value);
  if (!firstPart || !secondPart || !firstSocket || !secondSocket) {
    showTemporaryNotice('Hãy chọn đủ hai đối tượng và socket trong tab Chỉnh.');
    return;
  }
  let target = { part: firstPart, socket: firstSocket };
  let source = { part: secondPart, socket: secondSocket };
  if (firstSocket.type === 'male' && secondSocket.type === 'female') {
    target = { part: secondPart, socket: secondSocket };
    source = { part: firstPart, socket: firstSocket };
  }
  if (target.socket.type !== 'female' || source.socket.type !== 'male') {
    showTemporaryNotice('Cần chọn một lỗ và một đầu chốt khác loại.');
    return;
  }
  if (connectionManager.isSocketOccupied(target.part.id, target.socket.id) || connectionManager.isSocketOccupied(source.part.id, source.socket.id)) {
    showTemporaryNotice('Một socket đã được ghép trước đó.');
    return;
  }
  unpackCluster();
  packCluster(source.part.id);
  const candidate = {
    source: { ...source, world: getSocketWorldData(source.part, source.socket) },
    target: { ...target, world: getSocketWorldData(target.part, target.socket) }
  };
  if (!connectionManager.snapCandidate(candidate, activeClusterGroup) || !connectionManager.connectCandidate(candidate)) {
    showTemporaryNotice('Không thể căn socket. Kiểm tra vị trí Empty và trục Y trong Blender.');
    return;
  }
  packCluster(source.part.id);
  updateJointsUI();
  showTemporaryNotice(`Đã ghép ${source.part.name} vào ${target.part.name}.`);
  refreshJoinSocketControls();
}

function setupEventListeners() {
  setupModelImport();
  if (typeof setupProjectStorage === 'function') setupProjectStorage();

  const socketWizardButton = document.getElementById('socket-wizard-join-button');
  if (socketWizardButton && typeof executeSocketWizardJoin === 'function') {
    socketWizardButton.addEventListener('click', executeSocketWizardJoin);
  }
  const objectJoinButton = document.getElementById('join-selected-objects');
  if (objectJoinButton) objectJoinButton.addEventListener('click', executeSelectedObjectJoin);

  // Toggles for wireframe & axes
  document.getElementById('check-wireframe').addEventListener('change', (e) => {
    const isWire = e.target.checked;
    parts.forEach(p => {
      if (p.root) {
        p.root.traverse(node => {
          if (node.isMesh && node.material && !node.userData.isHoleAnchor) {
            node.material.wireframe = isWire;
          }
        });
      }
    });
  });

  document.getElementById('check-axes').addEventListener('change', (e) => {
    axesHelper.visible = e.target.checked;
  });
}