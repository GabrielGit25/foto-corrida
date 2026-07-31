(function () {
  'use strict';

  const video = document.getElementById('video');
  const canvas = document.getElementById('result-canvas');
  const captureBtn = document.getElementById('capture-btn');
  const downloadBtn = document.getElementById('download-btn');
  const shareBtn = document.getElementById('share-btn');
  const retakeBtn = document.getElementById('retake-btn');
  const cameraView = document.getElementById('camera-view');
  const resultView = document.getElementById('result-view');
  const loadingOverlay = document.getElementById('loading-overlay');
  const cameraFrame = document.getElementById('camera-frame');
  const hintEl = document.querySelector('.hint');
  const flipBtn = document.getElementById('flip-btn');
  const stickerBtn = document.getElementById('sticker-btn');
  const stickerTray = document.getElementById('sticker-tray');
  const stickerClose = document.getElementById('sticker-close');
  const stickerGrid = document.getElementById('sticker-grid');
  const stickerLayer = document.getElementById('result-sticker-layer');

  let stream = null;
  let capturedImageData = null;
  let cameraReady = false;
  let facingMode = 'user';
  const CANVAS_W = 900;
  const CANVAS_H = 1200;

  // Identidade visual Librelon Em Movimento
  const C = {
    gold: '#f8b808',
    goldLight: '#f8d828',
    goldMedium: '#e88808',
    goldDark: '#d87808',
    navy: '#082868',
    navyDark: '#061f4d',
    white: '#f8f8f8',
  };

  // Adicione aqui o nome das suas figurinhas (arquivos .png em /stickers)
  const STICKERS = [
    'freepik.png',
    'sticker1.png',
    'sticker2.png',
    'sticker3.png',
    'sticker4.png',
    'sticker5.png',
    'sticker6.png',
    'sticker7.png',
    'sticker8.png',
  ];

  // Banner da campanha (usado no tema Julho Amarelo)
  const heroImg = new Image();
  heroImg.src = 'assets/hero-julho-amarelo.png';

  // ─── Figurinhas ──────────────────────────────────────────
  const stickers = [];
  let stickerId = 0;

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function loadStickerImages() {
    return Promise.all(
      stickers.map(function (s) {
        if (s.img.complete && s.img.naturalWidth) return Promise.resolve();
        return new Promise(function (resolve) {
          s.img.addEventListener('load', resolve, { once: true });
          s.img.addEventListener('error', resolve, { once: true });
        });
      })
    );
  }

  function loadHeroImage() {
    if (heroImg.complete && heroImg.naturalWidth) return Promise.resolve();
    return new Promise(function (resolve) {
      heroImg.addEventListener('load', resolve, { once: true });
      heroImg.addEventListener('error', resolve, { once: true });
    });
  }

  function updateStickerEl(s) {
    const basePx = s.sizeFrac * stickerLayer.clientWidth;
    const px = basePx * s.scale;
    const aspect = s.aspect || 1;
    s.el.style.left = s.x * 100 + '%';
    s.el.style.top = s.y * 100 + '%';
    s.el.style.width = px + 'px';
    s.el.style.height = px * aspect + 'px';
    s.el.style.transform =
      'translate(-50%, -50%) rotate(' + (s.rot * 180) / Math.PI + 'deg)';
  }

  function selectSticker(s) {
    stickers.forEach(function (st) {
      st.el.classList.toggle('selected', st === s);
    });
  }

  function addSticker(src) {
    const el = document.createElement('div');
    el.className = 'sticker-el';
    el.innerHTML =
      '<img src="' +
      src +
      '" draggable="false" alt="">' +
      '<button class="sticker-del" aria-label="Remover figurinha">✕</button>' +
      '<button class="sticker-handle" aria-label="Redimensionar">↗</button>';
    const img = el.querySelector('img');
    const s = {
      id: 'sticker-' + stickerId++,
      src: src,
      x: 0.5,
      y: 0.42,
      scale: 1,
      rot: 0,
      sizeFrac: 0.24,
      aspect: 1,
      el: el,
      img: img,
    };
    img.addEventListener('load', function () {
      if (img.naturalHeight) s.aspect = img.naturalHeight / img.naturalWidth;
      updateStickerEl(s);
    });
    stickers.push(s);
    stickerLayer.appendChild(el);
    selectSticker(s);
    bindStickerEvents(s);
    updateStickerEl(s);
  }

  function removeSticker(s) {
    const i = stickers.indexOf(s);
    if (i !== -1) stickers.splice(i, 1);
    if (s.el.parentNode) s.el.parentNode.removeChild(s.el);
  }

  function clearStickers() {
    stickers.slice().forEach(function (s) { removeSticker(s); });
  }

  function bindStickerEvents(s) {
    const el = s.el;
    const del = el.querySelector('.sticker-del');
    const handle = el.querySelector('.sticker-handle');
    const pointers = new Map();

    del.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      removeSticker(s);
    });

    handle.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      selectSticker(s);
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      s.mode = 'resize';
      const frame = stickerLayer.getBoundingClientRect();
      const cx = frame.left + s.x * frame.width;
      const cy = frame.top + s.y * frame.height;
      s.startScale = s.scale;
      s.startRot = s.rot;
      s.startDist = Math.hypot(e.clientX - cx, e.clientY - cy);
      s.startAng = Math.atan2(e.clientY - cy, e.clientX - cx);
    });

    el.addEventListener('pointerdown', function (e) {
      if (e.target !== el) return;
      e.preventDefault();
      selectSticker(s);
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        s.startScale = s.scale;
        s.startRot = s.rot;
        s.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        s.startAng = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      } else {
        s.mode = 'drag';
      }
    });

    el.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const frame = stickerLayer.getBoundingClientRect();

      if (pointers.size === 1) {
        const p = Array.from(pointers.values())[0];
        if (s.mode === 'drag') {
          s.x = clamp((p.x - frame.left) / frame.width, 0, 1);
          s.y = clamp((p.y - frame.top) / frame.height, 0, 1);
        } else if (s.mode === 'resize') {
          const cx = frame.left + s.x * frame.width;
          const cy = frame.top + s.y * frame.height;
          const dist = Math.hypot(p.x - cx, p.y - cy);
          const ang = Math.atan2(p.y - cy, p.x - cx);
          s.scale = clamp((s.startScale * dist) / s.startDist, 0.25, 4);
          s.rot = s.startRot + (ang - s.startAng);
        }
      } else {
        const pts = Array.from(pointers.values());
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const a = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
        if (s.startDist) {
          s.scale = clamp((s.startScale * d) / s.startDist, 0.25, 4);
          s.rot = s.startRot + (a - s.startAng);
        }
      }
      updateStickerEl(s);
    });

    function release(e) {
      if (pointers.has(e.pointerId)) pointers.delete(e.pointerId);
      if (pointers.size === 0) s.mode = null;
    }
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  // ─── Bandeja de figurinhas ──────────────────────────────

  function openTray() {
    stickerTray.classList.add('open');
    stickerBtn.classList.add('active');
  }

  function closeTray() {
    stickerTray.classList.remove('open');
    stickerBtn.classList.remove('active');
  }

  stickerBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    stickerTray.classList.contains('open') ? closeTray() : openTray();
  });

  stickerClose.addEventListener('click', closeTray);

  STICKERS.forEach(function (file) {
    const btn = document.createElement('button');
    btn.className = 'sticker-opt';
    btn.title = 'Adicionar figurinha';
    const img = document.createElement('img');
    img.src = 'stickers/' + file;
    img.alt = 'Figurinha';
    img.draggable = false;
    btn.appendChild(img);
    btn.addEventListener('click', function () {
      addSticker(img.src);
      closeTray();
    });
    stickerGrid.appendChild(btn);
  });

  // Clique fora da figurinha desmarca a seleção
  stickerLayer.addEventListener('pointerdown', function (e) {
    if (e.target === stickerLayer) selectSticker(null);
  });

  // ─── Camera ─────────────────────────────────────────────

  async function startCamera() {
    if (cameraReady) return;
    try {
      if (!window.isSecureContext) {
        throw new Error('Contexto inseguro: acesse via https:// ou http://localhost para usar a câmera.');
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('API de câmera não suportada neste navegador.');
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      cameraReady = true;
      cameraFrame.classList.add('camera-active');
      captureBtn.classList.add('ready');
      hintEl.textContent = 'Toque para capturar sua selfie';
    } catch (err) {
      console.error(err);
      if (facingMode === 'environment') {
        facingMode = 'user';
        startCamera();
        return;
      }
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Permissão da câmera negada. Permita o acesso nos ajustes do navegador.');
      } else if (err.name === 'NotFoundError') {
        alert('Nenhuma câmera encontrada neste dispositivo.');
      } else {
        alert('Não foi possível acessar a câmera: ' + err.message);
      }
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    cameraReady = false;
    cameraFrame.classList.remove('camera-active');
    captureBtn.classList.remove('ready');
  }

  flipBtn.addEventListener('click', async function (e) {
    e.stopPropagation();
    const hadCamera = cameraReady;
    stopCamera();
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    if (hadCamera) await startCamera();
  });

  // ─── Iniciar câmera no primeiro toque ─────────────────────

  cameraFrame.addEventListener('click', startCamera, { once: false });
  captureBtn.addEventListener('click', function () {
    if (!cameraReady) { startCamera(); return; }
    capture();
  });

  // ─── Capture ──────────────────────────────────────────────

  function capture() {
    var vw = video.videoWidth;
    var vh = video.videoHeight;
    if (!vw || !vh) return;

    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = vw;
    tempCanvas.height = vh;
    var ctx = tempCanvas.getContext('2d');

    if (facingMode === 'user') {
      ctx.save();
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, vw, vh);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, vw, vh);
    }

    capturedImageData = tempCanvas;
    processImage(capturedImageData);
  }

  // ─── Processing ───────────────────────────────────────────

  function drawBaseTo(ctx, sourceCanvas) {
    var sw = sourceCanvas.width;
    var sh = sourceCanvas.height;
    var srcAspect = sw / sh;
    var dstAspect = CANVAS_W / CANVAS_H;
    var sx, sy, sWidth, sHeight;

    if (srcAspect > dstAspect) {
      sHeight = sh;
      sWidth = sh * dstAspect;
      sx = (sw - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = sw;
      sHeight = sw / dstAspect;
      sx = 0;
      sy = (sh - sHeight) / 2;
    }

    ctx.drawImage(sourceCanvas, sx, sy, sWidth, sHeight, 0, 0, CANVAS_W, CANVAS_H);
    applyJulhoTheme(ctx);
  }

  function drawStickersTo(ctx) {
    stickers.forEach(function (s) {
      if (!s.img.complete || !s.img.naturalWidth) return;
      var w = s.sizeFrac * CANVAS_W * s.scale;
      var h = w * (s.img.naturalHeight / s.img.naturalWidth);
      ctx.save();
      ctx.translate(s.x * CANVAS_W, s.y * CANVAS_H);
      ctx.rotate(s.rot);
      ctx.drawImage(s.img, -w / 2, -h / 2, w, h);
      ctx.restore();
    });
  }

  function processImage(sourceCanvas) {
    loadingOverlay.classList.remove('hidden');
    closeTray();
    clearStickers();

    loadHeroImage().then(function () {
      setTimeout(function () {
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        var ctx = canvas.getContext('2d');
        drawBaseTo(ctx, sourceCanvas);
        loadingOverlay.classList.add('hidden');
        showResult();
      }, 300);
    });
  }

  function renderFinal() {
    var finalCanvas = document.createElement('canvas');
    finalCanvas.width = CANVAS_W;
    finalCanvas.height = CANVAS_H;
    var ctx = finalCanvas.getContext('2d');
    drawBaseTo(ctx, capturedImageData);
    return loadStickerImages().then(function () {
      drawStickersTo(ctx);
      return finalCanvas;
    });
  }

  // ─── Tema — Identidade Librelon Em Movimento ───────────

  function goldGradient(ctx, x, y, w, h) {
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, C.goldLight);
    g.addColorStop(0.5, C.gold);
    g.addColorStop(1, C.goldDark);
    return g;
  }

  function addNavyOverlay(ctx, alpha) {
    ctx.fillStyle = 'rgba(6,31,77,' + (alpha || 0.35) + ')';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function addGoldLine(ctx, x, y, w, h) {
    ctx.fillStyle = goldGradient(ctx, x, y, w, h);
    ctx.fillRect(x, y, w, h);
  }

  function addGoldOrnaments(ctx) {
    ctx.save();
    for (var i = 0; i < 26; i++) {
      var x = Math.random() * CANVAS_W;
      var y = Math.random() * CANVAS_H;
      var s = 6 + Math.random() * 14;
      ctx.fillStyle = goldGradient(ctx, x - s, y - s, s * 2, s * 2);
      ctx.globalAlpha = 0.2 + Math.random() * 0.35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.restore();
  }

  // ─── Tema: Julho Amarelo ───────────────────────────────

  function applyJulhoTheme(ctx) {
    addNavyOverlay(ctx, 0.2);
    addGoldOrnaments(ctx);
    addHeroBanner(ctx);
    addPhotoFrame(ctx);
  }

  function addHeroBanner(ctx) {
    if (!heroImg.complete || !heroImg.naturalWidth) return;
    var h = Math.round((CANVAS_W * heroImg.naturalHeight) / heroImg.naturalWidth);
    ctx.drawImage(heroImg, 0, CANVAS_H - h, CANVAS_W, h);
  }

  function addPhotoFrame(ctx) {
    var b = 24;
    ctx.fillStyle = C.navyDark;
    ctx.fillRect(0, 0, CANVAS_W, b);
    ctx.fillRect(0, CANVAS_H - b, CANVAS_W, b);
    ctx.fillRect(0, 0, b, CANVAS_H);
    ctx.fillRect(CANVAS_W - b, 0, b, CANVAS_H);
    addGoldLine(ctx, 0, b, CANVAS_W, 5);
    addGoldLine(ctx, 0, CANVAS_H - b - 5, CANVAS_W, 5);
    addGoldLine(ctx, b, 0, 5, CANVAS_H);
    addGoldLine(ctx, CANVAS_W - b - 5, 0, 5, CANVAS_H);
    addRoundedGoldBorder(ctx);
  }

  function addRoundedGoldBorder(ctx) {
    ctx.save();
    roundRectPath(ctx, 1, 1, CANVAS_W - 2, CANVAS_H - 2, 32);
    ctx.strokeStyle = goldGradient(ctx, 0, 0, CANVAS_W, CANVAS_H);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ─── View Switching ──────────────────────────────────────

  function showResult() {
    cameraView.classList.remove('active');
    resultView.classList.add('active');
  }

  function showCamera() {
    resultView.classList.remove('active');
    cameraView.classList.add('active');
  }

  // ─── Download ─────────────────────────────────────────────

  downloadBtn.addEventListener('click', function () {
    renderFinal().then(function (finalCanvas) {
      var link = document.createElement('a');
      link.download = 'foto-corrida.png';
      link.href = finalCanvas.toDataURL('image/png');
      link.click();
    });
  });

  // ─── Share ───────────────────────────────────────────────

  shareBtn.addEventListener('click', function () {
    renderFinal().then(async function (finalCanvas) {
      try {
        var blob = await new Promise(function (resolve) { finalCanvas.toBlob(resolve, 'image/png'); });
        if (navigator.share) {
          await navigator.share({
            title: 'Foto Corrida',
            text: 'Transformei minha selfie em foto de corrida!',
            files: [new File([blob], 'foto-corrida.png', { type: 'image/png' })],
          });
        } else {
          var link = document.createElement('a');
          link.download = 'foto-corrida.png';
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    });
  });

  // ─── Retake ──────────────────────────────────────────────

  retakeBtn.addEventListener('click', function () {
    capturedImageData = null;
    clearStickers();
    closeTray();
    showCamera();
  });

  // ─── Instalação PWA ─────────────────────────────────────

  var installPrompt = null;
  var installBtn = document.getElementById('install-btn');

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installPrompt = e;
    installBtn.classList.remove('hidden');
  });

  installBtn.addEventListener('click', async function () {
    if (!installPrompt) return;
    installPrompt.prompt();
    var result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') installBtn.classList.add('hidden');
    installPrompt = null;
  });

  window.addEventListener('appinstalled', function () {
    installBtn.classList.add('hidden');
    installPrompt = null;
  });

  // ─── Service Worker ──────────────────────────────────────

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }

})();
