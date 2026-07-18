// ============================================================
//  CONFIG
// ============================================================
const DISCORD_ID = "756800068065165394"; // ID của bạn

// ============================================================
//  Typewriter Effect (Hiệu ứng gõ chữ)
// ============================================================
const phrases = [
  "I build things for the web",
  "Một chiếc web giới thiệu đơn giản",
  "Chào mừng vị khách mới",
  "Lướt xuống sẽ thấy điều kì diệu",
  "How are you, I'm fine thank you and you?"
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
      setTimeout(typeEffect, 500); // Đợi 0.5s trước khi gõ câu mới
    } else {
      setTimeout(typeEffect, 40); // Tốc độ xoá chữ
    }
  } else {
    charIndex++;
    textEl.textContent = currentPhrase.substring(0, charIndex);
    if (charIndex === currentPhrase.length) {
      isDeleting = true;
      setTimeout(typeEffect, 2000); // Đợi 2s trước khi xoá
    } else {
      setTimeout(typeEffect, 100); // Tốc độ gõ chữ
    }
  }
}

// ============================================================
//  Random Idle Messages (F5 để đổi câu)
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
const randomIdleMessage = idleMessages[Math.floor(Math.random() * idleMessages.length)];

// ============================================================
//  Lanyard API Polling
// ============================================================
let spotifyInterval = null;
let currentMediaData = null;

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
  const status = presence.discord_status;
  const statusColors = {
    online: "#43b581", idle: "#faa61a", dnd: "#f04747", offline: "#747f8d"
  };

  // --- Update Avatar ---
  const avatarEl = document.getElementById("rpc-avatar");
  const placeholderEl = document.getElementById("rpc-avatar-placeholder");
  let avatarUrl;
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    avatarUrl = `https://cdn.discordapp.com/avatars/${DISCORD_ID}/${user.avatar}.${ext}?size=128`;
  } else {
    const index = (BigInt(DISCORD_ID) >> 22n) % 6n;
    avatarUrl = `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  avatarEl.src = avatarUrl;
  avatarEl.onload = () => {
    avatarEl.style.opacity = "1";
    placeholderEl.style.display = "none";
  };

  // --- Update Status Indicator ---
  const statusIndicator = document.getElementById("rpc-status-indicator");
  statusIndicator.style.background = statusColors[status] || "#747f8d";

  // --- Update Username ---
  const displayName = user.display_name || user.global_name || user.username || "Unknown";
  document.getElementById("rpc-username").textContent = displayName;

  // --- Update Custom Status ---
  const customStatus = presence.activities?.find((a) => a.type === 4);
  const customStatusEl = document.getElementById("rpc-custom-status");
  if (customStatus && (customStatus.state || customStatus.emoji)) {
    customStatusEl.classList.remove("hidden");
    const emojiEl = document.getElementById("rpc-custom-emoji");
    const textEl = document.getElementById("rpc-custom-text");
    if (customStatus.emoji) {
      if (customStatus.emoji.id) {
        const ext = customStatus.emoji.animated ? "gif" : "png";
        emojiEl.innerHTML = `<img src="https://cdn.discordapp.com/emojis/${customStatus.emoji.id}.${ext}" style="width:14px;height:14px;" alt="" />`;
      } else if (customStatus.emoji.name) {
        emojiEl.textContent = customStatus.emoji.name;
      }
    } else { emojiEl.textContent = ""; }
    textEl.textContent = customStatus.state || "";
  } else {
    customStatusEl.classList.add("hidden");
  }

  // --- Update Navbar Status ---
  let navStatusText = status === "online" ? "Online" : status === "idle" ? "Idle" : status === "dnd" ? "Do Not Disturb" : "Offline";
  
  const game = presence.activities?.find((a) => a.type === 0);
  const mediaActivity = presence.activities?.find((a) => (a.type === 2 || a.type === 3) && a.id !== "custom-status"); 

  if (status !== "offline") {
    if (mediaActivity) navStatusText = `${mediaActivity.type === 3 ? 'Watching' : 'Listening to'} ${mediaActivity.name}`;
    else if (game) navStatusText = `Playing ${game.name}`;
  }
  
  const navDot = document.getElementById("nav-status-dot");
  const navText = document.getElementById("nav-status-text");
  if (navDot) navDot.style.background = statusColors[status] || "#747f8d";
  if (navText) navText.textContent = navStatusText;

  // --- Update Activities UI ---
  const noActEl = document.getElementById("rpc-no-activity");
  const gameEl = document.getElementById("rpc-game");
  const spotifyEl = document.getElementById("rpc-spotify");

  noActEl.classList.add("hidden");
  gameEl.classList.add("hidden");
  spotifyEl.classList.add("hidden");

  let hasActivity = false;

  if (game) {
    document.getElementById("rpc-game-name").textContent = game.name || "Unknown";
    let detailsText = [game.details, game.state].filter(Boolean).join(" - ");
    document.getElementById("rpc-game-state").textContent = detailsText || "";
    
    const imgEl = document.getElementById("rpc-game-img");
    if (game.assets?.large_image) {
      imgEl.src = resolveImage(game.assets.large_image, game.application_id);
      imgEl.style.display = "block";
    } else {
      imgEl.style.display = "none";
    }
    
    gameEl.classList.remove("hidden");
    hasActivity = true;
  }

  if (mediaActivity) {
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
      imgEl.src = "";
    }
    
    document.getElementById("rpc-spotify-song").textContent = mediaActivity.details || "Unknown";
    document.getElementById("rpc-spotify-artist").textContent = mediaActivity.state ? `${mediaActivity.state}` : "";

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

  if (!hasActivity) {
    noActEl.innerHTML = `<div class="text-xs" style="color: var(--muted);">${randomIdleMessage}</div>`;
    noActEl.classList.remove("hidden");
  }
}

function updateMediaProgress() {
  if (!currentMediaData || !currentMediaData.timestamps) return;
  
  const start = currentMediaData.timestamps.start || Date.now();
  const end = currentMediaData.timestamps.end || Date.now();
  const total = end - start;
  const current = Date.now() - start;
  
  if (current >= total) {
    clearInterval(spotifyInterval);
    fetchLanyard(); 
    return;
  }
  
  const pct = Math.min(100, (current / total) * 100);
  document.getElementById("rpc-spotify-progress").style.width = `${pct}%`;
  document.getElementById("rpc-spotify-current").textContent = formatTime(current);
}

function resolveImage(imageId, appId) {
  if (!imageId) return "";
  if (imageId.startsWith("http")) return imageId;
  if (imageId.startsWith("spotify:")) return `https://i.scdn.co/image/${imageId.slice(8)}`;
  if (imageId.startsWith("mp:external/")) return `https://media.discordapp.net/${imageId.slice(3)}`;
  if (appId) return `https://cdn.discordapp.com/app-assets/${appId}/${imageId}.png`;
  return "";
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ============================================================
//  Scroll Progress & Nav Background
// ============================================================
const scrollProgress = document.getElementById("scroll-progress");
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
  scrollProgress.style.width = `${scrolled}%`;
  if (window.scrollY > 50) nav.classList.add("scrolled");
  else nav.classList.remove("scrolled");
});

// ============================================================
//  Scroll Reveal
// ============================================================
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// ============================================================
//  Mobile Menu
// ============================================================
const menuToggle = document.getElementById("menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");
menuToggle.addEventListener("click", () => mobileMenu.classList.toggle("open"));
mobileMenu.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => mobileMenu.classList.remove("open"));
});

// ============================================================
//  Active Nav Link Tracking (Sửa lỗi sáng vĩnh viễn)
// ============================================================
const navSections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll(".nav-link");

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute("id");
      navLinks.forEach(link => {
        // Xóa active ở tất cả các tab
        link.classList.remove("active");
        // Thêm active cho tab tương ứng
        if (link.getAttribute("href") === `#${id}`) {
          link.classList.add("active");
        }
      });
    }
  });
}, { 
  // Chỉ kích hoạt khi section ở giữa màn hình (tránh lỗi kẹt active)
  rootMargin: "-50% 0px -50% 0px" 
});

navSections.forEach(section => navObserver.observe(section));

// ============================================================
//  Init
// ============================================================
typeEffect(); // Bắt đầu gõ chữ
fetchLanyard();
setInterval(fetchLanyard, 3000);
