// ============================================================
//  CONFIG
// ============================================================
const DISCORD_ID = "756800068065165394";

// ============================================================
//  COLOR INTERPOLATION (Theme-color meta)
// ============================================================
function lerpColor(color1, color2, t) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const PROGRESS_COLOR_START = "#34d399";
const PROGRESS_COLOR_END = "#5865f2";

// ============================================================
//  TOAST HELPER
// ============================================================
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("site-toast");
  const text = document.getElementById("site-toast-text");
  if (!toast || !text) return;
  text.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// ============================================================
//  LIVE VIETNAM CLOCK (GMT+7)
// ============================================================
function updateVietnamClock() {
  const clockEl = document.getElementById("vn-clock");
  if (!clockEl) return;
  try {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now);
    clockEl.textContent = `${formatted} GMT+7`;
  } catch (e) {
    clockEl.textContent = "GMT+7";
  }
}
updateVietnamClock();
setInterval(updateVietnamClock, 1000);

// ============================================================
//  TYPEWRITER EFFECT
// ============================================================
const phrases = [
  "I build fun things for the web ✨",
  "Một chiếc web giới thiệu nhỏ xinh",
  "Chào mừng vị khách mới ghé chơi!",
  "Lướt xuống dưới khám phá đồ chơi nhé",
  "How are you? I'm fine, thank you, and you?"
];

let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;

function typeEffect() {
  const currentPhrase = phrases[phraseIndex];
  const textEl = document.getElementById("hero-subtitle-text");
  if (!textEl) return;

  if (isDeleting) {
    charIndex--;
    textEl.textContent = currentPhrase.substring(0, charIndex);
    if (charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      setTimeout(typeEffect, 420);
    } else {
      setTimeout(typeEffect, 32);
    }
  } else {
    charIndex++;
    textEl.textContent = currentPhrase.substring(0, charIndex);
    if (charIndex === currentPhrase.length) {
      isDeleting = true;
      setTimeout(typeEffect, 2200);
    } else {
      setTimeout(typeEffect, 75);
    }
  }
}

// ============================================================
//  RANDOM IDLE MESSAGES
// ============================================================
const idleMessages = [
  "ʕ •ᴥ•ʔ đang suy nghĩ ngày mai ăn gì...",
  "( ︶︿︶) đang bận việc không làm gì cả",
  "(っ˘ڡ˘ς) nhâm nhi cốc cafe tỉ lệ sữa 99%",
  "ʕᴥʔ đang đi tìm cảm hứng mất rồi",
  "( ͝° ͜ʖ͡°) code dở rồi lười quá đi ngủ",
  "(* ^ ω ^) đang chém gió với mấy đứa bạn",
  "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ đang ngắm mây trời suy ngẫm",
  "(づ｡◕‿‿◕｡) dzợt qua thế giới khác chơi chút",
  "( ＾ω＾ ) đang đếm cừu để ngủ...",
  "٩(◕‿◕)۶ đang ném boom mấy team bạn"
];

let currentIdleIndex = 0;
let hasLiveCustomStatus = false;

const defaultIdlePrompts = [
  "Món bạn đang muốn ăn lúc nào?",
  ...idleMessages
];

function renderThoughtIdle() {
  if (hasLiveCustomStatus) return;
  const emojiEl = document.getElementById("rpc-custom-emoji");
  const textEl = document.getElementById("rpc-custom-text");
  if (emojiEl) emojiEl.textContent = currentIdleIndex === 0 ? "⊕" : "💭";
  if (textEl) textEl.textContent = defaultIdlePrompts[currentIdleIndex];
}

const thoughtBtn = document.getElementById("rpc-thought-btn");
if (thoughtBtn) {
  thoughtBtn.addEventListener("click", () => {
    if (hasLiveCustomStatus) return;
    currentIdleIndex = (currentIdleIndex + 1) % defaultIdlePrompts.length;
    renderThoughtIdle();
  });
}

// ============================================================
//  FULL DISCORD NITRO PROFILE SYNC (dcdn.dstn.to/profile)
// ============================================================
function intToRgb(intColor) {
  return {
    r: (intColor >> 16) & 255,
    g: (intColor >> 8) & 255,
    b: intColor & 255
  };
}

