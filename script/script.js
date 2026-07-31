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

    // Xóa interval cũ nếu có
  if (gameInterval) clearInterval(gameInterval);

  // Render Game
  if (game) {
    document.getElementById("rpc-game-name").textContent = game.name || "Unknown";
    let detailsText = [game.details, game.state].filter(Boolean).join(" - ");
    document.getElementById("rpc-game-state").textContent = detailsText || "";
    
    const imgEl = document.getElementById("rpc-game-img");
    const timeEl = document.getElementById("rpc-game-time");
    
    // Chỉ cập nhật ảnh nếu tên game thay đổi (tránh chớp ảnh do API gọi lại mỗi 3s)
    if (game.name !== currentGameName) {
      currentGameName = game.name;
      imgEl.style.objectPosition = "center";
      
      const fallbackImg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234a4a56"><path d="M7.5 6C4.46 6 2 8.46 2 11.5S4.46 17 7.5 17c1.71 0 3.21-.82 4.13-2.06h1.74C14.29 16.18 15.79 17 17.5 17c3.04 0 5.5-2.46 5.5-5.5S20.54 6 17.5 6h-10zM7.5 14C6.12 14 5 12.88 5 11.5S6.12 9 7.5 9 10 10.12 10 11.5 8.88 14 7.5 14zm10 0c-1.38 0-2.5-1.12-2.5-2.5S16.12 9 17.5 9 20 10.12 20 11.5 18.88 14 17.5 14z"/></svg>';
      
      if (game.assets?.large_image) {
        imgEl.src = resolveImage(game.assets.large_image, game.application_id);
        imgEl.onerror = () => { 
          imgEl.src = fallbackImg; 
          fetchSteamImage(game.name, imgEl, fallbackImg); 
        };
      } else {
        imgEl.src = fallbackImg;
        fetchSteamImage(game.name, imgEl, fallbackImg);
      }
    }

    // Xử lý đồng hồ đếm thời gian chơi (vẫn cập nhật mỗi 3s nhưng không ảnh hưởng ảnh)
    if (game.timestamps?.start) {
      const updateGameTime = () => {
        const elapsed = Date.now() - game.timestamps.start;
        timeEl.textContent = `${formatDuration(elapsed)} đã trôi qua`;
      };
      updateGameTime();
      gameInterval = setInterval(updateGameTime, 1000);
    } else {
      timeEl.textContent = "";
    }
    
    gameEl.classList.remove("hidden");
    hasActivity = true;
  } else {
    // Nếu không chơi game, xóa interval và reset tên game
    if (gameInterval) clearInterval(gameInterval);
    currentGameName = ""; // Reset để lần sau chơi lại game đó sẽ fetch lại ảnh
  }

  // Render Media
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
}

function getActivityIcon(activity, btnText = "") {
  const text = btnText.toLowerCase();
  // Nếu là Spotify
  if (activity.id === "spotify:1") return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.301.42-1.021.6-1.561.3z"/></svg>';
  // Nếu là Game (type 0 hoặc có chữ join)
  if (activity.type === 0 || text.includes('join') || text.includes('spectate')) return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 6C4.46 6 2 8.46 2 11.5S4.46 17 7.5 17c1.71 0 3.21-.82 4.13-2.06h1.74C14.29 16.18 15.79 17 17.5 17c3.04 0 5.5-2.46 5.5-5.5S20.54 6 17.5 6h-10zM7.5 14C6.12 14 5 12.88 5 11.5S6.12 9 7.5 9 10 10.12 10 11.5 8.88 14 7.5 14zm10 0c-1.38 0-2.5-1.12-2.5-2.5S16.12 9 17.5 9 20 10.12 20 11.5 18.88 14 17.5 14z"/></svg>';
  // Nếu là Video (type 3 hoặc có chữ watch)
  if (activity.type === 3 || text.includes('watch')) return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  // Nếu là Music (type 2 hoặc có chữ listen)
  if (activity.type === 2 || text.includes('listen')) return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
  // Mặc định (Icon mở link ngoài)
  return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';
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

// ============================================================
//  IMAGE RESOLVER (Xử lý link ảnh chuẩn nhất)
// ============================================================
function resolveImage(imageId, appId) {
  if (!imageId) return "";
  if (imageId.startsWith("http")) return imageId;
  if (imageId.startsWith("spotify:")) return `https://i.scdn.co/image/${imageId.slice(8)}`;
  if (imageId.startsWith("mp:external/")) return `https://media.discordapp.net/${imageId.slice(3)}`;
  if (appId) return `https://cdn.discordapp.com/app-assets/${appId}/${imageId}.png`;
  return "";
}

// ============================================================
//  STEAM IMAGE FALLBACK (Lấy ảnh icon HD & Lọc tên chính xác)
// ============================================================
async function fetchSteamImage(gameName, imgEl, fallbackImg) {
  if (!gameName) return;
  
  try {
    const searchUrl = `https://corsproxy.io/?url=${encodeURIComponent(`https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(gameName)}`)}`;
    const res = await fetch(searchUrl);
    const data = await res.json();
    
    if (data && data.length > 0) {
      let bestMatch = null;
      
      // Lọc tìm kết quả khớp chính xác nhất để tránh lấy nhầm bản sequel (vd: RDR2 thay vì RDR1)
      for (let item of data) {
        if (item.name.toLowerCase() === gameName.toLowerCase()) {
          bestMatch = item;
          break;
        }
      }
      // Nếu không có kết quả chính xác tuyệt đối, tìm kết quả bắt đầu bằng tên game và không chứa số 2/3
      if (!bestMatch) {
        for (let item of data) {
          if (item.name.toLowerCase().startsWith(gameName.toLowerCase()) && !item.name.toLowerCase().match(/[23]/)) {
            bestMatch = item;
            break;
          }
        }
      }
      // Nếu vẫn không có, lấy kết quả đầu tiên
      if (!bestMatch) bestMatch = data[0];

      const appId = bestMatch.appid;
      
      const tryLoadImage = (url) => {
        return new Promise((resolve) => {
          const testImg = new Image();
          testImg.onload = () => resolve(true);
          testImg.onerror = () => resolve(false);
          testImg.src = url;
        });
      };

      const library2xUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
      const libraryUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
      const headerUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
      
      if (await tryLoadImage(library2xUrl)) {
        imgEl.src = library2xUrl;
        imgEl.style.objectPosition = "top center";
      } else if (await tryLoadImage(libraryUrl)) {
        imgEl.src = libraryUrl;
        imgEl.style.objectPosition = "top center";
      } else if (await tryLoadImage(headerUrl)) {
        imgEl.src = headerUrl;
        imgEl.style.objectPosition = "center";
      } else {
        imgEl.src = fallbackImg;
        imgEl.style.objectPosition = "center";
      }
    }
  } catch (error) {
    console.log("Không thể lấy ảnh Steam:", error);
  }
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
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