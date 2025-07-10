const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const rooms = {}; // { roomId: { players: [], gameState: {} } }

// 정적 파일 서빙을 위한 디렉토리 설정
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('createRoom', () => {
    const roomId = Math.random().toString(36).substring(2, 8); // Simple unique ID
    rooms[roomId] = { players: [], gameState: {} };
    socket.join(roomId);
    rooms[roomId].players.push(socket.id);
    socket.roomId = roomId; // Store roomId on socket for easy access
    console.log(`Room created: ${roomId} by ${socket.id}`);
    socket.emit('roomCreated', roomId);
  });

  socket.on('joinRoom', (roomId) => {
    if (rooms[roomId]) {
      socket.join(roomId);
      rooms[roomId].players.push(socket.id);
      socket.roomId = roomId;
      console.log(`${socket.id} joined room: ${roomId}`);
      socket.emit('roomJoined', roomId);
      // Notify others in the room that a new player joined
      socket.to(roomId).emit('playerJoined', socket.id);
    } else {
      socket.emit('roomError', 'Room not found');
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
        (id) => id !== socket.id
      );
      if (rooms[socket.roomId].players.length === 0) {
        delete rooms[socket.roomId]; // Delete room if no players left
        console.log(`Room ${socket.roomId} deleted.`);
      } else {
        // Notify others in the room that a player left
        socket.to(socket.roomId).emit('playerLeft', socket.id);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});