function darkenColor(intColor, factor) {
  const { r, g, b } = intToRgb(intColor);
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `rgb(${dr}, ${dg}, ${db})`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/[\u{E0000}-\u{E007F}]/gu, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDiscordBio(rawBio) {
  if (!rawBio) return "";
  return escapeHtml(rawBio)
    .split(/\r?\n/)
    .map((line) => {
      let formatted = line.replace(/`([^`]+)`/g, '<span class="rpc-inline-code">$1</span>');
      formatted = formatted.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener" class="rpc-bio-link">$1</a>'
      );
      return `<div>${formatted}</div>`;
    })
    .join("");
}

function formatVnDate(dateObj, includeYearPrefix = false) {
  const d = dateObj.getDate();
  const m = dateObj.getMonth() + 1;
  const y = dateObj.getFullYear();
  return includeYearPrefix ? `Thành viên từ năm ${d} thg ${m}, ${y}` : `${d} thg ${m}, ${y}`;
}

function updateJoinedFromSnowflake(snowflakeId) {
  const joinedEl = document.getElementById("rpc-joined-date");
  if (!joinedEl) return;
  try {
    const timestamp = Number((BigInt(snowflakeId) >> 22n) + 1420070400000n);
    joinedEl.textContent = formatVnDate(new Date(timestamp));
  } catch (e) {}
}
updateJoinedFromSnowflake(DISCORD_ID);

const STARFALL_ROSE_SKU = "1343751617429766165";
let profileEffectsCatalogPromise = null;
let currentProfileEffectSku = "";
let introWaveTimer = null;
let nextCycleTimer = null;
let lastIntroReplayAt = 0;
let replayCounter = 0;
let localStarfallBufferPromise = null;
let activeIntroBlobUrl = null;
let hasPlayedInitialMobileWave = false;

const isMobileDevice =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (window.matchMedia && window.matchMedia("(max-width: 768px)").matches);

let isCardInViewport = true;
if ("IntersectionObserver" in window) {
  const cardObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        isCardInViewport = e.isIntersecting;
      });
    },
    { threshold: 0.1 }
  );
  const cardShell = document.getElementById("rpc-card-shell");
  if (cardShell) cardObs.observe(cardShell);
}

function getProfileEffectsCatalog() {
  if (!profileEffectsCatalogPromise) {
    profileEffectsCatalogPromise = import(
      "https://cdn.jsdelivr.net/npm/@discord-user-card/profile-effects@0.0.9/lib/index.js"
    ).catch(() => null);
  }
  return profileEffectsCatalogPromise;
}

async function getStarfallIntroSrc(isReplay) {
  if (!isReplay) return "resources/starfall_l0.png";
  // Trên http/https (GitHub Pages / Live Server): tạo Blob URL từ RAM để APNG luôn tua về frame đầu mà không tốn băng thông tải lại
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    try {
      if (!localStarfallBufferPromise) {
        localStarfallBufferPromise = fetch("resources/starfall_l0.png").then((r) =>
          r.ok ? r.arrayBuffer() : null
        );
      }
      const buf = await localStarfallBufferPromise;
      if (buf) {
        if (activeIntroBlobUrl) {
          URL.revokeObjectURL(activeIntroBlobUrl);
          activeIntroBlobUrl = null;
        }
        activeIntroBlobUrl = URL.createObjectURL(new Blob([buf], { type: "image/png" }));
        return activeIntroBlobUrl;
      }
    } catch (e) {}
  }
  return `resources/starfall_l0.png?r=${++replayCounter}`;
}

async function playIntroWaveSequence(skuId, isReplay = false) {
  const realLayersEl = document.getElementById("rpc-real-effect-layers");
  if (!realLayersEl || !skuId) return;

  clearTimeout(introWaveTimer);
  clearTimeout(nextCycleTimer);
  lastIntroReplayAt = Date.now();

  // Bộ sóng biển hồng Starfall Tides (Rose) của anh dùng trực tiếp file trong resources/ (không bị chặn CORP bởi server ngoài)
  if (String(skuId) === STARFALL_ROSE_SKU) {
    realLayersEl.classList.remove("hidden");

    let loopImg = realLayersEl.querySelector('img[data-role="loop"]');
    if (!loopImg) {
      loopImg = document.createElement("img");
      loopImg.dataset.role = "loop";
      loopImg.src = "resources/starfall_l1.png";
      loopImg.alt = "";
      loopImg.style.zIndex = "1";
      loopImg.style.opacity = isMobileDevice ? "1" : "0";
      loopImg.style.transition = "opacity 0.45s ease";
      realLayersEl.appendChild(loopImg);
    }

    // Trên điện thoại: nếu đã xem sóng mở đầu 1 lần rồi và đang chạy ngầm thì giữ mặt nước êm đềm lấp lánh (1.4MB)
    // để GPU & RAM điện thoại không bị giật lag ngốn pin do decode APNG 3.5MB liên tục
    if (isMobileDevice && hasPlayedInitialMobileWave && !isReplay) {
      loopImg.style.opacity = "1";
      return;
    }

    const oldIntro = realLayersEl.querySelector('img[data-role="intro"]');
    if (oldIntro) {
      oldIntro.remove();
      oldIntro.src = "";
    }

    const introSrc = await getStarfallIntroSrc(isReplay);
    if (String(skuId) !== String(currentProfileEffectSku)) return;

    const introImg = document.createElement("img");
    introImg.dataset.role = "intro";
    introImg.alt = "";
    introImg.style.zIndex = "2";
    introImg.style.opacity = "1";
    introImg.style.transition = "opacity 0.45s ease";

    introImg.onload = () => {
      hasPlayedInitialMobileWave = true;
      loopImg.style.opacity = "0.35";

      // Sóng lớn chạy 5 giây rồi rút êm sang mặt nước dạt dào
      introWaveTimer = setTimeout(() => {
        loopImg.style.opacity = "1";
        introImg.style.opacity = "0";

        // Dọn dẹp bộ nhớ RAM / GPU tức thì sau khi sóng tan
        setTimeout(() => {
          if (introImg.parentNode) introImg.remove();
          introImg.src = "";
          if (activeIntroBlobUrl) {
            URL.revokeObjectURL(activeIntroBlobUrl);
            activeIntroBlobUrl = null;
          }
        }, 480);

        // Chỉ tự động lặp lại theo chu kỳ trên Desktop khi card nằm trong tầm mắt người dùng
        if (!isMobileDevice) {
          nextCycleTimer = setTimeout(() => {
            if (!document.hidden && isCardInViewport && String(currentProfileEffectSku) === STARFALL_ROSE_SKU) {
              playIntroWaveSequence(STARFALL_ROSE_SKU, true);
            }
          }, 11000); // Khoảng nghỉ 11s thanh tao như nhịp sóng biển tự nhiên, không ngốn GPU
        }
      }, 4950);
    };

    realLayersEl.appendChild(introImg);
    introImg.src = introSrc;
    return;
  }

  // Nếu anh đổi sang hiệu ứng khác có trên Discord CDN chính thức (cdn.discordapp.com cho phép cross-origin)
  const mod = await getProfileEffectsCatalog();
  if (String(skuId) !== String(currentProfileEffectSku)) return;
  const found = mod?.findProfileEffect ? mod.findProfileEffect(String(skuId)) : null;
  if (found && Array.isArray(found.effects) && found.effects.length > 0) {
    const loopLayers = found.effects.filter((l) => l.loop && l.src);
    const layersToRender = loopLayers.length > 0 ? loopLayers : [found.effects[0]];
    realLayersEl.innerHTML = layersToRender.map((l) => `<img src="${escapeHtml(l.src)}" alt="" />`).join("");
    realLayersEl.classList.remove("hidden");
  } else {
    realLayersEl.innerHTML = "";
    realLayersEl.classList.add("hidden");
  }
}

// Chạm hoặc rê chuột vào thẻ Discord để gọi sóng biển dạt ngang tức thì (cooldown 5.5s)
const rpcCardForWave = document.getElementById("rpc-card");
if (rpcCardForWave) {
  const triggerManualWave = () => {
    if (currentProfileEffectSku && Date.now() - lastIntroReplayAt > 5500) {
      playIntroWaveSequence(currentProfileEffectSku, true);
    }
  };
  rpcCardForWave.addEventListener("mouseenter", () => {
    if (!isMobileDevice) triggerManualWave();
  });
  rpcCardForWave.addEventListener("click", () => {
    triggerManualWave();
  });
}

function syncAvatarDecoration(asset) {
  const decoEl = document.getElementById("rpc-avatar-decoration");
  if (!decoEl) return;
  if (asset) {
    const decoUrl = `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png?size=240&passthrough=true`;
    if (decoEl.dataset.loadedSrc !== decoUrl) {
      decoEl.dataset.loadedSrc = decoUrl;
      decoEl.src = decoUrl;
      decoEl.onload = () => decoEl.classList.remove("hidden");
      decoEl.onerror = () => decoEl.classList.add("hidden");
    } else {
      decoEl.classList.remove("hidden");
    }
  } else {
    decoEl.dataset.loadedSrc = "";
    decoEl.classList.add("hidden");
  }
}

function syncNameplate(asset) {
  const nameplateVideo = document.getElementById("rpc-nameplate-video");
  if (!nameplateVideo) return;
  if (asset) {
    const npUrl = `https://cdn.discordapp.com/assets/collectibles/${asset}asset.webm`;
    if (nameplateVideo.dataset.loadedSrc !== npUrl) {
      nameplateVideo.dataset.loadedSrc = npUrl;
      nameplateVideo.src = npUrl;
    }
    nameplateVideo.classList.remove("hidden");
  } else {
    nameplateVideo.dataset.loadedSrc = "";
    nameplateVideo.removeAttribute("src");
    nameplateVideo.classList.add("hidden");
  }
}

async function syncProfileEffect(profileEffectObj, collectiblesArr) {
  const svgCrownEl = document.getElementById("rpc-profile-effect");
  const svgBottomEl = document.getElementById("rpc-sparkle-bottom");
  const realLayersEl = document.getElementById("rpc-real-effect-layers");
  const skuId = profileEffectObj?.sku_id || profileEffectObj?.id || "";

  // Khung sao lấp lánh viền ngoài (type: 3 Frame Collectible trên Discord)
  const hasOuterFrame = Array.isArray(collectiblesArr) && collectiblesArr.some((c) => c.type === 3);
  if (svgCrownEl) svgCrownEl.classList.toggle("hidden", !hasOuterFrame && !skuId);
  if (svgBottomEl) svgBottomEl.classList.toggle("hidden", !hasOuterFrame && !skuId);

  if (!skuId) {
    currentProfileEffectSku = "";
    clearTimeout(introWaveTimer);
    if (realLayersEl) {
      realLayersEl.innerHTML = "";
      realLayersEl.classList.add("hidden");
    }
    return;
  }

  if (skuId === currentProfileEffectSku) return;
  currentProfileEffectSku = skuId;

  // Phát trực tiếp 2 lớp ảnh động APNG gốc của Discord (ví dụ: Sóng biển hồng Starfall Tides Rose _l0 + _l1)
  playIntroWaveSequence(skuId, false);
}

async function fetchDiscordProfile() {
  try {
    const res = await fetch(`https://dcdn.dstn.to/profile/${DISCORD_ID}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const profile = await res.json();
    const u = profile.user || {};
    const up = profile.user_profile || {};
    const rpcCard = document.getElementById("rpc-card");

    // 1. Theme Colors Nitro (màu tím hồng đặc trưng trên Discord)
    if (rpcCard && Array.isArray(up.theme_colors) && up.theme_colors.length >= 2) {
      const [c1, c2] = up.theme_colors;
      const { r, g, b } = intToRgb(c1);
      rpcCard.style.setProperty("--nitro-bg-1", darkenColor(c1, 0.33));
      rpcCard.style.setProperty("--nitro-bg-2", darkenColor(c2, 0.24));
      rpcCard.style.setProperty("--nitro-border", `rgba(${r}, ${g}, ${b}, 0.46)`);
    }

    // 2. Banner thực tế từ Discord
    const bannerHash = up.banner || u.banner;
    const bannerImg = document.getElementById("rpc-banner-img");
    if (bannerImg && bannerHash) {
      const ext = bannerHash.startsWith("a_") ? "gif" : "png";
      const nextBanner = `https://cdn.discordapp.com/banners/${DISCORD_ID}/${bannerHash}.${ext}?size=600`;
      if (bannerImg.dataset.loadedSrc !== nextBanner) {
        bannerImg.dataset.loadedSrc = nextBanner;
        bannerImg.src = nextBanner;
      }
    }

    // 3. Đồng bộ Avatar Decoration, Nameplate & Profile Effect
    if (u.avatar_decoration_data !== undefined) {
      syncAvatarDecoration(u.avatar_decoration_data?.asset || "");
    }
    if (u.collectibles !== undefined) {
      syncNameplate(u.collectibles?.nameplate?.asset || "");
    }
    await syncProfileEffect(up.profile_effect, up.collectibles);

    // 4. Danh sách Huy hiệu Discord (Nitro, HypeSquad, Quest, Orb, Legacy...)
    const badgesEl = document.getElementById("rpc-badges");
    if (badgesEl && Array.isArray(profile.badges)) {
      badgesEl.innerHTML = profile.badges
        .map(
          (b) =>
            `<img src="https://cdn.discordapp.com/badge-icons/${b.icon}.png" alt="${escapeHtml(
              b.description
            )}" title="${escapeHtml(b.description)}" class="rpc-badge-icon" loading="lazy" />`
        )
        .join("");
    }

    // 5. Tiểu sử (Bio + Pronouns)
    const bioEl = document.getElementById("rpc-bio");
    const rawBio = up.bio || u.bio;
    if (bioEl && rawBio) {
      const cleanPronouns = String(up.pronouns || "").replace(/[\u{E0000}-\u{E007F}]/gu, "").trim();
      const prefix = cleanPronouns ? `<div><span class="rpc-inline-code">${escapeHtml(cleanPronouns)}</span></div>` : "";
      bioEl.innerHTML = prefix + formatDiscordBio(rawBio);
    }

    // 6. Kết nối (Connected Accounts: Facebook, Steam + số game & vật phẩm...)
    const connEl = document.getElementById("rpc-connections");
    if (connEl && Array.isArray(profile.connected_accounts) && profile.connected_accounts.length > 0) {
      connEl.innerHTML = profile.connected_accounts
        .map((acc) => {
          if (acc.type === "facebook") {
            return `
              <div class="rpc-conn-row">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 text-[#1877F2]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </span>
                  <span class="text-[13px] font-semibold text-white truncate">${escapeHtml(acc.name)}</span>
                </div>
              </div>`;
          }
          if (acc.type === "steam") {
            const steamUrl = `https://steamcommunity.com/profiles/${encodeURIComponent(acc.id)}`;
            const createdStr = acc.metadata?.created_at
              ? `<div class="pl-7 mt-0.5 text-[11.5px] text-white/70">${formatVnDate(new Date(acc.metadata.created_at), true)}</div>`
              : "";
            const metaChips = [];
            if (acc.metadata?.game_count) metaChips.push(`<span>${escapeHtml(acc.metadata.game_count)} Games</span>`);
            if (Number(acc.metadata?.item_count_tf2) > 0) {
              metaChips.push(
                `<span class="inline-flex items-center gap-1"><span class="w-3.5 h-3.5 rounded-full inline-block" style="background: radial-gradient(circle, #f97316 35%, #ea580c 100%);"></span>${escapeHtml(
                  acc.metadata.item_count_tf2
                )} vật phẩm</span>`
              );
            }
            const metaRow =
              metaChips.length > 0
                ? `<div class="pl-7 mt-1 flex items-center gap-3 text-[11.5px] font-semibold text-white/90">${metaChips.join("")}</div>`
                : "";
            return `
              <a href="${steamUrl}" target="_blank" rel="noopener" class="rpc-conn-row block no-underline">
                <div class="flex items-center gap-2.5">
                  <span class="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 text-[#171a21]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z"/></svg>
                  </span>
                  <span class="text-[13px] font-semibold text-white">${escapeHtml(acc.name)}</span>
                  <svg class="text-white/70" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M7 17L17 7M7 7h10v10"/></svg>
                </div>
                ${createdStr}
                ${metaRow}
              </a>`;
          }
          return `
            <div class="rpc-conn-row">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-xs uppercase font-bold text-white/70">${escapeHtml(acc.type)}</span>
                <span class="text-[13px] font-semibold text-white truncate">${escapeHtml(acc.name)}</span>
              </div>
            </div>`;
        })
        .join("");
    }
  } catch (e) {
    console.warn("Profile metadata fetch error:", e);
  }
}

// ============================================================
//  DISCORD FONT MAPPING & LANYARD PRESENCE
// ============================================================
const DISCORD_FONTS = {
  1: "'Press Start 2P', cursive",
  2: "'Caveat', cursive",
  3: "'Pacifico', cursive",
  4: "'Cinzel', serif",
  5: "'Bebas Neue', sans-serif",
  14: "'Pirata One', cursive",
  15: "'Pirata One', cursive"
};

let spotifyInterval = null;
let currentMediaData = null;
let gameInterval = null;
let currentGameName = "";

async function fetchLanyard() {
  try {
    const response = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`);
    const data = await response.json();
    if (data.success) {
      updatePresence(data.data);
    }
  } catch (error) {
    console.error("Lanyard API Error:", error);
  }
}

function updatePresence(presence) {
  if (!presence || !presence.discord_user) return;

  const user = presence.discord_user;
  const status = presence.discord_status || "offline";
  const statusColors = {
    online: "#23a55a",
    idle: "#f0b232",
    dnd: "#f23f43",
    offline: "#80848e"
  };
  const statusLabels = {
    online: "Online",
    idle: "Idle",
    dnd: "Do Not Disturb",
    offline: "Offline"
  };

  // --- Avatar ---
  const avatarEl = document.getElementById("rpc-avatar");
  const placeholderEl = document.getElementById("rpc-avatar-placeholder");
  if (avatarEl) {
    let avatarUrl;
    if (user.avatar) {
      const ext = user.avatar.startsWith("a_") ? "gif" : "png";
      avatarUrl = `https://cdn.discordapp.com/avatars/${DISCORD_ID}/${user.avatar}.${ext}?size=256`;
    } else {
      avatarUrl = "resources/avt.jpg";
    }
    if (avatarEl.dataset.loadedSrc !== avatarUrl) {
      avatarEl.dataset.loadedSrc = avatarUrl;
      avatarEl.src = avatarUrl;
      avatarEl.onload = () => {
        avatarEl.style.opacity = "1";
        if (placeholderEl) placeholderEl.classList.add("hidden");
      };
    }
  }

  // --- Status Indicators & Card Ambient Glow ---
  const activeColor = statusColors[status] || statusColors.offline;
  const statusIndicator = document.getElementById("rpc-status-indicator");
  const bannerDot = document.getElementById("rpc-banner-status-dot");
  const bannerText = document.getElementById("rpc-banner-status-text");
  const rpcCard = document.getElementById("rpc-card");

  if (statusIndicator) statusIndicator.style.background = activeColor;
  if (bannerDot) bannerDot.style.background = activeColor;
  if (bannerText) bannerText.textContent = statusLabels[status] || "Offline";

  // --- Collectibles Nameplate Video (e.g. Angels Bubble Gum) ---
  syncNameplate(user.collectibles?.nameplate?.asset || "");

  // --- Display Name + Discord Custom Styles (Font + Neon Glow / Gradient) ---
  const displayName = user.display_name || user.global_name || user.username || "HùngNoPro";
  const nameEl = document.getElementById("rpc-username");
  if (nameEl) {
    nameEl.textContent = displayName;
    nameEl.className = "text-white";
    nameEl.style.fontFamily = "";
    nameEl.style.fontWeight = "700";
    nameEl.style.color = "";
    nameEl.style.backgroundImage = "";

    if (user.display_name_styles) {
      const styles = user.display_name_styles;
      if (styles.font_id && DISCORD_FONTS[styles.font_id]) {
        nameEl.style.fontFamily = DISCORD_FONTS[styles.font_id];
        // Không ép in đậm giả (faux-bold) lên font nghệ thuật để nét chữ Gothic sắc nét
        nameEl.style.fontWeight = "400";
      }
      if (styles.colors && styles.colors.length > 0) {
        const hexColors = styles.colors.map((c) => "#" + c.toString(16).padStart(6, "0"));
        if (styles.effect_id === 3) {
          // Effect 3 = Discord Neon Glow
          nameEl.classList.add("rpc-name-neon");
          if (rpcCard) rpcCard.style.setProperty("--name-neon", hexColors[0]);
        } else if (hexColors.length === 1) {
          nameEl.style.color = hexColors[0];
        } else {
          nameEl.style.backgroundImage = `linear-gradient(90deg, ${hexColors.join(", ")}, ${hexColors[0]})`;
          nameEl.classList.add("rpc-name-gradient");
        }
      }
    }
  }

  // --- username ---
  const handleEl = document.getElementById("rpc-handle");
  if (handleEl) {
    const uname = user.username || "hungnemaoi";
    handleEl.textContent = uname;
    handleEl.dataset.username = uname;
  }

  // --- Avatar Decoration ---
  syncAvatarDecoration(user.avatar_decoration_data?.asset || "");

  // --- Clan / Guild Badge ---
  const guildBadgeEl = document.getElementById("rpc-guild-badge");
  if (guildBadgeEl) {
    if (user.primary_guild?.badge && user.primary_guild?.tag) {
      guildBadgeEl.innerHTML = `
        <img src="https://cdn.discordapp.com/clan-badges/${user.primary_guild.identity_guild_id}/${user.primary_guild.badge}.png?size=32" class="w-3.5 h-3.5 rounded-sm" alt="" onerror="this.style.display='none'" />
        <span>${escapeHtml(user.primary_guild.tag)}</span>
      `;
      guildBadgeEl.classList.remove("hidden");
    } else {
      guildBadgeEl.classList.add("hidden");
    }
  }

  // --- Active Platforms ---
  const platformsEl = document.getElementById("rpc-platforms");
  if (platformsEl) {
    const platforms = [];
    if (presence.active_on_discord_desktop) platforms.push("💻");
    if (presence.active_on_discord_mobile) platforms.push("📱");
    if (presence.active_on_discord_web) platforms.push("🌐");

    if (platforms.length > 0) {
      platformsEl.innerHTML = platforms.map((p) => `<span title="Active on Discord"><span class="rpc-platform-dot"></span>${p}</span>`).join("");
      platformsEl.classList.remove("hidden");
    } else {
      platformsEl.classList.add("hidden");
    }
  }

  // --- Custom Status Thought Bubble ---
  const customStatus = presence.activities?.find((a) => a.type === 4);
  const emojiEl = document.getElementById("rpc-custom-emoji");
  const textEl = document.getElementById("rpc-custom-text");
  if (customStatus && (customStatus.state || customStatus.emoji)) {
    hasLiveCustomStatus = true;
    if (emojiEl) {
      if (customStatus.emoji?.id) {
        const ext = customStatus.emoji.animated ? "gif" : "png";
        emojiEl.innerHTML = `<img src="https://cdn.discordapp.com/emojis/${customStatus.emoji.id}.${ext}" style="width:15px;height:15px;" alt="" />`;
      } else if (customStatus.emoji?.name) {
        emojiEl.textContent = customStatus.emoji.name;
      } else {
        emojiEl.textContent = "";
      }
    }
    if (textEl) textEl.textContent = customStatus.state || "";
  } else {
    hasLiveCustomStatus = false;
    renderThoughtIdle();
  }

  // --- Navbar Status Summary ---
  const gameCandidates = (presence.activities || [])
    .filter((a) => a.type === 0 || a.type === 1 || a.type === 5)
    .sort((a, b) => (b.timestamps?.start || b.created_at || 0) - (a.timestamps?.start || a.created_at || 0));
  const game = gameCandidates[0] || null;
  const mediaActivity = presence.activities?.find((a) => (a.type === 2 || a.type === 3) && a.id !== "custom-status");

  let navStatusText = statusLabels[status] || "Offline";
  if (status !== "offline") {
    if (mediaActivity) navStatusText = `${mediaActivity.type === 3 ? "Watching" : "Listening"} • ${mediaActivity.name}`;
    else if (game) navStatusText = `${game.type === 1 ? "Streaming" : "Playing"} • ${game.name}`;
  }

  const navDot = document.getElementById("nav-status-dot");
  const navText = document.getElementById("nav-status-text");
  if (navDot) navDot.style.background = activeColor;
  if (navText) navText.textContent = navStatusText;

  // Dynamic ambient glow on RPC card
  if (rpcCard) {
    if (mediaActivity) rpcCard.style.setProperty("--rpc-glow", "rgba(74, 222, 128, 0.35)");
    else if (game) rpcCard.style.setProperty("--rpc-glow", "rgba(217, 70, 239, 0.38)");
    else rpcCard.style.setProperty("--rpc-glow", "rgba(236, 29, 253, 0.32)");
  }

  // --- Activities ---
  const actWrapEl = document.getElementById("rpc-activities-wrap");
  const gameEl = document.getElementById("rpc-game");
  const spotifyEl = document.getElementById("rpc-spotify");

  if (gameEl) gameEl.classList.add("hidden");
  if (spotifyEl) spotifyEl.classList.add("hidden");

  let hasActivity = false;
  if (gameInterval) clearInterval(gameInterval);

  if (game && gameEl) {
    const labelEl = document.getElementById("rpc-game-label");
    if (labelEl) {
      labelEl.textContent = game.type === 1 ? "Đang stream" : game.type === 5 ? "Đang thi đấu" : "Đang chơi";
    }
    document.getElementById("rpc-game-name").textContent = game.name || "Unknown";
    const detailsText = [game.details, game.state].filter(Boolean).join(" • ");
    document.getElementById("rpc-game-state").textContent = detailsText || "";

    const imgEl = document.getElementById("rpc-game-img");
    const smallImgEl = document.getElementById("rpc-game-small-img");
    const timeEl = document.getElementById("rpc-game-time");

    if (imgEl) {
      imgEl.title = game.assets?.large_text || game.name || "";
    }

    const signature = `${game.application_id || ""}|${game.name || ""}|${game.assets?.large_image || ""}|${game.assets?.small_image || ""}`;
    if (signature !== currentGameName) {
      currentGameName = signature;
      updateGameImages(game, signature, imgEl, smallImgEl);
    }

    if (game.timestamps?.start) {
      const updateGameTime = () => {
        const elapsed = Date.now() - game.timestamps.start;
        timeEl.textContent = `⏱ ${formatDuration(elapsed)} đã trôi qua`;
      };
      updateGameTime();
      gameInterval = setInterval(updateGameTime, 1000);
    } else {
      timeEl.textContent = "";
    }

    gameEl.classList.remove("hidden");
    hasActivity = true;
  } else {
    currentGameName = "";
  }

  if (mediaActivity && spotifyEl) {
    currentMediaData = mediaActivity;
    const listeningTextEl = document.getElementById("rpc-listening-text");
    if (mediaActivity.type === 3) {
      listeningTextEl.textContent = "Watching";
    } else if (mediaActivity.id === "spotify:1") {
      listeningTextEl.textContent = "Listening to Spotify";
    } else {
      listeningTextEl.textContent = `Listening to ${mediaActivity.name || "Media"}`;
    }

    const imgEl = document.getElementById("rpc-spotify-img");
    if (mediaActivity.assets?.large_image) {
      imgEl.src = resolveImage(mediaActivity.assets.large_image, mediaActivity.application_id);
    } else {
      imgEl.src = "resources/avt.jpg";
    }

    document.getElementById("rpc-spotify-song").textContent = mediaActivity.details || "Unknown Track";
    document.getElementById("rpc-spotify-artist").textContent = mediaActivity.state ? `by ${mediaActivity.state}` : "";

    const total = (mediaActivity.timestamps?.end || Date.now()) - (mediaActivity.timestamps?.start || Date.now());
    document.getElementById("rpc-spotify-duration").textContent = formatTime(total);

    if (spotifyInterval) clearInterval(spotifyInterval);
    updateMediaProgress();
    spotifyInterval = setInterval(updateMediaProgress, 1000);

    spotifyEl.classList.remove("hidden");
    hasActivity = true;
  } else {
    if (spotifyInterval) clearInterval(spotifyInterval);
    currentMediaData = null;
  }

  if (actWrapEl) {
    actWrapEl.classList.toggle("hidden", !hasActivity);
  }
}

