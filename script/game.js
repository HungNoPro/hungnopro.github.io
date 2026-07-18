// ===== STATE =====
let balance = 1000;
let currentBet = 0;
let deck = [];
let playerHand = [];
let dealerHand = [];
let canHit = false;
let gameActive = false;
let isAllIn = false;
let heartbeatInterval = null;

// ===== AUDIO ENGINE =====
let audioCtx;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playSound(freq, duration, type = 'sine', volume = 0.1) {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    osc.connect(gain); gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}
function soundDeal() { playSound(800, 0.05, 'square', 0.05); }
function soundChip() { playSound(1200, 0.08, 'sine', 0.1); setTimeout(() => playSound(900, 0.05, 'sine', 0.1), 50); }
function soundWin() { playSound(523, 0.1); setTimeout(() => playSound(659, 0.1), 100); setTimeout(() => playSound(784, 0.2), 200); }
function soundLose() { playSound(200, 0.2, 'sawtooth', 0.1); setTimeout(() => playSound(150, 0.3, 'sawtooth', 0.1), 150); }
function soundCoin() { playSound(1500, 0.05, 'square', 0.08); }

// Heartbeat
function soundHeartbeat() {
    playSound(60, 0.12, 'sine', 0.4);
    setTimeout(() => playSound(50, 0.18, 'sine', 0.5), 180);
}
function startHeartbeat() {
    if (heartbeatInterval) return;
    soundHeartbeat();
    heartbeatInterval = setInterval(soundHeartbeat, 1000);
}
function stopHeartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
}

// Rewind
function playRewindSound() {
    let freq = 2000;
    const interval = setInterval(() => {
        playSound(freq, 0.05, 'sawtooth', 0.05);
        freq -= 150;
        if (freq <= 200) clearInterval(interval);
    }, 60);
}

// ===== DECK & LOGIC =====
function buildDeck() {
    let values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"];
    let types = ["C", "D", "H", "S"]; deck = [];
    for (let i = 0; i < types.length; i++) for (let j = 0; j < values.length; j++) deck.push(values[j] + "-" + types[i]);
}
function shuffleDeck() { for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } }
function cardImage(card) { return "./cards/" + card.replace("-", "") + ".svg"; }
function getCardValue(card) { let v = card.split("-")[0]; if (v === "T" || v === "J" || v === "Q" || v === "K") return 10; if (v === "A") return 11; return parseInt(v); }
function calculateScore(hand) {
    let score = 0, aces = 0;
    for (let card of hand) { score += getCardValue(card); if (card[0] === "A") aces++; }
    while (score > 21 && aces > 0) { score -= 10; aces--; }
    return score;
}

// ===== UI RENDERING =====
function createCardElement(card, hidden = false) {
    const wrapper = document.createElement("div");
    wrapper.className = "card-wrapper"; if (hidden) wrapper.classList.add("hidden");
    const inner = document.createElement("div"); inner.className = "card-inner";
    const front = document.createElement("div"); front.className = "card-face card-front"; front.style.backgroundImage = `url('${cardImage(card)}')`;
    const back = document.createElement("div"); back.className = "card-face card-back";
    inner.appendChild(front); inner.appendChild(back); wrapper.appendChild(inner);
    return wrapper;
}
function dealCard(hand, elementId, hidden = false) {
    return new Promise(resolve => {
        const card = deck.pop(); hand.push(card);
        const cardEl = createCardElement(card, hidden);
        document.getElementById(elementId).appendChild(cardEl);
        soundDeal(); setTimeout(resolve, 300);
    });
}
function updateScores(hideDealer = true) {
    document.getElementById("player-sum").innerText = calculateScore(playerHand);
    if (hideDealer && dealerHand.length > 0) document.getElementById("dealer-sum").innerText = calculateScore([dealerHand[0]]) + " + ?";
    else document.getElementById("dealer-sum").innerText = calculateScore(dealerHand);
}

