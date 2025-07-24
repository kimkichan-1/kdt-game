const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { getRandomWeaponName } = require('./weaponUtils');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const rooms = {}; // { roomId: { players: [...], gameState: {...} } }

// Helper function to update all players in a room
function updateRoomPlayers(roomId) {
  if (rooms[roomId]) {
    const playersData = rooms[roomId].players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      ready: p.ready,
      character: p.character,
      kills: p.kills,
      deaths: p.deaths
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
      name: room.name,
      status: room.status
    }));
    socket.emit('publicRoomsList', publicRooms);
  });

  socket.on('createRoom', (roomSettings) => {
    const roomId = Math.random().toString(36).substring(2, 8);
    const { map, maxPlayers, visibility, roundTime, nickname, character, roomName } = roomSettings;

    rooms[roomId] = {
      id: roomId,
      players: [{ id: socket.id, ready: false, nickname: nickname, character: character, equippedWeapon: null, isAttacking: false, hp: 100, kills: 0, deaths: 0 }],
      gameState: { timer: roundTime, gameStarted: false },
      map: map,
      maxPlayers: maxPlayers,
      visibility: visibility,
      roundTime: roundTime,
      name: roomName,
      status: 'waiting'
    };
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`Room created: ${roomId} by ${socket.id} with settings:`, roomSettings);
    socket.emit('roomCreated', { id: roomId, name: rooms[roomId].name, map: rooms[roomId].map });
    updateRoomPlayers(roomId);
  });

  socket.on('joinRoom', (roomId, nickname, character) => {
    if (rooms[roomId]) {
      if (rooms[roomId].players.some(p => p.id === socket.id)) {
        socket.emit('roomError', 'Already in this room');
        return;
      }
      if (rooms[roomId].players.length >= rooms[roomId].maxPlayers) {
        socket.emit('roomError', 'Room is full');
        return;
      }
      if (rooms[roomId].status === 'playing') {
        socket.emit('roomError', 'Game is already in progress');
        return;
      }
      if (rooms[roomId].visibility === 'private' && roomId !== rooms[roomId].id) {
        socket.emit('roomError', 'Invalid private room code');
        return;
      }
      socket.join(roomId);
      rooms[roomId].players.push({ id: socket.id, ready: false, nickname: nickname, character: character, equippedWeapon: null, isAttacking: false, hp: 100, kills: 0, deaths: 0 });
      socket.roomId = roomId;
      console.log(`${socket.id} joined room: ${roomId}`);
      socket.emit('roomJoined', { id: roomId, name: rooms[roomId].name, map: rooms[roomId].map });
      updateRoomPlayers(roomId);
    } else {
      socket.emit('roomError', 'Room not found');
    }
  });

  socket.on('ready', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      const playerIndex = rooms[socket.roomId].players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        rooms[socket.roomId].players[playerIndex].ready = !rooms[socket.roomId].players[playerIndex].ready;
        updateRoomPlayers(socket.roomId);

        const allReady = rooms[socket.roomId].players.every(p => p.ready);
        if (allReady && rooms[socket.roomId].players.length > 0) {
          const roomCreator = rooms[socket.roomId].players[0];
          if (roomCreator.id === socket.id) {
            socket.emit('allPlayersReady');
          }
        }
      }
    }
  });

  socket.on('gameUpdate', (data) => {
    if (socket.roomId && rooms[socket.roomId]) {
      const playerInRoom = rooms[socket.roomId].players.find(p => p.id === socket.id);
      if (playerInRoom) {
        playerInRoom.equippedWeapon = data.equippedWeapon;
        playerInRoom.isAttacking = data.isAttacking;
        playerInRoom.hp = data.hp;
      }
      socket.to(socket.roomId).emit('gameUpdate', data);
    }
  });

  socket.on('startGameRequest', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];
      const roomCreator = room.players[0];

      if (roomCreator.id === socket.id) {
        const allReady = room.players.every(p => p.ready);
        if (allReady && room.players.length > 0) {
          room.status = 'playing';
          room.gameState.gameStarted = true;

          const spawnedWeapons = [];
          for (let i = 0; i < 10; i++) {
            const weaponName = getRandomWeaponName();
            if (weaponName) {
              const uuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
              const x = Math.random() * 80 - 40;
              const y = 1;
              const z = Math.random() * 80 - 40;
              spawnedWeapons.push({ uuid, weaponName, x, y, z });
            }
          }
          room.gameState.spawnedWeapons = spawnedWeapons;

          io.to(socket.roomId).emit('startGame', { players: room.players, map: room.map, spawnedWeapons: spawnedWeapons });

          // Start game timer
          const gameTimer = setInterval(() => {
            if (room.gameState.timer > 0) {
              room.gameState.timer--;
              io.to(socket.roomId).emit('updateTimer', room.gameState.timer);
            } else {
              clearInterval(gameTimer);
              io.to(socket.roomId).emit('gameEnd', room.players.map(p => ({ nickname: p.nickname, kills: p.kills, deaths: p.deaths })));
            }
          }, 1000);

        } else {
          socket.emit('roomError', '모든 플레이어가 준비되지 않았습니다.');
        }
      } else {
        socket.emit('roomError', '방장만 게임을 시작할 수 있습니다.');
      }
    }
  });

  socket.on('playerKilled', ({ victimId, attackerId }) => {
    if (socket.roomId && rooms[socket.roomId]) {
        const room = rooms[socket.roomId];
        const victim = room.players.find(p => p.id === victimId);
        const attacker = room.players.find(p => p.id === attackerId);

        if (victim) {
            victim.deaths++;
        }
        if (attacker && attacker.id !== victim.id) {
            attacker.kills++;
        }

        io.to(socket.roomId).emit('updateScores', room.players.map(p => ({ id: p.id, kills: p.kills, deaths: p.deaths })));
        io.to(socket.roomId).emit('killFeed', { attackerName: attacker ? attacker.nickname : 'World', victimName: victim.nickname });
    }
  });

  socket.on('increaseMaxPlayers', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];
      const roomCreator = room.players[0];

      if (roomCreator.id === socket.id) {
        if (room.maxPlayers < 8) {
          room.maxPlayers++;
          updateRoomPlayers(socket.roomId);
        } else {
          socket.emit('roomError', '최대 인원은 8명까지 설정할 수 있습니다.');
        }
      } else {
        socket.emit('roomError', '방장만 인원수를 변경할 수 있습니다.');
      }
    }
  });

  socket.on('closePlayerSlot', (slotIndex) => {
    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];
      const roomCreator = room.players[0];

      if (roomCreator.id === socket.id) {
        if (slotIndex < room.maxPlayers) {
          const playerToKick = room.players[slotIndex];
          if (playerToKick) {
            io.to(playerToKick.id).emit('roomError', '방장에 의해 강제 퇴장되었습니다.');
            io.sockets.sockets.get(playerToKick.id)?.leave(socket.roomId);
            room.players.splice(slotIndex, 1);
          }
          room.maxPlayers = Math.max(room.players.length, room.maxPlayers - 1);
          updateRoomPlayers(socket.roomId);
        } else {
          socket.emit('roomError', '유효하지 않은 슬롯입니다.');
        }
      } else {
        socket.emit('roomError', '방장만 슬롯을 닫을 수 있습니다.');
      }
    }
  });

  socket.on('weaponPickedUp', (weaponUuid) => {
    if (socket.roomId && rooms[socket.roomId]) {
      let spawnedWeapons = rooms[socket.roomId].gameState.spawnedWeapons;
      if (spawnedWeapons) {
        rooms[socket.roomId].gameState.spawnedWeapons = spawnedWeapons.filter(weapon => weapon.uuid !== weaponUuid);
        io.to(socket.roomId).emit('weaponPickedUp', weaponUuid);
      }
    }
  });

  socket.on('weaponSpawned', (weaponData) => {
    if (socket.roomId && rooms[socket.roomId]) {
      let spawnedWeapons = rooms[socket.roomId].gameState.spawnedWeapons;
      if (spawnedWeapons) {
        spawnedWeapons.push(weaponData);
        io.to(socket.roomId).emit('weaponSpawned', weaponData);
      }
    }
  });

  socket.on('weaponEquipped', (weaponName) => {
    if (socket.roomId && rooms[socket.roomId]) {
      const playerInRoom = rooms[socket.roomId].players.find(p => p.id === socket.id);
      if (playerInRoom) {
        playerInRoom.equippedWeapon = weaponName;
        socket.to(socket.roomId).emit('playerEquippedWeapon', { playerId: socket.id, weaponName: weaponName });
      }
    }
  });

  socket.on('playerAttack', (animationName) => {
    if (socket.roomId && rooms[socket.roomId]) {
      socket.to(socket.roomId).emit('playerAttack', { playerId: socket.id, animationName: animationName });
    }
  });

  socket.on('playerDamage', (data) => {
    console.log(`[Server] Received playerDamage: targetId=${data.targetId}, damage=${data.damage}, attackerId=${data.attackerId}`);
    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];
      const targetPlayer = room.players.find(p => p.id === data.targetId);
      if (targetPlayer) {
        console.log(`[Server] Target player found: ${targetPlayer.nickname} (HP: ${targetPlayer.hp})`);
        targetPlayer.hp -= data.damage;
        if (targetPlayer.hp < 0) targetPlayer.hp = 0;
        console.log(`[Server] ${targetPlayer.nickname} new HP: ${targetPlayer.hp}`);

        io.to(socket.roomId).emit('hpUpdate', { playerId: targetPlayer.id, hp: targetPlayer.hp, attackerId: data.attackerId });
        console.log(`[Server] Emitted hpUpdate: playerId=${targetPlayer.id}, hp=${targetPlayer.hp}, attackerId=${data.attackerId}`);

        if (targetPlayer.hp === 0) {
          console.log(`${targetPlayer.nickname} (${targetPlayer.id}) has been defeated!`);
        }
      } else {
        console.log(`[Server] Target player ${data.targetId} not found in room ${socket.roomId}`);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId].players = rooms[socket.roomId].players.filter(
        (p) => p.id !== socket.id
      );
      if (rooms[socket.roomId].players.length === 0) {
        delete rooms[socket.roomId];
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
