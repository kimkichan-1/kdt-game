import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/GLTFLoader.js';
import { BoxHelper } from 'https://cdn.jsdelivr.net/npm/three@0.124/src/helpers/BoxHelper.js';

// --- Start of Ball class from ball1.js ---
class Ball {
  constructor(params, currentBallSpeedIncrease = 0) {
    this.scene_ = params.scene;
    this.position_ = params.position;
    this.mainBoundingBox_ = params.mainBoundingBox;
    this.ballNumber_ = params.ballNumber;
    this.ballColor_ = params.ballColor; // 추가: 공의 색상

    // 초기 속도에 누적된 공 속도 증가량 적용
    this.initialSpeed_ = 5; // 공의 기본 속도
    this.velocity_ = new THREE.Vector3(
        (Math.random() * 2 - 1) * (this.initialSpeed_ + currentBallSpeedIncrease),
        0,
        (Math.random() * 2 - 1) * (this.initialSpeed_ + currentBallSpeedIncrease)
    );

    this.LoadModel_();
  }

  LoadModel_() {
    const loader = new GLTFLoader();
    loader.load(`./resources/Pool-table/ball/${this.ballNumber_}ball.glb`, (gltf) => {
      this.mesh_ = gltf.scene;
      this.mesh_.scale.set(40, 40, 40); // 크기 조정
      this.mesh_.position.copy(this.position_);
      this.mesh_.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Assign color based on ball number or provided color
          if (this.ballColor_ !== undefined) {
            child.material = new THREE.MeshStandardMaterial({ color: this.ballColor_ });
          } else {
            const randomColor = new THREE.Color(Math.random(), Math.random(), Math.random());
            child.material = new THREE.MeshStandardMaterial({ color: randomColor });
          }
        }
      });
      this.scene_.add(this.mesh_);

      // [추가] 공의 바운딩 박스 생성
      // 공의 3D 모델을 기반으로 정확한 바운딩 박스를 계산합니다.
      this.boundingBox_ = new THREE.Box3().setFromObject(this.mesh_);

      // BoxHelper 추가 (디버깅용)
      this.boxHelper_ = new THREE.BoxHelper(this.mesh_, 0xffff00);
      this.boxHelper_.visible = false; // 공의 바운딩 박스를 보이지 않게 설정
      this.scene_.add(this.boxHelper_);

