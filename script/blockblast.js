const GRID_SIZE = 6; 
let grid = [];
let currentPieces = [];
let selectedPiece = null;
let score = 0;
let bestScore = localStorage.getItem('blockBestScore') || 0;
let isClearing = false;
let isDragging = false;
let ghostElement = null;
let scoreSaved = false; 


const WORKER_URL = "https://leaderboard-api.hungthcs2017.workers.dev"; 

const SHAPES = [
    { matrix: [[1,1,1,1]], color: "#42a5f5" },
    { matrix: [[1],[1],[1],[1]], color: "#42a5f5" },
    { matrix: [[1,1],[1,1]], color: "#66bb6a" },
    { matrix: [[1,1,1],[1,1,1],[1,1,1]], color: "#ffca28" },
    { matrix: [[1,0],[1,0],[1,1]], color: "#ab47bc" },
    { matrix: [[0,1],[0,1],[1,1]], color: "#ab47bc" },
    { matrix: [[1,1],[1,0],[1,0]], color: "#ab47bc" },
    { matrix: [[1,1],[0,1],[0,1]], color: "#ab47bc" },
    { matrix: [[1,1,1],[1,0,0]], color: "#ff7043" },
    { matrix: [[1,0,0],[1,1,1]], color: "#ff7043" },
    { matrix: [[0,0,1],[1,1,1]], color: "#ff7043" },
    { matrix: [[1,1,1],[0,0,1]], color: "#ff7043" },
    { matrix: [[1,1,1],[0,1,0]], color: "#ec407a" },
    { matrix: [[0,1,0],[1,1,1]], color: "#ec407a" },
    { matrix: [[1,0],[1,1],[1,0]], color: "#ec407a" },
    { matrix: [[0,1],[1,1],[0,1]], color: "#ec407a" },
    { matrix: [[1,1,0],[0,1,1]], color: "#26c6da" },
    { matrix: [[0,1],[1,1],[1,0]], color: "#26c6da" },
    { matrix: [[1]], color: "#ef5350" },
    { matrix: [[1,1]], color: "#5c6bc0" },
    { matrix: [[1],[1]], color: "#5c6bc0" }
];

const gridElement = document.getElementById('grid');
const piecesContainer = document.getElementById('pieces-container');
const scoreElement = document.getElementById('score');
const bestScoreElement = document.getElementById('best-score');
const messagePopup = document.getElementById('message-popup');
const gameOverScreen = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');
const gameContainer = document.getElementById('game-container');

function initGame() {
    grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
    gridElement.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.r = r;
            cell.dataset.c = c;
            gridElement.appendChild(cell);
        }
    }
    score = 0;
    isClearing = false;
    scoreSaved = false;
    
    // Khôi phục tên người chơi từ localStorage và khóa ô nhập
    const nameInput = document.getElementById('player-name');
    const saveBtn = document.getElementById('save-score-btn');
    let savedName = localStorage.getItem('blockPlayerName');
    
    if (savedName) {
        nameInput.value = savedName;
        nameInput.disabled = true;
        nameInput.style.opacity = '0.7';
        nameInput.style.cursor = 'not-allowed';
    } else {
        nameInput.value = '';
        nameInput.disabled = false;
        nameInput.style.opacity = '1';
        nameInput.style.cursor = 'text';
    }
    
    saveBtn.disabled = false;
    saveBtn.innerText = "Lưu điểm";
    saveBtn.style.background = "#4caf50";
    
    updateScore();
    bestScoreElement.textContent = bestScore;
    generateNewPieces();
    renderPieces();
    gameOverScreen.classList.remove('active');
}

function generateNewPieces() {
    currentPieces = [];
    for (let i = 0; i < 3; i++) {
        const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        currentPieces.push({ ...shape, id: i });
    }
}

