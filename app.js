/**
 * WebAR Studio - Hit-Test Tap to Place & Custom GLB Controller
 * Berbasis Three.js (Standar WebXR Device API resmi W3C & Google)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =============================================================================
// State & Variabel Global
// =============================================================================
let scene, camera, renderer, controls;
let previewGroup, arGroup, reticle;
let modelTemplate = null; // Node 3D template dari file GLB
let modelBoundingBox = null;
let currentScale = 1.0;

// WebXR Hit-Test State
let xrSession = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let isModelPlaced = false;
let isRepositioning = false;
let isArSupported = false;

// DOM Elements
const canvas = document.getElementById('webgl-canvas');
const fileInput = document.getElementById('glb-file-input');
const dropZone = document.getElementById('drop-zone');
const dropOverlay = document.getElementById('drop-overlay');
const modelNameEl = document.getElementById('model-name');
const modelSizeEl = document.getElementById('model-size');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const toast = document.getElementById('toast');
const btnStartAr = document.getElementById('btn-start-ar');
const btnToggleRotate = document.getElementById('btn-toggle-rotate');
const btnResetView = document.getElementById('btn-reset-view');
const presetSelector = document.getElementById('preset-selector');
const scaleSlider = document.getElementById('scale-slider');
const scaleValue = document.getElementById('scale-value');
const previewControls = document.getElementById('preview-controls');
const securityWarning = document.getElementById('security-warning');
const btnFixHttps = document.getElementById('btn-fix-https');
const xrStatusPill = document.getElementById('xr-status-pill');
const xrStatusText = document.getElementById('xr-status-text');

// AR DOM Overlay Elements
const arOverlay = document.getElementById('ar-overlay');
const arInstructionText = document.getElementById('ar-instruction-text');
const arInstructionIcon = document.getElementById('ar-instruction-icon');
const arTapPrompt = document.getElementById('ar-tap-prompt');
const btnRepositionAr = document.getElementById('btn-reposition-ar');
const btnExitAr = document.getElementById('btn-exit-ar');

// Phone Modal Elements
const btnPhoneGuide = document.getElementById('btn-phone-guide');
const phoneModal = document.getElementById('phone-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnModalOk = document.getElementById('btn-modal-ok');
const qrCodeImg = document.getElementById('qr-code-img');
const currentUrlText = document.getElementById('current-url-text');

let autoRotate = true;
let toastTimeout = null;

// =============================================================================
// 1. Inisialisasi Three.js Engine & WebXR
// =============================================================================
function initEngine() {
  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
  camera.position.set(0, 1.2, 1.8);

  // Renderer dengan dukungan WebXR
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true, // Transparan untuk camera feed di AR
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true; // Aktifkan WebXR

  // Orbit Controls (Mode Preview Desktop/Mobile)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0.4, 0);
  controls.maxPolarAngle = Math.PI / 2 + 0.1; // Jangan tembus ke bawah lantai
  controls.update();

  // Pencahayaan
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(2, 4, 2);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 10;
  scene.add(dirLight);

  // Group Kontainer Objek
  previewGroup = new THREE.Group();
  scene.add(previewGroup);

  // Ground Grid & Shadow Receiver untuk mode preview
  const gridHelper = new THREE.GridHelper(10, 20, 0x3b82f6, 0x1e293b);
  gridHelper.position.y = 0;
  previewGroup.add(gridHelper);

  const shadowPlaneGeo = new THREE.PlaneGeometry(10, 10);
  const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.3 });
  const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.receiveShadow = true;
  previewGroup.add(shadowPlane);

  // Group AR (Tempat objek AR saat ditempatkan)
  arGroup = new THREE.Group();
  scene.add(arGroup);

  // Buat Target Cincin (Reticle) untuk Hit-Testing
  buildReticle();

  // Controller WebXR (Untuk menangkap Tap Layar di AR)
  const controller = renderer.xr.getController(0);
  controller.addEventListener('select', onArTap);
  scene.add(controller);

  // Event Listeners Jendela
  window.addEventListener('resize', onWindowResize);

  // Mulai Loop Render
  renderer.setAnimationLoop(render);

  // Cek Keamanan Konteks (HTTPS / Localhost) & Kapabilitas WebXR
  checkSecurityAndWebXR();

  // Muat Model Bawaan Awal
  loadGlbFromUrl(presetSelector.value, 'Astronaut');
}

// =============================================================================
// 2. Pembuatan Reticle (Cincin Penanda Bidang Datar)
// =============================================================================
function buildReticle() {
  const reticleGroup = new THREE.Group();

  // Cincin Luar
  const ringGeo = new THREE.RingGeometry(0.12, 0.14, 32).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    side: THREE.DoubleSide
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  reticleGroup.add(ringMesh);

  // Titik Pusat
  const dotGeo = new THREE.CircleGeometry(0.02, 16).rotateX(-Math.PI / 2);
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    side: THREE.DoubleSide
  });
  const dotMesh = new THREE.Mesh(dotGeo, dotMat);
  reticleGroup.add(dotMesh);

  reticle = reticleGroup;
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
}

// =============================================================================
// 3. Pengecekan Keamanan HTTPS & Dukungan WebXR AR
// =============================================================================
async function checkSecurityAndWebXR() {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isHttps = window.location.protocol === 'https:';
  const isSecureContext = window.isSecureContext || isLocalhost;

  // Jika dibuka lewat IP lokal (http://192.168.x.x) di HP, browser akan memblokir kamera
  if (!isSecureContext && !isLocalhost) {
    securityWarning.classList.remove('hidden');
    xrStatusPill.className = 'status-pill status-warn';
    xrStatusText.textContent = 'HTTP (Kamera Diblokir)';
  }

  // Cek ketersediaan WebXR
  if ('xr' in navigator) {
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      isArSupported = supported;
      if (supported) {
        xrStatusPill.className = 'status-pill status-ok';
        xrStatusText.textContent = 'Kamera AR Siap';
        btnStartAr.classList.remove('disabled');
      } else {
        xrStatusPill.className = 'status-pill status-warn';
        xrStatusText.textContent = 'AR Butuh HP';
      }
    } catch (e) {
      console.warn('Gagal cek immersive-ar:', e);
      xrStatusPill.className = 'status-pill status-warn';
      xrStatusText.textContent = 'AR Butuh HP';
    }
  } else {
    xrStatusPill.className = 'status-pill status-warn';
    xrStatusText.textContent = 'Buka di Chrome HP';
  }

  // Setup QR code untuk link saat ini
  setupQrCode();
}

function setupQrCode() {
  const currentUrl = window.location.href;
  currentUrlText.textContent = currentUrl;
  qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`;
}

// =============================================================================
// 4. Manajemen & Pemuatan Model GLB (Custom File & Presets)
// =============================================================================
function showLoading(text) {
  loadingText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// Muat dari URL Preset
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

// Muat dari File Input Lokal (Custom GLB)
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
        showToast(`Model "${file.name}" siap digunakan di AR!`, 'success');
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

// Normalisasi & Tempatkan Model ke Scene
function applyLoadedModel(modelScene, name, sizeInBytes) {
  // Bersihkan model lama
  while (previewGroup.children.length > 2) { // sisakan grid & shadowPlane
    previewGroup.remove(previewGroup.children[previewGroup.children.length - 1]);
  }
  while (arGroup.children.length > 0) {
    arGroup.remove(arGroup.children[0]);
  }

  // Aktifkan bayangan untuk semua mesh di model
  modelScene.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  // Hitung Bounding Box asli untuk normalisasi ukuran
  const box = new THREE.Box3().setFromObject(modelScene);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Normalisasi agar tinggi/lebar objek standar di dunia nyata (~0.4 meter = 40cm)
  const targetDimension = 0.45;
  const baseScale = targetDimension / (maxDim || 1);

  // Buat pivot agar bagian paling bawah objek persis di y=0 (di atas lantai)
  // dan di tengah (center x dan z)
  const center = box.getCenter(new THREE.Vector3());
  modelScene.position.x = -center.x;
  modelScene.position.y = -box.min.y; // dasar model pas di lantai!
  modelScene.position.z = -center.z;

  // Bungkus dalam wrapper group
  const normalizedWrapper = new THREE.Group();
  normalizedWrapper.add(modelScene);
  normalizedWrapper.scale.setScalar(baseScale * currentScale);

  modelTemplate = normalizedWrapper;

  // Masukkan clone ke mode preview 3D
  const previewClone = modelTemplate.clone();
  previewGroup.add(previewClone);

  // Reset status AR
  isModelPlaced = false;
  isRepositioning = false;

  // Update UI Badge
  modelNameEl.textContent = name;
  modelSizeEl.textContent = sizeInBytes ? formatBytes(sizeInBytes) : '';
}

// =============================================================================
// 5. Logika Hit-Testing & Tap to Place WebXR
// =============================================================================
async function startArSession() {
  // Jika perangkat tidak mendukung WebXR secara langsung (misal desktop)
  if (!navigator.xr || !isArSupported) {
    phoneModal.classList.add('active');
    return;
  }

  try {
    showLoading('Menghubungkan ke kamera AR...');
    
    // Minta sesi immersive-ar dengan fitur hit-test & DOM Overlay
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: arOverlay }
    });

    xrSession = session;
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);

    hideLoading();

    // Masuk ke Mode AR: Tampilkan overlay AR, sembunyikan preview
    previewGroup.visible = false;
    arOverlay.classList.remove('hidden');
    previewControls.classList.add('hidden');
    btnStartAr.parentElement.classList.add('hidden');

    isModelPlaced = false;
    isRepositioning = false;
    reticle.visible = false;

    // Bersihkan objek AR sebelumnya jika ada
    while (arGroup.children.length > 0) {
      arGroup.remove(arGroup.children[0]);
    }

    arInstructionIcon.textContent = '🔍';
    arInstructionText.textContent = 'Arahkan kamera ke lantai / meja datar...';
    arTapPrompt.classList.add('hidden');
    btnRepositionAr.classList.add('hidden');

    session.addEventListener('end', onArSessionEnded);
  } catch (err) {
    hideLoading();
    console.error('Gagal memulai sesi AR:', err);
    showToast('Kamera AR gagal dibuka: ' + err.message, 'error', 5000);
    phoneModal.classList.add('active');
  }
}

// Callback saat layar diketuk (Tap) di dalam mode AR
function onArTap() {
  if (!xrSession) return;

  // Jika reticle sedang mendeteksi lantai dan model belum ditempatkan (atau sedang reposisi)
  if (reticle.visible && modelTemplate && (!isModelPlaced || isRepositioning)) {
    placeModelAtReticle();
  }
}

// Meletakkan model 3D di koordinat cincin reticle
function placeModelAtReticle() {
  if (!arGroup.children.length) {
    const arModel = modelTemplate.clone();
    arGroup.add(arModel);
  }

  const modelInAr = arGroup.children[0];

  // Ekstrak posisi dan rotasi dari matriks reticle
  modelInAr.position.setFromMatrixPosition(reticle.matrix);

  // Arahkan model agar menghadap ke arah kamera pengguna saat pertama kali diletakkan
  const camPos = new THREE.Vector3();
  camera.getWorldPosition(camPos);
  modelInAr.lookAt(camPos.x, modelInAr.position.y, camPos.z);

  modelInAr.visible = true;
  isModelPlaced = true;
  isRepositioning = false;

  // Sembunyikan reticle dan prompt tap
  reticle.visible = false;
  arTapPrompt.classList.add('hidden');
  btnRepositionAr.classList.remove('hidden');

  arInstructionIcon.textContent = '✅';
  arInstructionText.textContent = 'Model diletakkan! Anda bisa berjalan mengelilinginya.';
  showToast('Model 3D berhasil ditempatkan!', 'success', 2500);
}

// Sesi AR Berakhir
function onArSessionEnded() {
  xrSession = null;
  hitTestSource = null;
  hitTestSourceRequested = false;

  // Kembalikan UI ke mode 3D Preview
  previewGroup.visible = true;
  arOverlay.classList.add('hidden');
  previewControls.classList.remove('hidden');
  btnStartAr.parentElement.classList.remove('hidden');

  while (arGroup.children.length > 0) {
    arGroup.remove(arGroup.children[0]);
  }

  reticle.visible = false;
  isModelPlaced = false;
  isRepositioning = false;
}

// =============================================================================
// 6. Loop Render Animasi & Hit-Test Processing
// =============================================================================
function render(timestamp, frame) {
  // Jika sedang dalam sesi WebXR Kamera AR
  if (frame) {
    const session = frame.session;
    const referenceSpace = renderer.xr.getReferenceSpace();

    // 1. Minta Hit-Test Source sekali saat sesi mulai
    if (!hitTestSourceRequested) {
      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
        });
      });
      hitTestSourceRequested = true;
    }

    // 2. Baca hasil hit-test jika objek belum diletakkan atau sedang mode reposisi
    if (hitTestSource && (!isModelPlaced || isRepositioning)) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);

        // Bidang datar terdeteksi di dunia nyata!
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);

        arTapPrompt.classList.remove('hidden');
        arInstructionIcon.textContent = '📍';
        arInstructionText.textContent = 'Permukaan ditemukan! Ketuk layar untuk meletakkan.';
      } else {
        // Belum menemukan bidang datar
        reticle.visible = false;
        arTapPrompt.classList.add('hidden');
        arInstructionIcon.textContent = '🔍';
        arInstructionText.textContent = 'Arahkan kamera ke lantai & gerakkan perlahan...';
      }
    } else {
      reticle.visible = false;
    }
  } else {
    // Mode 3D Preview Desktop / Non-AR
    if (autoRotate && previewGroup) {
      previewGroup.rotation.y += 0.005;
    }
    controls.update();
  }

  renderer.render(scene, camera);
}

// Resize Canvas
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// =============================================================================
// 7. Event Handlers & Kontrol UI
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initEngine();

  // Tombol Mulai AR
  btnStartAr.addEventListener('click', startArSession);

  // Tombol Keluar AR
  btnExitAr.addEventListener('click', () => {
    if (xrSession) xrSession.end();
  });

  // Tombol Reposisi / Pindah Posisi AR
  btnRepositionAr.addEventListener('click', () => {
    isRepositioning = true;
    reticle.visible = true;
    btnRepositionAr.classList.add('hidden');
    arInstructionIcon.textContent = '📍';
    arInstructionText.textContent = 'Arahkan kamera ke posisi baru, lalu ketuk layar.';
    showToast('Arahkan cincin ke lokasi baru & ketuk layar', 'info');
  });

  // Upload Custom GLB via Tombol
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadGlbFromFile(file);
    fileInput.value = '';
  });

  // Drag and Drop GLB ke Layar
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

  // Pilihan Preset Model
  presetSelector.addEventListener('change', (e) => {
    const url = e.target.value;
    const label = e.target.options[e.target.selectedIndex].text;
    loadGlbFromUrl(url, label);
  });

  // Toggle Rotasi Otomatis (Preview Mode)
  btnToggleRotate.addEventListener('click', () => {
    autoRotate = !autoRotate;
    btnToggleRotate.classList.toggle('active', autoRotate);
  });

  // Reset Kamera View
  btnResetView.addEventListener('click', () => {
    camera.position.set(0, 1.2, 1.8);
    controls.target.set(0, 0.4, 0);
    controls.update();
    if (previewGroup) previewGroup.rotation.y = 0;
    showToast('Posisi kamera direset', 'info');
  });

  // Slider Skala Model
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

  // Modal Panduan Buka di Smartphone
  const openModal = () => phoneModal.classList.add('active');
  const closeModal = () => phoneModal.classList.remove('active');

  btnPhoneGuide.addEventListener('click', openModal);
  btnFixHttps.addEventListener('click', openModal);
  btnCloseModal.addEventListener('click', closeModal);
  btnModalOk.addEventListener('click', closeModal);
  phoneModal.addEventListener('click', (e) => {
    if (e.target === phoneModal) closeModal();
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
