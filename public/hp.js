import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js';
import { player } from './player.js'; // Assuming player.js will be in the same directory

export const hp = (() => {
  class HPUI {
    constructor(isNPC = false) {
      // ===============================
      // HP 바 UI 생성
      // ===============================
      this.hpBarContainer = document.createElement('div');
      this.hpBarContainer.style.position = 'absolute';
      if (isNPC) {
        this.hpBarContainer.style.left = '30px';
        this.hpBarContainer.style.top = '30px';
      } else {
        this.hpBarContainer.style.right = '30px';
        this.hpBarContainer.style.bottom = '30px';
      }
      this.hpBarContainer.style.zIndex = '200';
      this.hpBarContainer.style.display = 'flex';
      this.hpBarContainer.style.flexDirection = 'row';
      this.hpBarContainer.style.alignItems = 'center';
      this.hpBarContainer.style.background = '#235280';
      this.hpBarContainer.style.borderRadius = '12px';
      this.hpBarContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18), 0 0px 8px #2228';
      this.hpBarContainer.style.padding = '6px 16px 6px 6px';
      this.hpBarContainer.style.height = '60px';
      this.hpBarContainer.style.minWidth = '250px';

      // 프로필 이미지
      this.hpProfile = document.createElement('img');
      this.hpProfile.src = '';
      this.hpProfile.style.width = '48px';
      this.hpProfile.style.height = '48px';
      this.hpProfile.style.borderRadius = '50%';
      this.hpProfile.style.border = '2.5px solid #fff';
      this.hpProfile.style.background = '#222';
      this.hpProfile.style.objectFit = 'cover';
      this.hpProfile.style.marginRight = '12px';
      this.hpProfile.style.boxShadow = '0 1px 4px #0008';

      // HP 바 배경
      this.hpBarBg = document.createElement('div');
      this.hpBarBg.style.position = 'relative';
      this.hpBarBg.style.width = '170px';
      this.hpBarBg.style.height = '20px';
      this.hpBarBg.style.background = '#1a2a1a';
      this.hpBarBg.style.border = '2px solid #444';
      this.hpBarBg.style.borderRadius = '10px';
      this.hpBarBg.style.overflow = 'hidden';
      this.hpBarBg.style.marginRight = '12px';

      // 실제 HP 게이지 바
      this.hpBarFill = document.createElement('div');
      this.hpBarFill.style.height = '100%';
      this.hpBarFill.style.width = '100%';
      this.hpBarFill.style.background = 'linear-gradient(90deg, #e22 70%, #f88 100%)';
      this.hpBarFill.style.transition = 'width 0.25s';
      this.hpBarFill.style.position = 'absolute';
      this.hpBarFill.style.left = '0';
      this.hpBarFill.style.top = '0';

      // HP 수치 텍스트
      this.hpNumber = document.createElement('div');
      this.hpNumber.innerText = '100';
      this.hpNumber.style.position = 'absolute';
      this.hpNumber.style.top = '50%';
      this.hpNumber.style.transform = 'translateY(-50%)';
      this.hpNumber.style.fontWeight = 'bold';
      this.hpNumber.style.color = '#fff';
      this.hpNumber.style.fontSize = '15px';
      this.hpNumber.style.textShadow = '0 0 3px #000, 0 1px 4px #222c';
      this.hpNumber.style.pointerEvents = 'none';
      this.hpNumber.style.transition = 'left 0.25s';

      this.hpBarBg.appendChild(this.hpBarFill);
      this.hpBarBg.appendChild(this.hpNumber);

      // 플레이어 이름
      this.hpName = document.createElement('div');
      this.hpName.innerText = isNPC ? 'Viking' : 'Player'; // Placeholder name
      this.hpName.style.color = '#bfe8ff';
      this.hpName.style.fontWeight = 'bold';
      this.hpName.style.fontSize = '17px';
      this.hpName.style.textShadow = '1px 1px 3px #222c';
      this.hpName.style.letterSpacing = '1px';
      this.hpName.style.marginBottom = '2px';

      // 이름 + HP바 묶음
      this.hpTextBarWrapper = document.createElement('div');
      this.hpTextBarWrapper.style.display = 'flex';
      this.hpTextBarWrapper.style.flexDirection = 'column';
      this.hpTextBarWrapper.style.justifyContent = 'center';
      this.hpTextBarWrapper.appendChild(this.hpName);
      this.hpTextBarWrapper.appendChild(this.hpBarBg);

      this.hpBarContainer.appendChild(this.hpProfile);
      this.hpBarContainer.appendChild(this.hpTextBarWrapper);
      document.body.appendChild(this.hpBarContainer);

      this.player = null; // Reference to the player object
    }

    setTarget(target) {
      this.target = target;
      // 플레이어 객체를 직접 연결
      if (target instanceof player.Player) {
        this.player = target;
      }
    }

    updateHP(hp) {
      const maxHp = 100; // Assuming max HP is 100 for players
      const percent = Math.max(0, Math.min(1, hp / maxHp));
      this.hpBarFill.style.width = (percent * 100) + '%';
      this.hpNumber.innerText = Math.round(hp);
      const offsetPx = 22;
      this.hpNumber.style.left = hp <= 0 ? '0px' : `calc(${percent * 100}% - ${offsetPx}px)`;
    }

    // === 프로필 얼굴 이미지 추출 기능 ===
    renderCharacterFaceToProfile(mesh, scene, renderer) {
      const size = 128;
      const renderTarget = new THREE.WebGLRenderTarget(size, size);

      let head = null;
      mesh.traverse((child) => {
        if (child.name === "Head") head = child;
      });

      let faceWorldPos, cameraWorldPos;
      if (head) {
        head.updateMatrixWorld(true);
        faceWorldPos = new THREE.Vector3();
        head.getWorldPosition(faceWorldPos);

        const headQuaternion = new THREE.Quaternion();
        head.getWorldQuaternion(headQuaternion);
        const headForward = new THREE.Vector3(0, 0, 1).applyQuaternion(headQuaternion);
        cameraWorldPos = faceWorldPos.clone().add(headForward.multiplyScalar(0.35));
      } else {
        mesh.updateMatrixWorld(true);
        faceWorldPos = mesh.localToWorld(new THREE.Vector3(0, 1.7, 0));
        cameraWorldPos = mesh.localToWorld(new THREE.Vector3(0, 1.7, 0.7));
      }

      const faceCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
      faceCamera.position.copy(cameraWorldPos);
      faceCamera.lookAt(faceWorldPos);

      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, faceCamera);
      renderer.setRenderTarget(null);

      const buffer = new Uint8Array(size * size * 4);
      renderer.readRenderTargetPixels(renderTarget, 0, 0, size, size, buffer);

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(size, size);
      imageData.data.set(buffer);
      ctx.putImageData(imageData, 0, 0);

      const dataURL = canvas.toDataURL();
      this.hpProfile.src = dataURL;

      renderTarget.dispose();
    }
  }

  return { HPUI };
})();