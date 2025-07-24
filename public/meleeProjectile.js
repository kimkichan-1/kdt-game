// public/meleeProjectile.js
// 근접 무기용 보이지 않는 투사체(hitbox) 클래스
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js';

export class MeleeProjectile {
  constructor({ scene, position, direction, weapon, attacker, onHit, type = 'circle', angle = Math.PI / 2, radius = 3, speed, startWidth }) {
    this.scene = scene;
    this.position = position.clone();
    this.direction = direction.clone().normalize();
    this.weapon = weapon;
    this.attacker = attacker;
    this.onHit = onHit;
    this.speed = (speed !== undefined) ? speed : (weapon.projectileSpeed !== undefined ? weapon.projectileSpeed : 20);
    this.range = weapon.range || weapon.attackRadius || 20.0;
    this.traveled = 0;
    this.radius = (weapon.projectileSize !== undefined) ? weapon.projectileSize : (radius || weapon.radius || 0.3);
    this.angle = angle || weapon.angle || Math.PI / 2;
    this.type = type;
    this.isDestroyed = false;
    this.projectileEffect = weapon.projectileEffect || null;
    this.hitTargets = new Set(); // 이미 타격한 대상을 저장하여 중복 타격 방지
    this.lifeTime = 0.2; // 근접 공격 디버그 메시 유지 시간 (초)
    this.startWidth = (weapon.startWidth !== undefined) ? weapon.startWidth : (startWidth || 1.0); // 시작 선 너비 추가

    // 디버그 시각화: 항상 생성
    this.debugMesh = this.createDebugMesh();
    if (this.debugMesh && this.scene) this.scene.add(this.debugMesh);
  }

