/* ================================================================
   HÀN GIAI X — FLASHCARD (flashcard.js)
   Học flashcard từ: deck đã tạo (HGFlash.openDeck) hoặc giáo trình
   HSK 1/2/3 nạp trong app (HGFlash.openHSK). Nút nổi 📚 gọi HGFlash.open()
   sẽ hiện trang chọn nguồn. Tự động đọc to chữ Hán mỗi lần hiện thẻ.
   ================================================================ */
(function () {
  'use strict';
  if (window.HGFlash) return;
  var U = window.HGXUI;
  if (!U) { console.error('[Hàn Giai X] Thiếu hgx-ui.js — hãy nạp nó trước flashcard.js'); return; }
  var esc = U.esc, toast = U.toast;

  /* ---------- Lọc trùng chữ Hán để ghép không bị nhập nhằng ---------- */
  function dedupe(words) {
    var seen = {}, out = [];
    words.forEach(function (w) {
      if (!w || !w.hanzi || seen[w.hanzi]) return;
      seen[w.hanzi] = 1;
      out.push(w);
    });
    return out;
  }

  /* ---------- Trang chọn nguồn khi mở từ nút nổi ---------- */
  function openPicker() {
    var D = window.HGDecks;
    var p = U.page('Chọn bộ để học');
    var html = '<div class="hgx-section"><h3 class="hgx-h3">Deck của tôi</h3>';
    var ds = D.allDecks();
    if (!ds.length) {
      html += '<div class="hgx-empty">Chưa có bộ thẻ nào. Bộ thẻ bạn tạo ở các phần flashcard khác cũng sẽ tự hiện ở đây.</div>';
    } else {
      html += ds.map(function (d) {
        return '<div class="hgx-deckrow" data-deck="' + esc(d.id) + '">' +
          '<div class="hgx-deckinfo"><b>' + esc(d.name) + '</b><span>' + d.words.length + ' từ</span></div>' +
          '<button class="hgx-btn hgx-btn--mini hgx-btn--green">Học</button></div>';
      }).join('');
    }
    html += '</div><div class="hgx-section"><h3 class="hgx-h3">Giáo trình trong app</h3><div class="hgx-hskgrid">';
    for (var lv = 1; lv <= 3; lv++) {
      var n = D.hskWords(lv).length;
      html += '<div class="hgx-hskcard"><div class="hgx-hskname">HSK ' + lv + '</div>' +
        '<div class="hgx-hskcount">' + (n ? n + ' từ' : 'Chưa nạp') + '</div>' +
        '<button class="hgx-btn hgx-btn--mini" data-hsk="' + lv + '">Học</button></div>';
    }
    html += '</div></div>';
    p.body.innerHTML = html;

    p.body.addEventListener('click', function (e) {
      var dk = e.target.closest('.hgx-deckrow');
      var hk = e.target.closest('button[data-hsk]');
      if (dk) {
        var id = dk.getAttribute('data-deck');
        p.close();
        openDeck(id);
      } else if (hk) {
        var lv2 = +hk.getAttribute('data-hsk');
        p.close();
        openHSK(lv2);
      }
    });
    return p;
  }

  /* ---------- Máy học flashcard ---------- */
  function player(words, title) {
    var p = U.page(title, {
      onClose: function () {
        try { document.removeEventListener('keydown', onKey); } catch (e) { }
      }
    });

    var order = U.shuffle(words.map(function (w, i) { return i; }));
    var pos = 0, flipped = false;

    p.body.innerHTML =
      '<div class="hgx-pbar"><div class="hgx-pfill" id="hgx-f-fill"></div></div>' +
      '<div class="hgx-fwrap">' +
      '  <div class="hgx-fcard" id="hgx-f-card">' +
      '    <div class="hgx-finner">' +
      '      <div class="hgx-face hgx-front">' +
      '        <div class="hgx-fhz" id="hgx-f-hz"></div>' +
      '        <div class="hgx-fpy" id="hgx-f-py"></div>' +
      '        <button class="hgx-btn hgx-btn--mini" id="hgx-f-say" type="button">Nghe</button>' +
      '        <div class="hgx-fhint">Chạm vào thẻ để xem nghĩa</div>' +
      '      </div>' +
      '      <div class="hgx-face hgx-face--back">' +
      '        <div class="hgx-fvi" id="hgx-f-vi"></div>' +
      '        <div class="hgx-fsub" id="hgx-f-sub"></div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="hgx-fctl">' +
      '  <button class="hgx-btn hgx-btn--nav" id="hgx-f-prev" type="button">&#8592;</button>' +
      '  <div class="hgx-fprog" id="hgx-f-prog"></div>' +
      '  <button class="hgx-btn hgx-btn--nav" id="hgx-f-next" type="button">&#8594;</button>' +
      '</div>' +
      '<div class="hgx-fctl2">' +
      '  <button class="hgx-btn" id="hgx-f-flip" type="button">Lật thẻ</button>' +
      '  <button class="hgx-btn" id="hgx-f-shuf" type="button">Xáo trộn</button>' +
      '</div>';

    var cardEl = p.body.querySelector('#hgx-f-card');
    var fillEl = p.body.querySelector('#hgx-f-fill');
    var progEl = p.body.querySelector('#hgx-f-prog');

    function renderCard(silent) {
      var w = words[order[pos]];
      p.body.querySelector('#hgx-f-hz').textContent = w.hanzi;
      p.body.querySelector('#hgx-f-py').textContent = w.pinyin || '';
      p.body.querySelector('#hgx-f-vi').textContent = w.vi || '(chưa có nghĩa)';
      p.body.querySelector('#hgx-f-sub').textContent = w.hanzi + (w.pinyin ? ' · ' + w.pinyin : '');
      flipped = false;
      cardEl.classList.remove('hgx-flipped');
      progEl.textContent = (pos + 1) + ' / ' + order.length;
      fillEl.style.width = (((pos + 1) / order.length) * 100) + '%';
      if (!silent) U.speak(w.hanzi);
    }

    function move(delta) {
      pos = (pos + delta + order.length) % order.length;
      renderCard();
    }

    cardEl.addEventListener('click', function () {
      flipped = !flipped;
      cardEl.classList.toggle('hgx-flipped', flipped);
    });
    p.body.querySelector('#hgx-f-flip').addEventListener('click', function () {
      flipped = !flipped;
      cardEl.classList.toggle('hgx-flipped', flipped);
    });
    p.body.querySelector('#hgx-f-say').addEventListener('click', function (e) {
      e.stopPropagation();
      U.speak(words[order[pos]].hanzi);
    });
    p.body.querySelector('#hgx-f-prev').addEventListener('click', function () { move(-1); });
    p.body.querySelector('#hgx-f-next').addEventListener('click', function () { move(1); });
    p.body.querySelector('#hgx-f-shuf').addEventListener('click', function () {
      order = U.shuffle(order);
      pos = 0;
      renderCard();
      toast('Đã xáo trộn thứ tự thẻ');
    });

    function onKey(e) {
      if (!document.body.contains(cardEl)) return;
      if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
      else if (e.key === ' ') { e.preventDefault(); cardEl.click(); }
    }
    document.addEventListener('keydown', onKey);

    renderCard();
    return p;
  }

  /* ---------- API công khai ---------- */
  function open(opts) {
    opts = opts || {};
    var D = window.HGDecks;
    if (opts.words && opts.words.length) return player(dedupe(opts.words), opts.title || 'Flashcard');
    if (opts.deckId) {
      var ds = D.allDecks();
      var name = 'Deck';
      ds.forEach(function (d) { if (d.id === opts.deckId) name = d.name; });
      var ws = D.deckWords(opts.deckId);
      if (!ws.length) { toast('Deck này còn trống — hãy thêm từ đã'); return null; }
      return player(dedupe(ws), name);
    }
    if (opts.hsk) {
      var hws = D.hskWords(opts.hsk);
      if (!hws.length && !opts._retry) {
        toast('Đang nạp từ HSK ' + opts.hsk + '…');
        U.ensureAppData(function () { open({ hsk: opts.hsk, _retry: true }); });
        return null;
      }
      if (!hws.length) { toast('Không có từ HSK ' + opts.hsk + ' — kiểm tra data.json đã up chưa'); return null; }
      return player(dedupe(hws), 'Ôn HSK ' + opts.hsk);
    }
    return openPicker();
  }
  function openDeck(id) { return open({ deckId: id }); }
  function openHSK(level) { return open({ hsk: level }); }

  window.HGFlash = { open: open, openDeck: openDeck, openHSK: openHSK };
})();
