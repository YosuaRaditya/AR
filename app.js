/**
 * WebAR Studio - Universal Camera & Hit-Test AR Controller
 * Mendukung 100% perangkat smartphone (Android Chrome, iPhone Safari, Tablet, PC)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =============================================================================
// State & Variabel Global
// =============================================================================
let scene, camera, renderer, controls;
let previewGroup, arGroup, reticle3D;
let modelTemplate = null;
let currentScale = 1.0;

// AR State
let arMode = null; // 'webxr' | 'camera' | null
let xrSession = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let isModelPlaced = false;
let isRepositioning = false;
let isWebXRSupported = false;
let videoStream = null;

// DOM Elements
const canvas = document.getElementById('webgl-canvas');
const videoFeed = document.getElementById('camera-video-feed');
const viewerWrapper = document.getElementById('drop-zone');
const fileInput = document.getElementById('glb-file-input');
const dropZone = document.getElementById('drop-zone');
const dropOverlay = document.getElementById('drop-overlay');
const modelNameEl = document.getElementById('model-name');
const modelSizeEl = document.getElementById('model-size');
const modelInfoBadge = document.getElementById('model-info-badge');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const toast = document.getElementById('toast');
const ctaContainer = document.getElementById('cta-container');
const btnStartAr = document.getElementById('btn-start-ar');
const btnToggleRotate = document.getElementById('btn-toggle-rotate');
const btnResetView = document.getElementById('btn-reset-view');
const presetSelector = document.getElementById('preset-selector');
const scaleSlider = document.getElementById('scale-slider');
const scaleValue = document.getElementById('scale-value');
const previewControls = document.getElementById('preview-controls');
const webviewWarning = document.getElementById('webview-warning');
const cameraStatusPill = document.getElementById('camera-status-pill');
const cameraStatusText = document.getElementById('camera-status-text');

// AR DOM Overlay Elements
const arOverlay = document.getElementById('ar-overlay');
const arInstructionText = document.getElementById('ar-instruction-text');
const arInstructionIcon = document.getElementById('ar-instruction-icon');
const screenReticle = document.getElementById('screen-reticle');
const btnRepositionAr = document.getElementById('btn-reposition-ar');
const btnExitAr = document.getElementById('btn-exit-ar');

// Info Modal Elements
const btnPhoneGuide = document.getElementById('btn-phone-guide');
const infoModal = document.getElementById('info-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnModalOk = document.getElementById('btn-modal-ok');
const deviceInfoText = document.getElementById('device-info-text');

let autoRotate = true;
let toastTimeout = null;

// =============================================================================
// 1. Inisialisasi Three.js Engine
// =============================================================================
function initEngine() {
  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 30);
  camera.position.set(0, 1.2, 1.8);

  // Renderer dengan Canvas Transparan
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true, // Memungkinkan video feed terlihat di belakang canvas
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0); // 100% transparan
  renderer.xr.enabled = true;

  // Orbit Controls (Khusus mode 3D Preview)
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

  // Ground Grid & Shadow Receiver
  const gridHelper = new THREE.GridHelper(10, 20, 0x3b82f6, 0x1e293b);
  previewGroup.add(gridHelper);

  const shadowPlaneGeo = new THREE.PlaneGeometry(10, 10);
  const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.3 });
  const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.receiveShadow = true;
  previewGroup.add(shadowPlane);

  // Group AR (Objek saat ditempatkan di kamera)
  arGroup = new THREE.Group();
  scene.add(arGroup);

  // Reticle 3D (Untuk WebXR Hit-Test)
  build3DReticle();

  // WebXR Controller Event (Tap di mode WebXR)
  const controller = renderer.xr.getController(0);
  controller.addEventListener('select', onWebXRTap);
  scene.add(controller);

  // Event Listener Touch / Click untuk Mode Kamera Universal
  setupTouchInteractions();

  window.addEventListener('resize', onWindowResize);

  // Mulai Loop Render
  renderer.setAnimationLoop(render);

  // Periksa dukungan WebXR & Kamera
  checkCameraCapabilities();

  // Muat Model Bawaan
  loadGlbFromUrl(presetSelector.value, 'Astronaut');
}

// =============================================================================
// 2. Pembuatan Reticle 3D (WebXR)
// =============================================================================
function build3DReticle() {
  const group = new THREE.Group();

  const ringGeo = new THREE.RingGeometry(0.12, 0.14, 32).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ringGeo, ringMat));

  const dotGeo = new THREE.CircleGeometry(0.02, 16).rotateX(-Math.PI / 2);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x34d399, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(dotGeo, dotMat));

  reticle3D = group;
  reticle3D.matrixAutoUpdate = false;
  reticle3D.visible = false;
  scene.add(reticle3D);
}

// =============================================================================
// 3. Pengecekan Kapabilitas Kamera & Perangkat
// =============================================================================
async function checkCameraCapabilities() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isInApp = /FBAN|FBAV|Instagram|WhatsApp|Line|Telegram|MicroMessenger/i.test(ua);

  if (isInApp) {
    webviewWarning.classList.remove('hidden');
  }

  // Cek WebXR (Android Chrome dengan ARCore)
  if ('xr' in navigator) {
    try {
      isWebXRSupported = await navigator.xr.isSessionSupported('immersive-ar');
    } catch (e) {
      isWebXRSupported = false;
    }
  }

  cameraStatusPill.className = 'status-pill status-ok';
  cameraStatusText.textContent = isWebXRSupported ? 'WebXR AR Siap' : 'Kamera Siap';

  const os = isIOS ? 'Apple iOS (iPhone/iPad)' : isAndroid ? 'Android' : 'Komputer/Laptop';
  const mode = isWebXRSupported ? 'WebXR ARCore (Hit-Test Lantai)' : 'Kamera Langsung Universal (WebRTC)';
  deviceInfoText.innerHTML = `
    Sistem Operasi: <strong>${os}</strong><br/>
    Mode Kamera: <strong>${mode}</strong><br/>
    Akses: <strong>${window.isSecureContext ? 'HTTPS (Aman ✅)' : 'HTTP ⚠️'}</strong>
  `;
}

// =============================================================================
// 4. Buka Kamera AR (Anti-Gagal: WebXR -> Fallback Kamera Langsung)
// =============================================================================
async function startArExperience() {
  if (isWebXRSupported) {
    try {
      await launchWebXR();
      return;
    } catch (err) {
      console.warn('WebXR gagal, langsung beralih ke Kamera Langsung:', err);
    }
  }

  // Fallback Universal: Nyalakan kamera HP langsung
  await launchCameraDirect();
}

// Mode 1: WebXR Hit-Test
async function launchWebXR() {
  showLoading('Membuka kamera WebXR...');
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: arOverlay }
  });

  xrSession = session;
  arMode = 'webxr';
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);

  hideLoading();
  activateArUI();

  session.addEventListener('end', closeArExperience);
}

// Mode 2: Universal Camera Video Stream (100% Work di iPhone & Android)
async function launchCameraDirect() {
  showLoading('Mengaktifkan kamera HP...');

  let stream = null;

  // Coba kamera belakang secara bertahap
  const options = [
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
    { video: true, audio: false }
  ];

  for (const opt of options) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(opt);
      if (stream) break;
    } catch (e) {
      console.warn('Opsi kamera gagal, mencoba opsi berikutnya...', e);
    }
  }

  if (!stream) {
    hideLoading();
    showToast('Kamera tidak dapat diakses. Pastikan izin kamera sudah diaktifkan.', 'error', 5000);
    infoModal.classList.add('active');
    return;
  }

  videoStream = stream;
  videoFeed.srcObject = stream;
  videoFeed.setAttribute('playsinline', '');
  videoFeed.setAttribute('webkit-playsinline', '');
  videoFeed.muted = true;

  try {
    await videoFeed.play();
  } catch (err) {
    console.warn('video.play() warning:', err);
  }

  arMode = 'camera';
  hideLoading();

  // Tampilkan video di background dan buat canvas transparan
  document.body.classList.add('camera-active');
  viewerWrapper.classList.add('camera-mode');
  videoFeed.classList.remove('hidden');

  // Nonaktifkan OrbitControls dan posisikan kamera 3D
  controls.enabled = false;
  camera.position.set(0, 0, 1.2);
  camera.lookAt(0, 0, 0);

  activateArUI();
  screenReticle.classList.remove('hidden');
  showToast('Kamera aktif! Ketuk layar untuk menempatkan objek', 'info', 3000);
}

// Aktifkan Tampilan Layar AR
function activateArUI() {
  previewGroup.visible = false;
  arOverlay.classList.remove('hidden');
  previewControls.classList.add('hidden');
  ctaContainer.classList.add('hidden');
  modelInfoBadge.classList.add('hidden');

  isModelPlaced = false;
  isRepositioning = false;

  arInstructionIcon.textContent = '📍';
  arInstructionText.textContent = 'Arahkan kamera & ketuk layar untuk meletakkan model 3D';
  btnRepositionAr.classList.add('hidden');

  // Bersihkan objek AR lama
  while (arGroup.children.length > 0) {
    arGroup.remove(arGroup.children[0]);
  }
}

// Tutup Mode AR
function closeArExperience() {
  if (xrSession) {
    xrSession.end();
    xrSession = null;
  }

  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
    videoStream = null;
  }
  videoFeed.classList.add('hidden');
  videoFeed.srcObject = null;

  document.body.classList.remove('camera-active');
  viewerWrapper.classList.remove('camera-mode');

  arMode = null;
  hitTestSource = null;
  hitTestSourceRequested = false;

  controls.enabled = true;
  camera.position.set(0, 1.2, 1.8);
  controls.target.set(0, 0.4, 0);
  controls.update();

  previewGroup.visible = true;
  arOverlay.classList.add('hidden');
  screenReticle.classList.add('hidden');
  previewControls.classList.remove('hidden');
  ctaContainer.classList.remove('hidden');
  modelInfoBadge.classList.remove('hidden');

  while (arGroup.children.length > 0) {
    arGroup.remove(arGroup.children[0]);
  }

  isModelPlaced = false;
  isRepositioning = false;
}

// =============================================================================
// 5. Interaksi Tap Layar (Menempatkan & Menggeser Model 3D)
// =============================================================================
function setupTouchInteractions() {
  let touchStartX = 0;
  let isDragging = false;

  // Tap di mode Kamera Langsung (Universal)
  canvas.addEventListener('click', (e) => {
    if (arMode !== 'camera') return;

    if (!isModelPlaced || isRepositioning) {
      placeModelInCamera();
    }
  });

  // Gestur sentuh untuk memutar model saat sudah diletakkan
  canvas.addEventListener('touchstart', (e) => {
    if (arMode === 'camera' && e.touches.length === 1) {
      isDragging = true;
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (arMode === 'camera' && isDragging && isModelPlaced && arGroup.children.length > 0) {
      const deltaX = e.touches[0].clientX - touchStartX;
      arGroup.children[0].rotation.y += deltaX * 0.012;
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    isDragging = false;
  });
}

// Tempatkan Model di Mode Kamera Langsung
function placeModelInCamera() {
  if (!modelTemplate) return;

  if (!arGroup.children.length) {
    const clone = modelTemplate.clone();
    arGroup.add(clone);
  }

  const model = arGroup.children[0];
  // Posisikan tepat di depan kamera pengguna, sedikit di bawah pandangan
  model.position.set(0, -0.28, -1.1);
  model.rotation.set(0, 0, 0);
  model.visible = true;

  isModelPlaced = true;
  isRepositioning = false;

  screenReticle.classList.add('hidden');
  btnRepositionAr.classList.remove('hidden');

  arInstructionIcon.textContent = '✅';
  arInstructionText.textContent = 'Model berhasil diletakkan! Sentuh & geser untuk memutar.';
  showToast('Model 3D berhasil diletakkan!', 'success');
}

// Tap di Mode WebXR
function onWebXRTap() {
  if (arMode !== 'webxr' || !reticle3D.visible || !modelTemplate) return;

  if (!isModelPlaced || isRepositioning) {
    if (!arGroup.children.length) {
      arGroup.add(modelTemplate.clone());
    }

    const model = arGroup.children[0];
    model.position.setFromMatrixPosition(reticle3D.matrix);

    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    model.lookAt(camPos.x, model.position.y, camPos.z);

    model.visible = true;
    isModelPlaced = true;
    isRepositioning = false;

    reticle3D.visible = false;
    btnRepositionAr.classList.remove('hidden');

    arInstructionIcon.textContent = '✅';
    arInstructionText.textContent = 'Model diletakkan! Anda bisa mengelilinginya.';
    showToast('Model diletakkan di lantai!', 'success');
  }
}

// =============================================================================
// 6. Loop Render Animasi & Hit-Test
// =============================================================================
function render(timestamp, frame) {
  if (arMode === 'webxr' && frame) {
    const session = frame.session;
    const refSpace = renderer.xr.getReferenceSpace();

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((src) => {
          hitTestSource = src;
        });
      });
      hitTestSourceRequested = true;
    }

    if (hitTestSource && (!isModelPlaced || isRepositioning)) {
      const results = frame.getHitTestResults(hitTestSource);
      if (results.length > 0) {
        const pose = results[0].getPose(refSpace);
        reticle3D.visible = true;
        reticle3D.matrix.fromArray(pose.transform.matrix);
        arInstructionIcon.textContent = '📍';
        arInstructionText.textContent = 'Lantai terdeteksi! Ketuk layar untuk menempatkan.';
      } else {
        reticle3D.visible = false;
        arInstructionIcon.textContent = '🔍';
        arInstructionText.textContent = 'Arahkan kamera ke lantai / meja datar...';
      }
    } else {
      reticle3D.visible = false;
    }
  } else if (arMode === 'camera') {
    // Mode Kamera Langsung
  } else {
    // Mode 3D Preview Desktop
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
// 7. Pemuatan & Manajemen File GLB
// =============================================================================
function showLoading(text) {
  loadingText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

function loadGlbFromUrl(url, label) {
  showLoading(`Mengunduh ${label}...`);
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      applyLoadedModel(gltf.scene, `${label} (Sampel)`, null);
      hideLoading();
      showToast(`Model "${label}" berhasil dimuat!`, 'success');
    },
    undefined,
    (error) => {
      hideLoading();
      console.error('Error load GLB:', error);
      showToast('Gagal mengunduh model sampel.', 'error');
    }
  );
}

function loadGlbFromFile(file) {
  if (!file) return;

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.glb') && !fileName.endsWith('.gltf')) {
    showToast('Harap pilih file dengan format .glb atau .gltf', 'error');
    return;
  }

  showLoading(`Membaca file "${file.name}"...`);

  const reader = new FileReader();
  reader.onload = (e) => {
    const arrayBuffer = e.target.result;
    const loader = new GLTFLoader();
    loader.parse(
      arrayBuffer,
      '',
      (gltf) => {
        applyLoadedModel(gltf.scene, file.name, file.size);
        hideLoading();
        showToast(`Model "${file.name}" siap di AR!`, 'success');
      },
      (error) => {
        hideLoading();
        console.error('Gagal parsing GLB:', error);
        showToast('Format GLB tidak valid / rusak.', 'error');
      }
    );
  };
  reader.onerror = () => {
    hideLoading();
    showToast('Gagal membaca file dari perangkat.', 'error');
  };
  reader.readAsArrayBuffer(file);
}

function applyLoadedModel(modelScene, name, sizeInBytes) {
  while (previewGroup.children.length > 2) {
    previewGroup.remove(previewGroup.children[previewGroup.children.length - 1]);
  }
  while (arGroup.children.length > 0) {
    arGroup.remove(arGroup.children[0]);
  }

  modelScene.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(modelScene);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  const targetDimension = 0.45;
  const baseScale = targetDimension / (maxDim || 1);

  const center = box.getCenter(new THREE.Vector3());
  modelScene.position.x = -center.x;
  modelScene.position.y = -box.min.y; // dasar model pas di lantai
  modelScene.position.z = -center.z;

  const normalizedWrapper = new THREE.Group();
  normalizedWrapper.add(modelScene);
  normalizedWrapper.scale.setScalar(baseScale * currentScale);

  modelTemplate = normalizedWrapper;

  const previewClone = modelTemplate.clone();
  previewGroup.add(previewClone);

  isModelPlaced = false;
  isRepositioning = false;

  modelNameEl.textContent = name;
  modelSizeEl.textContent = sizeInBytes ? formatBytes(sizeInBytes) : '';
}

// =============================================================================
// 8. Event Listeners UI
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initEngine();

  // Tombol Buka Kamera AR (Eksekusi Langsung)
  btnStartAr.addEventListener('click', startArExperience);

  // Tombol Tutup Kamera AR
  btnExitAr.addEventListener('click', closeArExperience);

  // Tombol Reposisi
  btnRepositionAr.addEventListener('click', () => {
    isRepositioning = true;
    isModelPlaced = false;
    btnRepositionAr.classList.add('hidden');

    if (arMode === 'camera') {
      if (arGroup.children.length > 0) {
        arGroup.children[0].visible = false;
      }
      screenReticle.classList.remove('hidden');
      arInstructionIcon.textContent = '📍';
      arInstructionText.textContent = 'Arahkan kamera & ketuk layar untuk menempatkan ulang.';
    } else if (arMode === 'webxr') {
      reticle3D.visible = true;
      arInstructionIcon.textContent = '📍';
      arInstructionText.textContent = 'Arahkan cincin ke titik baru, lalu ketuk layar.';
    }

    showToast('Arahkan kamera & ketuk layar untuk meletakkan ulang', 'info');
  });

  // Upload GLB
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadGlbFromFile(file);
    fileInput.value = '';
  });

  // Drag and Drop
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
  presetSelector.addEventListener('change', (e) => {
    const url = e.target.value;
    const label = e.target.options[e.target.selectedIndex].text;
    loadGlbFromUrl(url, label);
  });

  // Toggle Rotasi
  btnToggleRotate.addEventListener('click', () => {
    autoRotate = !autoRotate;
    btnToggleRotate.classList.toggle('active', autoRotate);
  });

  // Reset Kamera
  btnResetView.addEventListener('click', () => {
    camera.position.set(0, 1.2, 1.8);
    controls.target.set(0, 0.4, 0);
    controls.update();
    if (previewGroup) previewGroup.rotation.y = 0;
    showToast('Posisi kamera direset', 'info');
  });

  // Slider Skala
  scaleSlider.addEventListener('input', (e) => {
    currentScale = parseFloat(e.target.value);
    scaleValue.textContent = `${currentScale.toFixed(1)}x`;

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

  // Modal Info
  const openModal = () => infoModal.classList.add('active');
  const closeModal = () => infoModal.classList.remove('active');

  btnPhoneGuide.addEventListener('click', openModal);
  btnCloseModal.addEventListener('click', closeModal);
  btnModalOk.addEventListener('click', closeModal);
  infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) closeModal();
  });
});

// Toast Helper
function showToast(msg, type = 'info', duration = 3500) {
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `(${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]})`;
}
