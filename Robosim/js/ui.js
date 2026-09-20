    function selectPart(id) {
  selectedPartId = id;
  const part = parts.find(p => p.id === id);
  if (!part) return;

  highlightBox.setFromObject(part.root);
  highlightBox.visible = true;

  // Gọi gắn Gizmo nếu đang ở chế độ Kéo hoặc Xoay
  if (typeof currentToolMode !== 'undefined' && (currentToolMode === 'translate' || currentToolMode === 'rotate')) {
    if (typeof attachTransformToSelected === 'function') attachTransformToSelected();
  } else {
    if (typeof transformControl !== 'undefined' && transformControl) transformControl.detach();
  }

  // Update Floating HUD
  const hud = document.getElementById('floating-part-hud');
  const hudName = document.getElementById('floating-part-name');
  if (hud && hudName) {
    hudName.innerText = part.name;
    hud.classList.remove('hidden');
  }

  update3DHoleBadges(part);

  // Update Inspector UI
  document.getElementById('inspector-no-selection').classList.add('hidden');
  document.getElementById('inspector-active-panel').classList.remove('hidden');
  document.getElementById('inspect-part-title').innerText = part.name;
  document.getElementById('inspect-part-id').innerText = `Loại: ${part.type} • ID: ${part.id}`;

  const holesContainer = document.getElementById('inspector-holes-list');
  holesContainer.innerHTML = '';
  if (part.holes && part.holes.length > 0) {
    part.holes.forEach(h => {
      const btn = document.createElement('button');
      btn.className = 'px-2.5 py-1.5 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 font-mono text-[10px] font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5';
      btn.innerHTML = `<i data-lucide="crosshair" class="w-3 h-3"></i> Lỗ ${h.index + 1}`;
      btn.onclick = () => startHoleSnapping(part.id, h.index);
      holesContainer.appendChild(btn);
    });
    lucide.createIcons();
  } else {
    holesContainer.innerHTML = '<span class="text-[10px] text-slate-500">Chi tiết này không có lỗ dập để ghép chốt.</span>';
  }

  document.getElementById('inp-pos-x').value = part.root.position.x.toFixed(2);
  document.getElementById('inp-pos-y').value = part.root.position.y.toFixed(2);
  document.getElementById('inp-pos-z').value = part.root.position.z.toFixed(2);
  document.getElementById('inp-part-rot').value = Math.round((part.root.rotation.y * 180) / Math.PI);
  document.getElementById('val-part-rot').innerText = `${Math.round((part.root.rotation.y * 180) / Math.PI)}°`;

  refreshJoinDropdowns(part.id);
}

    function selectPart(id) {
    selectedPartId = id;
    const part = parts.find(p => p.id === id);
    if (!part) return;

    highlightBox.setFromObject(part.root);
    highlightBox.visible = true;

    // Update Floating HUD
    const hud = document.getElementById('floating-part-hud');
    const hudName = document.getElementById('floating-part-name');
    if (hud && hudName) {
        hudName.innerText = part.name;
        hud.classList.remove('hidden');
    }

    // Render 3D numbered badges above holes
    update3DHoleBadges(part);

    // Update Inspector UI
    document.getElementById('inspector-no-selection').classList.add('hidden');
    document.getElementById('inspector-active-panel').classList.remove('hidden');
    document.getElementById('inspect-part-title').innerText = part.name;
    document.getElementById('inspect-part-id').innerText = `Loại: ${part.type} • ID: ${part.id}`;

    // Populate Hole Buttons for Snapping
    const holesContainer = document.getElementById('inspector-holes-list');
    holesContainer.innerHTML = '';
    if (part.holes && part.holes.length > 0) {
        part.holes.forEach(h => {
        const btn = document.createElement('button');
        btn.className = 'px-2.5 py-1.5 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 font-mono text-[10px] font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5';
        btn.innerHTML = `<i data-lucide="crosshair" class="w-3 h-3"></i> Lỗ ${h.index + 1}`;
        btn.onclick = () => startHoleSnapping(part.id, h.index);
        holesContainer.appendChild(btn);
        });
        lucide.createIcons();
    } else {
        holesContainer.innerHTML = '<span class="text-[10px] text-slate-500">Chi tiết này không có lỗ dập để ghép chốt.</span>';
    }

    // Sync Position inputs
    document.getElementById('inp-pos-x').value = part.root.position.x.toFixed(1);
    document.getElementById('inp-pos-y').value = part.root.position.y.toFixed(1);
    document.getElementById('inp-pos-z').value = part.root.position.z.toFixed(1);
    document.getElementById('inp-part-rot').value = Math.round((part.root.rotation.y * 180) / Math.PI);
    document.getElementById('val-part-rot').innerText = `${Math.round((part.root.rotation.y * 180) / Math.PI)}°`;

    // Synchronize 2-Bar Join dropdowns
    refreshJoinDropdowns(part.id);
    }

    function update3DHoleBadges(part) {
    while (holeBadgesGroup.children.length > 0) {
        holeBadgesGroup.remove(holeBadgesGroup.children[0]);
    }
    if (!part || !part.holes || part.holes.length === 0) return;

    part.root.updateMatrixWorld(true);
    part.holes.forEach(h => {
        const sprite = createTextSprite(`${h.index + 1}`);
        const localPos = new THREE.Vector3(h.x, part.height / 2 + 0.6, h.z || 0);
        localPos.applyMatrix4(part.root.matrixWorld);
        sprite.position.copy(localPos);
        holeBadgesGroup.add(sprite);
    });
    }

    function openJoinWizardForSelected() {
    setSidebarTab('joinwizard');
    if (selectedPartId) {
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

    // Auto pick second bar if available and not set
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

    function setupEventListeners() {
    ['x', 'y', 'z'].forEach(axis => {
        const inp = document.getElementById(`inp-pos-${axis}`);
        if (inp) {
        inp.addEventListener('input', (e) => {
            const part = parts.find(p => p.id === selectedPartId);
            if (part && part.root) {
            part.root.position[axis] = parseFloat(e.target.value) || 0;
            highlightBox.setFromObject(part.root);
            }
        });
        }
    });

    const inRot = document.getElementById('inp-part-rot');
    if (inRot) {
        inRot.addEventListener('input', (e) => {
        const deg = parseFloat(e.target.value);
        document.getElementById('val-part-rot').innerText = `${deg}°`;
        const part = parts.find(p => p.id === selectedPartId);
        if (part && part.root) {
            part.root.rotation.y = (deg * Math.PI) / 180;
            highlightBox.setFromObject(part.root);
        }
        });
    }

    // Mobile sidebar toggle
    const mobileBtn = document.getElementById('mobile-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    if (mobileBtn && sidebar) {
        mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
        });
    }
    }