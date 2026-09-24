// ==========================================
// FILE: ConnectionManager.js
// CHỨC NĂNG: Tìm và hít các socket tương thích.
// ==========================================

const SOCKET_SNAP_DISTANCE = 0.5;
const SOCKET_RADIUS_TOLERANCE = 0.08;

class ConnectionManager {
	isSocketOccupied(partId, socketId) {
		return socketConnections.some(connection =>
			(connection.partAId === partId && connection.socketAId === socketId) ||
			(connection.partBId === partId && connection.socketBId === socketId)
		);
	}

	findCandidate(activePartIds, root) {
		const sourceSockets = [];
		const clusterIds = new Set(activePartIds);

		parts.forEach(part => {
			if (!clusterIds.has(part.id)) return;
			getPartSockets(part).forEach(socket => {
				if (socket.type !== 'male' && socket.type !== 'female') return;
				const world = getSocketWorldData(part, socket);
				sourceSockets.push({ part, socket, world });
			});
		});

		let best = null;
		parts.forEach(part => {
			if (clusterIds.has(part.id)) return;
			getPartSockets(part).forEach(targetSocket => {
				if (this.isSocketOccupied(part.id, targetSocket.id)) return;
				const target = getSocketWorldData(part, targetSocket);
				sourceSockets.forEach(source => {
					if (this.isSocketOccupied(source.part.id, source.socket.id)) return;
					if (source.socket.type === targetSocket.type) return;
					if (!source.socket.locking || !targetSocket.locking) return;
					if (Math.abs(source.socket.radius - targetSocket.radius) > SOCKET_RADIUS_TOLERANCE) return;
					const distance = source.world.position.distanceTo(target.position);
					if (distance > SOCKET_SNAP_DISTANCE || (best && distance >= best.distance)) return;
					best = { source, target: { part, socket: targetSocket, world: target }, distance };
				});
			});
		});
		return best;
	}

	snapCandidate(candidate, activeRoot) {
		if (!candidate || !activeRoot) return false;
		const source = candidate.source.world;
		const target = candidate.target.world;
		if (!source.position || !target.position || !source.axis || !target.axis) return false;

		const sourceToTarget = new THREE.Quaternion().setFromUnitVectors(source.axis, target.axis.clone().negate());
		const currentWorldQuaternion = new THREE.Quaternion();
		const currentWorldPosition = new THREE.Vector3();
		activeRoot.getWorldQuaternion(currentWorldQuaternion);
		activeRoot.getWorldPosition(currentWorldPosition);
		const nextWorldQuaternion = sourceToTarget.clone().multiply(currentWorldQuaternion);
		const rotatedOffset = source.position.clone().sub(currentWorldPosition);
		rotatedOffset.applyQuaternion(sourceToTarget);
		// Socket female nằm ở mặt vào của lỗ. Đưa đầu chốt tới mặt đối diện
		// sau khi xuyên qua độ sâu của thân linh kiện, thay vì dừng ở mặt ngoài.
		const femaleSocket = candidate.source.socket.type === 'female'
			? candidate.source.socket
			: candidate.target.socket;
		// Một đầu chốt nằm trong mỗi thanh một nửa bề dày của thanh.
		const insertionDepth = 0.48;
		const insertion = target.axis.clone().multiplyScalar(insertionDepth);

		const nextWorldPosition = target.position.clone().sub(insertion).sub(rotatedOffset);
		const parent = activeRoot.parent;
		if (parent) {
			const parentQuaternion = new THREE.Quaternion();
			parent.getWorldQuaternion(parentQuaternion);
			const localPosition = parent.worldToLocal(nextWorldPosition.clone());
			activeRoot.position.copy(localPosition);
			activeRoot.quaternion.copy(parentQuaternion.invert().multiply(nextWorldQuaternion));
		} else {
			activeRoot.position.copy(nextWorldPosition);
			activeRoot.quaternion.copy(nextWorldQuaternion);
		}
		activeRoot.updateMatrixWorld(true);
		return true;
	}

	removeConnection(partId, socketId) {
		socketConnections = socketConnections.filter(connection => {
			const isSource = connection.partAId === partId && connection.socketAId === socketId;
			const isTarget = connection.partBId === partId && connection.socketBId === socketId;
			return !isSource && !isTarget;
		});
	}

	detachPart(partId) {
		socketConnections = socketConnections.filter(connection =>
			connection.partAId !== partId && connection.partBId !== partId
		);
	}

	detachPartConnections(partId) {
		this.detachPart(partId);
	}

	connectCandidate(candidate) {
		if (!candidate) return false;
		if (candidate.source.part.id === candidate.target.part.id) return false;
		if (this.isSocketOccupied(candidate.source.part.id, candidate.source.socket.id)) return false;
		if (this.isSocketOccupied(candidate.target.part.id, candidate.target.socket.id)) return false;

		socketConnections.push({
			id: `socket_connection_${socketConnections.length + 1}`,
			partAId: candidate.source.part.id,
			socketAId: candidate.source.socket.id,
			partBId: candidate.target.part.id,
			socketBId: candidate.target.socket.id,
			angle: 0
		});
		return true;
	}
}

function getPartSockets(part) {
	return part.sockets && part.sockets.length > 0 ? part.sockets : (part.holes || []).map(hole => normalizeSocket({
		id: `hole_${hole.index + 1}`,
		type: 'female',
		pos: [hole.x, hole.y || part.height / 2, hole.z || 0],
		legacyIndex: hole.index,
		insertionDepth: Number(part.height) || 0
	}));
}

function getSocketWorldData(part, socket) {
	part.root.updateMatrixWorld(true);
	const position = socket.object3D
		? socket.object3D.getWorldPosition(new THREE.Vector3())
		: socket.position.clone().applyMatrix4(part.root.matrixWorld);
	const axis = socket.object3D
		? new THREE.Vector3(0, 1, 0).applyQuaternion(socket.object3D.getWorldQuaternion(new THREE.Quaternion())).normalize()
		: socket.axis.clone().transformDirection(part.root.matrixWorld).normalize();
	return { position, axis };
}

const connectionManager = new ConnectionManager();
