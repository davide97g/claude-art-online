import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// One shared manager so the loading screen sees a single, honest progress count.
// main.js attaches onProgress/onLoad/onError. GLB fetches route through `gltf`;
// gray-box fallbacks in each subsystem still run on error, and the manager
// resolves regardless (errors count toward "done").
// ponytail: geometry only — bards_tale.mp3 loads via HTMLAudio, outside this.
export const manager = new THREE.LoadingManager();
export const gltf = new GLTFLoader(manager);
