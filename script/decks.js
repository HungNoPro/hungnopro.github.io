/* ================================================================
   HÀN GIAI X — QUẢN LÝ DECK + ĐỒNG BỘ CLOUDFLARE WORKER/KV (decks.js)
   - Tạo / đổi tên / xóa deck, thêm-bớt từ (có Bộ gõ pinyin dự đoán)
   - Đọc deck cũ từ bản addon (hanyu_mm_decks_v1) tự chuyển sang hệ mới
   - Deck lưu: localStorage (mặc định) + tự đồng bộ lên Worker/KV
     khi đã đăng nhập (tài khoản trùng với tài khoản của app)
   API công khai: window.HGDecks = { openManager, openEditor, ... }
   ================================================================ */
(function () {
  'use strict';
  if (window.HGDecks) return;
  var U = window.HGXUI;
  if (!U) { console.error('[Hàn Giai X] Thiếu hgx-ui.js — hãy nạp nó trước decks.js'); return; }
  var esc = U.esc, toast = U.toast;

  var LS_DECKS = 'hg_decks_v1';
  var LS_AUTH = 'hg_decks_auth';     /* phiên đăng nhập riêng của phần deck */
  var LS_API = 'hg_api_base';        /* link worker người dùng tự dán */
  var LS_MIGRATED = 'hg_decks_migrated_v1';

  var decks = loadLocal();
  var _pulledOnce = false;
  var _syncLine = null;
  var _managerPage = null;

  /* ================= LƯU CỤC BỘ (localStorage) ================= */
  function loadLocal() {
    try {
      var a = JSON.parse(localStorage.getItem(LS_DECKS) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function saveLocal() {
    try { localStorage.setItem(LS_DECKS, JSON.stringify(decks)); } catch (e) { }
  }

  /* Chuyển deck của bản addon cũ (key hanyu_mm_decks_v1, từ {h,p,v}) sang hệ mới */
  function migrateOld() {
    if (localStorage.getItem(LS_MIGRATED)) return;
    try {
      var old = JSON.parse(localStorage.getItem('hanyu_mm_decks_v1') || '[]');
      if (Array.isArray(old) && old.length && !decks.length) {
        old.forEach(function (d) {
          if (!d) return;
          decks.push({
            id: 'old-' + (d.id != null ? d.id : Math.random().toString(36).slice(2, 8)),
            name: String(d.name || 'Deck cũ'),
            updatedAt: Date.now(),
            words: (Array.isArray(d.words) ? d.words : []).map(function (w) {
              return {
                hanzi: U.NFC(w && (w.h != null ? w.h : (w.hanzi != null ? w.hanzi : ''))),
                pinyin: U.NFC(w && (w.p != null ? w.p : (w.pinyin != null ? w.pinyin : ''))),
                vi: U.NFC(w && (w.v != null ? w.v : (w.vi != null ? w.vi : '')))
              };
            }).filter(function (w) { return w.hanzi; })
          });
        });
        saveLocal();
        toast('Đã chuyển ' + old.length + ' deck cũ sang hệ mới');
      }
    } catch (e) { }
    try { localStorage.setItem(LS_MIGRATED, '1'); } catch (e) { }
  }
  migrateOld();

  /* ================= MÁY CHỦ & PHIÊN ĐĂNG NHẬP ================= */
  function apiBase() {
    if (typeof window.HG_API_BASE === 'string' && window.HG_API_BASE) return window.HG_API_BASE;
    var cfg = '';
    try { cfg = localStorage.getItem(LS_API) || ''; } catch (e) { }
    if (cfg) return cfg;
    /* Dò trong localStorage xem có URL worker nào được app lưu lại không */
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var m = (localStorage.getItem(k) || '').match(/https:\/\/[a-z0-9\-]+\.workers\.dev/i);
        if (m) return m[0];
      }
    } catch (e) { }
    return '';
  }
  function session() {
    var keys = ['hg_decks_auth', 'hg_user', 'hg_session', 'hg_auth', 'hanyu_user', 'hg_current_user'];
    for (var i = 0; i < keys.length; i++) {
      var v = tryParse(keys[i]);
      if (v && v.token && (v.username || v.user)) {
        return { token: v.token, username: v.username || v.user };
      }
    }
    /* Quét toàn bộ localStorage tìm object có token + username */
    try {
      for (var j = 0; j < localStorage.length; j++) {
        var k = localStorage.key(j);
        if (k === LS_DECKS) continue;
        var o = tryParse(k);
        if (o && typeof o === 'object' && typeof o.token === 'string' && o.token.length > 8 && (o.username || o.user)) {
          return { token: o.token, username: o.username || o.user };
        }
      }
    } catch (e) { }
    return null;
  }
  function tryParse(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function api(path, opts) {
    opts = opts || {};
    var base = apiBase().replace(/\/+$/, '');
    if (!base) return Promise.reject(new Error('Chưa cấu hình địa chỉ Worker'));
    var s = session();
    var headers = { 'Content-Type': 'application/json' };
    if (s && s.token) headers['Authorization'] = 'Bearer ' + s.token;
    return fetch(base + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok || data.ok === false) throw new Error(data.error || ('Lỗi HTTP ' + r.status));
        return data;
      });
    });
  }

  /* ================= CRUD DECK ================= */
  function uid() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function cleanWord(w) {
    return {
      hanzi: U.NFC(w && w.hanzi).slice(0, 60),
      pinyin: U.NFC(w && w.pinyin).slice(0, 120),
      vi: U.NFC(w && w.vi).slice(0, 200)
    };
  }
  function cleanDeck(d) {
    return {
      id: String(d && d.id || '').slice(0, 64),
      name: String(d && d.name || 'Deck').slice(0, 80),
      updatedAt: +((d && d.updatedAt) || 0),
      words: ((d && Array.isArray(d.words)) ? d.words : []).map(cleanWord)
    };
  }
  function getDeck(id) {
    for (var i = 0; i < decks.length; i++) if (decks[i].id === id) return decks[i];
    return null;
  }
  function createDeck(name) {
    var d = { id: uid(), name: String(name || '').trim() || 'Deck mới', words: [], updatedAt: Date.now() };
    decks.unshift(d);
    saveLocal(); syncPush();
    return d;
  }
  function renameDeck(id, name) {
    var d = getDeck(id); if (!d) return;
    d.name = String(name || '').trim() || d.name;
    d.updatedAt = Date.now();
    saveLocal(); syncPush();
  }
  function deleteDeck(id) {
    decks = decks.filter(function (d) { return d.id !== id; });
    saveLocal(); syncPush();
  }
  /* trả về true nếu thêm được, 'dup' nếu trùng chữ Hán */
  function addWord(id, w) {
    var d = getDeck(id); if (!d) return false;
    w = cleanWord(w);
    if (!w.hanzi) return false;
    for (var i = 0; i < d.words.length; i++) if (d.words[i].hanzi === w.hanzi) return 'dup';
    d.words.push(w);
    d.updatedAt = Date.now();
    saveLocal(); syncPush();
    return true;
  }
  function removeWord(id, index) {
    var d = getDeck(id); if (!d) return;
    d.words.splice(index, 1);
    d.updatedAt = Date.now();
    saveLocal(); syncPush();
  }
  function allDecks() { return decks.slice(); }
  function deckWords(id) {
    var d = getDeck(id);
    return d ? d.words.slice() : [];
  }

  /* ================= TỪ VỰNG HSK TRONG APP (data.json) ================= */
  var _hskCache = {};
  function hskWords(level) {
    if (_hskCache[level]) return _hskCache[level];
    var out = [], seen = {};
    var D = U.appDataSync();
    var unit = D && Array.isArray(D.units) ? D.units[level - 1] : null;
    function push(w) {
      if (!w) return;
      var hz = U.NFC(w.hanzi != null ? w.hanzi : (w.zi != null ? w.zi : (w.z != null ? w.z : w.word)));
      if (!hz || seen[hz]) return;
      seen[hz] = 1;
      out.push({
        hanzi: hz,
        pinyin: U.NFC(w.pinyin != null ? w.pinyin : (w.py != null ? w.py : '')),
        vi: U.NFC(w.vi != null ? w.vi : (w.viet != null ? w.viet : (w.nghia != null ? w.nghia : (w.meaning != null ? w.meaning : ''))))
      });
    }
    if (unit) {
      (unit.words || []).forEach(push);
      (unit.vocab || []).forEach(push);
      (unit.lessons || []).forEach(function (L) {
        if (!L) return;
        if (Array.isArray(L)) { L.forEach(push); return; }
        (L.words || []).forEach(push);
        (L.vocab || []).forEach(push);
      });
    }
    _hskCache[level] = out;
    return out;
  }

  /* ================= ĐỒNG BỘ LÊN WORKER/KV ================= */
  var _pushTimer = null;
  function setStatus(t) { if (_syncLine) _syncLine.textContent = t; }
  function cloudReady() { return !!(apiBase() && session()); }

  function syncPush() {
    if (!cloudReady()) return;
    clearTimeout(_pushTimer);
    setStatus('Đang đồng bộ…');
    _pushTimer = setTimeout(function () {
      api('/api/decks', { method: 'PUT', body: { decks: decks.map(cleanDeck) } })
        .then(function () { setStatus('Đã đồng bộ lên đám mây ✓'); })
        .catch(function (e) { setStatus('Đồng bộ lỗi: ' + e.message); });
    }, 1200);
  }
  function syncPull(force) {
    if (!cloudReady()) return Promise.resolve();
    if (_pulledOnce && !force) return Promise.resolve();
    _pulledOnce = true;
    setStatus('Đang tải deck từ đám mây…');
    return api('/api/decks').then(function (data) {
      if (!Array.isArray(data.decks)) return;
      var map = {};
      data.decks.map(cleanDeck).forEach(function (d) { map[d.id] = d; });
      decks.forEach(function (d) {
        var r = map[d.id];
        if (!r || (d.updatedAt || 0) > (r.updatedAt || 0)) map[d.id] = cleanDeck(d);
      });
      var before = JSON.stringify(decks);
      decks = Object.keys(map).map(function (k) { return map[k]; })
        .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      if (JSON.stringify(decks) !== before) {
        saveLocal();
        toast('Đã tải deck từ đám mây');
        if (_managerPage) renderManager();
      }
      setStatus('Đã đồng bộ lên đám mây ✓');
    }).catch(function (e) { setStatus('Đồng bộ lỗi: ' + e.message); });
  }
  function cloudLogin(username, password) {
    return api('/api/login', { method: 'POST', body: { username: username, password: password } })
      .then(function (data) {
        try {
          localStorage.setItem(LS_AUTH, JSON.stringify({ username: data.username, token: data.token }));
        } catch (e) { }
        _pulledOnce = false;
        return syncPull(true);
      });
  }

  /* ================= GIAO DIỆN: TRANG QUẢN LÝ DECK ================= */
  function openManager() {
    _managerPage = U.page('Deck & Flashcard', { onClose: function () { _managerPage = null; _syncLine = null; } });
    renderManager();
    syncPull();
    return _managerPage;
  }
  function hskCardsHTML() {
    var html = '';
    for (var lv = 1; lv <= 3; lv++) {
      var n = hskWords(lv).length;
      html += '<div class="hgx-hskcard">' +
        '<div class="hgx-hskname">HSK ' + lv + '</div>' +
        '<div class="hgx-hskcount">' + (n ? n + ' từ trong app' : 'Chưa nạp từ') + '</div>' +
        '<div class="hgx-hskbtns">' +
        '<button class="hgx-btn hgx-btn--mini" data-hsk-learn="' + lv + '">Học</button>' +
        '<button class="hgx-btn hgx-btn--mini hgx-btn--green" data-hsk-match="' + lv + '">Ghép</button>' +
        '</div></div>';
    }
    return html;
  }
  function deckRowsHTML() {
    if (!decks.length) {
      return '<div class="hgx-empty">Chưa có deck nào. Tạo deck phía trên, hoặc bấm "Sửa" ở HSK để trích từ giáo trình vào deck riêng.</div>';
    }
    return decks.map(function (d) {
      return '<div class="hgx-deckrow" data-id="' + esc(d.id) + '">' +
        '<div class="hgx-deckinfo"><b>' + esc(d.name) + '</b>' +
        '<span>' + d.words.length + ' từ</span></div>' +
        '<div class="hgx-deckbtns">' +
        '<button class="hgx-btn hgx-btn--mini" data-act="learn">Học</button>' +
        '<button class="hgx-btn hgx-btn--mini hgx-btn--green" data-act="match">Ghép</button>' +
        '<button class="hgx-btn hgx-btn--mini" data-act="edit">Sửa</button>' +
        '<button class="hgx-btn hgx-btn--mini hgx-btn--danger" data-act="del">Xóa</button>' +
        '</div></div>';
    }).join('');
  }
  function cloudBoxHTML() {
    var base = apiBase(), s = session();
    var state, extra = '';
    if (!base) {
      state = '<b class="hgx-warn">Chưa nối máy chủ</b> — deck hiện chỉ lưu trên máy này.';
      extra = '<div class="hgx-cfg"><input id="hgx-api-input" placeholder="Dán link Worker, vd: https://han-giai.xxx.workers.dev" />' +
        '<button class="hgx-btn" data-cfg="1">Lưu</button></div>';
    } else if (!s) {
      state = '<b class="hgx-warn">Chưa đăng nhập</b> — đăng nhập để đồng bộ deck lên KV.';
      extra = '<form class="hgx-cfg" data-login="1">' +
        '<input id="hgx-lg-user" placeholder="Tên đăng nhập" autocomplete="username" />' +
        '<input id="hgx-lg-pass" type="password" placeholder="Mật khẩu" autocomplete="current-password" />' +
        '<button class="hgx-btn hgx-btn--green" type="submit">Đăng nhập</button></form>' +
        '<div class="hgx-cfg"><input id="hgx-api-input" value="' + esc(base) + '" />' +
        '<button class="hgx-btn" data-cfg="1">Đổi máy chủ</button></div>';
    } else {
      state = 'Tài khoản <b>' + esc(s.username) + '</b> — deck sẽ tự đồng bộ lên KV.' +
        '<div class="hgx-cfg"><input id="hgx-api-input" value="' + esc(base) + '" />' +
        '<button class="hgx-btn" data-cfg="1">Đổi máy chủ</button>' +
        '<button class="hgx-btn" data-sync="1">Đồng bộ ngay</button></div>';
    }
    return '<div class="hgx-cloud"><div class="hgx-cloud-state">' + state + '</div>' + extra +
      '<div class="hgx-syncline" id="hgx-syncline"></div></div>';
  }
  function renderManager() {
    if (!_managerPage) return;
    var p = _managerPage;
    p.body.innerHTML =
      cloudBoxHTML() +
      '<div class="hgx-section">' +
      '<div class="hgx-newdeck">' +
      '<input id="hgx-newdeck-name" type="text" maxlength="40" placeholder="Tên deck mới, ví dụ: Chữ hay quên" />' +
      '<button class="hgx-btn hgx-btn--green" id="hgx-newdeck-btn">Tạo deck</button>' +
      '</div>' +
      '<div class="hgx-decklist">' + deckRowsHTML() + '</div>' +
      '</div>' +
      '<div class="hgx-section">' +
      '<h3 class="hgx-h3">Ôn theo giáo trình (từ đã nạp trong app)</h3>' +
      '<div class="hgx-hskgrid">' + hskCardsHTML() + '</div>' +
      '</div>' +
      '<p class="hgx-note">Học = lật flashcard · Ghép = chơi Ghép từ siêu tốc · Sửa = thêm/xóa/đổi tên deck. Thêm từ mới bằng cách gõ pinyin, app sẽ dự đoán chữ Hán.</p>';

    _syncLine = p.body.querySelector('#hgx-syncline');
    if (cloudReady()) setStatus('Đã đồng bộ lên đám mây ✓');

    /* Tạo deck */
    p.body.querySelector('#hgx-newdeck-btn').addEventListener('click', function () {
      var inp = p.body.querySelector('#hgx-newdeck-name');
      var name = inp.value.trim();
      if (!name) { toast('Hãy nhập tên deck'); inp.focus(); return; }
      createDeck(name);
      renderManager();
    });
    p.body.querySelector('#hgx-newdeck-name').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); p.body.querySelector('#hgx-newdeck-btn').click(); }
    });

    /* Hàng deck: Học / Ghép / Sửa / Xóa */
    p.body.querySelector('.hgx-decklist').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var id = btn.closest('.hgx-deckrow').getAttribute('data-id');
      var act = btn.getAttribute('data-act');
      var d = getDeck(id);
      if (!d) return;
      if (act === 'learn') { if (window.HGFlash) HGFlash.openDeck(id); }
      else if (act === 'match') { if (window.HGMatch) HGMatch.openDeck(id); }
      else if (act === 'edit') { openEditor(id); }
      else if (act === 'del') {
        if (U.confirm('Xóa deck "' + d.name + '"?')) { deleteDeck(id); renderManager(); }
      }
    });

    /* HSK: Học / Ghép */
    p.body.querySelector('.hgx-hskgrid').addEventListener('click', function (e) {
      var lb = e.target.closest('button[data-hsk-learn]');
      var mb = e.target.closest('button[data-hsk-match]');
      if (lb && window.HGFlash) HGFlash.openHSK(+lb.getAttribute('data-hsk-learn'));
      else if (mb && window.HGMatch) HGMatch.openHSK(+mb.getAttribute('data-hsk-match'));
    });

    /* Cấu hình máy chủ */
    p.body.querySelector('[data-cfg]').addEventListener('click', function () {
      var v = p.body.querySelector('#hgx-api-input').value.trim().replace(/\/+$/, '');
      try { localStorage.setItem(LS_API, v); } catch (err) { }
      _pulledOnce = false;
      toast(v ? 'Đã lưu địa chỉ máy chủ' : 'Đã xóa địa chỉ máy chủ');
      renderManager();
    });

    /* Đăng nhập nhanh để đồng bộ */
    var loginForm = p.body.querySelector('[data-login]');
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var u = p.body.querySelector('#hgx-lg-user').value.trim();
        var pw = p.body.querySelector('#hgx-lg-pass').value;
        if (!u || !pw) { toast('Nhập đủ tên đăng nhập và mật khẩu'); return; }
        setStatus('Đang đăng nhập…');
        cloudLogin(u, pw).then(function () {
          toast('Đăng nhập thành công');
          renderManager();
        }).catch(function (err) { setStatus('Đăng nhập lỗi: ' + err.message); });
      });
    }

    var syncBtn = p.body.querySelector('[data-sync]');
    if (syncBtn) syncBtn.addEventListener('click', function () { _pulledOnce = false; syncPull(true).then(syncPush); });
  }

  /* ================= GIAO DIỆN: TRANG SỬA DECK (có Bộ gõ pinyin) ================= */
  function openEditor(id) {
    var d = getDeck(id);
    if (!d) { toast('Không tìm thấy deck'); return; }
    var p = U.page('Sửa deck', { onClose: function () { } });
    p.body.innerHTML =
      '<div class="hgx-edhead">' +
      '<div class="hgx-edname"><b id="hgx-ed-name">' + esc(d.name) + '</b>' +
      '<button class="hgx-btn hgx-btn--mini" id="hgx-ed-rename">Đổi tên</button></div>' +
      '<div class="hgx-edcount"><b id="hgx-ed-count">' + d.words.length + '</b> từ trong deck</div>' +
      '</div>' +
      '<form class="hgx-addword" id="hgx-addword">' +
      '<div class="hgx-field"><label>Chữ Hán <span class="hgx-tip">(gõ pinyin — app đoán chữ)</span></label>' +
      '<input id="hgx-w-hanzi" autocomplete="off" placeholder="Thử gõ: nihao hoặc ni3hao3" /></div>' +
      '<div class="hgx-field"><label>Pinyin</label>' +
      '<input id="hgx-w-pinyin" autocomplete="off" placeholder="Tự điền khi chọn gợi ý" /></div>' +
      '<div class="hgx-field"><label>Nghĩa tiếng Việt</label>' +
      '<input id="hgx-w-vi" autocomplete="off" placeholder="ví dụ: xin chào" /></div>' +
      '<button class="hgx-btn hgx-btn--green hgx-btn--wide" type="submit">Thêm vào deck</button>' +
      '</form>' +
      '<div class="hgx-wordlist" id="hgx-wordlist"></div>' +
      '<p class="hgx-note">Quy ước bộ gõ: gõ v = ü (nv3 = nǚ), có thể thêm số thanh điệu, phím cách hoặc Enter để chọn gợi ý đầu tiên, mũi tên lên/xuống để chọn gợi ý khác.</p>';

    var hanziEl = p.body.querySelector('#hgx-w-hanzi');
    var pinyinEl = p.body.querySelector('#hgx-w-pinyin');
    var viEl = p.body.querySelector('#hgx-w-vi');
    var listEl = p.body.querySelector('#hgx-wordlist');
    var countEl = p.body.querySelector('#hgx-ed-count');

    /* Gắn Bộ gõ pinyin vào ô Chữ Hán */
    if (window.HGIME) {
      HGIME.attach(hanziEl, {
        onPick: function (c) {
          pinyinEl.value = c.pinyin;
          if (c.vi && !viEl.value.trim()) viEl.value = c.vi;
          setTimeout(function () { viEl.focus(); viEl.select(); }, 0);
        }
      });
    }

    function renderWords() {
      countEl.textContent = d.words.length;
      if (!d.words.length) {
        listEl.innerHTML = '<div class="hgx-empty">Deck còn trống. Gõ pinyin ở ô "Chữ Hán" phía trên rồi chọn gợi ý nhé.</div>';
        return;
      }
      listEl.innerHTML = d.words.map(function (w, i) {
        return '<div class="hgx-wordrow">' +
          '<div class="hgx-wordmain">' +
          '<b class="hgx-wordhz">' + esc(w.hanzi) + '</b>' +
          '<span class="hgx-wordpy">' + esc(w.pinyin) + '</span>' +
          '<span class="hgx-wordvi">' + esc(w.vi || '—') + '</span>' +
          '</div>' +
          '<div class="hgx-wordbtns">' +
          '<button class="hgx-btn hgx-btn--mini" data-say="' + i + '" title="Đọc">Nghe</button>' +
          '<button class="hgx-btn hgx-btn--mini hgx-btn--danger" data-rm="' + i + '" title="Xóa khỏi deck">Xóa</button>' +
          '</div></div>';
      }).join('');
    }
    renderWords();

    listEl.addEventListener('click', function (e) {
      var say = e.target.closest('button[data-say]');
      var rm = e.target.closest('button[data-rm]');
      if (say) { U.speak(d.words[+say.getAttribute('data-say')].hanzi); }
      else if (rm) {
        removeWord(id, +rm.getAttribute('data-rm'));
        renderWords();
      }
    });

    p.body.querySelector('#hgx-ed-rename').addEventListener('click', function () {
      var name = window.prompt('Tên deck mới:', d.name);
      if (name === null) return;
      renameDeck(id, name);
      p.body.querySelector('#hgx-ed-name').textContent = d.name;
    });

    p.body.querySelector('#hgx-addword').addEventListener('submit', function (e) {
      e.preventDefault();
      var hz = hanziEl.value.trim();
      var py = pinyinEl.value.trim();
      var vi = viEl.value.trim();
      if (!hz) { toast('Hãy gõ pinyin hoặc dán chữ Hán'); hanziEl.focus(); return; }
      if (!/[\u3400-\u9fff]/.test(hz)) { toast('Ô Chữ Hán phải là chữ Hán — hãy chọn 1 gợi ý bên dưới'); hanziEl.focus(); return; }
      if (!vi) { toast('Nhập nghĩa tiếng Việt để chơi Ghép từ được'); viEl.focus(); return; }
      var r = addWord(id, { hanzi: hz, pinyin: py, vi: vi });
      if (r === 'dup') { toast('Từ này đã có trong deck'); return; }
      hanziEl.value = ''; pinyinEl.value = ''; viEl.value = '';
      renderWords();
      hanziEl.focus();
      toast('Đã thêm ' + hz);
    });
    return p;
  }

  /* ================= NỔI GÓC MÀN HÌNH (Dock) ================= */
  function injectDock() {
    var hide = '';
    try { hide = localStorage.getItem('hg_hide_dock'); } catch (e) { }
    if (hide === '1') return;
    if (document.querySelector('.hgx-dock')) return;
    var d = document.createElement('div');
    d.className = 'hgx-dock';
    d.innerHTML =
      '<button type="button" class="hgx-dockbtn" title="Deck & Flashcard">&#128218;</button>' +
      '<button type="button" class="hgx-dockbtn hgx-dockbtn--g" title="Ghép từ siêu tốc">&#9889;</button>';
    var b1 = d.children[0], b2 = d.children[1];
    b1.addEventListener('click', function () {
      if (window.HGFlash) HGFlash.open();
      else toast('Đang tải flashcard…');
    });
    b2.addEventListener('click', function () {
      if (window.HGMatch) HGMatch.open();
      else toast('Đang tải Ghép từ siêu tốc…');
    });
    document.body.appendChild(d);
  }

  /* Nạp data.json của app nếu biến DATA chưa sẵn sàng (để đếm từ HSK) */
  U.ensureAppData(function () {
    if (_managerPage) renderManager();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDock);
  } else {
    injectDock();
  }

  /* ================= EXPORT ================= */
  window.HGDecks = {
    openManager: openManager,
    openEditor: openEditor,
    createDeck: createDeck,
    renameDeck: renameDeck,
    deleteDeck: deleteDeck,
    addWord: addWord,
    removeWord: removeWord,
    allDecks: allDecks,
    deckWords: deckWords,
    hskWords: hskWords,
    cloudLogin: cloudLogin,
    syncNow: function () { _pulledOnce = false; return syncPull(true).then(syncPush); },
    _apiBase: apiBase,
    _session: session
  };
})();