// ===== EFFECTS =====
function spawnCoins(betAmount) {
    let coinCount = 15, velocityMul = 1;
    if (betAmount >= 2000) { coinCount = 60; velocityMul = 2.5; }
    else if (betAmount >= 700) { coinCount = 40; velocityMul = 2; }
    else if (betAmount >= 200) { coinCount = 25; velocityMul = 1.5; }

    const table = document.querySelector('.game-table').getBoundingClientRect();
    const cX = table.left + table.width / 2, cY = table.top + table.height / 2;

    for(let i=0; i<coinCount; i++) {
        const coin = document.createElement('div'); coin.className = 'coin'; coin.innerText = '$';
        coin.style.left = `${cX}px`; coin.style.top = `${cY}px`; document.body.appendChild(coin);
        const angle = Math.random() * Math.PI - Math.PI/2;
        const velocity = (100 + Math.random() * 150) * velocityMul;
        coin.style.setProperty('--tx', `${Math.cos(angle) * velocity}px`);
        coin.style.setProperty('--ty', `${Math.sin(angle) * velocity}px`);
        const delay = i * (20 / velocityMul);
        coin.style.animation = `coin-fly 1s ease-out forwards`; coin.style.animationDelay = `${delay}ms`;
        setTimeout(soundCoin, delay);
        setTimeout(() => coin.remove(), 1200 + delay);
    }
}
function showWinText(amount) {
    const el = document.createElement('div'); el.className = 'win-amount'; el.innerText = `+${amount}$`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 1500);
}
function spawnConfetti() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'];
    for (let i = 0; i < 60; i++) {
        const c1 = document.createElement('div'); c1.className = 'confetti';
        c1.style.left = '0px'; c1.style.bottom = '0px'; c1.style.background = colors[Math.floor(Math.random() * colors.length)];
        c1.style.setProperty('--tx', `${Math.random() * 100 + 50}vw`); c1.style.setProperty('--ty', `-${Math.random() * 80 + 20}vh`);
        c1.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`); document.body.appendChild(c1);
        
        const c2 = document.createElement('div'); c2.className = 'confetti';
        c2.style.right = '0px'; c2.style.bottom = '0px'; c2.style.background = colors[Math.floor(Math.random() * colors.length)];
        c2.style.setProperty('--tx', `-${Math.random() * 100 + 50}vw`); c2.style.setProperty('--ty', `-${Math.random() * 80 + 20}vh`);
        c2.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`); document.body.appendChild(c2);
        setTimeout(() => { c1.remove(); c2.remove(); }, 1600);
    }
}

// ===== GAME FLOW =====
function placeBet(amount) {
    if (gameActive) return;
    if (balance < amount) { showMessage("Không đủ tiền!", "red"); return; }
    balance -= amount; currentBet += amount; soundChip(); updateStats();
}

function resetBet() {
    if (gameActive || currentBet === 0) return;
    balance += currentBet;
    currentBet = 0;
    soundChip();
    updateStats();
}

async function startGame() {
    if (currentBet === 0) { showMessage("Hãy đặt cược trước!", "red"); return; }
    
    // Chỉ bật suspense mode khi tất tay (số dư bằng 0)
    if (balance === 0) {
        isAllIn = true;
        document.body.classList.add('suspense-mode');
        startHeartbeat();
    }

    gameActive = true; buildDeck(); shuffleDeck(); playerHand = []; dealerHand = [];
    document.getElementById("dealer-cards").innerHTML = ""; document.getElementById("player-cards").innerHTML = "";
    document.getElementById("hit-btn").disabled = false; document.getElementById("stay-btn").disabled = false;
    document.getElementById("deal-btn").disabled = true; document.getElementById("allin-btn").disabled = true;
    document.getElementById("reset-btn").disabled = true;
    document.getElementById("betting-area").style.display = "none"; document.getElementById("game-controls").style.display = "flex";
    
    showMessage(isAllIn ? "ALL IN! Bốc đi..." : "Đang chia bài...");
    
    await dealCard(playerHand, "player-cards"); updateScores();
    await dealCard(dealerHand, "dealer-cards", true); updateScores();
    await dealCard(playerHand, "player-cards"); updateScores();
    await dealCard(dealerHand, "dealer-cards"); updateScores();

    canHit = true;
    if (calculateScore(playerHand) === 21) stand();
    else if(!isAllIn) showMessage("Lượt của bạn - Hit hoặc Stand?");
}

