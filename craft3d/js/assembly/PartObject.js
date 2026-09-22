// ==========================================
// FILE: PartObject.js
// CHỨC NĂNG: Chuẩn hóa linh kiện và socket kết nối.
// ==========================================

class PartObject {
	constructor({ id, name, type, root, holes = [], sockets = [], colorHex = null, height = 0.8 }) {
		this.id = id;
		this.name = name;
		this.type = type;
		this.root = root;
		this.holes = holes;
		this.sockets = [];
		this.colorHex = colorHex;
		this.height = height || 0.8;

		sockets.forEach(socket => this.addSocket(socket));
		this.syncLegacyHoles();
	}

	addSocket(socketData) {
		const socket = normalizeSocket(socketData, this.sockets.length);
		const marker = new THREE.Mesh(
			new THREE.SphereGeometry(socket.radius, 12, 8),
			new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0 })
		);
		marker.name = `socket_${socket.id}`;
		marker.position.copy(socket.position);
		marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), socket.axis);
		marker.userData = {
			isSocket: true,
			socketId: socket.id,
			socketType: socket.type,
			radius: socket.radius,
			axis: socket.axis.clone(),
			partId: this.id
		};
		this.root.add(marker);
		socket.object3D = marker;
		this.sockets.push(socket);
		return socket;
	}

	syncLegacyHoles() {
		if (this.holes.length > 0) {
			this.holes.forEach(hole => {
				if (!this.sockets.some(socket => socket.legacyIndex === hole.index)) {
					const socket = normalizeSocket({
						id: `hole_${hole.index + 1}`,
						type: 'female',
						radius: hole.radius || (14 / 47) * 0.98,
						pos: [hole.x, hole.y || this.height / 2, hole.z || 0],
						axis: hole.axis || [0, 1, 0],
						legacyIndex: hole.index
					}, this.sockets.length);
					const marker = findSocketMarker(this.root, hole.index);
					if (marker) {
						marker.userData.isSocket = true;
						marker.userData.socketId = socket.id;
						marker.userData.socketType = socket.type;
						marker.userData.radius = socket.radius;
						marker.userData.axis = socket.axis.clone();
						marker.userData.partId = this.id;
						socket.object3D = marker;
					}
					this.sockets.push(socket);
				}
			});
		}
	}
}

function normalizeSocket(data, index = 0) {
	const position = data.position instanceof THREE.Vector3
		? data.position.clone()
		: new THREE.Vector3(...(data.pos || [data.x || 0, data.y || 0, data.z || 0]));
	const axis = data.axis instanceof THREE.Vector3
		? data.axis.clone()
		: new THREE.Vector3(...(data.axis || [0, 1, 0]));

	if (axis.lengthSq() === 0) axis.set(0, 1, 0);
	axis.normalize();

	return {
		id: data.id || `socket_${index + 1}`,
		type: data.type === 'male' ? 'male' : 'female',
		radius: Number(data.radius) || (14 / 47) * 0.98,
		position,
		axis,
		legacyIndex: data.legacyIndex
	};
}

function findSocketMarker(root, holeIndex) {
	let marker = null;
	root.traverse(node => {
		if (node.userData && node.userData.isHoleAnchor && node.userData.holeIndex === holeIndex) marker = node;
	});
	return marker;
}