function renderPieces() {
    piecesContainer.innerHTML = '';
    currentPieces.forEach((piece, index) => {
        const slot = document.createElement('div');
        slot.classList.add('piece-slot');
        if (!piece) slot.classList.add('empty');
        if (piece) {
            slot.appendChild(createPieceElement(piece));
            slot.addEventListener('mousedown', (e) => startDrag(e, index));
            slot.addEventListener('touchstart', (e) => startDrag(e, index), { passive: false });
        }
        piecesContainer.appendChild(slot);
    });
}

function createPieceElement(piece) {
    const pieceGrid = document.createElement('div');
    pieceGrid.classList.add('piece-grid');
    pieceGrid.style.gridTemplateColumns = `repeat(${piece.matrix[0].length}, 1fr)`;
    piece.matrix.forEach(row => {
        row.forEach(val => {
            const block = document.createElement('div');
            block.classList.add('piece-block');
            if (val === 1) block.style.background = piece.color;
            else { block.style.background = 'transparent'; block.style.boxShadow = 'none'; }
            pieceGrid.appendChild(block);
        });
    });
    return pieceGrid;
}

function startDrag(e, index) {
    if (!currentPieces[index] || isClearing) return;
    e.preventDefault(); 
    selectedPiece = { ...currentPieces[index], id: index };
    ghostElement = document.createElement('div');
    ghostElement.classList.add('drag-ghost');
    ghostElement.appendChild(createPieceElement(selectedPiece));
    document.body.appendChild(ghostElement);
    updateGhostPosition(e);
    isDragging = true;
}

function updateGhostPosition(e) {
    if (!ghostElement) return;
    const isTouch = e.touches && e.touches.length > 0;
    const x = isTouch ? e.touches[0].clientX : e.clientX;
    const y = isTouch ? e.touches[0].clientY : e.clientY;
    if (!x || !y) return;
    const rect = ghostElement.getBoundingClientRect();
    const offsetY = isTouch ? 40 : 0;
    ghostElement.style.left = `${x - (rect.width / 2)}px`;
    ghostElement.style.top = `${y - rect.height - offsetY}px`;
    const target = document.elementFromPoint(x, y);
    if (target && target.classList.contains('cell')) {
        showPreview(parseInt(target.dataset.r), parseInt(target.dataset.c));
    } else {
        clearPreview();
    }
}

function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    const isTouch = e.changedTouches && e.changedTouches.length > 0;
    const x = isTouch ? e.changedTouches[0].clientX : e.clientX;
    const y = isTouch ? e.changedTouches[0].clientY : e.clientY;
    const target = document.elementFromPoint(x, y);
    if (target && target.classList.contains('cell')) {
        tryPlacePiece(parseInt(target.dataset.r), parseInt(target.dataset.c));
    }
    if (ghostElement) { ghostElement.remove(); ghostElement = null; }
    selectedPiece = null;
    clearPreview();
}

document.addEventListener('mousemove', (e) => { if (isDragging) updateGhostPosition(e); });
document.addEventListener('mouseup', (e) => { if (isDragging) endDrag(e); });
document.addEventListener('touchmove', (e) => { if (isDragging) { e.preventDefault(); updateGhostPosition(e); } }, { passive: false });
document.addEventListener('touchend', (e) => { if (isDragging) endDrag(e); });

function showPreview(r, c) {
    clearPreview();
    const shape = selectedPiece.matrix;
    let canPlace = true;
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] === 1) {
                const nr = r + i, nc = c + j;
                if (nr >= GRID_SIZE || nc >= GRID_SIZE || grid[nr][nc] !== 0) canPlace = false;
            }
        }
    }
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] === 1) {
                const nr = r + i, nc = c + j;
                if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
                    gridElement.children[nr * GRID_SIZE + nc].classList.add(canPlace ? 'preview-valid' : 'preview-invalid');
                }
            }
        }
    }
}

function clearPreview() {
    document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('preview-valid', 'preview-invalid'));
}

