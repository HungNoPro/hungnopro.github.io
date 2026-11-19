// ============================================================
//  BLACKJACK VIP — ROYAL MONTE CARLO EDITION (script/game.js)
// ============================================================

const HIGH_SCORE_KEY = "bj_vip_high_score_v1";
const SOUND_KEY = "bj_vip_sound_v1";

// ===== STATE =====
let balance = 1000;
let highScore = 1000;
let currentBet = 0;
let deck = [];
let playerHand = [];
let dealerHand = [];
let canHit = false;
let gameActive = false;
let isAllIn = false;
let soundEnabled = true;
let heartbeatInterval = null;

try {
    const savedPeak = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10);
    if (!isNaN(savedPeak) && savedPeak > 1000) highScore = savedPeak;
    const savedSound = localStorage.getItem(SOUND_KEY);
    if (savedSound === "0") soundEnabled = false;
} catch (e) {}

// ===== AUDIO ENGINE =====
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

function playSound(freq, duration, type = "sine", volume = 0.1) {
    if (!soundEnabled) return;
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

function soundDeal() { playSound(820, 0.05, "square", 0.045); }
function soundChip() {
    playSound(1250, 0.07, "sine", 0.09);
    setTimeout(() => playSound(950, 0.05, "sine", 0.08), 45);
}
function soundWin() {
    playSound(523.25, 0.1);
    setTimeout(() => playSound(659.25, 0.1), 100);
    setTimeout(() => playSound(783.99, 0.22), 200);
}
function soundLose() {
    playSound(210, 0.2, "sawtooth", 0.09);
    setTimeout(() => playSound(150, 0.3, "sawtooth", 0.09), 150);
}
function soundCoin() { playSound(1550, 0.045, "square", 0.06); }

function toggleSound() {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0"); } catch (e) {}
    syncSoundIcon();
    if (!soundEnabled) stopHeartbeat();
    else if (isAllIn && gameActive) startHeartbeat();
}

function syncSoundIcon() {
    const onIcon = document.getElementById("sound-icon-on");
    const offIcon = document.getElementById("sound-icon-off");
    if (onIcon && offIcon) {
        onIcon.classList.toggle("hidden", !soundEnabled);
        offIcon.classList.toggle("hidden", soundEnabled);
    }
}

// Heartbeat
function soundHeartbeat() {
    if (!soundEnabled) return;
    playSound(60, 0.12, "sine", 0.38);
    setTimeout(() => playSound(50, 0.18, "sine", 0.46), 180);
}
function startHeartbeat() {
    if (heartbeatInterval || !soundEnabled) return;
    soundHeartbeat();
    heartbeatInterval = setInterval(soundHeartbeat, 1000);
}
function stopHeartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
}

// Rewind
function playRewindSound() {
    if (!soundEnabled) return;
    let freq = 2000;
    const interval = setInterval(() => {
        playSound(freq, 0.05, "sawtooth", 0.045);
        freq -= 150;
        if (freq <= 200) clearInterval(interval);
    }, 60);
}

// ===== DECK & LOGIC =====
function buildDeck() {
    const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"];
    const types = ["C", "D", "H", "S"];
    deck = [];
    for (let i = 0; i < types.length; i++) {
        for (let j = 0; j < values.length; j++) {
            deck.push(values[j] + "-" + types[i]);
        }
    }
}
function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}
function cardImage(card) { return "./cards/" + card.replace("-", "") + ".svg"; }
function getCardValue(card) {
    const v = card.split("-")[0];
    if (v === "T" || v === "J" || v === "Q" || v === "K") return 10;
    if (v === "A") return 11;
    return parseInt(v, 10);
}
function calculateScore(hand) {
    let score = 0, aces = 0;
    for (let card of hand) {
        score += getCardValue(card);
        if (card[0] === "A") aces++;
    }
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    return score;
}

// ===== UI RENDERING =====
function formatMoney(num) {
    return "$" + Number(num || 0).toLocaleString("en-US");
}