function updateMediaProgress() {
  if (!currentMediaData || !currentMediaData.timestamps) return;
  const start = currentMediaData.timestamps.start || Date.now();
  const end = currentMediaData.timestamps.end || Date.now();
  const total = Math.max(1, end - start);
  const current = Date.now() - start;

  if (current >= total) {
    clearInterval(spotifyInterval);
    fetchLanyard();
    return;
  }

  const pct = Math.min(100, (current / total) * 100);
  const progEl = document.getElementById("rpc-spotify-progress");
  const curEl = document.getElementById("rpc-spotify-current");
  if (progEl) progEl.style.width = `${pct}%`;
  if (curEl) curEl.textContent = formatTime(current);
}

// ============================================================
//  MULTI-TIER GAME ICON & ARTWORK RESOLVER
// ============================================================
const GAME_FALLBACK_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%23141829"/><path d="M21.5 22C15.7 22 11 26.7 11 32.5S15.7 43 21.5 43c3.3 0 6.2-1.6 8-4h5c1.8 2.4 4.7 4 8 4 5.8 0 10.5-4.7 10.5-10.5S48.3 22 42.5 22h-21zm0 15c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5zm21 0c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z" fill="%23818cf8"/></svg>';

const gameArtworkCache = new Map();
let detectableAppsPromise = null;

