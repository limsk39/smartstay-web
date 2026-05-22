import fs from "node:fs";
import path from "node:path";

export const defaultRooms = [
  {
    id: "room-1201",
    name: "1201 프리미어",
    type: "프리미어 더블",
    floor: "12층",
    deviceId: "Lockpro H5000",
    nightlyRate: 118000,
    memo: "",
    imageUrl:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "room-803",
    name: "803 디럭스",
    type: "디럭스 트윈",
    floor: "8층",
    deviceId: "미연결",
    nightlyRate: 98000,
    memo: "",
    imageUrl:
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "room-502",
    name: "502 스탠다드",
    type: "스탠다드 더블",
    floor: "5층",
    deviceId: "미연결",
    nightlyRate: 76000,
    memo: "",
    imageUrl:
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=900&q=80"
  }
];

export class RoomStoreError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "RoomStoreError";
    this.statusCode = statusCode;
  }
}

export function createRoomStore(rootDir) {
  const dataDir = process.env.VERCEL ? path.join("/tmp", "staypass-data") : path.join(rootDir, "server", "data");
  const uploadDir = process.env.VERCEL
    ? path.join("/tmp", "staypass-uploads", "rooms")
    : path.join(rootDir, "server", "uploads", "rooms");
  const roomFilePath = path.join(dataDir, "rooms.json");
  const seedRoomFilePath = path.join(rootDir, "server", "data", "rooms.json");

  ensureDirectory(dataDir);
  ensureDirectory(uploadDir);
  if (!fs.existsSync(roomFilePath)) {
    writeJson(roomFilePath, readSeedJson(seedRoomFilePath, defaultRooms));
  }

  function readRooms() {
    try {
      const rooms = JSON.parse(fs.readFileSync(roomFilePath, "utf8"));
      return Array.isArray(rooms) && rooms.length ? rooms.map(normalizeRoom) : defaultRooms;
    } catch {
      writeJson(roomFilePath, defaultRooms);
      return defaultRooms;
    }
  }

  function saveRooms(rooms) {
    const normalized = rooms.map(normalizeRoom);
    writeJson(roomFilePath, normalized);
    return normalized;
  }

  function createRoom() {
    const rooms = readRooms();
    const room = normalizeRoom({
      id: `room-${Date.now()}`,
      name: "신규 객실",
      type: "객실 형태 입력",
      floor: "1층",
      deviceId: "미연결",
      nightlyRate: 100000,
      memo: "",
      imageUrl:
        "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=80"
    });
    saveRooms([...rooms, room]);
    return room;
  }

  function updateRoom(roomId, patch) {
    const rooms = readRooms();
    const index = rooms.findIndex((room) => room.id === roomId);
    if (index < 0) {
      throw new RoomStoreError("객실을 찾을 수 없습니다.", 404);
    }

    const nextRoom = normalizeRoom({ ...rooms[index], ...patch, id: roomId });
    rooms[index] = nextRoom;
    saveRooms(rooms);
    return nextRoom;
  }

  function deleteRoom(roomId) {
    const rooms = readRooms();
    if (rooms.length <= 1) {
      throw new RoomStoreError("객실은 최소 1개 이상 있어야 합니다.");
    }
    const nextRooms = rooms.filter((room) => room.id !== roomId);
    if (nextRooms.length === rooms.length) {
      throw new RoomStoreError("객실을 찾을 수 없습니다.", 404);
    }
    saveRooms(nextRooms);
    return nextRooms;
  }

  return {
    dataDir,
    roomFilePath,
    uploadDir,
    createRoom,
    deleteRoom,
    readRooms,
    updateRoom
  };
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readSeedJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeRoom(room) {
  return {
    id: String(room.id || `room-${Date.now()}`),
    name: String(room.name || "객실"),
    type: String(room.type || "객실 형태"),
    floor: String(room.floor || ""),
    deviceId: String(room.deviceId || "미연결"),
    nightlyRate: Math.max(100, Number.parseInt(String(room.nightlyRate || 0), 10) || 100),
    memo: String(room.memo || ""),
    imageUrl: String(room.imageUrl || defaultRooms[0].imageUrl)
  };
}
