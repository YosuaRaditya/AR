/**
 * WebAR Studio - Engine Kamera AR & 3D Viewer
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

// State Kamera AR
let isCameraActive = false;
let isModelPlaced = false;
let mediaStream = null;

// DOM Elements
const canvas = document.getElementById('webgl-canvas');
const cameraFeed = document.getElementById('camera-feed');
const fileInput = document.getElementById('glb-file-input');
const dropZone = document.getElementById('drop-zone');
const dropOverlay = document.getElementById('drop-overlay');
const modelName = document.getElementById('model-name');
const modelBadge = document.getElementById('model-badge');
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
  // 1. Scene
  scene = new THREE.Scene();

  // 2. Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 30);
  camera.position.set(0, 1.2, 1.8);

  // 3. Renderer Transparan
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true, // Memungkinkan video kamera di belakang terlihat
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0); // Background canvas bening

  // 4. Orbit Controls (Untuk mode preview 3D)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0.4, 0);
  controls.maxPolarAngle = Math.PI / 2 + 0.1;
  controls.update();

  // 5. Pencahayaan
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(2, 4, 2);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  // 6. Group Preview 3D (Grid & Bayangan)
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

  // 7. Group AR (Tempat objek saat kamera aktif)
  arGroup = new THREE.Group();
  scene.add(arGroup);

  // Touch & Drag Interaction
  setupTouchControls();

  // Resize handler
  window.addEventListener('resize', onWindowResize);

  // Render Loop
  renderer.setAnimationLoop(renderLoop);

  // Muat model awal
  loadGlbFromUrl(presetSelect.value, 'Astronaut');
}

// =============================================================================
// 2. Buka & Tutup Kamera HP (WebRTC Universal)
// =============================================================================
async function startCamera() {
  try {
    // 1. Panggil izin kamera browser secara langsung (seperti di laptop)
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
    } catch (e1) {
      console.warn('Gagal buka kamera belakang ideal, coba kamera standar...', e1);
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    }

    mediaStream = stream;
    cameraFeed.srcObject = stream;
    cameraFeed.classList.add('active');

    // Pastikan video mulai berjalan
    await cameraFeed.play();

    isCameraActive = true;
    isModelPlaced = false;

    // 2. Alihkan Tampilan UI ke Mode Kamera AR
    previewGroup.visible = false; // Sembunyikan grid lantai abu-abu
    previewPanel.classList.add('hidden');
    btnOpenCamera.classList.add('hidden');
    modelBadge.classList.add('hidden');

    arReticle.classList.remove('hidden'); // Tampilkan cincin bidik
    arInstructionBar.classList.remove('hidden');
    arControlsBar.classList.remove('hidden');
    btnReposition.classList.add('hidden');

    arInstructionIcon.textContent = '📍';
    arInstructionText.textContent = 'Arahkan kamera & ketuk layar untuk meletakkan model 3D';

    // Posisikan kamera 3D tetap menghadap lurus
    controls.enabled = false;
    camera.position.set(0, 0, 1.2);
    camera.lookAt(0, 0, 0);

    // Bersihkan objek AR sebelumnya jika ada
    while (arGroup.children.length > 0) {
      arGroup.remove(arGroup.children[0]);
    }

    showToast('Kamera aktif! Arahkan & ketuk layar untuk menaruh objek.', 'success');
  } catch (err) {
    console.error('Kamera gagal dibuka:', err);
    showToast('Izin kamera ditolak pada browser.', 'error', 4000);
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
  controls.target.set(0, 0.4, 0);
  controls.update();

  showToast('Kamera ditutup', 'info');
}

// =============================================================================
// 3. Menempatkan Model (Tap to Place) & Geser Putar
// =============================================================================
function placeModel() {
  if (!modelTemplate || !isCameraActive) return;

  if (!arGroup.children.length) {
    const clone = modelTemplate.clone();
    arGroup.add(clone);
  }

  const model = arGroup.children[0];
  // Posisikan tepat di tengah kamera agak ke bawah di lantai
  model.position.set(0, -0.28, -1.05);
  model.rotation.set(0, 0, 0);
  model.visible = true;

  isModelPlaced = true;

  // Sembunyikan cincin target, tampilkan tombol reposisi
  arReticle.classList.add('hidden');
  btnReposition.classList.remove('hidden');

  arInstructionIcon.textContent = '✅';
  arInstructionText.textContent = 'Model berhasil diletakkan! Sentuh & geser untuk memutar.';
  showToast('Model 3D berhasil diletakkan!', 'success');
}

function repositionModel() {
  if (!isCameraActive) return;

  isModelPlaced = false;

  if (arGroup.children.length > 0) {
    arGroup.children[0].visible = false;
  }

  // Munculkan kembali cincin target
  arReticle.classList.remove('hidden');
  btnReposition.classList.add('hidden');

  arInstructionIcon.textContent = '📍';
  arInstructionText.textContent = 'Arahkan kamera & ketuk layar di lokasi baru.';
  showToast('Arahkan kamera & ketuk layar untuk meletakkan ulang', 'info');
}

function setupTouchControls() {
  let touchStartX = 0;
  let isDragging = false;

  // Klik / Tap layar untuk meletakkan objek
  canvas.addEventListener('click', () => {
    if (isCameraActive && !isModelPlaced) {
      placeModel();
    }
  });

  // Gestur geser horizontal untuk memutar objek saat sudah diletakkan
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
// 4. Render Loop Animasi
// =============================================================================
function renderLoop() {
  if (!isCameraActive) {
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
// 5. Muat Model GLB (Custom Upload & Sampel)
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
      applyModel(gltf.scene, `${label} (Model Bawaan)`);
      hideLoading();
      showToast(`Model "${label}" siap!`, 'success');
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
        applyModel(gltf.scene, file.name);
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

function applyModel(sceneObj, displayName) {
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
  sceneObj.position.y = -box.min.y; // dasar model pas di lantai
  sceneObj.position.z = -center.z;

  const wrapper = new THREE.Group();
  wrapper.add(sceneObj);
  wrapper.scale.setScalar(baseScale * currentScale);

  modelTemplate = wrapper;

  // Masukkan clone ke preview biasa
  previewGroup.add(modelTemplate.clone());

  modelName.textContent = displayName;
}

// =============================================================================
// 6. Event Listeners UI
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initEngine();

  // Buka Kamera HP Langsung
  btnOpenCamera.addEventListener('click', startCamera);

  // Tutup Kamera
  btnCloseCamera.addEventListener('click', stopCamera);

  // Reposisi / Pindah Posisi
  btnReposition.addEventListener('click', repositionModel);

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