function resolveImage(imageId, appId, ext = "png") {
  if (!imageId) return "";
  if (imageId.startsWith("http://") || imageId.startsWith("https://")) return imageId;
  if (imageId.startsWith("spotify:")) return `https://i.scdn.co/image/${imageId.slice(8)}`;
  // Mọi tiền tố mp: (mp:external/, mp:attachments/, mp:app-icons/...) đều đi qua Discord Media Proxy
  if (imageId.startsWith("mp:")) return `https://media.discordapp.net/${imageId.slice(3)}`;
  if (appId) return `https://cdn.discordapp.com/app-assets/${appId}/${imageId}.${ext}?size=256`;
  return "";
}

function canLoadImage(url, timeoutMs = 4500) {
  if (!url) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const img = new Image();
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(false);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(img.naturalWidth > 1);
      }
    };
    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(false);
      }
    };
    img.src = url;
  });
}

function cleanGameTitle(rawName) {
  return String(rawName || "")
    .replace(/[™®©]/g, "")
    .replace(/\.(exe|bin|x64|x86)$/i, "")
    .replace(/\s*[-–—]\s*(DirectX\s*\d+|DX\d+|Vulkan|64-bit|32-bit).*$/i, "")
    .replace(/\s*\((64-bit|32-bit|DX\d+|Client|Shipping)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGameKey(str) {
  return cleanGameTitle(str)
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff\u4e00-\u9fff]+/g, "");
}

function getDetectableApps() {
  if (!detectableAppsPromise) {
    detectableAppsPromise = fetch("https://discord.com/api/v9/applications/detectable")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return detectableAppsPromise;
}

// Bảng tra cứu chuẩn xác Steam AppID cho các game PC phổ biến
const STEAM_APP_DB = {
  "counterstrike2": 730,
  "cs2": 730,
  "counterstrike": 730,
  "dota2": 570,
  "left4dead2": 550,
  "l4d2": 550,
  "left4dead": 500,
  "teamfortress2": 440,
  "tf2": 440,
  "halflife2": 220,
  "portal2": 620,
  "reddeadredemption2": 1174180,
  "grandtheftautov": 271590,
  "gtav": 271590,
  "gta5": 271590,
  "eldenring": 1245620,
  "cyberpunk2077": 1091500,
  "pubgbattlegrounds": 578080,
  "pubg": 578080,
  "apexlegends": 1172470,
  "rocketleague": 252950,
  "forzahorizon5": 1551360,
  "seaofthieves": 1172620,
  "deadlock": 1422450,
  "marvelrivals": 2767030,
  "overwatch2": 2357570,
  "thefinals": 2073850,
  "blackmythwukong": 2358720,
  "naraka": 1203220,
  "narakabladepoint": 1203220,
  "palworld": 1623730,
  "helldivers2": 553850,
  "lethalcompany": 1966720,
  "repo": 3241660,
  "balatro": 2379780,
  "stardewvalley": 413150,
  "terraria": 105600,
  "rust": 252490,
  "arksurvivalascended": 2399830,
  "monsterhunterwilds": 2246340,
  "monsterhunterworld": 582010,
  "eafootballclub25": 2669320,
  "eafc25": 2669320,
  "wutheringwaves": 3513350,
  "strinova": 1282270,
  "deltaforce": 2507950
};

async function trySteamArtwork(steamAppId) {
  if (!steamAppId) return null;
  const candidates = [
    { url: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/library_600x900.jpg`, pos: "top center" },
    { url: `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg`, pos: "top center" },
    { url: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/header.jpg`, pos: "center" },
    { url: `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/header.jpg`, pos: "center" }
  ];
  for (const item of candidates) {
    if (await canLoadImage(item.url)) return item;
  }
  return null;
}

async function resolveGameArtwork(game) {
  const cacheKey = `${game.application_id || ""}|${game.name || ""}|${game.assets?.large_image || ""}`;
  if (gameArtworkCache.has(cacheKey)) {
    return gameArtworkCache.get(cacheKey);
  }

  // Tầng 1: Ảnh Rich Presence trực tiếp từ game.assets.large_image (.png / .webp / mp: / http)
  if (game.assets?.large_image) {
    const primaryRpc = resolveImage(game.assets.large_image, game.application_id, "png");
    if (await canLoadImage(primaryRpc)) {
      const res = { url: primaryRpc, pos: "center", usedSmallAsMain: false };
      gameArtworkCache.set(cacheKey, res);
      return res;
    }
    if (game.application_id && !game.assets.large_image.includes(":")) {
      const webpRpc = resolveImage(game.assets.large_image, game.application_id, "webp");
      if (await canLoadImage(webpRpc)) {
        const res = { url: webpRpc, pos: "center", usedSmallAsMain: false };
        gameArtworkCache.set(cacheKey, res);
        return res;
      }
    }
  }

  // Tầng 2: Logo gốc của ứng dụng/game trên Discord thông qua application_id (dcdn của Lanyard)
  // Giải quyết 90% game không dùng Rich Presence riêng (Valorant, LoL, Genshin, CS2, WuWa, Roblox, Minecraft...)
  if (game.application_id) {
    const dcdnIcon = `https://dcdn.dstn.to/app-icons/${game.application_id}?size=256`;
    if (await canLoadImage(dcdnIcon)) {
      const res = { url: dcdnIcon, pos: "center", usedSmallAsMain: false };
      gameArtworkCache.set(cacheKey, res);
      return res;
    }
  }

  // Tầng 3: Nếu game chỉ có small_image mà không có large_image
  if (!game.assets?.large_image && game.assets?.small_image) {
    const smallRpc = resolveImage(game.assets.small_image, game.application_id, "png");
    if (await canLoadImage(smallRpc)) {
      const res = { url: smallRpc, pos: "center", usedSmallAsMain: true };
      gameArtworkCache.set(cacheKey, res);
      return res;
    }
  }

  const cleanedTitle = cleanGameTitle(game.name);
  const normTarget = normalizeGameKey(game.name);
  let detectedSteamId = null;

  // Tầng 4: Tra cứu CSDL 25,000+ game chính thức của Discord (applications/detectable - hỗ trợ CORS trực tiếp)
  // Cực hiệu quả khi game được thêm thủ công (.exe) hoặc thiếu application_id
  if (cleanedTitle) {
    const apps = await getDetectableApps();
    if (apps && apps.length > 0) {
      let matched = null;
      if (game.application_id) {
        matched = apps.find((a) => a.id === String(game.application_id));
      }
      if (!matched && normTarget) {
        matched = apps.find((a) => {
          if (normalizeGameKey(a.name) === normTarget) return true;
          if (Array.isArray(a.aliases) && a.aliases.some((al) => normalizeGameKey(al) === normTarget)) return true;
          return false;
        });
      }
      if (!matched && normTarget.length >= 4) {
        matched = apps.find((a) => normalizeGameKey(a.name).startsWith(normTarget));
      }

      if (matched) {
        if (matched.icon_hash) {
          const iconUrl = `https://cdn.discordapp.com/app-icons/${matched.id}/${matched.icon_hash}.png?size=256`;
          if (await canLoadImage(iconUrl)) {
            const res = { url: iconUrl, pos: "center", usedSmallAsMain: false };
            gameArtworkCache.set(cacheKey, res);
            return res;
          }
        }
        if (matched.cover_image_hash) {
          const coverUrl = `https://cdn.discordapp.com/app-icons/${matched.id}/${matched.cover_image_hash}.png?size=256`;
          if (await canLoadImage(coverUrl)) {
            const res = { url: coverUrl, pos: "center", usedSmallAsMain: false };
            gameArtworkCache.set(cacheKey, res);
            return res;
          }
        }
        const steamSku = (matched.third_party_skus || []).find((s) => s.distributor === "steam" && s.id);
        if (steamSku) detectedSteamId = steamSku.id;
      }
    }
  }

  // Tầng 5: Ảnh bìa chính thức từ Steam CDN (qua SKU từ Discord hoặc bảng tra cứu STEAM_APP_DB)
  if (!detectedSteamId && normTarget) {
    if (STEAM_APP_DB[normTarget]) {
      detectedSteamId = STEAM_APP_DB[normTarget];
    } else {
      for (const [k, id] of Object.entries(STEAM_APP_DB)) {
        if (k.length >= 4 && normTarget.includes(k)) {
          detectedSteamId = id;
          break;
        }
      }
    }
  }
  if (detectedSteamId) {
    const steamArt = await trySteamArtwork(detectedSteamId);
    if (steamArt) {
      const res = { ...steamArt, usedSmallAsMain: false };
      gameArtworkCache.set(cacheKey, res);
      return res;
    }
  }

  // Tầng 6: Tìm kiếm logo vuông chuẩn HD trên Apple App Store / iTunes API & Wikipedia API (CORS mở sẵn, không cần proxy)
  if (cleanedTitle) {
    try {
      const itunesRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(cleanedTitle)}&entity=software&limit=5`
      );
      if (itunesRes.ok) {
        const itunesData = await itunesRes.json();
        const bestApp = (itunesData.results || []).find((item) => {
          const trackNorm = normalizeGameKey(item.trackName || "");
          return trackNorm === normTarget || trackNorm.startsWith(normTarget) || normTarget.startsWith(trackNorm);
        });
        const artUrl = bestApp?.artworkUrl512 || bestApp?.artworkUrl100;
        if (artUrl && (await canLoadImage(artUrl))) {
          const res = { url: artUrl, pos: "center", usedSmallAsMain: false };
          gameArtworkCache.set(cacheKey, res);
          return res;
        }
      }
    } catch (e) {}

    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          cleanedTitle + " video game"
        )}&gsrlimit=3&prop=pageimages&piprop=thumbnail&pithumbsize=256&format=json&origin=*`
      );
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const pages = Object.values(wikiData.query?.pages || {}).sort((a, b) => (a.index || 99) - (b.index || 99));
        for (const page of pages) {
          if (page.thumbnail?.source && (await canLoadImage(page.thumbnail.source))) {
            const res = { url: page.thumbnail.source, pos: "center", usedSmallAsMain: false };
            gameArtworkCache.set(cacheKey, res);
            return res;
          }
        }
      }
    } catch (e) {}
  }

  const fallbackRes = { url: GAME_FALLBACK_SVG, pos: "center", usedSmallAsMain: false };
  gameArtworkCache.set(cacheKey, fallbackRes);
  return fallbackRes;
}