  createDebugMesh() {
    // 근접 공격(sector, aerial)의 디버그 메시는 생성하지 않음
    if (this.type === 'sector' || this.type === 'aerial') {
      let color = 0xff0000; // 근접: 빨강
      const segments = 32;
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const indices = [];

      // 시작 선의 양 끝점 (투사체 방향을 고려하여 X축에 평행하게 놓음)
      const startHalfWidth = this.startWidth / 2;
      positions.push(-startHalfWidth, 0, 0); // Index 0 (P0: 시작 왼쪽)
      positions.push(startHalfWidth, 0, 0);  // Index 1 (P1: 시작 오른쪽)

      // 끝 호의 점들
      for (let i = 0; i <= segments; i++) {
        const segmentAngle = (this.angle / 2) * (2 * i / segments - 1); // -angle/2 to +angle/2
        const x = this.radius * Math.sin(segmentAngle);
        const z = this.radius * Math.cos(segmentAngle);
        positions.push(x, 0, z); // Index 2, 3, ... (Q_i)
      }

      // 인덱스 구성: 사다리꼴 형태
      // 시작 선과 첫 번째 호 세그먼트 연결
      // 정점: P0(0), P1(1), Q0(2), Q1(3)
      indices.push(0, 1, 3); // 삼각형 1: P0, P1, Q1
      indices.push(0, 3, 2); // 삼각형 2: P0, Q1, Q0

      // 나머지 호 세그먼트들을 연결하여 사다리꼴을 만듭니다.
      for (let i = 0; i < segments; i++) {
        const current_q_idx = i + 2;     // 현재 호의 시작점 인덱스 (Q_i)
        const next_q_idx = i + 3;        // 다음 호의 끝점 인덱스 (Q_i+1)

        // 사다리꼴의 두 삼각형: (Q_i, Q_i+1, P1), (Q_i, P1, P0)
        indices.push(current_q_idx, next_q_idx, 1); // 삼각형 1: Q_i, Q_i+1, P1
        indices.push(current_q_idx, 1, 0);          // 삼각형 2: Q_i, P1, P0
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(new THREE.Uint16BufferAttribute(indices, 1));
      geometry.computeVertexNormals();

      const material = new THREE.MeshBasicMaterial({ color: color, wireframe: true, transparent: true, opacity: 0.5 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(this.position);

      // 투사체 방향에 따라 메시 회전 (부채꼴의 경우)
      const angleToDirection = Math.atan2(this.direction.x, this.direction.z);
      mesh.rotation.y = angleToDirection;

      return mesh;
    } else if (this.type === 'circle') {
      // 원거리 투사체 (구)
      let color = 0xff0000; // 기본 빨간색
      const geometry = new THREE.SphereGeometry(this.radius, 16, 16);
      if (this.projectileEffect === 'piercing') color = 0x00ff00; // 관통: 초록
      else if (this.projectileEffect === 'explosion') color = 0x0000ff; // 폭발: 파랑
      else color = 0xffaa00; // 일반 원거리: 주황

      const material = new THREE.MeshBasicMaterial({ color: color, wireframe: true, transparent: true, opacity: 0.5 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(this.position);
      return mesh;
    } else {
      // 기본 박스 (fallback)
      const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.5 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(this.position);
      return mesh;
    }
  }

  // 부채꼴 판정 함수 (이 함수는 시작점이 선으로 변경되어도 동일하게 작동합니다.)
  isInSector(targetPos) {
    const toTarget = targetPos.clone().sub(this.position);
    toTarget.y = 0; // Y축 무시
    const dist = toTarget.length();
    if (dist > this.radius) return false;

    const dirToTarget = toTarget.normalize();
    const dot = this.direction.dot(dirToTarget);
    const theta = Math.acos(Math.min(Math.max(dot, -1), 1)); // Clamp dot product to avoid NaN from acos
    return theta <= this.angle / 2;
  }

  update(delta, targets) {
    if (this.isDestroyed) return;

    // 디버그 메시 위치 업데이트
    if (this.debugMesh) this.debugMesh.position.copy(this.position);

    if (this.type === 'sector' || this.type === 'aerial') {
      // sector(근접), aerial(공중) 공격은 이동하지 않고, 생성 프레임에만 판정
      for (const target of targets) {
        // 공격자와 같은 대상은 타격하지 않음
        if (target === this.attacker) continue;

        // NPC 또는 플레이어의 mesh_가 있는지 확인
        const targetMesh = target.mesh_ || target.model_;
        if (targetMesh && typeof target.TakeDamage === 'function') {
          const canTargetTakeDamage = typeof target.canTakeDamage === 'function' ? target.canTakeDamage() : !target.isDead_;
          if (canTargetTakeDamage && !this.hitTargets.has(target)) {
            const targetPos = targetMesh.position;
            if (this.isInSector(targetPos)) {
              target.TakeDamage(this.weapon.damage);
              this.hitTargets.add(target); // 타격한 대상 추가
              if (this.attacker && this.attacker.hitEnemies_) { this.attacker.hitEnemies_.add(target); }
              if (this.onHit) this.onHit(target);
              // 근접 공격은 한 번 타격하면 소멸 (관통 효과가 없는 경우)
              if (this.weapon.projectileEffect !== 'piercing') {
                // this.destroy(); // 즉시 소멸 대신 일정 시간 유지
                // return;
              }
            }
          }
        }
      }
      // 일정 시간 후 소멸
      this.lifeTime -= delta;
      if (this.lifeTime <= 0) {
        this.destroy();
        return;
      }
    }

    // 원거리(circle) 타입 이동 및 판정
    if (this.type === 'circle') {
      const moveDist = this.speed * delta;
      this.position.addScaledVector(this.direction, moveDist);
      this.traveled += moveDist;
    }

    for (const target of targets) {
      // 공격자와 같은 대상은 타격하지 않음
      if (target === this.attacker) continue;

      const targetMesh = target.mesh_ || target.model_;
      if (targetMesh && typeof target.TakeDamage === 'function') {
        const canTargetTakeDamage = typeof target.canTakeDamage === 'function' ? target.canTakeDamage() : !target.isDead_;
        if (canTargetTakeDamage && !this.hitTargets.has(target)) {
          const targetPos = targetMesh.position;
          let hit = false;
          if (this.type === 'circle') {
            const dist = this.position.distanceTo(targetPos);
            // 플레이어/NPC의 바운딩 박스/반경을 고려하여 충돌 판정
            const targetRadius = (target.boundingBox_ ? target.boundingBox_.getSize(new THREE.Vector3()).length() / 2 : 0.7); // 대략적인 반경
            hit = dist <= this.radius + targetRadius;
          }

          if (hit) {
            this.hitTargets.add(target); // 타격한 대상 추가
            // projectileEffect 처리
            if (this.projectileEffect === 'piercing') {
              // 관통: 소멸하지 않고 다음 대상도 타격
              target.TakeDamage(this.weapon.damage);
              if (this.attacker && this.attacker.hitEnemies_) { this.attacker.hitEnemies_.add(target); }
              if (this.onHit) this.onHit(target);
            } else if (this.projectileEffect === 'explosion') {
              // 폭발: 주변 대상 추가 타격
              target.TakeDamage(this.weapon.damage);
              if (this.attacker && this.attacker.hitEnemies_) { this.attacker.hitEnemies_.add(target); }
              if (this.onHit) this.onHit(target);
              this.explode(targets); // 폭발 범위 내 모든 대상에게 피해
              this.destroy();
              return;
            } else {
              // 일반: 1회 타격 후 소멸
              target.TakeDamage(this.weapon.damage);
              if (this.attacker && this.attacker.hitEnemies_) { this.attacker.hitEnemies_.add(target); }
              if (this.onHit) this.onHit(target);
              this.destroy();
              return;
            }
          }
        }
      }
    }

    // 사거리 초과 시 소멸
    if (this.traveled >= this.range) {
      this.destroy();
    }
  }

  // 폭발 효과
  explode(targets) {
    const explosionRadius = this.radius * 2; // 폭발 반경은 투사체 반경의 2배
    for (const target of targets) {
      // 공격자와 같은 대상은 타격하지 않음
      if (target === this.attacker) continue;

      const targetMesh = target.mesh_ || target.model_;
      if (targetMesh && typeof target.TakeDamage === 'function') {
        const canTargetTakeDamage = typeof target.canTakeDamage === 'function' ? target.canTakeDamage() : !target.isDead_;
        if (canTargetTakeDamage && !this.hitTargets.has(target)) {
          const dist = this.position.distanceTo(targetMesh.position);
          if (dist <= explosionRadius) {
            target.TakeDamage(this.weapon.damage * 0.5); // 폭발은 절반 피해
            this.hitTargets.add(target); // 타격한 대상 추가
          }
        }
      }
    }
    // 시각화: 폭발 이펙트 등 추가 가능 (예: 파티클 시스템)
  }

  destroy() {
    if (!this.isDestroyed) {
      if (this.debugMesh && this.scene) {
        this.scene.remove(this.debugMesh);
        this.debugMesh = null;
      }
      this.isDestroyed = true;
    }
  }
}
