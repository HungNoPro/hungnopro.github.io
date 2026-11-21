// ============================================================
//  3D ASCII CHRISTMAS TREE ENGINE (Ported from D:\Chrismas.tree)
//  + GENTLE GPU SNOWFALL CANVAS FOR HUNG NO PRO PORTFOLIO
// ============================================================

(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const RAMP = " .,:;-~=+*^oxv%&#W@";

  // Seeded RNG so tree geometry is crisp & deterministic
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function envelope(y) {
    const u = Math.max(0, Math.min(1, (y - -0.76) / (1.24 - -0.76)));
    const tiers = 1.0 + 0.08 * Math.sin(u * TAU * 5.0) * (1.0 - u);
    return 0.96 * Math.pow(1.0 - u, 0.9) * tiers;
  }

  // Build 3D point cloud matching christmas_tree.py
  function buildTreePoints() {
    const rng = mulberry32(20261225);
    const pts = [];

    // 1. Trunk (bark cylinder)
    for (let i = 0; i < 240; i++) {
      const y = -1.12 + rng() * 0.42;
      const ang = rng() * TAU;
      const r = 0.14 + (rng() - 0.5) * 0.025;
      pts.push({
        x: Math.cos(ang) * r,
        y,
        z: Math.sin(ang) * r,
        r: 120 + rng() * 45,
        g: 72 + rng() * 28,
        b: 40 + rng() * 18,
        kind: "trunk",
        phase: rng() * TAU
      });
    }

    // 2. Pine branches (25 whorls + snow tips)
    const whorls = 25;
    for (let w = 0; w < whorls; w++) {
      const u = w / (whorls - 1);
      const yBase = -0.76 + u * 1.98;
      const maxR = envelope(yBase);
      const branches = Math.max(5, Math.round(14 * (1 - u * 0.65)));

      for (let b = 0; b < branches; b++) {
        const bAng = (b / branches) * TAU + w * 0.72 + (rng() - 0.5) * 0.25;
        const steps = Math.max(4, Math.round(9 * (1 - u * 0.55)));
        for (let s = 1; s <= steps; s++) {
          const frac = s / steps;
          const r = maxR * frac * (0.85 + rng() * 0.2);
          const droop = -0.11 * frac * frac * (1 - u * 0.5);
          const jitter = (rng() - 0.5) * 0.04;
          const x = Math.cos(bAng) * r + jitter;
          const z = Math.sin(bAng) * r + jitter;
          const y = yBase + droop + (rng() - 0.5) * 0.03;

          const isSnow = frac > 0.78 && rng() < 0.45;
          if (isSnow) {
            pts.push({
              x,
              y: y + 0.02,
              z,
              r: 222,
              g: 240,
              b: 255,
              kind: "snow",
              phase: rng() * TAU
            });
          } else {
            const shade = 0.55 + frac * 0.45;
            pts.push({
              x,
              y,
              z,
              r: Math.round((24 + rng() * 22) * shade),
              g: Math.round((155 + rng() * 65) * shade),
              b: Math.round((80 + rng() * 35) * shade),
              kind: "needle",
              phase: rng() * TAU
            });
          }
        }
      }
    }

    // 3. Golden Tinsel Garland (3.6 turns spiraling up)
    const tinselCount = 340;
    for (let i = 0; i < tinselCount; i++) {
      const u = i / (tinselCount - 1);
      const y = -0.72 + u * 1.88;
      const r = envelope(y) * 1.03;
      const ang = u * TAU * 3.6;
      const swag = Math.sin(ang * 3) * 0.03;
      pts.push({
        x: Math.cos(ang) * r,
        y: y + swag,
        z: Math.sin(ang) * r,
        r: 255,
        g: 214,
        b: 84,
        kind: "tinsel",
        phase: u * 18
      });
    }

    // 4. Baubles (34 red / gold / silver ornaments)
    const baublePalette = [
      [245, 55, 68],
      [255, 200, 62],
      [220, 232, 250]
    ];
    for (let i = 0; i < 36; i++) {
      const u = 0.08 + rng() * 0.8;
      const y = -0.76 + u * 1.94;
      const r = envelope(y) * 0.96;
      const ang = rng() * TAU;
      const col = baublePalette[i % baublePalette.length];
      pts.push({
        x: Math.cos(ang) * r,
        y,
        z: Math.sin(ang) * r,
        r: col[0],
        g: col[1],
        b: col[2],
        kind: "ball",
        phase: rng() * TAU
      });
    }

    // 5. Twinkling Fairy Lights (150 branch-tip lights)
    const lightPalette = [
      [255, 224, 120],
      [255, 88, 108],
      [84, 240, 175],
      [110, 205, 255]
    ];
    for (let i = 0; i < 150; i++) {
      const u = 0.04 + rng() * 0.9;
      const y = -0.76 + u * 1.96;
      const r = envelope(y) * (0.94 + rng() * 0.12);
      const ang = rng() * TAU;
      const col = lightPalette[i % lightPalette.length];
      pts.push({
        x: Math.cos(ang) * r,
        y,
        z: Math.sin(ang) * r,
        r: col[0],
        g: col[1],
        b: col[2],
        kind: "light",
        phase: rng() * TAU
      });
    }

    // 6. 6 Wrapped 3D Gift Boxes around base
    const giftColors = [
      [235, 58, 68],
      [52, 211, 153],
      [64, 138, 255],
      [250, 198, 56],
      [216, 84, 248],
      [245, 90, 90]
    ];
    for (let g = 0; g < 6; g++) {
      const ang = (g / 6) * TAU + 0.35;
      const dist = 0.62 + (g % 2) * 0.14;
      const cx = Math.cos(ang) * dist;
      const cz = Math.sin(ang) * dist;
      const size = 0.18 + (g % 2) * 0.04;
      const col = giftColors[g];
      for (let i = 0; i < 42; i++) {
        const lx = (rng() - 0.5) * size;
        const ly = rng() * size;
        const lz = (rng() - 0.5) * size;
        const isRibbon = Math.abs(lx) < 0.025 || Math.abs(lz) < 0.025;
        pts.push({
          x: cx + lx,
          y: -1.12 + ly,
          z: cz + lz,
          r: isRibbon ? 255 : col[0],
          g: isRibbon ? 232 : col[1],
          b: isRibbon ? 115 : col[2],
          kind: isRibbon ? "ribbon" : "gift",
          phase: g
        });
      }
    }

    // 7. Top Glowing 5-Point Star
    for (let i = 0; i < 60; i++) {
      const arm = i % 5;
      const frac = (i / 60);
      const a = (arm / 5) * TAU - Math.PI / 2;
      const rad = 0.15 * frac;
      pts.push({
        x: Math.cos(a) * rad,
        y: 1.33 + Math.sin(a) * rad * 0.85,
        z: (rng() - 0.5) * 0.04,
        r: 255,
        g: 235,
        b: 120,
        kind: "star",
        phase: i * 0.4
      });
    }

    return pts;
  }

  // Interactive ASCII Tree Renderer
  function mountAsciiTree(canvas, opts = {}) {
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    const pts = buildTreePoints();
    const isSmall = !!opts.compact;

    let animId = null;
    let running = false;
    let startTime = performance.now();
    let userAngleOffset = 0;
    let dragging = false;
    let lastX = 0;

    // Falling snow particles inside ASCII canvas
    const snow = Array.from({ length: isSmall ? 26 : 55 }, () => ({
      x: Math.random(),
      y: Math.random(),
      v: 0.06 + Math.random() * 0.1,
      drift: (Math.random() - 0.5) * 0.03
    }));

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(260, Math.floor(rect.width));
      const h = Math.max(240, Math.floor(rect.height));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    }

    canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      userAngleOffset += dx * 0.012;
    });
    canvas.addEventListener("pointerup", () => { dragging = false; });
    canvas.addEventListener("pointercancel", () => { dragging = false; });

    function drawFrame(now) {
      if (!running) return;
      const { w, h } = resize();
      const t = (now - startTime) * 0.001;

      // Deep winter night backdrop
      ctx.fillStyle = "#060913";
      ctx.fillRect(0, 0, w, h);

      // Subtle radial glow behind tree
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.44, 10, w * 0.5, h * 0.48, h * 0.52);
      glow.addColorStop(0, "rgba(255, 200, 80, 0.11)");
      glow.addColorStop(0.5, "rgba(22, 163, 74, 0.08)");
      glow.addColorStop(1, "rgba(6, 9, 19, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const cellW = isSmall ? 7 : 8.5;
      const cellH = isSmall ? 11 : 13;
      const cols = Math.floor(w / cellW);
      const rows = Math.floor(h / cellH);

      ctx.font = `700 ${isSmall ? 11 : 13}px "JetBrains Mono", Consolas, monospace`;
      ctx.textBaseline = "top";

      // Draw gentle falling ASCII snow
      ctx.fillStyle = "rgba(180, 210, 255, 0.38)";
      for (let i = 0; i < snow.length; i++) {
        const s = snow[i];
        s.y = (s.y + s.v * 0.016) % 1;
        s.x = (s.x + s.drift * 0.016 + 1) % 1;
        ctx.fillText(i % 3 === 0 ? "*" : ".", s.x * w, s.y * h);
      }

      // Project 3D points into Z-buffered ASCII grid
      const size = cols * rows;
      const zBuf = new Float32Array(size);
      zBuf.fill(-1e9);
      const charBuf = new Array(size);
      const colBuf = new Array(size);

      const angle = t * 0.42 + userAngleOffset;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const camZ = 3.25;
      const scale = Math.min(w, h) * (isSmall ? 0.46 : 0.45);
      const cx = w * 0.5;
      const cy = h * (isSmall ? 0.54 : 0.51);

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const rx = p.x * cosA - p.z * sinA;
        const rz = p.x * sinA + p.z * cosA;
        const ry = p.y;

        const invZ = 1 / (camZ - rz);
        const sx = cx + rx * scale * invZ * 2.15;
        const sy = cy - ry * scale * invZ * 2.05;

        const col = Math.floor(sx / cellW);
        const row = Math.floor(sy / cellH);
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

        const idx = row * cols + col;
        if (rz > zBuf[idx]) {
          zBuf[idx] = rz;

          let lum = Math.max(0.2, Math.min(1, (rz + 1.1) / 2.2));
          let ch = RAMP[Math.min(RAMP.length - 1, Math.floor(lum * (RAMP.length - 1)))];
          let r = p.r, g = p.g, b = p.b;

          if (p.kind === "light") {
            const twinkle = 0.5 + 0.5 * Math.sin(t * 4.5 + p.phase);
            ch = twinkle > 0.65 ? "*" : "+";
            const boost = 0.65 + twinkle * 0.55;
            r = Math.min(255, Math.round(r * boost));
            g = Math.min(255, Math.round(g * boost));
            b = Math.min(255, Math.round(b * boost));
          } else if (p.kind === "star") {
            const pulse = 0.75 + 0.25 * Math.sin(t * 5.2 + p.phase);
            ch = pulse > 0.85 ? "@" : "*";
            r = 255;
            g = Math.round(230 + 25 * pulse);
            b = Math.round(115 + 110 * pulse);
          } else if (p.kind === "ball") {
            ch = "O";
          } else if (p.kind === "tinsel") {
            ch = "~";
          } else if (p.kind === "gift" || p.kind === "ribbon") {
            ch = p.kind === "ribbon" ? "+" : "#";
          }

          charBuf[idx] = ch;
          colBuf[idx] = `rgb(${Math.round(r * (0.45 + 0.55 * lum))},${Math.round(g * (0.45 + 0.55 * lum))},${Math.round(b * (0.45 + 0.55 * lum))})`;
        }
      }

      // Render ASCII characters
      for (let row = 0; row < rows; row++) {
        const yPos = row * cellH;
        const base = row * cols;
        for (let col = 0; col < cols; col++) {
          const ch = charBuf[base + col];
          if (!ch) continue;
          ctx.fillStyle = colBuf[base + col];
          ctx.fillText(ch, col * cellW, yPos);
        }
      }

      // Glowing star halo on top
      const starY = cy - 1.33 * scale * (1 / camZ) * 2.05;
      const starPulse = 0.75 + 0.25 * Math.sin(t * 4);
      const sg = ctx.createRadialGradient(cx, starY, 1, cx, starY, isSmall ? 26 : 38);
      sg.addColorStop(0, `rgba(255, 245, 180, ${0.7 * starPulse})`);
      sg.addColorStop(0.45, `rgba(255, 198, 70, ${0.28 * starPulse})`);
      sg.addColorStop(1, "rgba(255, 198, 70, 0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, starY, isSmall ? 26 : 38, 0, TAU);
      ctx.fill();

      // Holiday greeting line at bottom
      const greeting = "M E R R Y   C H R I S T M A S   2 0 2 6";
      ctx.font = `700 ${isSmall ? 10 : 13}px "JetBrains Mono", monospace`;
      ctx.fillStyle = "rgba(255, 214, 102, 0.92)";
      ctx.textAlign = "center";
      ctx.fillText(greeting, w * 0.5, h - (isSmall ? 18 : 26));
      ctx.textAlign = "left";

      animId = requestAnimationFrame(drawFrame);
    }

    return {
      start() {
        if (running) return;
        running = true;
        animId = requestAnimationFrame(drawFrame);
      },
      stop() {
        running = false;
        if (animId) cancelAnimationFrame(animId);
      },
      reset() {
        startTime = performance.now();
        userAngleOffset = 0;
      }
    };
  }

  // ============================================================
  //  GLOBAL SNOWFALL CANVAS (Lightweight, GPU-friendly, Pauseable)
  // ============================================================
  function initGlobalSnowfall() {
    const canvas = document.getElementById("xmas-snow-canvas");
    if (!canvas) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    const isMobile = window.innerWidth <= 768;
    const count = isMobile ? 34 : 72;
    let w = window.innerWidth;
    let h = window.innerHeight;
    let flakes = [];
    let snowEnabled = true;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    }
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < count; i++) {
      flakes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1 + Math.random() * 2.4,
        vy: 0.45 + Math.random() * 1.1,
        vx: (Math.random() - 0.5) * 0.45,
        phase: Math.random() * TAU,
        alpha: 0.35 + Math.random() * 0.55
      });
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      if (snowEnabled && !document.hidden) {
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < flakes.length; i++) {
          const f = flakes[i];
          f.y += f.vy;
          f.x += f.vx + Math.sin(f.y * 0.01 + f.phase) * 0.35;
          if (f.y > h + 6) {
            f.y = -6;
            f.x = Math.random() * w;
          }
          if (f.x > w + 6) f.x = -6;
          if (f.x < -6) f.x = w + 6;
          ctx.globalAlpha = f.alpha;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Optional toggle button on nav to pause/resume snow on mobile
    const snowBtn = document.getElementById("nav-snow-btn");
    if (snowBtn) {
      snowBtn.classList.add("playing");
      snowBtn.addEventListener("click", () => {
        snowEnabled = !snowEnabled;
        snowBtn.classList.toggle("playing", snowEnabled);
        if (!snowEnabled) ctx.clearRect(0, 0, w, h);
        if (typeof window.showToast === "function") {
          window.showToast(snowEnabled ? "Đã bật tuyết rơi Giáng sinh ❄️" : "Đã tạm tắt tuyết rơi");
        }
      });
    }
  }

  // ============================================================
  //  BOOT: MOUNT CORNER TREE + FULLSCREEN MODAL + TRACK SWITCHER
  // ============================================================
  document.addEventListener("DOMContentLoaded", () => {
    initGlobalSnowfall();

    // 1. Mount preview ASCII tree in Little Corner
    const cornerCanvas = document.getElementById("ascii-tree-canvas");
    const cornerTree = mountAsciiTree(cornerCanvas, { compact: true });
    if (cornerTree) {
      if ("IntersectionObserver" in window) {
        const obs = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) cornerTree.start();
              else cornerTree.stop();
            });
          },
          { threshold: 0.05 }
        );
        obs.observe(cornerCanvas);
      } else {
        cornerTree.start();
      }
    }

    // 2. Fullscreen ASCII Christmas Tree Modal
    const modal = document.getElementById("ascii-tree-modal");
    const modalCanvas = document.getElementById("ascii-tree-modal-canvas");
    const openBtn = document.getElementById("open-tree-modal-btn");
    const closeBtn = document.getElementById("close-tree-modal-btn");
    const resetBtn = document.getElementById("reset-tree-btn");
    let modalTree = null;

    function openTreeModal() {
      if (!modal) return;
      modal.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      if (!modalTree) modalTree = mountAsciiTree(modalCanvas, { compact: false });
      modalTree.start();
    }

    function closeTreeModal() {
      if (!modal) return;
      modal.classList.add("hidden");
      document.body.style.overflow = "";
      if (modalTree) modalTree.stop();
    }

    if (openBtn) openBtn.addEventListener("click", openTreeModal);
    if (closeBtn) closeBtn.addEventListener("click", closeTreeModal);
    if (resetBtn) resetBtn.addEventListener("click", () => modalTree && modalTree.reset());
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeTreeModal();
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) closeTreeModal();
    });

    // 3. Playlist switcher in Vinyl Music Box (Last Christmas / Way Back Home)
    const audio = document.getElementById("bgm-audio");
    const titleEl = document.getElementById("vinyl-track-title");
    const artistEl = document.getElementById("vinyl-track-artist");
    const switchBtns = document.querySelectorAll(".track-switch-btn");

    switchBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const src = btn.dataset.src;
        const title = btn.dataset.title;
        const artist = btn.dataset.artist;
        if (!audio || !src) return;
        const wasPlaying = !audio.paused;
        audio.src = src;
        audio.load();
        if (titleEl) titleEl.textContent = title;
        if (artistEl) artistEl.textContent = artist;
        switchBtns.forEach((b) => b.classList.toggle("active", b === btn));
        if (wasPlaying) audio.play().catch(() => {});
        if (typeof window.showToast === "function") {
          window.showToast(`Đã chọn bài: ${title}`);
        }
      });
    });
    // 4. Game Collection Modal (Bộ Sưu Tập Trò Chơi) + 1-click copy
    const gamesModal = document.getElementById("games-modal");
    const openGamesBtn = document.getElementById("open-games-modal-btn");
    const closeGamesBtn = document.getElementById("close-games-modal-btn");

    function openGamesModal() {
      if (!gamesModal) return;
      gamesModal.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }
    function closeGamesModal() {
      if (!gamesModal) return;
      gamesModal.classList.add("hidden");
      document.body.style.overflow = "";
    }

    if (openGamesBtn) openGamesBtn.addEventListener("click", openGamesModal);
    if (closeGamesBtn) closeGamesBtn.addEventListener("click", closeGamesModal);
    if (gamesModal) {
      gamesModal.addEventListener("click", (e) => {
        if (e.target === gamesModal) closeGamesModal();
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && gamesModal && !gamesModal.classList.contains("hidden")) closeGamesModal();
    });

    document.querySelectorAll(".game-copy-btn[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.copy;
        const label = btn.dataset.label || "thông tin";
        if (!val) return;
        const done = () => {
          if (typeof window.showToast === "function") {
            window.showToast(`Đã copy ${label}: ${val}`);
          }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(val).then(done).catch(done);
        } else {
          const ta = document.createElement("textarea");
          ta.value = val;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          done();
        }
      });
    });
  });
})();