async function updateGameImages(game, expectedSignature, imgEl, smallImgEl) {
  if (!imgEl) return;

  // Hiển thị tạm icon tay cầm sang xịn trong vài mili-giây đang tải ảnh thật
  if (!imgEl.getAttribute("src")) {
    imgEl.src = GAME_FALLBACK_SVG;
  }
  if (smallImgEl) smallImgEl.classList.add("hidden");

  const artwork = await resolveGameArtwork(game);
  // Chống race-condition nếu đổi game nhanh
  if (currentGameName !== expectedSignature) return;

  imgEl.src = artwork.url;
  imgEl.style.objectPosition = artwork.pos || "center";

  // Hiển thị huy hiệu góc nhỏ (small_image: rank, tướng đang chơi, ngôn ngữ code...) nếu có
  if (smallImgEl && game.assets?.small_image && !artwork.usedSmallAsMain) {
    const smallUrl = resolveImage(game.assets.small_image, game.application_id, "png");
    if (await canLoadImage(smallUrl)) {
      if (currentGameName !== expectedSignature) return;
      smallImgEl.src = smallUrl;
      smallImgEl.title = game.assets?.small_text || "";
      smallImgEl.classList.remove("hidden");
    }
  }
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// ============================================================
//  INTERACTIVE SPOTLIGHT HOVER ON BENTO CARDS
// ============================================================
document.querySelectorAll(".spotlight-card").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
  });
});

