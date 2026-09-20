/**
 * Generates a 2D canvas sprite with a high-contrast circular badge
 * displaying the hole number in 3D world space.
 */
function createTextSprite(text, bgColor = '#0284c7', textColor = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');

  // Outer circle
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Number text
  ctx.font = 'bold 54px Inter, sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 66);

  const texture = new THREE.CanvasTexture(c);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.1, 1.1, 1.1);
  return sprite;
}

/**
 * Procedural brushed metal texture for CNC parts.
 */
function generateBrushedTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#dddddd';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 15 + Math.random() * 70;
    const opacity = 0.03 + Math.random() * 0.08;
    ctx.strokeStyle = Math.random() > 0.5 ? `rgba(255,255,255,${opacity})` : `rgba(0,0,0,${opacity})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
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

/**
 * Tải buffer nhị phân về máy người dùng dưới dạng file .glb
 */
function saveArrayBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}