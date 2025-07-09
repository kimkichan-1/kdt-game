import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.128.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.128.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, model, animations, mixer, activeAction, previousAction;
let clock = new THREE.Clock();

const idleButton = document.getElementById('idleButton');
const walkButton = document.getElementById('walkButton');
const jumpButton = document.getElementById('jumpButton');

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1, 3);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(3, 10, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 2;
    dirLight.shadow.camera.bottom = -2;
    dirLight.shadow.camera.left = -2;
    dirLight.shadow.camera.right = 2;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 40;
    scene.add(dirLight);

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const loader = new GLTFLoader();
    loader.load('animated_teddy.glb', function (gltf) {
        model = gltf.scene;
        model.traverse(function (object) {
            if (object.isMesh) {
                object.castShadow = true;
            }
        });
        scene.add(model);

        animations = {};
        mixer = new THREE.AnimationMixer(model);

        gltf.animations.forEach(clip => {
            animations[clip.name] = mixer.clipAction(clip);
        });

        // Set initial animation to Idle
        activeAction = animations.Idle;
        if (activeAction) {
            activeAction.play();
        } else {
            console.warn("Idle animation not found.");
        }

        setupAnimationButtons();

    }, undefined, function (error) {
        console.error(error);
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.75, 0);
    controls.update();

    window.addEventListener('resize', onWindowResize);
}

function setupAnimationButtons() {
    idleButton.addEventListener('click', () => fadeToAction('Idle', 0.5));
    walkButton.addEventListener('click', () => fadeToAction('Walk', 0.5));
    jumpButton.addEventListener('click', () => fadeToAction('Jump', 0.2)); // Jump might be faster
}

function fadeToAction(name, duration) {
    previousAction = activeAction;
    activeAction = animations[name];

    if (previousAction !== activeAction) {
        previousAction.fadeOut(duration);
    }

    activeAction
        .reset()
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .fadeIn(duration)
        .play();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    renderer.render(scene, camera);
}