// ============================================================
//  PROJECT CATEGORY FILTERING
// ============================================================
const filterBtns = document.querySelectorAll(".filter-btn");
const projectCards = document.querySelectorAll("#projects-grid > a[data-category]");

// Store original col-span classes for "all" view
projectCards.forEach((card) => {
  const spanClass = Array.from(card.classList).find((c) => c.startsWith("md:col-span-"));
  if (spanClass) card.dataset.origSpan = spanClass;
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const filter = btn.dataset.filter;
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    projectCards.forEach((card) => {
      const cat = card.dataset.category;
      const origSpan = card.dataset.origSpan;
      card.classList.remove("md:col-span-7", "md:col-span-6", "md:col-span-5", "md:col-span-4");

      if (filter === "all") {
        card.style.display = "";
        if (origSpan) card.classList.add(origSpan);
      } else if (cat === filter) {
        card.style.display = "";
        card.classList.add(filter === "app" ? "md:col-span-6" : "md:col-span-4");
      } else {
        card.style.display = "none";
      }
    });
  });
});

// ============================================================
//  COPY ACTIONS (Email & Discord Handle)
// ============================================================
const copyEmailBtn = document.getElementById("copy-email-btn");
if (copyEmailBtn) {
  copyEmailBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("hungnopro20cm@gmail.com");
      showToast("Đã sao chép email: hungnopro20cm@gmail.com");
    } catch (e) {
      showToast("hungnopro20cm@gmail.com");
    }
  });
}

