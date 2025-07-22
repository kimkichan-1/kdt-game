// public/weapon.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js';
import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/FBXLoader.js';

let WEAPON_DATA = {};

// weapon_data.json 로드
async function loadWeaponData() {
    try {
        const response = await fetch('./resources/data/weapon_data.json');
        WEAPON_DATA = await response.json();
        console.log('Weapon data loaded:', WEAPON_DATA);
    } catch (error) {
        console.error('Failed to load weapon data:', error);
    }
}

// 페이지 로드 시 무기 데이터 로드
loadWeaponData();

export class Weapon {
    constructor(scene, weaponName, position = new THREE.Vector3(0, 0, 0)) {
        this.scene_ = scene;
        this.weaponName = weaponName; // FBX 파일 이름 (예: "Sword.fbx")
        this.model_ = null; // 모델을 저장할 속성

        // WEAPON_DATA가 로드된 후에 모델을 로드하도록 보장
        // 이미 로드되어 있다면 바로 모델 로드
        if (Object.keys(WEAPON_DATA).length > 0) {
            this.LoadModel_(weaponName, position);
        } else {
            // 데이터가 아직 로드되지 않았다면, 로드 완료 후 모델 로드
            loadWeaponData().then(() => {
                this.LoadModel_(weaponName, position);
            });
        }
    }

    LoadModel_(weaponName, position) {
        const loader = new FBXLoader();
        loader.setPath('./resources/weapon/FBX/'); // 무기 FBX 파일 경로

        loader.load(weaponName, (fbx) => {
            const model = fbx;
            // KDTgames-main/item.js의 스케일 로직 참고
            if (/AssaultRifle|Pistol|Shotgun|SniperRifle|SubmachineGun/i.test(weaponName)) {
                model.scale.setScalar(0.005);
            } else {
                model.scale.setScalar(0.01);
            }
            model.position.copy(position);

            model.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });

            this.scene_.add(model);
            this.model_ = model;
            console.log(`Weapon model ${weaponName} loaded at`, position);
        }, undefined, (error) => {
            console.error(`Error loading weapon model ${weaponName}:`, error);
        });
    }
}

// 맵에 무기를 생성하는 함수
export function spawnWeaponOnMap(scene, weaponName, x, y, z) {
    const position = new THREE.Vector3(x, y, z);
    const weapon = new Weapon(scene, weaponName, position);
    return weapon;
}