      console.log(`Ball ${this.ballNumber_} loaded successfully at position:`, this.mesh_.position);
    }, undefined, (error) => {
      console.error(`Error loading ball ${this.ballNumber_}ball.glb:`, error);
    });
  }

  Update(delta, currentBallSpeedIncrease = 0, allBalls = [], allHoles = [], playerBoundingBox = null, tableBoundaryMinX, tableBoundaryMaxX, tableBoundaryMinZ, tableBoundaryMaxZ, mapYPosition) {
    if (!this.mesh_) {
      return;
    }

    // 공의 이동 속도에 누적된 증가량 적용
    this.position_.add(this.velocity_.clone().normalize().multiplyScalar((this.initialSpeed_ + currentBallSpeedIncrease) * delta));

    // [추가] 홀과의 충돌 감지 및 반사
    for (const hole of allHoles) {
      if (this.boundingBox_.intersectsBox(hole.boundingBox)) {
        console.log(`Ball ${this.ballNumber_} collided with a hole!`);

        const ballCenter = this.boundingBox_.getCenter(new THREE.Vector3());
        const holeCenter = hole.boundingBox.getCenter(new THREE.Vector3());

        const ballMin = this.boundingBox_.min;
        const ballMax = this.boundingBox_.max;
        const holeMin = hole.boundingBox.min;
        const holeMax = hole.boundingBox.max;

        // 각 축에서의 겹침 정도 계산
        const xOverlap = Math.min(ballMax.x, holeMax.x) - Math.max(ballMin.x, holeMin.x);
        const zOverlap = Math.min(ballMax.z, holeMax.z) - Math.max(ballMin.z, holeMin.z);

        let normal = new THREE.Vector3();

        // 가장 적게 겹친 축을 기준으로 법선 결정 및 반사
        if (xOverlap < zOverlap) {
          // X축 충돌
          if (ballCenter.x < holeCenter.x) { // 공이 홀 중심의 왼쪽에 있음
            normal.set(-1, 0, 0);
            this.position_.x = holeMin.x - (ballMax.x - ballMin.x) / 2; // 공을 왼쪽으로 밀어냄
          } else { // 공이 홀 중심의 오른쪽에 있음
            normal.set(1, 0, 0);
            this.position_.x = holeMax.x + (ballMax.x - ballMin.x) / 2; // 공을 오른쪽으로 밀어냄
          }
        } else {
          // Z축 충돌
          if (ballCenter.z < holeCenter.z) { // 공이 홀 중심의 앞에 있음
            normal.set(0, 0, -1);
            this.position_.z = holeMin.z - (ballMax.z - ballMin.z) / 2; // 공을 앞으로 밀어냄
          } else { // 공이 홀 중심의 뒤에 있음
            normal.set(0, 0, 1);
            this.position_.z = holeMax.z + (ballMax.z - ballMin.z) / 2; // 공을 뒤로 밀어냄
          }
        }

        this.velocity_.reflect(normal);

        const epsilon = 0.001; // 공을 바운딩 박스 밖으로 밀어낼 작은 값

        // 반사 및 위치 조정 후 메쉬 위치와 바운딩 박스 업데이트
        if (xOverlap < zOverlap) {
          if (ballCenter.x < holeCenter.x) { // 공이 홀 중심의 왼쪽에 있음
            this.position_.x = holeMin.x - (ballMax.x - ballMin.x) / 2 - epsilon; // 공을 왼쪽으로 밀어냄
          } else { // 공이 홀 중심의 오른쪽에 있음
            this.position_.x = holeMax.x + (ballMax.x - ballMin.x) / 2 + epsilon; // 공을 오른쪽으로 밀어냄
          }
        } else {
          if (ballCenter.z < holeCenter.z) { // 공이 홀 중심의 앞에 있음
            this.position_.z = holeMin.z - (ballMax.z - ballMin.z) / 2 - epsilon; // 공을 앞으로 밀어냄
          } else {
            this.position_.z = holeMax.z + (ballMax.z - ballMin.z) / 2 + epsilon; // 공을 뒤로 밀어냄
          }
        }

        this.mesh_.position.copy(this.position_);
        this.boundingBox_.setFromObject(this.mesh_);

        break; // 한 프레임에 하나의 홀 충돌만 처리 (단순화를 위해)
      }
    }

    // [추가] 다른 공들과의 충돌 감지 및 반사
    for (const otherBall of allBalls) {
      if (otherBall === this) continue; // 자기 자신과의 충돌은 무시

      if (this.boundingBox_.intersectsBox(otherBall.boundingBox_)) {
        // 충돌 발생: 법선 벡터에 따라 속도 반사
        const normal = new THREE.Vector3().subVectors(this.position_, otherBall.position_).normalize();

        // 각 공의 속도를 법선에 대해 반사
        this.velocity_.reflect(normal);
        otherBall.velocity_.reflect(normal.clone().negate()); // 다른 공은 반대 법선으로 반사

        // 공들이 겹치는 것을 방지하기 위해 약간 밀어냄
        const overlapDirection = new THREE.Vector3().subVectors(this.position_, otherBall.position_).normalize();
        this.position_.add(overlapDirection.multiplyScalar(0.1)); // 약간 밀어내는 거리
        otherBall.position_.sub(overlapDirection.multiplyScalar(0.1));
      }
    }

    // [추가] 플레이어 바운딩 박스와의 충돌 감지 및 반사 (홀 충돌 로직과 동일하게)
    if (playerBoundingBox && this.boundingBox_.intersectsBox(playerBoundingBox)) {
      console.log(`Ball ${this.ballNumber_} collided with player!`);

      const ballCenter = this.boundingBox_.getCenter(new THREE.Vector3());
      const playerCenter = playerBoundingBox.getCenter(new THREE.Vector3());

      const ballMin = this.boundingBox_.min;
      const ballMax = this.boundingBox_.max;
      const playerMin = playerBoundingBox.min;
      const playerMax = playerBoundingBox.max;

      // 각 축에서의 겹침 정도 계산
      const xOverlap = Math.min(ballMax.x, playerMax.x) - Math.max(ballMin.x, playerMin.x);
      const zOverlap = Math.min(ballMax.z, playerMax.z) - Math.max(ballMin.z, playerMin.z);

      let normal = new THREE.Vector3();
      const epsilon = 0.001; // 공을 바운딩 박스 밖으로 밀어낼 작은 값

      // 가장 적게 겹친 축을 기준으로 법선 결정 및 반사
      if (xOverlap < zOverlap) {
        // X축 충돌
        if (ballCenter.x < playerCenter.x) { // 공이 플레이어 중심의 왼쪽에 있음
          normal.set(-1, 0, 0);
          this.position_.x = playerMin.x - (ballMax.x - ballMin.x) / 2 - epsilon; // 공을 왼쪽으로 밀어냄
        } else { // 공이 플레이어 중심의 오른쪽에 있음
          normal.set(1, 0, 0);
          this.position_.x = playerMax.x + (ballMax.x - ballMin.x) / 2 + epsilon; // 공을 오른쪽으로 밀어냄
        }
      } else {
        // Z축 충돌
        if (ballCenter.z < playerCenter.z) { // 공이 홀 중심의 앞에 있음
          normal.set(0, 0, -1);
          this.position_.z = playerMin.z - (ballMax.z - ballMin.z) / 2 - epsilon; // 공을 앞으로 밀어냄
        } else {
          normal.set(0, 0, 1);
          this.position_.z = playerMax.z + (ballMax.z - ballMin.z) / 2 + epsilon; // 공을 뒤로 밀어냄
        }
      }
      this.velocity_.reflect(normal);
    }

    // BoxHelper 업데이트
    if (this.boxHelper_) {
      this.boxHelper_.update();
    }

    // 경계 체크 및 반사
    if (this.position_.x < tableBoundaryMinX) {
      this.velocity_.reflect(new THREE.Vector3(1, 0, 0));
      this.position_.x = tableBoundaryMinX;
    } else if (this.position_.x > tableBoundaryMaxX) {
      this.velocity_.reflect(new THREE.Vector3(-1, 0, 0));
      this.position_.x = tableBoundaryMaxX;
    }

    if (this.position_.z < tableBoundaryMinZ) {
      this.velocity_.reflect(new THREE.Vector3(0, 0, 1));
      this.position_.z = tableBoundaryMinZ;
    } else if (this.position_.z > tableBoundaryMaxZ) {
      this.velocity_.reflect(new THREE.Vector3(0, 0, -1));
      this.position_.z = tableBoundaryMaxZ;
    }

    // 공 경계 검사 (Y축 하강)
    if (this.mesh_.position.x < tableBoundaryMinX || this.mesh_.position.x > tableBoundaryMaxX ||
        this.mesh_.position.z < tableBoundaryMinZ || this.mesh_.position.z > tableBoundaryMaxZ) {
        this.mesh_.position.y = mapYPosition;
    }

    this.mesh_.position.copy(this.position_);
    // [추가] 공의 Y축 위치를 바닥에 고정하는 로직
    // mainBoundingBox_의 상단 Y 좌표를 바닥으로 간주합니다.
    const groundY = this.mainBoundingBox_.max.y;
    // 공의 반지름을 계산합니다. (바운딩 박스 높이의 절반)
    // 이 값은 공 모델의 실제 크기와 스케일에 따라 달라집니다.
    const ballRadius = (this.boundingBox_.max.y - this.boundingBox_.min.y) / 2;

    // 공의 중심 Y 좌표를 바닥 위에 놓이도록 강제 설정합니다.
    // 이렇게 하면 공이 항상 테이블 표면에 붙어 있게 됩니다.
    this.position_.y = groundY + ballRadius;
    // Y축 속도를 0으로 설정하여 수직 움직임을 방지합니다.
    this.velocity_.y = 0;
    // [추가] 공의 바운딩 박스 업데이트
    // 공의 위치가 변경될 때마다 바운딩 박스도 함께 업데이트합니다.
    this.boundingBox_.setFromObject(this.mesh_);
    console.log(`Ball ${this.ballNumber_} updated position:`, this.position_);
  }
}