function createCardElement(card, hidden = false) {
    const wrapper = document.createElement("div");
    wrapper.className = "card-wrapper";
    if (hidden) wrapper.classList.add("hidden");
    const inner = document.createElement("div");
    inner.className = "card-inner";
    const front = document.createElement("div");
    front.className = "card-face card-front";
    front.style.backgroundImage = `url('${cardImage(card)}')`;
    const back = document.createElement("div");
    back.className = "card-face card-back";
    inner.appendChild(front);
    inner.appendChild(back);
    wrapper.appendChild(inner);
    return wrapper;
}

function dealCard(hand, elementId, hidden = false) {
    return new Promise((resolve) => {
        const card = deck.pop();
        hand.push(card);
        const cardEl = createCardElement(card, hidden);
        document.getElementById(elementId).appendChild(cardEl);
        soundDeal();
        setTimeout(resolve, 280);
    });
}

function updateScores(hideDealer = true) {
    document.getElementById("player-sum").innerText = calculateScore(playerHand);
    if (hideDealer && dealerHand.length > 0) {
        document.getElementById("dealer-sum").innerText = calculateScore([dealerHand[0]]) + " + ?";
    } else {
        document.getElementById("dealer-sum").innerText = calculateScore(dealerHand);
    }
}

function syncDoubleButton() {
    const doubleBtn = document.getElementById("double-btn");
    if (!doubleBtn) return;
    // Double Down chỉ khả dụng khi đang ở 2 lá đầu tiên và đủ số dư để nhân đôi cược
    const canDouble = canHit && playerHand.length === 2 && balance >= currentBet && currentBet > 0;
    doubleBtn.disabled = !canDouble;
}

// ===== EFFECTS =====
function spawnCoins(betAmount) {
    let coinCount = 15, velocityMul = 1;
    if (betAmount >= 2000) { coinCount = 55; velocityMul = 2.4; }
    else if (betAmount >= 700) { coinCount = 38; velocityMul = 1.9; }
    else if (betAmount >= 200) { coinCount = 24; velocityMul = 1.45; }

    const table = document.querySelector(".game-table").getBoundingClientRect();
    const cX = table.left + table.width / 2, cY = table.top + table.height / 2;

    for (let i = 0; i < coinCount; i++) {
        const coin = document.createElement("div");
        coin.className = "coin";
        coin.innerText = "$";
        coin.style.left = `${cX}px`;
        coin.style.top = `${cY}px`;
        document.body.appendChild(coin);
        const angle = Math.random() * Math.PI - Math.PI / 2;
        const velocity = (100 + Math.random() * 150) * velocityMul;
        coin.style.setProperty("--tx", `${Math.cos(angle) * velocity}px`);
        coin.style.setProperty("--ty", `${Math.sin(angle) * velocity}px`);
        const delay = i * (20 / velocityMul);
        coin.style.animation = `coin-fly 1s ease-out forwards`;
        coin.style.animationDelay = `${delay}ms`;
        setTimeout(soundCoin, delay);
        setTimeout(() => coin.remove(), 1200 + delay);
    }
}

