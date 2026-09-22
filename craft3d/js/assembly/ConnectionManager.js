// ==========================================
// FILE: ConnectionManager.js
// CHỨC NĂNG: Tìm và hít các socket tương thích.
// ==========================================

const SOCKET_SNAP_DISTANCE = 0.5;
const SOCKET_RADIUS_TOLERANCE = 0.08;

class ConnectionManager {
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
				const target = getSocketWorldData(part, targetSocket);
				sourceSockets.forEach(source => {
					if (source.socket.type === targetSocket.type) return;
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
		if (!candidate) return false;
		const source = candidate.source.world;
		const target = candidate.target.world;
		const activePart = candidate.source.part;

		const sourceToTarget = new THREE.Quaternion().setFromUnitVectors(source.axis, target.axis.clone().negate());
		const currentWorldQuaternion = new THREE.Quaternion();
		activePart.root.getWorldQuaternion(currentWorldQuaternion);
		const nextWorldQuaternion = sourceToTarget.multiply(currentWorldQuaternion);
		const rotatedOffset = source.position.clone().sub(activePart.root.getWorldPosition(new THREE.Vector3()));
		rotatedOffset.applyQuaternion(sourceToTarget);
		const nextWorldPosition = target.position.clone().sub(rotatedOffset);

		const parent = activePart.root.parent;
		if (parent) {
			const parentQuaternion = new THREE.Quaternion();
			parent.getWorldQuaternion(parentQuaternion);
			activePart.root.position.copy(parent.worldToLocal(nextWorldPosition));
			activePart.root.quaternion.copy(parentQuaternion.invert().multiply(nextWorldQuaternion));
		} else {
			activePart.root.position.copy(nextWorldPosition);
			activePart.root.quaternion.copy(nextWorldQuaternion);
		}
		activeRoot.updateMatrixWorld(true);
		return true;
	}

	connectCandidate(candidate) {
		if (!candidate) return false;
		const exists = socketConnections.some(connection =>
			(connection.partAId === candidate.source.part.id && connection.socketAId === candidate.source.socket.id && connection.partBId === candidate.target.part.id && connection.socketBId === candidate.target.socket.id) ||
			(connection.partAId === candidate.target.part.id && connection.socketAId === candidate.target.socket.id && connection.partBId === candidate.source.part.id && connection.socketBId === candidate.source.socket.id)
		);
		if (exists) return false;

		socketConnections.push({
			id: `socket_connection_${socketConnections.length + 1}`,
			partAId: candidate.source.part.id,
			socketAId: candidate.source.socket.id,
			partBId: candidate.target.part.id,
			socketBId: candidate.target.socket.id
		});
		return true;
	}
}

function getPartSockets(part) {
	return part.sockets && part.sockets.length > 0 ? part.sockets : (part.holes || []).map(hole => normalizeSocket({
		id: `hole_${hole.index + 1}`,
		type: 'female',
		pos: [hole.x, hole.y || part.height / 2, hole.z || 0],
		legacyIndex: hole.index
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