function tryPlacePiece(r, c) {
    if (!selectedPiece) return;
    const shape = selectedPiece.matrix;
    let canPlace = true;
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] === 1) {
                const nr = r + i, nc = c + j;
                if (nr >= GRID_SIZE || nc >= GRID_SIZE || grid[nr][nc] !== 0) { canPlace = false; break; }
            }
        }
    }
    if (canPlace) {
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j] === 1) grid[r + i][c + j] = selectedPiece.color;
            }
        }
        score += shape.flat().filter(x => x === 1).length;
        currentPieces[selectedPiece.id] = null;
        renderGrid();
        renderPieces();
        clearPreview();
        checkLines();
        if (currentPieces.every(p => p === null)) {
            setTimeout(() => { generateNewPieces(); renderPieces(); }, 400);
        }
        setTimeout(() => {
            if (checkGameOver()) {
                finalScoreElement.textContent = score;
                gameOverScreen.classList.add('active');
                if (score > bestScore) {
                    bestScore = score;
                    localStorage.setItem('blockBestScore', score);
                }
            }
        }, 450);
    }
}

function renderGrid() {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = gridElement.children[r * GRID_SIZE + c];
            cell.className = 'cell';
            if (grid[r][c] !== 0) {
                cell.classList.add('filled');
                cell.style.setProperty('--block-color', grid[r][c]);
            }
        }
    }
    updateScore();
}

function checkLines() {
    let linesToClear = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        if (grid[r].every(cell => cell !== 0)) linesToClear.push({ type: 'row', index: r });
    }
    for (let c = 0; c < GRID_SIZE; c++) {
        let isFull = true;
        for (let r = 0; r < GRID_SIZE; r++) { if (grid[r][c] === 0) isFull = false; }
        if (isFull) linesToClear.push({ type: 'col', index: c });
    }
    if (linesToClear.length > 0) {
        isClearing = true;
        let cellsToClear = new Set();
        linesToClear.forEach(line => {
            if (line.type === 'row') { for (let c = 0; c < GRID_SIZE; c++) cellsToClear.add(line.index * GRID_SIZE + c); }
            else { for (let r = 0; r < GRID_SIZE; r++) cellsToClear.add(r * GRID_SIZE + line.index); }
        });
        cellsToClear.forEach(idx => gridElement.children[idx].classList.add('clearing'));
        gameContainer.classList.add('shake');
        setTimeout(() => gameContainer.classList.remove('shake'), 400);
        setTimeout(() => {
            cellsToClear.forEach(idx => { grid[Math.floor(idx / GRID_SIZE)][idx % GRID_SIZE] = 0; });
            renderGrid();
            isClearing = false;
        }, 400);
        score += linesToClear.length * 10 * linesToClear.length;
        updateScore();
        let msg = linesToClear.length === 1 ? "GOOD!" : linesToClear.length === 2 ? "GREAT! x2" : linesToClear.length === 3 ? "AWESOME! x3" : "INSANE! x4";
        showMessage(msg);
    }
}

function showMessage(text) {
    messagePopup.textContent = text;
    messagePopup.classList.remove('show'); 
    void messagePopup.offsetWidth;
    messagePopup.classList.add('show');
    setTimeout(() => messagePopup.classList.remove('show'), 1200);
}

function updateScore() {
    scoreElement.textContent = score;
    if (score > bestScore) bestScoreElement.textContent = score;
}

function checkGameOver() {
    for (let i = 0; i < currentPieces.length; i++) {
        if (currentPieces[i]) {
            let shape = currentPieces[i].matrix;
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    let canFit = true;
                    for (let x = 0; x < shape.length; x++) {
                        for (let y = 0; y < shape[x].length; y++) {
                            if (shape[x][y] === 1) {
                                if (r + x >= GRID_SIZE || c + y >= GRID_SIZE || grid[r + x][c + y] !== 0) { canFit = false; break; }
                            }
                        }
                        if (!canFit) break;
                    }
                    if (canFit) return false;
                }
            }
        }
    }
    return true;
}

