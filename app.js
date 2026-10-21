/**
 * WebAR Studio - Client Controller
 * Menggunakan Google <model-viewer> (Framework resmi standar Web/Google untuk 3D & WebAR)
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const modelViewer = document.getElementById("ar-viewer");
  const fileInput = document.getElementById("glb-file-input");
  const dropZone = document.getElementById("drop-zone");
  const dropOverlay = document.getElementById("drop-overlay");
  const modelNameEl = document.getElementById("model-name");
  const modelSizeEl = document.getElementById("model-size");
  const progressBar = document.getElementById("progress-bar");
  const progressContainer = document.getElementById("progress-container");
  const toast = document.getElementById("toast");
  const arLaunchBtn = document.getElementById("ar-launch-btn");
  
  // Controls
  const btnToggleRotate = document.getElementById("btn-toggle-rotate");
  const btnResetView = document.getElementById("btn-reset-view");
  const presetSelector = document.getElementById("preset-selector");
  const placementRadios = document.querySelectorAll('input[name="placement"]');
  const shadowSlider = document.getElementById("shadow-slider");
  const exposureSlider = document.getElementById("exposure-slider");

  // Modal
  const btnInfo = document.getElementById("btn-info");
  const infoModal = document.getElementById("info-modal");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnModalOk = document.getElementById("btn-modal-ok");

  // State
  let currentBlobUrl = null;
  let toastTimeout = null;

  // -------------------------------------------------------------------------
  // 1. Toast Notification Helper
  // -------------------------------------------------------------------------
  function showToast(message, type = "info", duration = 3500) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
  }

  // Helper format ukuran file
  function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return "";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `(${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]})`;
  }

  // -------------------------------------------------------------------------
  // 2. Custom GLB Loading Logic
  // -------------------------------------------------------------------------
  function loadGlbFile(file) {
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".glb") && !fileName.endsWith(".gltf")) {
      showToast("Harap pilih file dengan format .glb atau .gltf", "error");
      return;
    }

    // Revoke URL blob sebelumnya untuk mencegah memory leak
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
    }

    // Buat Object URL untuk file lokal
    currentBlobUrl = URL.createObjectURL(file);

    // Update Model Viewer
    modelViewer.src = currentBlobUrl;
    modelViewer.alt = `Model: ${file.name}`;

    // Update UI Badge
    modelNameEl.textContent = file.name;
    modelSizeEl.textContent = formatBytes(file.size);

    showToast(`Memuat "${file.name}"...`, "info");
  }

  // File Input Handler
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      loadGlbFile(file);
    }
    // Reset file input agar bisa upload file yang sama jika diperlukan
    fileInput.value = "";
  });

  // -------------------------------------------------------------------------
  // 3. Drag and Drop Support
  // -------------------------------------------------------------------------
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropOverlay.classList.add("active");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropOverlay.classList.remove("active");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      loadGlbFile(files[0]);
    }
  });

  // -------------------------------------------------------------------------
  // 4. Model-Viewer Events & Progress Handling
  // -------------------------------------------------------------------------
  modelViewer.addEventListener("progress", (event) => {
    const progress = event.detail.totalProgress;
    progressContainer.style.display = "block";
    progressBar.style.width = `${progress * 100}%`;
  });

  modelViewer.addEventListener("load", () => {
    progressContainer.style.display = "none";
    progressBar.style.width = "0%";
    showToast("Model 3D berhasil dimuat!", "success");

    // Periksa kapabilitas AR
    if (!modelViewer.canActivateAR) {
      // Perangkat desktop / browser tanpa dukungan AR langsung
      arLaunchBtn.title = "AR memerlukan browser mobile yang mendukung WebXR (Android Chrome / iOS Safari)";
    }
  });

  modelViewer.addEventListener("error", (err) => {
    progressContainer.style.display = "none";
    console.error("Gagal memuat model 3D:", err);
    showToast("Gagal memuat file 3D. Pastikan format GLB/glTF valid.", "error");
  });

  // Handler jika user mengklik tombol AR di desktop (memberikan instruksi jelas)
  arLaunchBtn.addEventListener("click", () => {
    if (!modelViewer.canActivateAR) {
      showToast("Kamera AR memerlukan smartphone (Android/iOS) dengan Chrome/Safari.", "info", 5000);
    }
  });

  // -------------------------------------------------------------------------
  // 5. Preset Model Selection
  // -------------------------------------------------------------------------
  presetSelector.addEventListener("change", (e) => {
    const selectedUrl = e.target.value;
    const selectedLabel = e.target.options[e.target.selectedIndex].text;

    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }

    modelViewer.src = selectedUrl;
    modelNameEl.textContent = `${selectedLabel} (Model Sampel)`;
    modelSizeEl.textContent = "";
    showToast(`Memuat ${selectedLabel}...`, "info");
  });

  // -------------------------------------------------------------------------
  // 6. Interactive Controls
  // -------------------------------------------------------------------------
  // Toggle Putar Otomatis
  btnToggleRotate.addEventListener("click", () => {
    const isRotating = modelViewer.hasAttribute("auto-rotate");
    if (isRotating) {
      modelViewer.removeAttribute("auto-rotate");
      btnToggleRotate.classList.remove("active");
    } else {
      modelViewer.setAttribute("auto-rotate", "");
      btnToggleRotate.classList.add("active");
    }
  });

  // Reset Sudut Kamera
  btnResetView.addEventListener("click", () => {
    modelViewer.cameraOrbit = "0deg 75deg 105%";
    modelViewer.cameraTarget = "auto auto auto";
    modelViewer.fieldOfView = "auto";
    showToast("Kamera direset", "info");
  });

  // Penempatan AR (Lantai / Dinding)
  placementRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const placement = e.target.value;
      modelViewer.setAttribute("ar-placement", placement);
      showToast(`Penempatan AR: ${placement === "wall" ? "Dinding" : "Lantai/Meja"}`, "info");
    });
  });

  // Slider Intensitas Bayangan
  shadowSlider.addEventListener("input", (e) => {
    modelViewer.setAttribute("shadow-intensity", e.target.value);
  });

  // Slider Exposure (Pencahayaan)
  exposureSlider.addEventListener("input", (e) => {
    modelViewer.setAttribute("exposure", e.target.value);
  });

  // -------------------------------------------------------------------------
  // 7. Modal Panduan AR
  // -------------------------------------------------------------------------
  const openModal = () => infoModal.classList.add("active");
  const closeModal = () => infoModal.classList.remove("active");

  btnInfo.addEventListener("click", openModal);
  btnCloseModal.addEventListener("click", closeModal);
  btnModalOk.addEventListener("click", closeModal);

  infoModal.addEventListener("click", (e) => {
    if (e.target === infoModal) closeModal();
  });
});
