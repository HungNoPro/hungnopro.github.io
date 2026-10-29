/* ================================================================
   HÀN GIAI X — KHUNG GIAO DIỆN DÙNG CHUNG (hgx-ui.js)
   Dùng chung cho: Deck & Flashcard, Ghép từ siêu tốc, Bộ gõ pinyin.
   Không phụ thuộc hanyu.js — nạp TRƯỚC các file kia.
   Tạo ra: window.HGXUI = { esc, shuffle, speak, page, toast, confirm,
                            appDataSync, ensureAppData }
   ================================================================ */
(function () {
  'use strict';
  if (window.HGXUI) return;

  /* ---------- Tiện ích ---------- */
  var NFC = function (s) { return s == null ? '' : String(s).normalize('NFC'); };

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  var shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* ---------- Đọc data.json của app (dù hanyu.js có che biến DATA) ---------- */
  var _appData = null, _appDataTried = false;

  function appDataSync() {
    if (_appData && _appData.units) return _appData;
    try {
      if (window.DATA && Array.isArray(window.DATA.units)) { _appData = window.DATA; return _appData; }
    } catch (e) { }
    try {
      if (typeof DATA !== 'undefined' && DATA && Array.isArray(DATA.units)) { _appData = DATA; return _appData; }
    } catch (e) { }
    return null;
  }

  function ensureAppData(cb) {
    var d = appDataSync();
    if (d) { if (cb) cb(d); return Promise.resolve(d); }
    if (_appDataTried) { if (cb) cb(null); return Promise.resolve(null); }
    _appDataTried = true;
    if (typeof fetch !== 'function') { if (cb) cb(null); return Promise.resolve(null); }
    return fetch('resources/data.json')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && Array.isArray(j.units)) _appData = j;
        if (cb) cb(_appData);
        return _appData;
      })
      .catch(function () { if (cb) cb(null); return null; });
  }

  /* ---------- TTS tiếng Trung (chống bug Chrome cancel-before-speak) ---------- */
  var _voice = null;
  function pickVoice() {
    try {
      if (!window.speechSynthesis) return;
      var vs = speechSynthesis.getVoices() || [];
      _voice = vs.find(function (v) { return /^zh([-_]CN)?$/i.test(v.lang); })
        || vs.find(function (v) { return /^zh/i.test(v.lang); }) || null;
    } catch (e) { _voice = null; }
  }
  if (window.speechSynthesis) {
    pickVoice();
    try { speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { }
    /* Giọng đọc cần 1 cú chạm đầu tiên để được phép phát — "xịt" sẵn 1 âm câm */
    document.addEventListener('pointerdown', function prime() {
      try {
        var u = new SpeechSynthesisUtterance(' ');
        u.volume = 0; u.lang = 'zh-CN';
        speechSynthesis.speak(u);
      } catch (e) { }
      document.removeEventListener('pointerdown', prime);
    }, { once: true });
  }
  function speak(text) {
    if (!text || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      if (!_voice) pickVoice();
      var u = new SpeechSynthesisUtterance(text);
      if (_voice) u.voice = _voice;
      u.lang = 'zh-CN'; u.rate = 0.85;
      setTimeout(function () { speechSynthesis.speak(u); }, 0);
    } catch (e) { }
  }

  /* ---------- Trang phủ toàn màn hình (có nút ← quay lại) ---------- */
  function page(title, opts) {
    opts = opts || {};
    var root = document.createElement('div');
    root.className = 'hgx-page';
    root.innerHTML =
      '<div class="hgx-topbar">' +
      '  <button class="hgx-backbtn" type="button" aria-label="Quay lại">&#8592;</button>' +
      '  <div class="hgx-topbar-title">' + esc(title) + '</div>' +
      '  <div class="hgx-topbar-slot"></div>' +
      '</div>' +
      '<div class="hgx-body"></div>';
    document.body.appendChild(root);
    document.documentElement.classList.add('hgx-lock');

    var closed = false;
    var close = function () {
      if (closed) return;
      closed = true;
      if (root.parentNode) root.parentNode.removeChild(root);
      if (!document.querySelector('.hgx-page')) {
        document.documentElement.classList.remove('hgx-lock');
      }
      if (opts.onClose) { try { opts.onClose(); } catch (e) { } }
    };
    root.querySelector('.hgx-backbtn').addEventListener('click', close);
    return {
      root: root,
      body: root.querySelector('.hgx-body'),
      slot: root.querySelector('.hgx-topbar-slot'),
      close: close,
      setTitle: function (t) { root.querySelector('.hgx-topbar-title').textContent = t; }
    };
  }

  /* ---------- Toast thông báo ---------- */
  var _toastEl = null, _toastT = null;
  function toast(msg, ms) {
    if (!_toastEl) {
      _toastEl = document.createElement('div');
      _toastEl.className = 'hgx-toast';
      document.body.appendChild(_toastEl);
    }
    _toastEl.textContent = msg;
    _toastEl.classList.add('hgx-show');
    clearTimeout(_toastT);
    _toastT = setTimeout(function () { _toastEl.classList.remove('hgx-show'); }, ms || 1800);
  }

  window.HGXUI = {
    NFC: NFC,
    esc: esc,
    shuffle: shuffle,
    speak: speak,
    page: page,
    toast: toast,
    confirm: function (msg) { return window.confirm(msg); },
    appDataSync: appDataSync,
    ensureAppData: ensureAppData
  };
})();
