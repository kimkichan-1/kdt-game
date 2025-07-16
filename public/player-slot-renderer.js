import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/GLTFLoader.js';

export class PlayerSlotRenderer {
    constructor(canvas, characterName) {
        this.canvas = canvas;
        this.characterName = characterName;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        this.renderer.setSize(canvas.width, canvas.height);

        this.mixer = null;
        this.clock = new THREE.Clock();

        this.setupScene();
        this.loadModel();
    }

    setupScene() {
        // Add a light to the scene
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(1, 2, 3);
        this.scene.add(directionalLight);

        this.camera.position.set(0, 1.5, 2.5); // Adjust camera position to view the character
        this.camera.lookAt(0, 1, 0); // Look at the center of the character
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.setPath('./resources/Ultimate Animated Character Pack - Nov 2019/glTF/');
        loader.load(`${this.characterName}.gltf`, (gltf) => {
            const model = gltf.scene;
            model.scale.setScalar(0.015); // Adjust scale to fit the slot
            model.position.y = -0.5; // Adjust vertical position
            model.rotation.y = Math.PI; // Rotate to face the camera
            this.scene.add(model);

            this.mixer = new THREE.AnimationMixer(model);
            const idleClip = gltf.animations.find(clip => clip.name === 'Idle');
            if (idleClip) {
                const idleAction = this.mixer.clipAction(idleClip);
                idleAction.play();
            } else {
                console.warn(`Idle animation not found for ${this.characterName}.`);
            }
        }, undefined, (error) => {
            console.error(`Error loading GLTF model for ${this.characterName}:`, error);
        });
    }

    update() {
        if (this.mixer) {
            this.mixer.update(this.clock.getDelta());
        }
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        // Dispose of renderer, scene, and other resources to prevent memory leaks
        this.renderer.dispose();
        this.scene.traverse((object) => {
            if (object.isMesh) {
                object.geometry.dispose();
                object.material.dispose();
            }
        });
        this.mixer = null;
        this.canvas = null;
    }
}