function restartGame() { initGame(); }

// ============================================================
//  LEADERBOARD API LOGIC (QUA CLOUDFLARE WORKER)
// ============================================================
async function saveScore() {
    if (scoreSaved || score === 0) return;
    
    const nameInput = document.getElementById('player-name');
    let name = nameInput.value.trim();
    
    if (!name) {
        alert("Vui lòng nhập tên của bạn!");
        return;
    }
    if (name.length > 12) name = name.substring(0, 12);

    // Chặn người chơi cũ nhập tên mới để đánh lừa hệ thống
    let savedName = localStorage.getItem('blockPlayerName');
    if (savedName && savedName !== name) {
        alert(`Bạn đã đăng ký tên là "${savedName}". Vui lòng dùng tên đó!`);
        nameInput.value = savedName;
        return;
    }

    const saveBtn = document.getElementById('save-score-btn');
    saveBtn.innerText = "Đang gửi...";
    saveBtn.disabled = true;

    try {
        // Chỉ gửi đúng Tên và Điểm lên Worker, không gửi mảng điểm nữa
        const res = await fetch(`${WORKER_URL}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, score: score })
        });

        const data = await res.json();

        if (res.ok) {
            if (data.message === "Đã lưu!") {
                localStorage.setItem('blockPlayerName', name); // Lưu tên lại
                saveBtn.innerText = "Đã lưu!";
                saveBtn.style.background = "#2a9d8f";
                scoreSaved = true;
                nameInput.disabled = true;
                nameInput.style.opacity = '0.7';
                nameInput.style.cursor = 'not-allowed';
            } else if (data.message === "Kỷ lục mới!") {
                saveBtn.innerText = "Kỷ lục mới!";
                saveBtn.style.background = "#2a9d8f";
                scoreSaved = true;
            } else if (data.message === "Chưa phá kỷ lục!") {
                saveBtn.innerText = "Chưa phá kỷ lục!";
                saveBtn.style.background = "#6c757d";
                scoreSaved = true;
            }
        } else {
            // Nếu server trả về lỗi (vd: trùng tên người khác)
            alert(data.error || "Lỗi không xác định!");
            saveBtn.innerText = "Lưu điểm";
            saveBtn.disabled = false;
        }
        
    } catch (error) {
        console.error("Lỗi lưu điểm:", error);
        saveBtn.innerText = "Lỗi mạng!";
        saveBtn.style.background = "#e63946";
        saveBtn.disabled = false;
    }
}

async function openLeaderboard() {
    document.getElementById('lb-modal').classList.add('active');
    document.getElementById('lb-list').innerHTML = '<p style="text-align:center; color:#8a8d9f;">Đang tải dữ liệu...</p>';
    
    try {
        const res = await fetch(`${WORKER_URL}/leaderboard`);
        const data = await res.json();
        let scores = data.scores || [];
        
        if (scores.length === 0) {
            document.getElementById('lb-list').innerHTML = '<p style="text-align:center;">Chưa có ai lên bảng!</p>';
            return;
        }

        let html = '';
        scores.forEach((entry, index) => {
            let medal = "🥇";
            if (index === 1) medal = "🥈";
            else if (index === 2) medal = "🥉";
            else medal = `${index + 1}`;
            
            html += `
                <div class="lb-item">
                    <span class="rank">${medal}</span>
                    <span class="name">${entry.name}</span>
                    <span class="score">${entry.score}</span>
                </div>
            `;
        });
        document.getElementById('lb-list').innerHTML = html;
    } catch (error) {
        document.getElementById('lb-list').innerHTML = '<p style="text-align:center; color:#ff4757;">Lỗi tải BXH!</p>';
    }
}

function closeLeaderboard() {
    document.getElementById('lb-modal').classList.remove('active');
}

initGame();