function showWinText(amount) {
    const el = document.createElement("div");
    el.className = "win-amount";
    el.innerText = `+${formatMoney(amount)}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

function spawnConfetti() {
    const colors = ["#e5bd52", "#10b981", "#38bdf8", "#f43f5e", "#a855f7", "#ffffff"];
    for (let i = 0; i < 55; i++) {
        const c1 = document.createElement("div");
        c1.className = "confetti";
        c1.style.left = "0px";
        c1.style.bottom = "0px";
        c1.style.background = colors[Math.floor(Math.random() * colors.length)];
        c1.style.setProperty("--tx", `${Math.random() * 100 + 50}vw`);
        c1.style.setProperty("--ty", `-${Math.random() * 80 + 20}vh`);
        c1.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
        document.body.appendChild(c1);

        const c2 = document.createElement("div");
        c2.className = "confetti";
        c2.style.right = "0px";
        c2.style.bottom = "0px";
        c2.style.background = colors[Math.floor(Math.random() * colors.length)];
        c2.style.setProperty("--tx", `-${Math.random() * 100 + 50}vw`);
        c2.style.setProperty("--ty", `-${Math.random() * 80 + 20}vh`);
        c2.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
        document.body.appendChild(c2);
        setTimeout(() => { c1.remove(); c2.remove(); }, 1600);
    }
}

// ===== GAME FLOW =====
function placeBet(amount) {
    if (gameActive) return;
    if (amount <= 0) {
        showMessage("Số dư đã hết để đặt thêm!", "#fb7185");
        return;
    }
    if (balance < amount) {
        showMessage("Không đủ số dư cho mệnh giá này!", "#fb7185");
        return;
    }
    balance -= amount;
    currentBet += amount;
    soundChip();
    updateStats();
    showMessage(`Đã cược ${formatMoney(currentBet)} — Bấm DEAL để chia bài!`);
}

function resetBet() {
    if (gameActive || currentBet === 0) return;
    balance += currentBet;
    currentBet = 0;
    soundChip();
    updateStats();
    showMessage("Chọn phỉnh chip và bấm DEAL");
}

async function startGame() {
    if (currentBet === 0) {
        showMessage("Hãy chọn phỉnh chip đặt cược trước!", "#fb7185");
        return;
    }

    if (balance === 0) {
        isAllIn = true;
        document.body.classList.add("suspense-mode");
        startHeartbeat();
    }

    gameActive = true;
    buildDeck();
    shuffleDeck();
    playerHand = [];
    dealerHand = [];
    document.getElementById("dealer-cards").innerHTML = "";
    document.getElementById("player-cards").innerHTML = "";
    document.getElementById("hit-btn").disabled = true;
    document.getElementById("stay-btn").disabled = true;
    syncDoubleButton();
    document.getElementById("deal-btn").disabled = true;
    document.getElementById("allin-btn").disabled = true;
    document.getElementById("reset-btn").disabled = true;
    document.getElementById("betting-area").style.display = "none";
    document.getElementById("game-controls").style.display = "flex";

    showMessage(isAllIn ? "ALL IN! Chúc bạn may mắn..." : "Đang chia bài...");

    await dealCard(playerHand, "player-cards");
    updateScores();
    await dealCard(dealerHand, "dealer-cards", true);
    updateScores();
    await dealCard(playerHand, "player-cards");
    updateScores();
    await dealCard(dealerHand, "dealer-cards");
    updateScores();

    canHit = true;
    document.getElementById("hit-btn").disabled = false;
    document.getElementById("stay-btn").disabled = false;
    syncDoubleButton();

    if (calculateScore(playerHand) === 21) {
        stand();
    } else if (!isAllIn) {
        showMessage("Lượt của bạn — Hit, Stand hay 2× Double?");
    }
}

async function hit() {
    if (!canHit) return;
    canHit = false;
    syncDoubleButton();
    await dealCard(playerHand, "player-cards");
    updateScores();
    if (calculateScore(playerHand) > 21) {
        showMessage("Bust! (Quá 21 điểm)", "#fb7185");
        stand();
    } else if (calculateScore(playerHand) === 21) {
        stand();
    } else {
        canHit = true;
        syncDoubleButton();
    }
}

async function doubleDown() {
    if (!canHit || playerHand.length !== 2 || balance < currentBet || currentBet <= 0) return;
    canHit = false;
    balance -= currentBet;
    currentBet *= 2;
    if (balance === 0) {
        isAllIn = true;
        document.body.classList.add("suspense-mode");
        startHeartbeat();
    }
    soundChip();
    updateStats();
    syncDoubleButton();
    document.getElementById("hit-btn").disabled = true;
    document.getElementById("stay-btn").disabled = true;
    showMessage(`2× DOUBLE DOWN (${formatMoney(currentBet)})! Rút 1 lá duy nhất...`, "#c4b5fd");

    await dealCard(playerHand, "player-cards");
    updateScores();
    await new Promise((r) => setTimeout(r, 350));
    stand();
}

async function stand() {
    canHit = false;
    gameActive = false;
    document.getElementById("hit-btn").disabled = true;
    document.getElementById("stay-btn").disabled = true;
    syncDoubleButton();

    const dealerCards = document.getElementById("dealer-cards").children;
    if (dealerCards[1] && dealerCards[1].classList.contains("hidden")) {
        dealerCards[1].classList.remove("hidden");
        soundDeal();
        await new Promise((r) => setTimeout(r, 480));
    }
    updateScores(false);

    // Nếu người chơi chưa Bust thì nhà cái mới cần rút tiếp tới 17
    if (calculateScore(playerHand) <= 21) {
        while (calculateScore(dealerHand) < 17) {
            await dealCard(dealerHand, "dealer-cards");
            updateScores(false);
            await new Promise((r) => setTimeout(r, 380));
        }
    }
    determineWinner();
}

function determineWinner() {
    stopHeartbeat();
    document.body.classList.remove("suspense-mode");

    const pScore = calculateScore(playerHand), dScore = calculateScore(dealerHand);
    const isBlackjack = pScore === 21 && playerHand.length === 2;
    const dealerBlackjack = dScore === 21 && dealerHand.length === 2;
    let msg = "", color = "#fbe698", winAmount = 0;

    if (pScore > 21) {
        msg = "Bạn thua! (Bust quá 21)";
        color = "#fb7185";
        soundLose();
        flashBackground("lose");
    } else if (dScore > 21) {
        if (isBlackjack) {
            winAmount = Math.floor(currentBet * 2.5);
            msg = `BLACKJACK! Nhà cái Bust (+${formatMoney(winAmount)})`;
            color = "#fde047";
        } else {
            winAmount = currentBet * 2;
            msg = `Nhà cái Bust! Bạn thắng (+${formatMoney(winAmount)})`;
            color = "#34d399";
        }
        balance += winAmount;
        soundWin();
        flashBackground("win");
        spawnCoins(currentBet);
        showWinText(winAmount);
        if (isAllIn) spawnConfetti();
    } else if (pScore === dScore) {
        if (isBlackjack && !dealerBlackjack) {
            winAmount = Math.floor(currentBet * 2.5);
            balance += winAmount;
            msg = `BLACKJACK THƯỢNG HẠNG! Thắng 3:2 (+${formatMoney(winAmount)})`;
            color = "#fde047";
            soundWin();
            flashBackground("win");
            spawnCoins(currentBet);
            showWinText(winAmount);
        } else if (!isBlackjack && dealerBlackjack) {
            msg = "Nhà cái có Blackjack! Bạn thua!";
            color = "#fb7185";
            soundLose();
            flashBackground("lose");
        } else {
            msg = "Hòa (Push) — Hoàn tiền cược";
            color = "#fcd34d";
            balance += currentBet;
        }
    } else if (pScore > dScore) {
        if (isBlackjack) {
            winAmount = Math.floor(currentBet * 2.5);
            msg = `BLACKJACK! Thắng 3:2 (+${formatMoney(winAmount)})`;
            color = "#fde047";
        } else {
            winAmount = currentBet * 2;
            msg = `Bạn thắng! (+${formatMoney(winAmount)})`;
            color = "#34d399";
        }
        balance += winAmount;
        soundWin();
        flashBackground("win");
        spawnCoins(currentBet);
        showWinText(winAmount);
        if (isAllIn) spawnConfetti();
    } else {
        msg = "Nhà cái điểm cao hơn — Bạn thua!";
        color = "#fb7185";
        soundLose();
        flashBackground("lose");
    }

    if (balance > highScore) {
        highScore = balance;
        try { localStorage.setItem(HIGH_SCORE_KEY, String(highScore)); } catch (e) {}
    }

    showMessage(msg, color);
    isAllIn = false;
    currentBet = 0;
    updateStats();

    if (balance <= 0) {
        document.getElementById("next-btn").disabled = true;
        setTimeout(gameOverSequence, 1500);
    } else {
        document.getElementById("next-btn").disabled = false;
    }
}

function gameOverSequence() {
    document.body.classList.add("gray-state");
    const overlay = document.createElement("div");
    overlay.className = "game-over-overlay active";
    overlay.innerHTML = '<div class="lose-text">BANKRUPT</div>';
    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.remove();
        const rewind = document.createElement("div");
        rewind.className = "rewind-overlay";
        document.body.appendChild(rewind);
        playRewindSound();

        setTimeout(() => {
            rewind.style.opacity = "0";
            setTimeout(() => {
                rewind.remove();
                document.body.classList.remove("gray-state");
                balance = 1000;
                newRound();
            }, 600);
        }, 2500);
    }, 1500);
}

function newRound() {
    document.getElementById("dealer-cards").innerHTML = "";
    document.getElementById("player-cards").innerHTML = "";
    document.getElementById("dealer-sum").innerText = "0";
    document.getElementById("player-sum").innerText = "0";
    document.getElementById("next-btn").disabled = true;
    document.getElementById("deal-btn").disabled = false;
    document.getElementById("allin-btn").disabled = false;
    document.getElementById("reset-btn").disabled = false;
    document.getElementById("betting-area").style.display = "flex";
    document.getElementById("game-controls").style.display = "none";
    showMessage("Chọn phỉnh chip và bấm DEAL");
    updateStats();
}

// ===== UI HELPERS =====
function updateStats() {
    document.getElementById("balance").innerText = formatMoney(balance);
    document.getElementById("current-bet").innerText = formatMoney(currentBet);
    const hsEl = document.getElementById("high-score");
    if (hsEl) hsEl.innerText = formatMoney(highScore);

    const potPill = document.getElementById("pot-pill");
    const potAmount = document.getElementById("pot-amount");
    if (potPill && potAmount) {
        potAmount.innerText = `POT: ${formatMoney(currentBet)}`;
        potPill.classList.toggle("hidden", currentBet <= 0);
    }
}

function showMessage(text, color = "#fbe698") {
    const msg = document.getElementById("message");
    if (!msg) return;
    msg.innerText = text;
    msg.style.color = color;
}

function flashBackground(type) {
    document.body.classList.add(type === "win" ? "win-flash" : "lose-flash");
    setTimeout(() => document.body.classList.remove("win-flash", "lose-flash"), 1000);
}

document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === "h" && !document.getElementById("hit-btn").disabled) hit();
    else if (key === "s" && !document.getElementById("stay-btn").disabled) stand();
    else if (key === "d" && !document.getElementById("double-btn").disabled) doubleDown();
    else if ((key === " " || key === "enter") && !document.getElementById("next-btn").disabled && document.getElementById("game-controls").style.display !== "none") {
        e.preventDefault();
        newRound();
    }
});

// ===== PRELOAD IMAGES =====
function preloadImages(callback) {
    const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"];
    const types = ["C", "D", "H", "S"];
    const totalImages = values.length * types.length;
    let loadedImages = 0;

    for (let i = 0; i < types.length; i++) {
        for (let j = 0; j < values.length; j++) {
            const img = new Image();
            img.src = `./cards/${values[j]}${types[i]}.svg`;
            img.onload = img.onerror = () => {
                loadedImages++;
                if (loadedImages === totalImages) {
                    callback();
                }
            };
        }
    }
}

window.onload = () => {
    document.getElementById("game-controls").style.display = "none";
    syncSoundIcon();
    updateStats();

    preloadImages(() => {
        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) loadingScreen.classList.add("hidden");
    });
};
