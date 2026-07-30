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
  const themeBtns = document.querySelectorAll('.theme-btn');
  const cameraFrame = document.getElementById('camera-frame');
  const hintEl = document.querySelector('.hint');

  let stream = null;
  let currentTheme = 'classic';
  let capturedImageData = null;
  let cameraReady = false;
  const CANVAS_W = 900;
  const CANVAS_H = 1200;

  // ─── Camera ───────────────────────────────────────────────

  async function startCamera() {
    if (cameraReady) return;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('API de câmera não suportada neste navegador.');
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1440 } },
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

  // ─── Iniciar câmera no primeiro toque ─────────────────────

  cameraFrame.addEventListener('click', startCamera, { once: false });
  captureBtn.addEventListener('click', function () {
    if (!cameraReady) { startCamera(); return; }
    capture();
  });

  // ─── Theme Selection ──────────────────────────────────────

  themeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      themeBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentTheme = btn.dataset.theme;
    });
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

    ctx.save();
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, vw, vh);
    ctx.restore();

    capturedImageData = tempCanvas;
    processImage(capturedImageData);
  }

  // ─── Processing ───────────────────────────────────────────

  function processImage(sourceCanvas) {
    loadingOverlay.classList.remove('hidden');

    setTimeout(function () {
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      var ctx = canvas.getContext('2d');

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

      switch (currentTheme) {
        case 'classic': applyClassicTheme(ctx); break;
        case 'champion': applyChampionTheme(ctx); break;
        case 'pitstop': applyPitStopTheme(ctx); break;
      }

      loadingOverlay.classList.add('hidden');
      showResult();
    }, 300);
  }

  // ─── Theme: Classic ───────────────────────────────────────

  function applyClassicTheme(ctx) {
    addCheckeredFlag(ctx, 0, CANVAS_H - 160, CANVAS_W, 160);
    addFinishLine(ctx);
    addRacingStripes(ctx);
    addRaceNumber(ctx, Math.floor(Math.random() * 99) + 1);
    addSpeedLines(ctx);
    addGradientVignette(ctx);
  }

  function addCheckeredFlag(ctx, x, y, w, h) {
    var size = 20;
    for (var row = 0; row < Math.ceil(h / size); row++) {
      for (var col = 0; col < Math.ceil(w / size); col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#1a1a1a';
        ctx.fillRect(x + col * size, y + row * size, size, size);
      }
    }
    ctx.fillStyle = '#e10600';
    ctx.fillRect(x, y + h - 8, w, 8);
  }

  function addFinishLine(ctx) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px "Impact","Arial Black",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var text = 'FINISH LINE';
    var tx = CANVAS_W / 2;
    var ty = CANVAS_H - 80;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillText(text, tx, ty);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#e10600';
    ctx.lineWidth = 4;
    ctx.strokeText(text, tx, ty);
    ctx.restore();
  }

  function addRacingStripes(ctx) {
    ctx.save();
    var stripeW = 40;
    var gap = 30;
    for (var x = -stripeW; x < CANVAS_W + stripeW; x += stripeW + gap) {
      ctx.fillStyle = 'rgba(225,6,0,0.35)';
      ctx.fillRect(x, 0, stripeW, CANVAS_H * 0.5);
    }
    ctx.restore();
  }

  function addRaceNumber(ctx, num) {
    ctx.save();
    var size = 80;
    var px = CANVAS_W - 60;
    var py = 100;
    var padding = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, px - size / 2 - padding, py - size / 2 - padding, size + padding * 2, size + padding * 2, 10);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold ' + size + 'px "Arial Black",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num).padStart(2, '0'), px, py + 2);
    ctx.fillStyle = '#e10600';
    ctx.font = 'bold ' + (size * 0.95) + 'px "Arial Black",sans-serif';
    ctx.fillText(String(num).padStart(2, '0'), px, py);
    ctx.restore();
  }

  function addSpeedLines(ctx) {
    ctx.save();
    for (var i = 0; i < 30; i++) {
      var x = Math.random() * CANVAS_W;
      var y = Math.random() * CANVAS_H;
      var len = 40 + Math.random() * 80;
      var alpha = 0.08 + Math.random() * 0.12;
      ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
      ctx.lineWidth = 2 + Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + len * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function addGradientVignette(ctx) {
    var grad = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.2, CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.8);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // ─── Theme: Champion ──────────────────────────────────────

  function applyChampionTheme(ctx) {
    addGoldOverlay(ctx);
    addTrophy(ctx);
    addChampionText(ctx);
    addConfetti(ctx);
    addGradientVignette(ctx);
  }

  function addGoldOverlay(ctx) {
    var grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    grad.addColorStop(0, 'rgba(255,215,0,0.08)');
    grad.addColorStop(0.5, 'rgba(255,215,0,0.15)');
    grad.addColorStop(1, 'rgba(255,215,0,0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function addTrophy(ctx) {
    ctx.save();
    var cx = CANVAS_W / 2;
    var cy = 140;
    ctx.shadowColor = 'rgba(255,215,0,0.6)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffec80';
    ctx.beginPath();
    ctx.arc(cx - 8, cy - 12, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.arc(cx + 8, cy - 12, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#daa520';
    ctx.fillRect(cx - 12, cy + 35, 24, 40);
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(cx - 30, cy + 70, 60, 12);
    ctx.fillRect(cx - 20, cy + 82, 40, 10);
    ctx.restore();
  }

  function addChampionText(ctx) {
    ctx.save();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 64px "Impact","Arial Black",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillText('CAMPEÃO', CANVAS_W / 2, CANVAS_H - 80);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 3;
    ctx.strokeText('CAMPEÃO', CANVAS_W / 2, CANVAS_H - 80);
    ctx.restore();
  }

  function addConfetti(ctx) {
    var colors = ['#ffd700', '#e10600', '#ffffff', '#ff6b6b', '#ffd93d'];
    for (var i = 0; i < 60; i++) {
      var x = Math.random() * CANVAS_W;
      var y = Math.random() * CANVAS_H;
      var w = 6 + Math.random() * 10;
      var h = 4 + Math.random() * 8;
      var angle = Math.random() * Math.PI;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.globalAlpha = 0.5 + Math.random() * 0.4;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  // ─── Theme: Pit Stop ──────────────────────────────────────

  function applyPitStopTheme(ctx) {
    addPitBoard(ctx);
    addTireMarks(ctx);
    addPitText(ctx);
    addSpeedDial(ctx);
    addGradientVignette(ctx);
  }

  function addPitBoard(ctx) {
    ctx.save();
    var bx = 40, by = 40, bw = 280, bh = 180;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, bx, by, bw, bh, 8);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#e10600';
    ctx.lineWidth = 4;
    roundRect(ctx, bx, by, bw, bh, 8);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var lines = ['PIT STOP', '', 'T  +' + Math.floor(Math.random() * 5) + '.' + Math.floor(Math.random() * 9) + 's', 'FR: OK  RR: OK', 'RL: OK  FL: OK'];
    lines.forEach(function (line, i) { ctx.fillText(line, bx + bw / 2, by + 28 + i * 30); });
    ctx.restore();
  }

  function addTireMarks(ctx) {
    ctx.save();
    for (var i = 0; i < 5; i++) {
      var startX = Math.random() * CANVAS_W * 0.5 + CANVAS_W * 0.25;
      var startY = CANVAS_H - 200 - Math.random() * 150;
      ctx.strokeStyle = 'rgba(30,30,30,' + (0.15 + Math.random() * 0.15) + ')';
      ctx.lineWidth = 8 + Math.random() * 6;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX + (Math.random() - 0.5) * 120, startY + 80 + Math.random() * 60);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(30,30,30,' + (0.08 + Math.random() * 0.1) + ')';
      ctx.lineWidth = 4 + Math.random() * 3;
      for (var j = 0; j < 6; j++) {
        var tx = startX + (Math.random() - 0.5) * 80;
        var ty = startY + 20 + j * 15;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + (Math.random() - 0.5) * 30, ty + 10 + Math.random() * 10);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function addPitText(ctx) {
    ctx.save();
    ctx.fillStyle = '#e10600';
    ctx.font = 'bold 56px "Impact","Arial Black",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillText('PIT STOP', CANVAS_W / 2, CANVAS_H - 80);
    ctx.restore();
  }

  function addSpeedDial(ctx) {
    ctx.save();
    var cx = CANVAS_W - 90, cy = CANVAS_H - 120, r = 60;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#e10600';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI * 0.8, Math.PI * 0.3);
    ctx.stroke();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI * 0.3, Math.PI * 0.2);
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px "Arial Black",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('' + Math.floor(7000 + Math.random() * 4000), cx, cy + 4);
    ctx.fillStyle = '#e10600';
    ctx.font = 'bold 12px Arial,sans-serif';
    ctx.fillText('RPM', cx, cy + 30);
    ctx.restore();
  }

  // ─── Helpers ─────────────────────────────────────────────

  function roundRect(ctx, x, y, w, h, r) {
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
    var link = document.createElement('a');
    link.download = 'foto-corrida.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // ─── Share ───────────────────────────────────────────────

  shareBtn.addEventListener('click', async function () {
    try {
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
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

  // ─── Retake ──────────────────────────────────────────────

  retakeBtn.addEventListener('click', function () {
    capturedImageData = null;
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