// --- Start of BallManager class from ball1.js ---
class BallManager {
  constructor(scene) {
    this.scene_ = scene;
    this.balls_ = [];

    // [사용자 설정] 각 공의 색상 (공 번호를 키로 사용)
    this.ballColors_ = {
      1: 0xfefe48, // 1번 공: 흰색 (큐볼)
      2: 0x39a8fe, // 2번 공: 파란색
      3: 0xFF0000, // 3번 공: 빨간색
      4: 0x020202, // 4번 공: 보라색
      5: 0xee6e06, // 5번 공: 주황색
      6: 0xa6fe48, // 6번 공: 초록색
    };
  }

  createAllBalls(mainBoundingBox, mainTopY, currentBallSpeedIncrease) {
    this.balls_ = []; // 기존 balls_ 초기화
    for (let i = 1; i <= 6; i++) {
      const position = new THREE.Vector3(
          mainBoundingBox.min.x + Math.random() * (mainBoundingBox.max.x - mainBoundingBox.min.x),
          mainTopY + 0.2,
          mainBoundingBox.min.z + Math.random() * (mainBoundingBox.max.z - mainBoundingBox.min.z)
      );

      const ball = new Ball({
        scene: this.scene_,
        position: position,
        mainBoundingBox: mainBoundingBox,
        ballNumber: i,
        ballColor: this.ballColors_[i] // 공 색상 전달
      }, currentBallSpeedIncrease);

      this.balls_.push(ball);
    }
  }

