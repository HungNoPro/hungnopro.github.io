/* ================================================================
   HÀN GIAI X — BỘ GÕ PINYIN DỰ ĐOÁN CHỮ HÁN (ime.js)
   Hoạt động như bàn phím tiếng Trung:
     - Gõ "nihao" (hoặc "ni3hao3") → gợi ý 你好, 好你?, ...
     - Gõ v = ü (nv3 = nǚ), khoảng trắng không bắt buộc
   Nguồn gợi ý: ime-dict.js (~300 từ phổ biến) + TOÀN BỘ từ vựng
   đã nạp trong app (data.json HSK 1/2/3) — tự hợp nhất khi app tải xong.

   API:
     HGIME.query("nihao")             → [{hanzi, pinyin, vi}, ...] tối đa 9
     HGIME.attach(inputEl, {onPick})  → gắn UI gợi ý vào 1 ô input
   ================================================================ */
(function () {
  'use strict';
  if (window.HGIME) return;

  /* ---------- Danh sách âm tiết pinyin hợp lệ (không thanh điệu) ---------- */
  var SYLL_RAW =
    'a,ai,an,ang,ao,' +
    'ba,bai,ban,bang,bao,bei,ben,beng,bi,bian,biao,bie,bin,bing,bo,bu,' +
    'ca,cai,can,cang,cao,ce,cen,ceng,cha,chai,chan,chang,chao,che,chen,cheng,chi,chong,chou,chu,chua,chuai,chuan,chuang,chui,chun,chuo,ci,cong,cou,cu,cuan,cui,cun,cuo,' +
    'da,dai,dan,dang,dao,de,dei,den,deng,di,dia,dian,diao,die,ding,diu,dong,dou,du,duan,dui,dun,duo,' +
    'e,ei,en,eng,er,' +
    'fa,fan,fang,fei,fen,feng,fo,fou,fu,' +
    'ga,gai,gan,gang,gao,ge,gei,gen,geng,gong,gou,gu,gua,guai,guan,guang,gui,gun,guo,' +
    'ha,hai,han,hang,hao,he,hei,hen,heng,hong,hou,hu,hua,huai,huan,huang,hui,hun,huo,' +
    'ji,jia,jian,jiang,jiao,jie,jin,jing,jiong,jiu,ju,juan,jue,jun,' +
    'ka,kai,kan,kang,kao,ke,kei,ken,keng,kong,kou,ku,kua,kuai,kuan,kuang,kui,kun,kuo,' +
    'la,lai,lan,lang,lao,le,lei,leng,li,lia,lian,liang,liao,lie,lin,ling,liu,lo,long,lou,lu,luan,lun,luo,lv,lve,' +
    'ma,mai,man,mang,mao,me,mei,men,meng,mi,mian,miao,mie,min,ming,miu,mo,mou,mu,' +
    'na,nai,nan,nang,nao,ne,nei,nen,neng,ni,nian,niang,niao,nie,nin,ning,niu,nong,nu,nuan,nuo,nv,nve,' +
    'o,ou,' +
    'pa,pai,pan,pang,pao,pei,pen,peng,pi,pian,piao,pie,pin,ping,po,pou,pu,' +
    'qi,qia,qian,qiang,qiao,qie,qin,qing,qiong,qiu,qu,quan,que,qun,' +
    'ran,rang,rao,re,ren,reng,ri,rong,rou,ru,rua,ruan,rui,run,ruo,' +
    'sa,sai,san,sang,sao,se,sen,seng,sha,shai,shan,shang,shao,she,shei,shen,sheng,shou,shu,shua,shuai,shuan,shuang,shui,shun,shuo,si,song,sou,su,suan,sui,sun,suo,' +
    'ta,tai,tan,tang,tao,te,teng,ti,tian,tiao,tie,ting,tong,tou,tu,tuan,tui,tun,tuo,' +
    'wa,wai,wan,wang,wei,wen,weng,wo,wu,' +
    'xi,xia,xian,xiang,xiao,xie,xin,xing,xiong,xiu,xu,xuan,xue,xun,' +
    'ya,yan,yang,yao,ye,yi,yin,ying,yo,yong,you,yu,yuan,yue,yun,' +
    'za,zai,zan,zang,zao,ze,zei,zen,zeng,zha,zhai,zhan,zhang,zhao,zhe,zhen,zheng,zhong,zhou,zhu,zhua,zhuai,zhuan,zhuang,zhui,zhun,zhuo,zi,zong,zou,zu,zuan,zui,zun,zuo';
  var SYLL = {};
  SYLL_RAW.split(',').forEach(function (s) { SYLL[s] = 1; });

  /* ---------- Tách dấu thanh → số (ā→a1, ǜ→v4 ...) ---------- */
  var TONE_OF = {
    'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4,
    'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
    'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4,
    'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
    'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4,
    'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4
  };
  var PLAIN_OF = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
    'ü': 'v'
  };

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* pinyin hiển thị → { base: "nihao", tones: "33" } */
  function parsePinyin(py) {
    var base = '', tones = '';
    var parts = String(py || '').toLowerCase().split(/[\s'\u2019\u00b7-]+/);
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p];
      if (!part) continue;
      var b = '', tone = 5;
      for (var i = 0; i < part.length; i++) {
        var ch = part[i];
        if (ch >= '0' && ch <= '9') { tone = +ch || 5; continue; }
        if (TONE_OF[ch]) { tone = TONE_OF[ch]; b += PLAIN_OF[ch]; }
        else if (ch === 'ü') b += 'v';
        else if (ch >= 'a' && ch <= 'z') b += ch;
      }
      if (!b) continue;
      base += b;
      tones += tone;
    }
    return { base: base, tones: tones };
  }

  /* ---------- Chỉ mục từ ---------- */
  var IDX = [];
  var _appMerged = false;

  function addEntry(hanzi, pinyin, vi) {
    hanzi = String(hanzi || '').trim();
    if (!hanzi || !pinyin) return;
    var pp = parsePinyin(pinyin);
    if (!pp.base) return;
    IDX.push({ hz: hanzi, py: String(pinyin).trim(), vi: vi || '', base: pp.base, tones: pp.tones });
  }

  function buildBase() {
    var d = window.HG_IME_DICT || [];
    for (var i = 0; i < d.length; i++) addEntry(d[i][0], d[i][1], d[i][2]);
  }

  /* Hợp nhất từ vựng của app (data.json) — đọc trường linh hoạt */
  function mergeApp() {
    if (_appMerged) return;
    var D = null;
    if (window.HGXUI && window.HGXUI.appDataSync) D = window.HGXUI.appDataSync();
    if (!D) return;
    _appMerged = true;
    var seen = {};
    IDX.forEach(function (x) { seen[x.hz] = 1; });
    function push(w) {
      if (!w) return;
      var hz = w.hanzi != null ? w.hanzi : (w.zi != null ? w.zi : (w.z != null ? w.z : w.word));
      var py = w.pinyin != null ? w.pinyin : (w.py != null ? w.py : '');
      var vi = w.vi != null ? w.vi : (w.viet != null ? w.viet : (w.nghia != null ? w.nghia : (w.meaning != null ? w.meaning : '')));
      if (!hz || !py || seen[hz]) return;
      seen[hz] = 1;
      addEntry(hz, py, vi);
    }
    (D.units || []).forEach(function (u) {
      if (!u) return;
      (u.words || []).forEach(push);
      (u.vocab || []).forEach(push);
      (u.lessons || []).forEach(function (L) {
        if (!L) return;
        if (Array.isArray(L)) { L.forEach(push); return; }
        (L.words || []).forEach(push);
        (L.vocab || []).forEach(push);
      });
    });
  }

  buildBase();
  mergeApp();
  /* data.json có thể tải bất đồng bộ → thử hợp nhất lại trong 20 giây đầu */
  var _tries = 0;
  var _iv = setInterval(function () {
    _tries++;
    if (_appMerged || _tries > 20) { clearInterval(_iv); return; }
    mergeApp();
  }, 1000);

  /* ---------- Tách chuỗi pinyin thành các âm tiết (tham lam + thử lại) ---------- */
  function segment(s) {
    var memo = {};
    function go(i) {
      if (i === s.length) return [];
      if (memo[i] !== undefined) return memo[i];
      var maxL = Math.min(6, s.length - i);
      for (var L = maxL; L >= 1; L--) {
        var piece = s.slice(i, i + L);
        if (SYLL[piece]) {
          var rest = go(i + L);
          if (rest) { memo[i] = [piece].concat(rest); return memo[i]; }
        }
      }
      memo[i] = null;
      return null;
    }
    return go(0);
  }

  /* ---------- Truy vấn ứng viên ---------- */
  function query(text) {
    var raw = String(text || '').toLowerCase();
    if (/[\u3400-\u9fff]/.test(raw)) return [];   /* đã là chữ Hán → không gợi ý */
    var base = '', tones = '';
    for (var i = 0; i < raw.length; i++) {
      var ch = raw[i];
      if (ch >= '0' && ch <= '9') { tones += (ch === '0' ? '5' : ch); continue; }
      if (ch === 'ü') { base += 'v'; continue; }
      if (ch >= 'a' && ch <= 'z') base += ch;
    }
    if (!base) return [];
    var seg = segment(base);
    var segBase = seg ? seg.join('') : '';

    var out = [], seen = {};
    function add(it) {
      if (seen[it.hz]) return;
      seen[it.hz] = 1;
      out.push({ hanzi: it.hz, pinyin: it.py, vi: it.vi });
    }

    /* 1) Khớp trọn vẹn chuỗi âm tiết — ưu tiên đúng thanh điệu nếu có nhập số */
    if (seg && segBase === base) {
      var exact = IDX.filter(function (w) { return w.base === base; });
      if (tones) {
        exact.sort(function (a, b) {
          return (b.tones === tones ? 1 : 0) - (a.tones === tones ? 1 : 0);
        });
      }
      exact.forEach(add);
    }
    /* 1b) Ghép từng chữ theo âm tiết như bàn phím thật: wo+shi → 我是 */
    if (seg && segBase === base) {
      var composed = '', compPy = [], ok = true;
      for (var si = 0; si < seg.length; si++) {
        var best = null;
        for (var ki = 0; ki < IDX.length; ki++) {
          if (IDX[ki].base === seg[si]) { best = IDX[ki]; break; }
        }
        if (!best) { ok = false; break; }
        composed += best.hz;
        compPy.push(best.py);
      }
      if (ok && composed) add({ hz: composed, py: compPy.join(' '), vi: '' });
    }
    /* 2) Tiền tố trực tiếp trên chuỗi đã gõ (vd "nih" → 你好...) */
    for (var k = 0; k < IDX.length; k++) {
      if (IDX[k].base.indexOf(base) === 0) add(IDX[k]);
    }
    /* 4) Âm tiết cuối chưa gõ xong: "wosh" = wo + sh(dở) → 我是, 我上…
       Tách trọn phần đầu, phần đuôi tìm chữ có âm bắt đầu bằng đuôi đó */
    if (!seg && base.length >= 2) {
      for (var cut = base.length - 1; cut >= 1; cut--) {
        var preSeg = segment(base.slice(0, cut));
        if (!preSeg) continue;
        var rest = base.slice(cut);
        var chars = [], pys = [], okAll = true;
        for (var si = 0; si < preSeg.length; si++) {
          var best = null;
          for (var ki2 = 0; ki2 < IDX.length; ki2++) {
            if (IDX[ki2].base === preSeg[si]) { best = IDX[ki2]; break; }
          }
          if (!best) { okAll = false; break; }
          chars.push(best.hz);
          pys.push(best.py);
        }
        if (!okAll) break;
        var added = 0;
        for (var ki3 = 0; ki3 < IDX.length && added < 3; ki3++) {
          var c = IDX[ki3];
          /* chỉ ghép chữ ĐƠN cho phần âm dở dang, như bàn phím thật */
          if (c.hz.length === 1 && c.base.indexOf(rest) === 0 && c.base.length > rest.length) {
            add({ hz: chars.join('') + c.hz, py: pys.join(' ') + ' ' + c.py, vi: '' });
            added++;
          }
        }
        break;   /* dùng cách tách dài nhất đầu tiên tìm được */
      }
    }
    return out.slice(0, 9);
  }

  /* ---------- Gắn UI gợi ý vào 1 ô input ---------- */
  function attach(input, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'hgx-ime-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var box = document.createElement('div');
    box.className = 'hgx-ime-box';
    wrap.appendChild(box);

    var cands = [], active = 0;

    function render() {
      if (!cands.length) { box.classList.remove('hgx-open'); box.innerHTML = ''; return; }
      box.classList.add('hgx-open');
      box.innerHTML = cands.map(function (c, i) {
        return '<button type="button" class="hgx-ime-cand' + (i === active ? ' hgx-active' : '') +
          '" data-i="' + i + '"><b>' + esc(c.hanzi) + '</b><span>' + esc(c.pinyin) + '</span></button>';
      }).join('');
    }

    function update() {
      var v = input.value;
      if (/[\u3400-\u9fff]/.test(v)) { cands = []; render(); return; }
      cands = query(v);
      active = 0;
      render();
    }

    function pick(i) {
      var c = cands[i];
      if (!c) return;
      input.value = c.hanzi;
      cands = [];
      render();
      if (opts.onPick) { try { opts.onPick(c, input); } catch (e) { } }
      try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { }
      input.focus();
    }

    input.addEventListener('input', update);
    input.addEventListener('focus', update);
    input.addEventListener('blur', function () {
      setTimeout(function () { cands = []; render(); }, 200);
    });
    input.addEventListener('keydown', function (e) {
      if (!cands.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % cands.length; render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + cands.length) % cands.length; render(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active); }
      else if (e.key === 'Escape') { cands = []; render(); }
    });
    box.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('.hgx-ime-cand');
      if (b) { e.preventDefault(); pick(+b.getAttribute('data-i')); }
    });

    return { update: update };
  }

  window.HGIME = { query: query, attach: attach, _rebuild: function () { mergeApp(); } };
})();