const rpcHandleBtn = document.getElementById("rpc-handle");
if (rpcHandleBtn) {
  rpcHandleBtn.addEventListener("click", async () => {
    const uname = rpcHandleBtn.dataset.username || rpcHandleBtn.textContent.replace("@", "").trim();
    try {
      await navigator.clipboard.writeText(uname);
      showToast(`Đã sao chép Discord username: @${uname}`);
    } catch (e) {
      showToast(`@${uname}`);
    }
  });
}

// ============================================================
//  BUILT-IN VINYL MUSIC PLAYER ("Way Back Home")
// ============================================================
const bgmAudio = document.getElementById("bgm-audio");
const playBtn = document.getElementById("music-play-btn");
const playIcon = document.getElementById("music-play-icon");
const navMusicBtn = document.getElementById("nav-music-btn");
const vinylDisc = document.getElementById("vinyl-disc");
const musicEq = document.getElementById("music-eq");
const musicSeek = document.getElementById("music-seek");
const musicCurrent = document.getElementById("music-current");
const musicTotal = document.getElementById("music-total");

function syncMusicUI(isPlaying) {
  if (vinylDisc) vinylDisc.classList.toggle("spinning", isPlaying);
  if (musicEq) musicEq.classList.toggle("paused", !isPlaying);
  if (navMusicBtn) navMusicBtn.classList.toggle("playing", isPlaying);
  if (playIcon) {
    playIcon.innerHTML = isPlaying
      ? '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }
}

function toggleMusic() {
  if (!bgmAudio) return;
  if (bgmAudio.paused) {
    bgmAudio.volume = 0.55;
    bgmAudio.play().then(() => {
      syncMusicUI(true);
      showToast("♫ Đang phát: Way Back Home");
    }).catch(() => {});
  } else {
    bgmAudio.pause();
    syncMusicUI(false);
  }
}

if (playBtn) playBtn.addEventListener("click", toggleMusic);
if (navMusicBtn) navMusicBtn.addEventListener("click", toggleMusic);

if (bgmAudio) {
  bgmAudio.addEventListener("loadedmetadata", () => {
    if (musicTotal && isFinite(bgmAudio.duration)) {
      musicTotal.textContent = formatTime(bgmAudio.duration * 1000);
    }
  });

  bgmAudio.addEventListener("timeupdate", () => {
    if (!isFinite(bgmAudio.duration) || bgmAudio.duration === 0) return;
    const pct = (bgmAudio.currentTime / bgmAudio.duration) * 100;
    if (musicSeek) musicSeek.value = pct;
    if (musicCurrent) musicCurrent.textContent = formatTime(bgmAudio.currentTime * 1000);
    if (musicTotal) musicTotal.textContent = formatTime(bgmAudio.duration * 1000);
  });

  bgmAudio.addEventListener("ended", () => syncMusicUI(false));
}

if (musicSeek && bgmAudio) {
  musicSeek.addEventListener("input", () => {
    if (isFinite(bgmAudio.duration) && bgmAudio.duration > 0) {
      bgmAudio.currentTime = (musicSeek.value / 100) * bgmAudio.duration;
    }
  });
}

// ============================================================
//  SCROLL PROGRESS, NAVBAR & DYNAMIC THEME COLOR
// ============================================================
const scrollProgress = document.getElementById("scroll-progress");
const nav = document.getElementById("nav");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

window.addEventListener("scroll", () => {
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const scrolled = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
  if (scrollProgress) scrollProgress.style.width = `${scrolled}%`;

  if (nav) {
    if (window.scrollY > 36) nav.classList.add("scrolled");
    else nav.classList.remove("scrolled");
  }

  if (themeColorMeta) {
    const t = Math.min(1, Math.max(0, scrolled / 100));
    themeColorMeta.setAttribute("content", lerpColor(PROGRESS_COLOR_START, PROGRESS_COLOR_END, t));
  }
});

// ============================================================
//  SCROLL REVEAL
// ============================================================
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// ============================================================
//  MOBILE MENU & ACTIVE NAV TRACKING
// ============================================================
const menuToggle = document.getElementById("menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");
if (menuToggle && mobileMenu) {
  menuToggle.addEventListener("click", () => mobileMenu.classList.toggle("open"));
  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => mobileMenu.classList.remove("open"));
  });
}

const navSections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll(".nav-link");

const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
        });
      }
    });
  },
  { rootMargin: "-45% 0px -45% 0px" }
);
navSections.forEach((section) => navObserver.observe(section));

// ============================================================
//  INIT
// ============================================================
typeEffect();
syncProfileEffect({ sku_id: STARFALL_ROSE_SKU }, [{ type: 3 }]);
fetchDiscordProfile();
fetchLanyard();
setInterval(fetchLanyard, 3000);
setInterval(fetchDiscordProfile, 15000);
