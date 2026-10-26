/* ================================================================
   HÀN GIAI X — GHÉP TỪ SIÊU TỐC, kiểu Match Madness của Duolingo (match.js)
   - 2 cột: trái = nghĩa tiếng Việt, phải = chữ Hán — xáo trộn ngẫu nhiên
   - Chọn đúng cặp → sáng viền xanh rồi biến mất, cặp mới hiện dần thay thế
   - Ghép sai → rung đỏ, chỉ tốn thời gian
   - Thời gian = số từ × 3 giây/cặp; chọn được số từ muốn ôn
   - Nguồn từ: deck tự tạo (flashcard) hoặc giáo trình HSK 1/2/3 trong app
   API: HGMatch.open() / openDeck(id) / openHSK(level)
   ================================================================ */
(function () {
  'use strict';
  if (window.HGMatch) return;
  var U = window.HGXUI;
  if (!U) { console.error('[Hàn Giai X] Thiếu hgx-ui.js — hãy nạp nó trước match.js'); return; }
  var esc = U.esc, toast = U.toast;
  var PACE = 3000;   /* ms cho mỗi cặp (theo yêu cầu: ~3 giây/1 cặp) */
  var CAP = 6;       /* số cặp tối đa hiện trên màn hình cùng lúc */

  function dedupe(words) {
    var seen = {}, out = [];
    words.forEach(function (w) {
      if (!w || !w.hanzi || seen[w.hanzi]) return;
      seen[w.hanzi] = 1;
      out.push(w);
    });
    return out;
  }
  function getWords(sel) {
    var D = window.HGDecks;
    if (!sel) return [];
    return sel.type === 'deck' ? dedupe(D.deckWords(sel.id)) : dedupe(D.hskWords(sel.level));
  }

  /* ================= TRANG CHỌN BỘ TỪ & SỐ LƯỢNG ================= */
  function open(opts) { return picker(normalizePre(opts)); }
  function openDeck(id) { return picker({ type: 'deck', id: id }); }
  function openHSK(level) { return picker({ type: 'hsk', level: level }); }
  function normalizePre(opts) {
    opts = opts || {};
    if (opts.deckId) return { type: 'deck', id: opts.deckId };
    if (opts.hsk) return { type: 'hsk', level: opts.hsk };
    return null;
  }

  function picker(pre) {
    var D = window.HGDecks;
    var tab = pre ? (pre.type === 'deck' ? 'mine' : 'hsk' + pre.level) : 'mine';
    var sel = pre ? pre : null;
    var count = null;   /* null = tất cả */

    var p = U.page('Ghép từ siêu tốc');
    p.body.innerHTML =
      '<div class="hgx-mtabs" id="hgx-mtabs"></div>' +
      '<div id="hgx-mlist"></div>' +
      '<h3 class="hgx-h3">Số từ muốn ôn</h3>' +
      '<div class="hgx-chips" id="hgx-mchips"></div>' +
      '<button class="hgx-btn hgx-btn--green hgx-btn--wide hgx-btn--big" id="hgx-mstart" type="button"></button>' +
      '<p class="hgx-note">Luật chơi: ghép nghĩa tiếng Việt với chữ Hán trước khi hết giờ. Thời gian = số từ × 3 giây/cặp.</p>';

    var tabsEl = p.body.querySelector('#hgx-mtabs');
    var listEl = p.body.querySelector('#hgx-mlist');
    var chipsEl = p.body.querySelector('#hgx-mchips');
    var startBtn = p.body.querySelector('#hgx-mstart');

    function renderTabs() {
      var tabs = [['mine', 'Deck của tôi'], ['hsk1', 'HSK 1'], ['hsk2', 'HSK 2'], ['hsk3', 'HSK 3']];
      tabsEl.innerHTML = tabs.map(function (t) {
        return '<button class="hgx-mtab' + (tab === t[0] ? ' hgx-active' : '') +
          '" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('');
    }

    function renderList() {
      if (tab === 'mine') {
        var ds = D.allDecks();
        if (!ds.length) {
          listEl.innerHTML = '<div class="hgx-empty">Chưa có deck — mở 📚 trên màn chính để tạo deck, hoặc chơi theo HSK.</div>';
          return;
        }
        listEl.innerHTML = ds.map(function (d) {
          var activeSel = sel && sel.type === 'deck' && sel.id === d.id;
          return '<div class="hgx-deckrow hgx-pickrow' + (activeSel ? ' hgx-selrow' : '') +
            '" data-pick-deck="' + esc(d.id) + '">' +
            '<div class="hgx-deckinfo"><b>' + esc(d.name) + '</b><span>' + d.words.length + ' từ</span></div>' +
            '<span class="hgx-pickdot"></span></div>';
        }).join('');
      } else {
        var lv = +tab.slice(3);
        var ws = D.hskWords(lv);
        if (!ws.length) {
          listEl.innerHTML = '<div class="hgx-empty">Chưa nạp được từ HSK ' + lv + ' — kiểm tra file data/data.json.</div>';
          return;
        }
        var activeSel2 = sel && sel.type === 'hsk' && sel.level === lv;
        listEl.innerHTML =
          '<div class="hgx-deckrow hgx-pickrow' + (activeSel2 ? ' hgx-selrow' : '') + '" data-pick-hsk="' + lv + '">' +
          '<div class="hgx-deckinfo"><b>Toàn bộ từ HSK ' + lv + '</b><span>' + ws.length + ' từ trong app</span></div>' +
          '<span class="hgx-pickdot"></span></div>';
      }
    }

    function chosenCount(size) {
      return count === null ? size : Math.min(count, size);
    }

    function renderChips() {
      var size = getWords(sel).length;
      var vals = [5, 10, 15, 20];
      var html = '';
      vals.forEach(function (v) {
        var dis = size < v;
        html += '<button class="hgx-chip' + (count === v ? ' hgx-active' : '') + (dis ? ' hgx-dis' : '') +
          '" data-cnt="' + v + '"' + (dis ? ' disabled' : '') + '>' + v + '</button>';
      });
      html += '<button class="hgx-chip' + (count === null ? ' hgx-active' : '') +
        '" data-cnt="all">Tất cả</button>';
      chipsEl.innerHTML = html;
    }

    function renderStart() {
      var size = getWords(sel).length;
      if (!sel || size < 4) {
        startBtn.disabled = true;
        startBtn.textContent = size ? 'Cần ít nhất 4 từ để chơi' : 'Hãy chọn một bộ từ ở trên';
        return;
      }
      var n = chosenCount(size);
      startBtn.disabled = false;
      startBtn.textContent = 'Bắt đầu: ' + n + ' cặp · ' + Math.round(n * PACE / 1000) + ' giây';
    }

    function render() {
      renderTabs(); renderList(); renderChips(); renderStart();
    }

    tabsEl.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (!b) return;
      tab = b.getAttribute('data-tab');
      if (sel && ((tab === 'mine' && sel.type !== 'deck') || (tab !== 'mine' && sel.type !== 'hsk'))) sel = null;
      render();
    });
    listEl.addEventListener('click', function (e) {
      var dk = e.target.closest('[data-pick-deck]');
      var hk = e.target.closest('[data-pick-hsk]');
      if (dk) sel = { type: 'deck', id: dk.getAttribute('data-pick-deck') };
      else if (hk) sel = { type: 'hsk', level: +hk.getAttribute('data-pick-hsk') };
      else return;
      count = null;
      render();
    });
    chipsEl.addEventListener('click', function (e) {
      var c = e.target.closest('button[data-cnt]');
      if (!c || c.disabled) return;
      var v = c.getAttribute('data-cnt');
      count = v === 'all' ? null : +v;
      renderChips(); renderStart();
    });
    startBtn.addEventListener('click', function () {
      var ws = getWords(sel);
      var size = ws.length;
      if (!sel || size < 4) { toast('Cần ít nhất 4 từ'); return; }
      var n = chosenCount(size);
      var label = sel.type === 'deck'
        ? (function () { var nm = 'Deck'; D.allDecks().forEach(function (d) { if (d.id === sel.id) nm = d.name; }); return nm; })()
        : 'HSK ' + sel.level;
      p.close();
      startGame(ws, n, label);
    });

    render();

    /* HSK chưa nạp xong thì thử nạp lại 1 lần */
    if (sel && sel.type === 'hsk' && !D.hskWords(sel.level).length) {
      U.ensureAppData(function () { if (document.body.contains(p.body)) render(); });
    }
    return p;
  }

  /* ================= VÁN CHƠI ================= */
  function startGame(words, count, label) {
    var total = Math.min(count, words.length);
    var G = {
      list: U.shuffle(words),
      next: 0,
      left: [], right: [],
      sel: null,
      matched: 0, wrong: 0,
      over: false,
      uidSeq: 1,
      total: total,
      dur: total * PACE,
      deadline: 0,
      tick: null
    };

    var p = U.page('Ghép từ siêu tốc', {
      onClose: function () { clearInterval(G.tick); G.over = true; }
    });
    p.body.innerHTML =
      '<div class="hgx-mtop">' +
      '  <div class="hgx-mcount" id="hgx-g-count">0/' + total + '</div>' +
      '  <div class="hgx-mbar" id="hgx-g-bar"><div class="hgx-mfill" id="hgx-g-fill"></div></div>' +
      '  <div class="hgx-mtime" id="hgx-g-time"></div>' +
      '</div>' +
      '<div class="hgx-mdecktag">' + esc(label) + ' · ' + total + ' cặp · ' + Math.round(total * PACE / 1000) + ' giây</div>' +
      '<div class="hgx-mboard">' +
      '  <div class="hgx-mcol" id="hgx-g-colL"></div>' +
      '  <div class="hgx-mcol" id="hgx-g-colR"></div>' +
      '</div>' +
      '<p class="hgx-note">Chạm 1 ô tiếng Việt + 1 ô chữ Hán. Đúng: viền xanh, tự biến mất, đọc to từ. Sai: rung đỏ.</p>';

    var colL = p.body.querySelector('#hgx-g-colL');
    var colR = p.body.querySelector('#hgx-g-colR');
    var fillEl = p.body.querySelector('#hgx-g-fill');
    var barEl = p.body.querySelector('#hgx-g-bar');
    var timeEl = p.body.querySelector('#hgx-g-time');
    var countEl = p.body.querySelector('#hgx-g-count');

    function rndInt(n) { return Math.floor(Math.random() * n); }

    function spawnPair() {
      if (G.next >= G.total) return;
      if (G.left.length >= CAP) return;
      var w = G.list[G.next++];
      G.left.splice(rndInt(G.left.length + 1), 0, { uid: 'l' + (G.uidSeq++), w: w, born: true });
      G.right.splice(rndInt(G.right.length + 1), 0, { uid: 'r' + (G.uidSeq++), w: w, born: true });
    }

    function tileHTML(side, t) {
      var cls = 'hgx-mtile';
      if (t.born) cls += ' hgx-born';
      if (G.sel && G.sel.uid === t.uid) cls += ' hgx-sel';
      var txt = side === 'L'
        ? '<span class="hgx-mtvi">' + esc(t.w.vi || t.w.pinyin || '…') + '</span>'
        : '<span class="hgx-mthz">' + esc(t.w.hanzi) + '</span>' +
          (t.w.pinyin ? '<span class="hgx-mtpy">' + esc(t.w.pinyin) + '</span>' : '');
      return '<button type="button" class="' + cls + '" data-uid="' + t.uid + '" data-side="' + side + '">' + txt + '</button>';
    }

    function drawCols() {
      colL.innerHTML = G.left.map(function (t) { return tileHTML('L', t); }).join('');
      colR.innerHTML = G.right.map(function (t) { return tileHTML('R', t); }).join('');
      G.left.forEach(function (t) { t.born = false; });
      G.right.forEach(function (t) { t.born = false; });
    }

    function updateCount() { countEl.textContent = G.matched + '/' + G.total; }

    function btnOf(uid) { return p.body.querySelector('[data-uid="' + uid + '"]'); }

    function tileByUid(uid) {
      var i, t;
      for (i = 0; i < G.left.length; i++) { t = G.left[i]; if (t.uid === uid) return t; }
      for (i = 0; i < G.right.length; i++) { t = G.right[i]; if (t.uid === uid) return t; }
      return null;
    }

    function attempt(a, bBtn) {
      var aBtn = btnOf(a.uid);
      var b = bBtn ? tileByUid(bBtn.getAttribute('data-uid')) : null;
      if (!b || !aBtn) { G.sel = null; drawCols(); return; }

      if (a.w === b.w) {
        /* ĐÚNG CẶP */
        G.matched++;
        a.w.deadRef = true; b.w.deadRef = true;
        aBtn.classList.add('hgx-hit');
        btnOf(b.uid).classList.add('hgx-hit');
        U.speak(a.w.hanzi);
        setTimeout(function () {
          G.left = G.left.filter(function (t) { return !t.w.deadRef; });
          G.right = G.right.filter(function (t) { return !t.w.deadRef; });
          spawnPair();
          G.sel = null;
          drawCols();
          updateCount();
          if (G.matched >= G.total && !G.over) finish(true);
        }, 380);
      } else {
        /* SAI CẶP */
        G.wrong++;
        aBtn.classList.add('hgx-miss');
        btnOf(b.uid).classList.add('hgx-miss');
        setTimeout(function () { G.sel = null; drawCols(); }, 420);
      }
      G.sel = null;
    }

    function onBoardClick(e) {
      if (G.over || G.deadline === 0) return;   /* chưa bắt đầu (đang đếm ngược) */
      var btn = e.target.closest('.hgx-mtile');
      if (!btn) return;
      var uid = btn.getAttribute('data-uid');
      var side = btn.getAttribute('data-side');
      var t = tileByUid(uid);
      if (!t) return;
      if (G.sel && G.sel.uid === uid) { G.sel = null; drawCols(); return; }
      if (G.sel && G.sel.side !== side) { attempt(G.sel, btn); return; }
      G.sel = { uid: uid, side: side, w: t.w };
      drawCols();
    }
    p.body.querySelector('.hgx-mboard').addEventListener('click', onBoardClick);

    /* ---- Đồng hồ đếm ngược ---- */
    function step() {
      if (G.over) return;
      var left = G.deadline - Date.now();
      if (left <= 0) {
        fillEl.style.width = '0%';
        timeEl.textContent = '0s';
        G.over = true;
        clearInterval(G.tick);
        finish(false);
        return;
      }
      fillEl.style.width = Math.min(100, (left / G.dur) * 100) + '%';
      timeEl.textContent = Math.ceil(left / 1000) + 's';
      barEl.classList.toggle('hgx-low', left < G.dur * 0.2);
    }

    /* ---- Kết thúc ---- */
    function finish(win) {
      clearInterval(G.tick);
      var pctLeft = win ? Math.max(0, (G.deadline - Date.now()) / G.dur) : 0;
      var stars = win ? (pctLeft >= 0.4 ? 3 : (pctLeft >= 0.2 ? 2 : 1)) : 0;
      var starStr = '';
      for (var i = 0; i < 3; i++) starStr += '<span class="' + (i < stars ? 'hgx-star-on' : 'hgx-star-off') + '">&#9733;</span>';
      p.body.innerHTML =
        '<div class="hgx-result">' +
        '  <div class="hgx-ricon">' + (win ? '&#127881;' : '&#9200;') + '</div>' +
        '  <h2 class="hgx-rtitle">' + (win ? 'Hoàn thành xuất sắc!' : 'Hết giờ rồi!') + '</h2>' +
        '  <div class="hgx-rstars">' + starStr + '</div>' +
        '  <div class="hgx-rstats">' +
        '    <div class="hgx-rstat"><b>' + G.matched + '/' + G.total + '</b><span>cặp đã ghép</span></div>' +
        '    <div class="hgx-rstat"><b>' + (win ? Math.ceil((G.deadline - Date.now()) / 1000) + 's' : '0s') + '</b><span>thời gian còn lại</span></div>' +
        '    <div class="hgx-rstat"><b>' + G.wrong + '</b><span>lần ghép sai</span></div>' +
        '  </div>' +
        '  <div class="hgx-rbtns">' +
        '    <button class="hgx-btn hgx-btn--green hgx-btn--wide" id="hgx-r-replay">Chơi lại</button>' +
        '    <button class="hgx-btn hgx-btn--wide" id="hgx-r-other">Chọn bộ từ khác</button>' +
        '    <button class="hgx-btn hgx-btn--wide" id="hgx-r-close">Đóng</button>' +
        '  </div>' +
        '  <div class="hgx-rwords"><h3 class="hgx-h3">Từ vừa ôn (chạm để nghe)</h3><div id="hgx-r-list"></div></div>' +
        '</div>';
      p.body.querySelector('#hgx-r-list').innerHTML = G.list.slice(0, total).map(function (w) {
        return '<button class="hgx-rword" data-say="' + esc(w.hanzi) + '"><b>' + esc(w.hanzi) + '</b>' +
          '<span>' + esc(w.pinyin) + '</span><span class="hgx-rwvi">' + esc(w.vi || '') + '</span></button>';
      }).join('');
      p.body.querySelector('#hgx-r-list').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-say]');
        if (b) U.speak(b.getAttribute('data-say'));
      });
      p.body.querySelector('#hgx-r-replay').addEventListener('click', function () {
        p.close();
        startGame(words, count, label);
      });
      p.body.querySelector('#hgx-r-other').addEventListener('click', function () {
        p.close();
        open();
      });
      p.body.querySelector('#hgx-r-close').addEventListener('click', function () { p.close(); });
    }

    /* ---- Đếm ngược 3·2·1 rồi bắt đầu ---- */
    function countdown(n, done) {
      var cd = document.createElement('div');
      cd.className = 'hgx-cd';
      p.root.appendChild(cd);
      var num = document.createElement('div');
      num.className = 'hgx-cdnum';
      cd.appendChild(num);
      function show(k) {
        if (k === 0) { num.textContent = 'VẬN ĐỘNG!'; }
        else { num.textContent = k; }
        num.classList.remove('hgx-pop');
        void num.offsetWidth;   /* restart animation */
        num.classList.add('hgx-pop');
      }
      show(n);
      var k = n;
      var iv = setInterval(function () {
        k--;
        if (k < 0) {
          clearInterval(iv);
          if (cd.parentNode) cd.parentNode.removeChild(cd);
          done();
          return;
        }
        show(k);
      }, 700);
      cd.addEventListener('click', function () {
        clearInterval(iv);
        if (cd.parentNode) cd.parentNode.removeChild(cd);
        done();
      });
    }

    /* Lấp đầy bàn chơi trước, đồng hồ chỉ chạy sau khi đếm ngược xong */
    for (var i = 0; i < CAP && G.next < G.total; i++) spawnPair();
    drawCols();
    updateCount();
    countdown(3, function () {
      if (G.over) return;
      G.deadline = Date.now() + G.dur;
      step();
      G.tick = setInterval(step, 100);
    });
    return p;
  }

  window.HGMatch = { open: open, openDeck: openDeck, openHSK: openHSK };
})();
