import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/controls/OrbitControls.js';
import { player } from './player.js';
import { object } from './object.js';
import { math } from './math.js';
import { hp } from './hp.js'; // hp.js 임포트

const socket = io();

export class GameStage3 {
  constructor(socket, players) {
    this.socket = socket;
    this.players = {}; // To store other players' objects
    this.localPlayerId = socket.id;
    this.playerInfo = players;

    this.Initialize();
    this.RAF();
    this.SetupSocketEvents();
  }

  Initialize() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.gammaFactor = 2.2;
    document.getElementById('container').appendChild(this.renderer.domElement);

    const fov = 60;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 1.0;
    const far = 2000.0;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(-8, 6, 12);
    this.camera.lookAt(0, 2, 0);

    this.scene = new THREE.Scene();

    this.SetupLighting();
    this.SetupSkyAndFog();
    this.CreateGround();
    this.CreateLocalPlayer();

    window.addEventListener('resize', () => this.OnWindowResize(), false);
  }

  SetupLighting() {
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(60, 100, 10);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.bias = -0.001;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 1.0;
    directionalLight.shadow.camera.far = 200.0;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0xf6f47f, 0.6);
    this.scene.add(hemisphereLight);
  }

  SetupSkyAndFog() {
    const skyUniforms = {
      topColor: { value: new THREE.Color(0x0077ff) },
      bottomColor: { value: new THREE.Color(0x89b2eb) },
      offset: { value: 33 },
      exponent: { value: 0.6 }
    };

    const skyGeometry = new THREE.SphereGeometry(1000, 32, 15);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize( vWorldPosition + offset ).y;
          gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0), exponent ), 0.0 ) ), 1.0 );
        }`,
      side: THREE.BackSide,
    });

    const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(skyMesh);
    this.scene.fog = new THREE.FogExp2(0x89b2eb, 0.002);
  }

  CreateGround() {
    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load('./resources/Map1.png');
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(1, 1);

    const groundGeometry = new THREE.PlaneGeometry(80, 80, 10, 10);
    const groundMaterial = new THREE.MeshLambertMaterial({ map: grassTexture });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  CreateLocalPlayer() {
    const npcPos = new THREE.Vector3(0, 0, -4);
    this.npc_ = new object.NPC(this.scene, npcPos);

    const localPlayerData = this.playerInfo.find(p => p.id === this.localPlayerId);

    this.player_ = new player.Player({
      scene: this.scene,
      onDebugToggle: (visible) => this.npc_.ToggleDebugVisuals(visible),
      character: localPlayerData.character,
      hpUI: new hp.HPUI(this.scene, this.renderer, `Player ${this.localPlayerId.substring(0, 4)}`) // HPUI 인스턴스 생성 및 전달
    });
    // this.player_.hpUI.setTarget(this.player_); // setTarget은 이제 player.js 내부에서 호출됩니다.

    this.cameraTargetOffset = new THREE.Vector3(0, 15, 10);
    this.rotationAngle = 4.715;
  }

  UpdateCamera() {
    if (!this.player_ || !this.player_.mesh_) return;

    const target = this.player_.mesh_.position.clone();
    const offset = this.cameraTargetOffset.clone();
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationAngle);
    const cameraPos = target.clone().add(offset);
    this.camera.position.copy(cameraPos);

    const headOffset = new THREE.Vector3(0, 2, 0);
    const headPosition = target.clone().add(headOffset);
    this.camera.lookAt(headPosition);
  }

  SetupSocketEvents() {
    this.socket.on('gameUpdate', (data) => {
      // Update other players' positions
      if (data.playerId === this.localPlayerId) return; // Don't update self

      let otherPlayer = this.players[data.playerId];
      if (!otherPlayer) {
        const remotePlayerData = this.playerInfo.find(p => p.id === data.playerId);
        // Create a new player object for the new player
        otherPlayer = new player.Player({
          scene: this.scene,
          character: remotePlayerData.character,
          isRemote: true,
          hpUI: new hp.HPUI(this.scene, this.renderer, `Player ${data.playerId.substring(0, 4)}`) // 원격 플레이어 HPUI 생성
        });
        this.players[data.playerId] = otherPlayer;
      }
      otherPlayer.SetPosition(data.position);
      otherPlayer.SetRotation(data.rotation);
      if (data.animation) {
        otherPlayer.SetRemoteAnimation(data.animation);
      }
      // 원격 플레이어 HP 업데이트
      if (data.hp !== undefined) {
        otherPlayer.hp_ = data.hp;
        if (otherPlayer.hpUI) {
          otherPlayer.hpUI.updateHP(data.hp);
        }
      }
    });

    this.socket.on('playerJoined', (playerId) => {
      console.log(`Player ${playerId} joined the room.`);
      // Optionally, request initial state from the new player
    });

    this.socket.on('playerLeft', (playerId) => {
      console.log(`Player ${playerId} left the room.`);
      const otherPlayer = this.players[playerId];
      if (otherPlayer) {
        this.scene.remove(otherPlayer.mesh_);
        delete this.players[playerId];
      }
    });
  }

  RAF(time) {
    requestAnimationFrame((t) => this.RAF(t));

    if (!this.prevTime) this.prevTime = time || performance.now();
    const delta = ((time || performance.now()) - this.prevTime) * 0.001;
    this.prevTime = time || performance.now();

    if (this.player_ && this.player_.mesh_) {
      this.player_.Update(delta, this.rotationAngle, this.npc_.GetCollidables());
      this.UpdateCamera();

      // Send player position to server
      this.socket.emit('gameUpdate', {
        playerId: this.localPlayerId,
        position: this.player_.mesh_.position.toArray(),
        rotation: this.player_.mesh_.rotation.toArray(),
        animation: this.player_.currentAnimationName_ // Add animation state
      });

      // HP UI 업데이트
      if (this.player_.hpUI) {
        this.player_.hpUI.updateHP(this.player_.hp_);
      }
    }

    for (const id in this.players) {
      this.players[id].Update(delta);
    }

    if (this.npc_) {
      this.npc_.Update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

const menu = document.getElementById('menu');
const controls = document.getElementById('controls');
const createRoomButton = document.getElementById('createRoomButton');
const joinRoomMainButton = document.getElementById('joinRoomMainButton');
const joinRoomPopup = document.getElementById('joinRoomPopup');
const popupRoomIdInput = document.getElementById('popupRoomIdInput');
const popupJoinButton = document.getElementById('popupJoinButton');
const popupCloseButton = document.getElementById('popupCloseButton');
const waitingRoom = document.getElementById('waitingRoom');
const waitingRoomIdDisplay = document.getElementById('waitingRoomIdDisplay');
const playerList = document.getElementById('playerList');
const readyButton = document.getElementById('readyButton');
const maxPlayersInput = document.getElementById('maxPlayersInput');

function updatePlayers(players) {
  playerList.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `Player ${p.id.substring(0, 4)} ${p.ready ? '(준비)' : '(대기)'}`;
    playerList.appendChild(li);
  });
}

createRoomButton.addEventListener('click', () => {
  const maxPlayers = parseInt(maxPlayersInput.value, 10);
  if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 8) {
    alert('최대 인원은 2에서 8 사이의 숫자로 설정해주세요.');
    return;
  }
  menu.style.display = 'none';
  waitingRoom.style.display = 'flex'; // Show waiting room
  socket.emit('createRoom', maxPlayers);
});

joinRoomMainButton.addEventListener('click', () => {
  joinRoomPopup.style.display = 'flex'; // Show popup
});

popupJoinButton.addEventListener('click', () => {
  const roomId = popupRoomIdInput.value.trim();
  if (roomId) {
    socket.emit('joinRoom', roomId);
    joinRoomPopup.style.display = 'none'; // Hide popup after joining
    menu.style.display = 'none';
    waitingRoom.style.display = 'flex'; // Show waiting room while waiting for join confirmation
    waitingRoomIdDisplay.textContent = `방 ID: ${roomId}`;
  } else {
    alert('방 ID를 입력해주세요.');
  }
});

popupCloseButton.addEventListener('click', () => {
  joinRoomPopup.style.display = 'none'; // Hide popup
});

readyButton.addEventListener('click', () => {
  const selectedCharacter = document.getElementById('charSelect').value;
  socket.emit('ready', selectedCharacter);
});

socket.on('roomCreated', (roomId) => {
  waitingRoomIdDisplay.textContent = `방 ID: ${roomId}`;
  // Game starts when another player joins or after a specific event
  // For now, let's assume game starts immediately for the creator
  // menu.style.display = 'none'; // Already hidden
  // waitingRoom.style.display = 'flex'; // Already shown
});

socket.on('roomJoined', (roomId) => {
  waitingRoomIdDisplay.textContent = `방 ID: ${roomId}`;
  // Hide waiting room and show game controls
  // menu.style.display = 'none'; // Already hidden
  // waitingRoom.style.display = 'flex'; // Already shown
});

socket.on('updatePlayers', (players) => {
  updatePlayers(players);
});

socket.on('startGame', (players) => {
  waitingRoom.style.display = 'none';
  controls.style.display = 'block';
  new GameStage3(socket, players);
});

socket.on('roomError', (message) => {
  alert(`방 오류: ${message}`);
  menu.style.display = 'flex'; // Show menu again on error
  waitingRoom.style.display = 'none';
  joinRoomPopup.style.display = 'none';
});