  updateAllBalls(delta, currentBallSpeedIncrease, allHoles, playerBoundingBox, tableBoundaryMinX, tableBoundaryMaxX, tableBoundaryMinZ, tableBoundaryMaxZ, mapYPosition) {
    for (const ball of this.balls_) {
      ball.Update(delta, currentBallSpeedIncrease, this.balls_, allHoles, playerBoundingBox, tableBoundaryMinX, tableBoundaryMaxX, tableBoundaryMinZ, tableBoundaryMaxZ, mapYPosition);
    }
  }

  getBalls() {
    return this.balls_;
  }
}

// --- End of BallManager class from ball1.js ---

export const object1 = (() => {
  class PoolTable {
    constructor(scene) {
      this.scene_ = scene;

      // [사용자 설정] 각 홀의 색상 (홀 번호를 키로 사용)
      this.holeColors_ = {
        1: 0xFFFFFF, // hole1: 빨강
        2: 0xFFFFFF, // hole2: 초록
        3: 0xFFFFFF, // hole3: 파랑
        4: 0xFFFFFF, // hole4: 노랑
        5: 0xFFFFFF, // hole5: 주황
        6: 0xFFFFFF  // hole6: 검정
      };
      // [사용자 설정] 홀의 Y축 위치 조정 (기본값: 0.3)
      this.holeHeightAdjustment_ = 0.45;

      // [사용자 설정] 홀 실린더 너비 배율 (기본값: 1.1, 1보다 큰 값으로 설정하여 너비 증가)
      this.holeCylinderWidthMultiplier_ = 1.1;

      // [사용자 설정] 박스 길이 배율 (기본값: 1.1, 1보다 큰 값으로 설정하여 길이 증가)
      this.boxLengthMultiplier_ = 1.1;

      this.ground = null;
      this.collidables_ = [];
      this.rimCollidables_ = [];
      this.holes_ = [];
      this.rimBoxHelpers_ = [];
      this.holeBoxHelpers_ = [];

      this.tableBoundaryMinX = 0;
      this.tableBoundaryMaxX = 0;
      this.tableBoundaryMinZ = 0;
      this.tableBoundaryMaxZ = 0;
      this.mainTopY = 0;
      this.playerSpawnY = 0;
      this.mainBoundingBox = null;
    }

    LoadTable() {
      return new Promise((resolve, reject) => {
        // 이미지 맵 (바닥) 생성
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load('./resources/map.png', (texture) => {
          const groundGeometry = new THREE.PlaneGeometry(100, 100); // 이미지 맵의 크기 (조절 가능)
          const groundMaterial = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide });
          const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
          groundPlane.rotation.x = -Math.PI / 2; // 바닥으로 눕히기
          groundPlane.position.y = -0.1; // map.png의 Y축 위치
          groundPlane.receiveShadow = true;
          this.scene_.add(groundPlane);
        });

        // table0.glb 로드
        const loader = new GLTFLoader();
        loader.load(
          './resources/Pool-table/table0.glb',
          (gltf) => {
            this.ground = gltf.scene;
            const box = new THREE.Box3().setFromObject(this.ground);
            const minY = box.min.y;
            this.ground.position.y = -minY; // 모델의 바닥이 0이 되도록 조정

            const size = new THREE.Vector3();
            box.getSize(size);
            const scaleX = 25 / size.x;
            const scaleZ = 50 / size.z;
            this.ground.scale.set(scaleX, scaleX, scaleZ);
            this.ground.updateMatrixWorld(true);

            const mainObject = this.ground.getObjectByName('main');
            if (mainObject) {
              mainObject.updateMatrixWorld(true);
              this.mainBoundingBox = new THREE.Box3().setFromObject(mainObject);
              this.mainTopY = this.mainBoundingBox.max.y;
              this.collidables_.push({ boundingBox: this.mainBoundingBox, object: mainObject });
              mainObject.visible = false;

              console.log('mainBox:', this.mainBoundingBox);
              console.log('mainTopY:', this.mainTopY);

              // table0.glb의 경계 좌표 설정
              this.tableBoundaryMinX = this.mainBoundingBox.min.x;
              this.tableBoundaryMaxX = this.mainBoundingBox.max.x;
              this.tableBoundaryMinZ = this.mainBoundingBox.min.z;
              this.tableBoundaryMaxZ = this.mainBoundingBox.max.z;
            }

            let groundY = 0;
            if (this.ground) {
              const box = new THREE.Box3().setFromObject(this.ground);
              groundY = box.max.y;
            }
            // 플레이어 스폰 Y 위치 조정: table0.glb의 상단에 위치하도록
            this.playerSpawnY = this.mainTopY !== undefined ? this.mainTopY + 0.01 : groundY + 11;

            const desiredHeight = 2.296;
            const commonTargetMaxY = 6.191;

            for (let i = 1; i <= 16; i++) {
              const boxName = `box${i}`;
              const boxObject = this.ground.getObjectByName(boxName);
              if (!boxObject) continue;

              boxObject.updateWorldMatrix(true, true);
              const boxBox = new THREE.Box3().setFromObject(boxObject);
              const currentHeight = boxBox.max.y - boxBox.min.y;
              const scaleY = desiredHeight / currentHeight;
              boxObject.scale.y *= scaleY;
              boxObject.scale.x *= this.boxLengthMultiplier_; // X축 길이 조정
              boxObject.scale.z *= this.boxLengthMultiplier_; // Z축 길이 조정
              boxObject.updateMatrixWorld(true);

              const adjustedBox = new THREE.Box3().setFromObject(boxObject); // Update bounding box after scaling
              this.rimCollidables_.push({ boundingBox: adjustedBox, object: boxObject });
              this.collidables_.push({ boundingBox: adjustedBox, object: boxObject }); // Add to collidables
              boxObject.visible = false;

              // BoxHelper 추가 (테이블 가장자리)
              const rimBoxHelper = new THREE.BoxHelper(boxObject, 0x00ff00); // 초록색
              rimBoxHelper.visible = false; // 테이블 가장자리 바운딩 박스를 보이지 않게 설정
              this.scene_.add(rimBoxHelper);
              this.rimBoxHelpers_.push(rimBoxHelper);
            }

            this.ground.traverse(child => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                  child.material.side = THREE.DoubleSide;
                  child.material.needsUpdate = true;
                }

                if (child.name.includes('hole')) {
                  const holeNumberMatch = child.name.match(/hole(\d+)/);
                  let holeColor = 0xFFFFFF; // 기본 색상 (이전 설정 유지)
                  if (holeNumberMatch && this.holeColors_[holeNumberMatch[1]]) {
                    holeColor = this.holeColors_[holeNumberMatch[1]];
                  }

                  child.position.y += this.holeHeightAdjustment_; // Adjust this value as needed
                  if (child.material) {
                    child.material = new THREE.MeshStandardMaterial({ color: holeColor });
                  }
                  const box = new THREE.Box3().setFromObject(child);
                  this.holes_.push({ object: child, boundingBox: box });

                  // 실린더 형태의 바운딩 박스 시각화 (홀)
                  const cylinderRadius = ((box.max.x - box.min.x) / 2) * this.holeCylinderWidthMultiplier_; // 바운딩 박스 너비의 절반을 반지름으로 사용
                  const cylinderHeight = box.max.y - box.min.y; // 바운딩 박스 높이를 실린더 높이로 사용
                  const cylinderGeometry = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 32);
                  const cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.5 }); // 빨간색, 와이어프레임, 투명
                  const cylinderMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
                  cylinderMesh.visible = false; // 홀 바운딩 박스를 보이지 않게 설정

                  // 실린더 위치 조정
                  cylinderMesh.position.copy(box.getCenter(new THREE.Vector3()));
                  cylinderMesh.position.y = box.min.y + cylinderHeight / 2; // 바운딩 박스 중앙 Y축에 맞춤

                  this.scene_.add(cylinderMesh);
                  this.holeBoxHelpers_.push(cylinderMesh); // 실린더 메쉬를 헬퍼 배열에 추가
                }
              }
            });

            this.scene_.add(this.ground);
            resolve(); // 로딩 완료 시 Promise resolve
          },
          undefined,
          (error) => {
            console.error('GLB 로드 실패:', error);
            reject(error); // 로딩 실패 시 Promise reject
          }
        );
      });
    }

    // Getter methods for properties
    getCollidables() { return this.collidables_; }
    getRimCollidables() { return this.rimCollidables_; }
    getHoles() { return this.holes_; }
    getRimBoxHelpers() { return this.rimBoxHelpers_; }
    getHoleBoxHelpers() { return this.holeBoxHelpers_; }
    getTableBoundaryMinX() { return this.tableBoundaryMinX; }
    getTableBoundaryMaxX() { return this.tableBoundaryMaxX; }
    getTableBoundaryMinZ() { return this.tableBoundaryMinZ; }
    getTableBoundaryMaxZ() { return this.tableBoundaryMaxZ; }
    getMainTopY() { return this.mainTopY; }
    getPlayerSpawnY() { return this.playerSpawnY; }
    getMainBoundingBox() { return this.mainBoundingBox; }
    getGround() { return this.ground; }
  }

  return {
    PoolTable: PoolTable,
    Ball: Ball, // Export Ball class
    BallManager: BallManager, // Export BallManager class
  };
})();