async function hit() {
    if (!canHit) return; canHit = false;
    await dealCard(playerHand, "player-cards"); updateScores();
    if (calculateScore(playerHand) > 21) { showMessage("Bust! (Quá 21)", "red"); stand(); }
    else canHit = true;
}

async function stand() {
    canHit = false; gameActive = false;
    document.getElementById("hit-btn").disabled = true; document.getElementById("stay-btn").disabled = true;
    const dealerCards = document.getElementById("dealer-cards").children;
    if (dealerCards[1].classList.contains("hidden")) {
        dealerCards[1].classList.remove("hidden"); soundDeal();
        await new Promise(r => setTimeout(r, 500));
    }
    updateScores(false);
    while (calculateScore(dealerHand) < 17) {
        await dealCard(dealerHand, "dealer-cards"); updateScores(false);
        await new Promise(r => setTimeout(r, 400));
    }
    determineWinner();
}

function determineWinner() {
    // Dừng hồi hộp
    stopHeartbeat();
    document.body.classList.remove('suspense-mode');

    const pScore = calculateScore(playerHand), dScore = calculateScore(dealerHand);
    const isBlackjack = pScore === 21 && playerHand.length === 2;
    let msg = "", color = "white", winAmount = 0;

    if (pScore > 21) { msg = "Bạn thua! (Bust)"; color = "red"; soundLose(); flashBackground("lose"); }
    else if (dScore > 21) { msg = "Dealer Bust! Bạn thắng!"; color = "#43b581"; winAmount = currentBet * 2; balance += winAmount; soundWin(); flashBackground("win"); spawnCoins(currentBet); showWinText(winAmount); if(isAllIn) spawnConfetti(); }
    else if (pScore === dScore) { msg = "Hòa (Push)"; color = "yellow"; balance += currentBet; }
    else if (pScore > dScore) {
        if (isBlackjack) { msg = "BLACKJACK! Thắng 1.5x!"; color = "gold"; winAmount = Math.floor(currentBet * 2.5); balance += winAmount; }
        else { msg = "Bạn thắng!"; color = "#43b581"; winAmount = currentBet * 2; balance += winAmount; }
        soundWin(); flashBackground("win"); spawnCoins(currentBet); showWinText(winAmount); if(isAllIn) spawnConfetti();
    } else { msg = "Bạn thua!"; color = "red"; soundLose(); flashBackground("lose"); }

    showMessage(msg, color);
    isAllIn = false; // Reset state
    currentBet = 0; updateStats();

    if (balance <= 0) {
        document.getElementById("next-btn").disabled = true;
        setTimeout(gameOverSequence, 1500);
    } else {
        document.getElementById("next-btn").disabled = false;
    }
}

function gameOverSequence() {
    document.body.classList.add('gray-state');
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay active';
    overlay.innerHTML = '<div class="lose-text">YOU LOSE</div>';
    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.classList.remove('active');
        const rewind = document.createElement('div');
        rewind.className = 'rewind-overlay';
        document.body.appendChild(rewind);
        playRewindSound();

        // Tăng thời gian tua ngược lên 2.5 giây
        setTimeout(() => {
            rewind.remove();
            document.body.classList.remove('gray-state');
            balance = 1000;
            newRound();
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
    showMessage("Đặt cược và bấm DEAL");
    updateStats();
}

// ===== UI HELPERS =====
function updateStats() { document.getElementById("balance").innerText = `$${balance}`; document.getElementById("current-bet").innerText = `$${currentBet}`; }
function showMessage(text, color = "white") { const msg = document.getElementById("message"); msg.innerText = text; msg.style.color = color; }
function flashBackground(type) { document.body.classList.add(type === "win" ? "win-flash" : "lose-flash"); setTimeout(() => document.body.classList.remove("win-flash", "lose-flash"), 1000); }

document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === 'h' && !document.getElementById("hit-btn").disabled) hit();
    if (e.key.toLowerCase() === 's' && !document.getElementById("stay-btn").disabled) stand();
});

window.onload = () => { document.getElementById("game-controls").style.display = "none"; };