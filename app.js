/**
 * WebAR Studio - Engine Kamera AR, Gyroscope Tracking & Animasi 3D
 * Murni HTML5 + CSS3 + Vanilla JavaScript + Three.js
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =============================================================================
// State & Variabel Global
// =============================================================================
let scene, camera, renderer, controls;
let previewGroup, arGroup;
let modelTemplate = null;
let currentScale = 1.0;

// State Kamera & Gyroscope AR
let isCameraActive = false;
let isModelPlaced = false;
let mediaStream = null;
let deviceOrientation = { alpha: null, beta: null, gamma: null };
let screenOrientation = 0;
let hasGyroData = false;

// State Animasi Karakter
let mixer = null;
let animationActions = [];
let activeAction = null;
const clock = new THREE.Clock();

// DOM Elements
const canvas = document.getElementById('webgl-canvas');
const cameraFeed = document.getElementById('camera-feed');
const fileInput = document.getElementById('glb-file-input');
const dropZone = document.getElementById('drop-zone');
const dropOverlay = document.getElementById('drop-overlay');
const modelName = document.getElementById('model-name');
const modelBadge = document.getElementById('model-badge');
const animBadge = document.getElementById('anim-badge');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const toast = document.getElementById('toast');

// Kontrol & Tombol
const btnOpenCamera = document.getElementById('btn-open-camera');
const btnCloseCamera = document.getElementById('btn-close-camera');
const btnReposition = document.getElementById('btn-reposition');
const btnRotate = document.getElementById('btn-rotate');
const btnReset = document.getElementById('btn-reset');
const presetSelect = document.getElementById('preset-select');
const previewAnimSelect = document.getElementById('preview-anim-select');
const arAnimSelect = document.getElementById('ar-anim-select');
const scaleRange = document.getElementById('scale-range');
const scaleLabel = document.getElementById('scale-label');

// AR UI
const arReticle = document.getElementById('ar-reticle');
const arInstructionBar = document.getElementById('ar-instruction-bar');
const arInstructionText = document.getElementById('ar-instruction-text');
const arInstructionIcon = document.getElementById('ar-instruction-icon');
const arControlsBar = document.getElementById('ar-controls-bar');
const previewPanel = document.getElementById('preview-panel');

let autoRotate = true;
let toastTimer = null;

// =============================================================================
// 1. Inisialisasi Three.js 3D Engine
// =============================================================================
function initEngine() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 35);
  camera.position.set(0, 1.2, 1.8);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  // Orbit Controls (Preview)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0.4, 0);
  controls.maxPolarAngle = Math.PI / 2 + 0.1;
  controls.update();

  // Pencahayaan
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(2, 4, 2);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  // Group Preview 3D
  previewGroup = new THREE.Group();
  scene.add(previewGroup);

  const grid = new THREE.GridHelper(10, 20, 0x3b82f6, 0x1e293b);
  previewGroup.add(grid);

  const shadowGeo = new THREE.PlaneGeometry(10, 10);
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.35 });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.receiveShadow = true;
  previewGroup.add(shadowMesh);

  // Group AR (Tempat objek di kamera)
  arGroup = new THREE.Group();
  scene.add(arGroup);

  // Pasang Listener Gyroscope & Sentuhan
  setupGyroscopeListener();
  setupTouchControls();

  window.addEventListener('resize', onWindowResize);

  // Mulai Loop Render
  renderer.setAnimationLoop(renderLoop);

  // Muat model awal (Robot Bergerak dengan Animasi)
  loadGlbFromUrl(presetSelect.value, 'Robot');
}

// =============================================================================
// 2. Gyroscope Tracking (Sensor Gerak HP)
// =============================================================================
function setupGyroscopeListener() {
  function handleOrientation(event) {
    if (event.alpha !== null) {
      deviceOrientation.alpha = event.alpha;
      deviceOrientation.beta = event.beta;
      deviceOrientation.gamma = event.gamma;
      hasGyroData = true;
    }
  }

  window.addEventListener('deviceorientation', handleOrientation, false);
  window.addEventListener('orientationchange', () => {
    screenOrientation = window.orientation || 0;
  }, false);
}

// Terapkan data sensor gyroscope ke orientasi kamera 3D
const _zee = new THREE.Vector3(0, 0, 1);
const _euler = new THREE.Euler();
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 sumbu X

function updateCameraFromGyro() {
  if (!isCameraActive || !hasGyroData || deviceOrientation.alpha === null) return;

  const alpha = THREE.MathUtils.degToRad(deviceOrientation.alpha); // Rotasi kompas (Z)
  const beta = THREE.MathUtils.degToRad(deviceOrientation.beta);   // Kemiringan depan-belakang (X)
  const gamma = THREE.MathUtils.degToRad(deviceOrientation.gamma); // Kemiringan kiri-kanan (Y)
  const orient = THREE.MathUtils.degToRad(screenOrientation);

  _euler.set(beta, alpha, -gamma, 'YXZ');
  camera.quaternion.setFromEuler(_euler);
  camera.quaternion.multiply(_q1); // Arahkan kamera Three.js ke belakang HP (sejajar kamera fisik)
  camera.quaternion.multiply(_q0.setFromAxisAngle(_zee, -orient));
}

// =============================================================================
// 3. Buka & Tutup Kamera HP
// =============================================================================
async function startCamera() {
  // Minta izin sensor giroskop pada perangkat iOS (iPhone/iPad)
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      await DeviceOrientationEvent.requestPermission();
    } catch (e) {
      console.warn('Izin giroskop:', e);
    }
  }

  try {
    // Panggil kamera belakang HP
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
    } catch (e1) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    }

    mediaStream = stream;
    cameraFeed.srcObject = stream;
    cameraFeed.classList.add('active');
    await cameraFeed.play();

    isCameraActive = true;
    isModelPlaced = false;

    // Alihkan UI ke Mode Kamera AR
    previewGroup.visible = false;
    previewPanel.classList.add('hidden');
    btnOpenCamera.classList.add('hidden');
    modelBadge.classList.add('hidden');

    arReticle.classList.remove('hidden');
    arInstructionBar.classList.remove('hidden');
    arControlsBar.classList.remove('hidden');
    btnReposition.classList.add('hidden');

    arInstructionIcon.textContent = '📍';
    arInstructionText.textContent = 'Arahkan kamera & ketuk layar untuk menaruh karakter 3D';

    // Nonaktifkan OrbitControls saat kamera aktif
    controls.enabled = false;
    camera.position.set(0, 0, 0); // Titik pusat kamera HP

    // Bersihkan objek AR lama
    while (arGroup.children.length > 0) {
      arGroup.remove(arGroup.children[0]);
    }

    showToast('Kamera & Gyroscope Aktif! Arahkan & ketuk layar.', 'success', 3500);
  } catch (err) {
    console.error('Kamera gagal dibuka:', err);
    showToast('Izin kamera ditolak pada browser HP Anda.', 'error', 4000);
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  cameraFeed.classList.remove('active');
  cameraFeed.srcObject = null;

  isCameraActive = false;
  isModelPlaced = false;

  // Kembalikan UI ke Mode Preview Biasa
  previewGroup.visible = true;
  previewPanel.classList.remove('hidden');
  btnOpenCamera.classList.remove('hidden');
  modelBadge.classList.remove('hidden');

  arReticle.classList.add('hidden');
  arInstructionBar.classList.add('hidden');
  arControlsBar.classList.add('hidden');

  while (arGroup.children.length > 0) {
    arGroup.remove(arGroup.children[0]);
  }

  // Aktifkan kembali kontrol orbit
  controls.enabled = true;
  camera.position.set(0, 1.2, 1.8);
  camera.rotation.set(0, 0, 0);
  controls.target.set(0, 0.4, 0);
  controls.update();

  showToast('Kamera ditutup', 'info');
}

// =============================================================================
// 4. Menempatkan Model (Tap to Place) & Gerakan Interaktif
// =============================================================================
function placeModel() {
  if (!modelTemplate || !isCameraActive) return;

  if (!arGroup.children.length) {
    const clone = modelTemplate.clone();
    arGroup.add(clone);
  }

  const model = arGroup.children[0];

  if (hasGyroData && deviceOrientation.alpha !== null) {
    // Tempatkan objek di koordinat dunia 3D tepat di depan arah pandang kamera saat ini
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir);

    // Letakkan objek 1.3 meter di depan kamera, sedikit ke bawah (posisi lantai/meja)
    model.position.copy(camera.position).add(viewDir.multiplyScalar(1.3));
    model.position.y -= 0.35;

    // Hadapkan model ke arah kamera
    model.lookAt(camera.position.x, model.position.y, camera.position.z);
  } else {
    // Fallback jika HP tidak memiliki sensor giroskop
    model.position.set(0, -0.28, -1.1);
    model.rotation.set(0, 0, 0);
  }

  model.visible = true;
  isModelPlaced = true;

  // Hubungkan mixer animasi ke model AR jika ada animasi
  if (animationActions.length > 0) {
    startAnimationOnModel(model);
  }

  arReticle.classList.add('hidden');
  btnReposition.classList.remove('hidden');

  arInstructionIcon.textContent = '✅';
  arInstructionText.textContent = 'Karakter diletakkan! Gerakkan HP Anda untuk melihat dari berbagai sudut.';
  showToast('Karakter 3D berhasil diletakkan & bergerak!', 'success', 3500);
}

function repositionModel() {
  if (!isCameraActive) return;

  isModelPlaced = false;

  if (arGroup.children.length > 0) {
    arGroup.children[0].visible = false;
  }

  arReticle.classList.remove('hidden');
  btnReposition.classList.add('hidden');

  arInstructionIcon.textContent = '📍';
  arInstructionText.textContent = 'Arahkan kamera & ketuk layar di posisi baru.';
  showToast('Arahkan kamera & ketuk layar untuk menaruh ulang', 'info');
}

function setupTouchControls() {
  let touchStartX = 0;
  let isDragging = false;

  // Tap layar untuk meletakkan
  canvas.addEventListener('click', () => {
    if (isCameraActive && !isModelPlaced) {
      placeModel();
    }
  });

  // Geser layar untuk memutar objek secara manual
  canvas.addEventListener('touchstart', (e) => {
    if (isCameraActive && isModelPlaced && e.touches.length === 1) {
      isDragging = true;
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (isCameraActive && isDragging && isModelPlaced && arGroup.children.length > 0) {
      const deltaX = e.touches[0].clientX - touchStartX;
      arGroup.children[0].rotation.y += deltaX * 0.015;
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    isDragging = false;
  });
}

// =============================================================================
// 5. Animasi Karakter 3D (AnimationMixer)
// =============================================================================
function setupAnimations(gltf, targetObj) {
  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }
  animationActions = [];
  previewAnimSelect.innerHTML = '';
  arAnimSelect.innerHTML = '';

  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(targetObj);

    gltf.animations.forEach((clip, index) => {
      const action = mixer.clipAction(clip);
      animationActions.push({ name: clip.name || `Gerakan ${index + 1}`, action });

      // Isi dropdown pilihan animasi
      const opt1 = document.createElement('option');
      opt1.value = index;
      opt1.textContent = `Animasi: ${clip.name || index + 1}`;
      previewAnimSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = index;
      opt2.textContent = `Animasi: ${clip.name || index + 1}`;
      arAnimSelect.appendChild(opt2);
    });

    // Jalankan animasi pertama (misal: Walk / Idle / Dance)
    playAnimationByIndex(0);

    animBadge.classList.remove('hidden');
    previewAnimSelect.classList.remove('hidden');
    arAnimSelect.classList.remove('hidden');
  } else {
    animBadge.classList.add('hidden');
    previewAnimSelect.classList.add('hidden');
    arAnimSelect.classList.add('hidden');
  }
}

function playAnimationByIndex(index) {
  if (!animationActions[index]) return;

  if (activeAction) {
    activeAction.fadeOut(0.3);
  }

  const nextAction = animationActions[index].action;
  nextAction.reset().fadeIn(0.3).play();
  activeAction = nextAction;

  previewAnimSelect.value = index;
  arAnimSelect.value = index;
}

function startAnimationOnModel(modelObj) {
  if (animationActions.length > 0 && modelTemplate && modelTemplate.userData.gltf) {
    setupAnimations(modelTemplate.userData.gltf, modelObj);
  }
}

// =============================================================================
// 6. Render Loop Animasi & Gyroscope
// =============================================================================
function renderLoop() {
  const delta = clock.getDelta();

  // 1. Perbarui Animasi Gerak Karakter 3D
  if (mixer) {
    mixer.update(delta);
  }

  // 2. Kamera AR: Perbarui orientasi dari Gyroscope sensor HP
  if (isCameraActive) {
    updateCameraFromGyro();
  } else {
    // Mode Preview 3D Desktop/Biasa
    if (autoRotate && previewGroup) {
      previewGroup.rotation.y += 0.005;
    }
    controls.update();
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// =============================================================================
// 7. Muat Model GLB (Custom Upload & Sampel)
// =============================================================================
function showLoading(msg) {
  loadingText.textContent = msg;
  loading.classList.remove('hidden');
}

function hideLoading() {
  loading.classList.add('hidden');
}

function loadGlbFromUrl(url, label) {
  showLoading(`Mengunduh model ${label}...`);
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      applyModel(gltf, `${label} (Model Bawaan)`);
      hideLoading();
      showToast(`Model "${label}" siap & animasi aktif!`, 'success');
    },
    undefined,
    (err) => {
      hideLoading();
      console.error(err);
      showToast('Gagal mengunduh model sampel.', 'error');
    }
  );
}

function loadGlbFromFile(file) {
  if (!file) return;

  const name = file.name.toLowerCase();
  if (!name.endsWith('.glb') && !name.endsWith('.gltf')) {
    showToast('Harap pilih file dengan format .glb atau .gltf', 'error');
    return;
  }

  showLoading(`Membaca file "${file.name}"...`);

  const reader = new FileReader();
  reader.onload = (e) => {
    const buffer = e.target.result;
    const loader = new GLTFLoader();
    loader.parse(
      buffer,
      '',
      (gltf) => {
        applyModel(gltf, file.name);
        hideLoading();
        showToast(`Model kustom "${file.name}" siap!`, 'success');
      },
      (err) => {
        hideLoading();
        console.error(err);
        showToast('Format GLB rusak / tidak valid.', 'error');
      }
    );
  };
  reader.readAsArrayBuffer(file);
}

function applyModel(gltf, displayName) {
  const sceneObj = gltf.scene;

  // Bersihkan model lama
  while (previewGroup.children.length > 2) {
    previewGroup.remove(previewGroup.children[previewGroup.children.length - 1]);
  }
  while (arGroup.children.length > 0) {
    arGroup.remove(arGroup.children[0]);
  }

  // Aktifkan bayangan
  sceneObj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Normalisasi ukuran & atur dasar model pas di Y=0 (lantai)
  const box = new THREE.Box3().setFromObject(sceneObj);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  const targetDim = 0.45;
  const baseScale = targetDim / (maxDim || 1);

  const center = box.getCenter(new THREE.Vector3());
  sceneObj.position.x = -center.x;
  sceneObj.position.y = -box.min.y;
  sceneObj.position.z = -center.z;

  const wrapper = new THREE.Group();
  wrapper.add(sceneObj);
  wrapper.scale.setScalar(baseScale * currentScale);
  wrapper.userData.gltf = gltf;

  modelTemplate = wrapper;

  // Masukkan ke preview biasa
  previewGroup.add(modelTemplate.clone());

  // Jalankan animasi pada model preview
  setupAnimations(gltf, previewGroup.children[previewGroup.children.length - 1]);

  modelName.textContent = displayName;
}

// =============================================================================
// 8. Event Listeners UI
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initEngine();

  // Buka Kamera HP Langsung
  btnOpenCamera.addEventListener('click', startCamera);

  // Tutup Kamera
  btnCloseCamera.addEventListener('click', stopCamera);

  // Reposisi / Pindah Posisi
  btnReposition.addEventListener('click', repositionModel);

  // Dropdown Pilih Animasi Karakter (Saat Kamera & Preview)
  previewAnimSelect.addEventListener('change', (e) => {
    playAnimationByIndex(parseInt(e.target.value));
  });

  arAnimSelect.addEventListener('change', (e) => {
    playAnimationByIndex(parseInt(e.target.value));
  });

  // Upload Custom GLB
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadGlbFromFile(file);
    fileInput.value = '';
  });

  // Drag and drop GLB
  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropOverlay.classList.add('active');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropOverlay.classList.remove('active');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      loadGlbFromFile(files[0]);
    }
  });

  // Preset Selector
  presetSelect.addEventListener('change', (e) => {
    const url = e.target.value;
    const label = e.target.options[e.target.selectedIndex].text;
    loadGlbFromUrl(url, label);
  });

  // Putar Otomatis Toggle (Preview)
  btnRotate.addEventListener('click', () => {
    autoRotate = !autoRotate;
    btnRotate.classList.toggle('active', autoRotate);
  });

  // Reset Kamera View
  btnReset.addEventListener('click', () => {
    camera.position.set(0, 1.2, 1.8);
    camera.rotation.set(0, 0, 0);
    controls.target.set(0, 0.4, 0);
    controls.update();
    if (previewGroup) previewGroup.rotation.y = 0;
    showToast('Kamera direset', 'info');
  });

  // Slider Ukuran (Skala)
  scaleRange.addEventListener('input', (e) => {
    currentScale = parseFloat(e.target.value);
    scaleLabel.textContent = `${currentScale.toFixed(1)}x`;

    if (modelTemplate) {
      const box = new THREE.Box3().setFromObject(modelTemplate.children[0]);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const baseScale = 0.45 / (maxDim || 1);

      if (previewGroup.children.length > 2) {
        previewGroup.children[2].scale.setScalar(baseScale * currentScale);
      }
      if (arGroup.children.length > 0) {
        arGroup.children[0].scale.setScalar(baseScale * currentScale);
      }
    }
  });
});

// Toast Helper
function showToast(msg, type = 'info', duration = 3000) {
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}
