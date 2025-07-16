const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const rooms = {}; // { roomId: { players: [{ id: socket.id, ready: false }], gameState: {} } }

// Helper function to update all players in a room
function updateRoomPlayers(roomId) {
  if (rooms[roomId]) {
    // Send nickname and character along with player ID and ready status
    const playersData = rooms[roomId].players.map(p => ({
      id: p.id,
      nickname: p.nickname, // Add nickname
      ready: p.ready,
      character: p.character // Add character
    }));
    io.to(roomId).emit('updatePlayers', playersData, rooms[roomId].maxPlayers);
  }
}

// 정적 파일 서빙을 위한 디렉토리 설정
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('getPublicRooms', () => {
    const publicRooms = Object.values(rooms).filter(room => room.visibility === 'public').map(room => ({
      id: room.id,
      players: room.players.length,
      maxPlayers: room.maxPlayers,
      map: room.map,
      name: room.name // Add room name
    }));
    socket.emit('publicRoomsList', publicRooms);
  });

  socket.on('createRoom', (roomSettings) => {
    const roomId = Math.random().toString(36).substring(2, 8); // Simple unique ID
    const { map, maxPlayers, visibility, roundTime, nickname, character, roomName } = roomSettings; // Destructure nickname, character, and roomName

    rooms[roomId] = {
      id: roomId,
      players: [{ id: socket.id, ready: false, nickname: nickname, character: character }], // Store nickname and character
      gameState: {},
      map: map,
      maxPlayers: maxPlayers,
      visibility: visibility,
      roundTime: roundTime,
      name: roomName // Store room name
    };
    socket.join(roomId);
    socket.roomId = roomId; // Store roomId on socket for easy access
    console.log(`Room created: ${roomId} by ${socket.id} with settings:`, roomSettings);
    socket.emit('roomCreated', roomId);
    updateRoomPlayers(roomId);
  });

  socket.on('joinRoom', (roomId, nickname, character) => { // Receive nickname and character
    if (rooms[roomId]) {
      // Check if player is already in the room
      if (rooms[roomId].players.some(p => p.id === socket.id)) {
        socket.emit('roomError', 'Already in this room');
        return;
      }
      // Check if room is full
      if (rooms[roomId].players.length >= rooms[roomId].maxPlayers) {
        socket.emit('roomError', 'Room is full');
        return;
      }
      // If private room, check if the provided roomId matches the actual roomId
      if (rooms[roomId].visibility === 'private' && roomId !== rooms[roomId].id) {
        socket.emit('roomError', 'Invalid private room code');
        return;
      }
      socket.join(roomId);
      rooms[roomId].players.push({ id: socket.id, ready: false, nickname: nickname, character: character }); // Store nickname and character
      socket.roomId = roomId;
      console.log(`${socket.id} joined room: ${roomId}`);
      socket.emit('roomJoined', roomId);
      updateRoomPlayers(roomId);
    } else {
      socket.emit('roomError', 'Room not found');
    }
  });

  socket.on('ready', () => { // No longer receives character
    if (socket.roomId && rooms[socket.roomId]) {
      const playerIndex = rooms[socket.roomId].players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        rooms[socket.roomId].players[playerIndex].ready = !rooms[socket.roomId].players[playerIndex].ready;
        // rooms[socket.roomId].players[playerIndex].character = character; // Remove this line
        updateRoomPlayers(socket.roomId);

        // Check if all players are ready
        const allReady = rooms[socket.roomId].players.every(p => p.ready);
        if (allReady && rooms[socket.roomId].players.length > 0) {
          io.to(socket.roomId).emit('startGame', rooms[socket.roomId].players);
        }
      }
    }
  });

  socket.on('gameUpdate', (data) => {
    if (socket.roomId && rooms[socket.roomId]) {
      // Broadcast game updates to all other clients in the same room
      socket.to(socket.roomId).emit('gameUpdate', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId].players = rooms[socket.roomId].players.filter(
        (p) => p.id !== socket.id
      );
      if (rooms[socket.roomId].players.length === 0) {
        delete rooms[socket.roomId]; // Delete room if no players left
        console.log(`Room ${socket.roomId} deleted.`);
      } else {
        updateRoomPlayers(socket.roomId);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
