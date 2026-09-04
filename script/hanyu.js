"use strict";
/* ==================================================================
   CẤU HÌNH — dán URL Cloudflare Worker của bạn vào đây, ví dụ:
   const API_BASE = "https://hangai-sync.ten-ban.workers.dev";
   Để trống "" thì app chạy 100% offline (localStorage).
   ================================================================== */
const API_BASE = "https://hanyu.hungthcs2017.workers.dev";

/* ================= DỮ LIỆU (load từ data.json) ================= */
let DATA=null, UNITS=[], WORDS=[];

/* ================= TRẠNG THÁI LOCAL ================= */
const KEY="hangai-v1", AKEY="hangai-auth-v1";
const DEF={xp:0,streak:0,lastDay:null,days:{},done:{},cp:{},words:{},sound:true,cur:1,welcomed:false,updatedAt:0};
let S=DEF;
try{const raw=localStorage.getItem(KEY);if(raw)S=Object.assign({},DEF,JSON.parse(raw));}catch(e){}

let AUTH=null;
try{AUTH=JSON.parse(localStorage.getItem(AKEY)||"null");}catch(e){AUTH=null;}

/* ================= TIỆN ÍCH ================= */
const $=s=>document.querySelector(s);
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const pick=a=>a[Math.floor(Math.random()*a.length)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\u4e00-\u9fff]/g,'');
function icons(){if(window.lucide)lucide.createIcons();}
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2300);}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const dayKey=(off=0)=>{const d=new Date();d.setDate(d.getDate()+off);return d.toLocaleDateString('sv-SE');};
function effStreak(){return (S.lastDay===dayKey()||S.lastDay===dayKey(-1))?S.streak:0;}
function touchDay(){const t=dayKey();if(S.lastDay!==t){S.streak=(S.lastDay===dayKey(-1))?S.streak+1:1;S.lastDay=t;}}
function addXp(n){const t=dayKey();const before=S.days[t]||0;S.days[t]=before+n;S.xp+=n;
  if(before<50&&S.days[t]>=50)toast("Đạt mục tiêu 50 XP hôm nay rồi, quá đỉnh!");}

/* ================= AUTH & SYNC (Cloudflare Worker) ================= */
const CLOUD_ON=()=>/^https?:\/\//.test(API_BASE);

function saveLocal(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function save(){
  S.updatedAt=Date.now();
  saveLocal();
  queueSync();
}
function persistAuth(){
  if(AUTH)localStorage.setItem(AKEY,JSON.stringify(AUTH));
  else localStorage.removeItem(AKEY);
}

async function api(path,body){
  const headers={};
  if(body)headers["Content-Type"]="application/json";
  if(AUTH&&AUTH.token)headers["Authorization"]="Bearer "+AUTH.token;
  const r=await fetch(API_BASE+path,{method:body?"POST":"GET",headers,body:body?JSON.stringify(body):undefined});
  let j={};try{j=await r.json();}catch(e){}
  if(!r.ok){const err=new Error(j.error||("Lỗi kết nối ("+r.status+")"));err.status=r.status;throw err;}
  return j;
}

/* PBKDF2 client — password không bao giờ gửi thẳng, chỉ gửi hash */
const hexToBytes=h=>{const a=new Uint8Array(h.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(h.slice(i*2,i*2+2),16);return a;};
const bytesToHex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
const randHex=n=>bytesToHex(crypto.getRandomValues(new Uint8Array(n)));
async function pbkdf2(pw,saltHex){
  if(!crypto.subtle)throw new Error("Trình duyệt cần https để mã hóa mật khẩu an toàn");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:hexToBytes(saltHex),iterations:100000},key,256);
  return bytesToHex(bits);
}

async function doLogin(u,p){
  const step1=await api("/login",{username:u});            // bước 1: xin salt
  const hash=await pbkdf2(p,step1.salt);                    // bước 2: hash phía client
  return api("/login",{username:u,hash});                   // trả {user, token}
}
async function doRegister(u,p){
  const salt=randHex(16);
  const hash=await pbkdf2(p,salt);
  return api("/register",{username:u,salt,hash});
}

/* ---- engine đồng bộ ---- */
let syncTimer=null,dirty=false,syncing=false;
function queueSync(){
  if(!AUTH||!AUTH.token){return;}
  dirty=true;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>doSync(false),4000);
}
async function doSync(manual){
  if(!AUTH||!AUTH.token||syncing)return;
  if(!dirty&&!manual)return;
  syncing=true;
  try{
    await api("/sync",{updatedAt:S.updatedAt,state:S});
    dirty=false;AUTH.lastSync=Date.now();persistAuth();
    if(manual)toast("Đã đồng bộ tiến trình lên cloud");
    if(!$('#scr-profile').classList.contains('hidden'))renderProfile();
  }catch(e){
    if(e.status===401){AUTH=null;persistAuth();toast("Phiên đăng nhập hết hạn — đăng nhập lại nhé");if(!$('#scr-profile').classList.contains('hidden'))renderProfile();}
    else if(manual)toast("Đồng bộ thất bại: "+e.message);
    /* offline thì giữ dirty, tự thử lại khi có mạng */
  }finally{syncing=false;}
}
window.addEventListener("online",()=>{if(dirty)doSync(false);});

function applyCloud(cloud){
  S=Object.assign({},DEF,cloud.state||{});
  saveLocal();
  renderTop();renderHome();
  if(!$('#scr-profile').classList.contains('hidden'))renderProfile();
}
const countLearned=st=>Object.keys((st&&st.words)||{}).length;

async function pullState(){
  if(!AUTH||!AUTH.token)return;
  try{
    const cloud=await api("/sync");
    if(!cloud.updatedAt){if(S.updatedAt)queueSync();return;}       // cloud trống → đẩy local lên
    if(cloud.updatedAt>(S.updatedAt||0)){applyCloud(cloud);toast("Đã lấy tiến trình mới nhất từ cloud");}
    else if(S.updatedAt>cloud.updatedAt){queueSync();}
  }catch(e){if(e.status===401){AUTH=null;persistAuth();}/* offline: im lặng, dùng local */}
}

async function afterLogin(res){
  AUTH={user:res.user,token:res.token};
  persistAuth();
  let cloud=null;
  try{cloud=await api("/sync");}catch(e){}
  const hasLocal=(S.updatedAt||0)>0&&(S.xp>0||countLearned(S)>0);
  const hasCloud=!!(cloud&&cloud.updatedAt>0);
  if(hasCloud&&hasLocal&&cloud.updatedAt!==S.updatedAt)conflictModal(cloud);
  else if(hasCloud){applyCloud(cloud);}
  else{S.updatedAt=Date.now();save();}
}

function conflictModal(cloud){
  const st=cloud.state||{};
  const m=modal(`
    <h2>Hợp nhất tiến trình</h2>
    <p>Tìm thấy dữ liệu ở cả cloud lẫn máy này. Giữ dữ liệu nào?</p>
    <div class="mbtns">
      <button class="btn ghost" id="cfCloud">Trên cloud — ${st.xp||0} XP · ${countLearned(st)} từ</button>
      <button class="btn" id="cfLocal">Trên máy này — ${S.xp} XP · ${countLearned(S)} từ</button>
    </div>`);
  m.querySelector('#cfCloud').onclick=()=>{m.remove();applyCloud(cloud);};
  m.querySelector('#cfLocal').onclick=()=>{m.remove();S.updatedAt=Date.now();save();toast("Đã giữ dữ liệu máy này và đẩy lên cloud");};
}

function logout(){
  AUTH=null;persistAuth();
  dirty=false;clearTimeout(syncTimer);
  toast("Đã đăng xuất — tiến trình vẫn còn trên máy này");
  renderProfile();
}

function authModal(mode){
  let m=mode||"login";
  const back=modal(`
    <div class="atabs">
      <button class="atab on" data-m="login">Đăng nhập</button>
      <button class="atab" data-m="reg">Tạo tài khoản</button>
    </div>
    <div class="afield"><label>TÊN ĐĂNG NHẬP</label>
      <input id="aUser" maxlength="20" autocomplete="username" placeholder="vd: lanngu"></div>
    <div class="afield"><label>MẬT KHẨU</label>
      <input id="aPass" type="password" maxlength="64" autocomplete="current-password" placeholder="tối thiểu 6 ký tự"></div>
    <div class="aerr" id="aErr"></div>
    <button class="btn block" id="aGo">Đăng nhập</button>
    <p class="ahint">Mật khẩu được mã hóa PBKDF2 trước khi gửi —<br>server không lưu mật khẩu gốc. Không có chức năng "quên mật khẩu",<br>nên hãy nhớ kỹ nhé.</p>`);
  const setMode=x=>{
    m=x;
    back.querySelectorAll('.atab').forEach(t=>t.classList.toggle('on',(t.dataset.m==='login')===(x==='login')));
    back.querySelector('#aGo').textContent=x==='login'?'Đăng nhập':'Tạo tài khoản';
  };
  back.querySelectorAll('.atab').forEach(t=>t.onclick=()=>setMode(t.dataset.m));
  const go=async()=>{
    const u=back.querySelector('#aUser').value.trim().toLowerCase();
    const p=back.querySelector('#aPass').value;
    const err=back.querySelector('#aErr');err.textContent='';
    if(!/^[a-z0-9_]{3,20}$/.test(u)){err.textContent='Tên đăng nhập: 3–20 ký tự a–z, 0–9, gạch dưới.';return;}
    if(p.length<6){err.textContent='Mật khẩu tối thiểu 6 ký tự.';return;}
    const btn=back.querySelector('#aGo');btn.disabled=true;btn.textContent='Đang xử lý…';
    try{
      const res=m==='login'?await doLogin(u,p):await doRegister(u,p);
      back.remove();
      await afterLogin(res);
      toast(m==='login'?('Chào mừng trở lại, '+res.user+'!'):('Tài khoản đã tạo — tiến trình tự đồng bộ!'));
    }catch(e){
      err.textContent=e.message;
      btn.disabled=false;btn.textContent=m==='login'?'Đăng nhập':'Tạo tài khoản';
    }
  };
  back.querySelector('#aGo').onclick=go;
  back.querySelector('#aPass').addEventListener('keydown',e=>{if(e.key==='Enter')go();});
}

/* ================= ÂM THANH ================= */
let VOICES=[];
function loadVoices(){try{VOICES=speechSynthesis.getVoices();}catch(e){}}
if('speechSynthesis' in window){loadVoices();try{speechSynthesis.onvoiceschanged=loadVoices;}catch(e){}}
const hasZhVoice=()=>VOICES.some(v=>/^zh/i.test(v.lang));
function speak(txt,slow){
  if(!S.sound||!('speechSynthesis' in window))return;
  try{speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(txt);u.lang='zh-CN';u.rate=slow?0.45:0.85;
    const v=VOICES.find(x=>/^zh[-_]CN/i.test(x.lang))||VOICES.find(x=>/^zh/i.test(x.lang));
    if(v)u.voice=v;speechSynthesis.speak(u);
  }catch(e){}
}
let AC=null;
function sfx(kind){
  if(!S.sound)return;
  try{
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    AC=AC||new C();if(AC.state==='suspended')AC.resume();
    const t=AC.currentTime;
    const tone=(f,d,ty,at)=>{const o=AC.createOscillator(),g=AC.createGain();o.type=ty;o.frequency.value=f;
      g.gain.setValueAtTime(.07,at);g.gain.exponentialRampToValueAtTime(.001,at+d);
      o.connect(g);g.connect(AC.destination);o.start(at);o.stop(at+d);};
    if(kind==='ok'){tone(587,.09,'triangle',t);tone(880,.15,'triangle',t+.09);}
    else if(kind==='no'){tone(196,.2,'sawtooth',t);tone(147,.26,'sawtooth',t+.08);}
    else if(kind==='win'){[523,659,784,1047].forEach((f,i)=>tone(f,.13,'triangle',t+i*.09));}
  }catch(e){}
}
function confetti(){
  if(reduced)return;
  const cv=$('#fx'),ctx=cv.getContext('2d');
  cv.width=innerWidth;cv.height=innerHeight;cv.style.display='block';
  const colors=['#16A172','#F2B02C','#D5482B','#241F15','#FFFDF6'];
  const ps=[];for(let i=0;i<90;i++)ps.push({x:Math.random()*cv.width,y:-30-Math.random()*180,
    v:2.2+Math.random()*3,w:5+Math.random()*5,h:10+Math.random()*8,
    r:Math.random()*Math.PI,vr:(Math.random()-.5)*.25,ph:Math.random()*6,c:colors[i%colors.length]});
  const t0=performance.now();
  (function loop(t){
    ctx.clearRect(0,0,cv.width,cv.height);let alive=false;
    ps.forEach(p=>{p.y+=p.v;p.x+=Math.sin(p.ph+t/300)*1.2;p.r+=p.vr;
      if(p.y<cv.height+30)alive=true;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;
      ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();});
    if(alive&&t-t0<2600)requestAnimationFrame(loop);else cv.style.display='none';
  })(t0);
}

/* ================= MODAL ================= */
function modal(html){
  const back=document.createElement('div');back.className='modal-back';
  back.innerHTML=`<div class="modal">${html}</div>`;
  back.addEventListener('click',e=>{if(e.target===back)back.remove();});
  $('#modal-root').appendChild(back);icons();
  return back;
}
function confirmModal(title,text,okText,danger,cb){
  const m=modal(`<h2>${title}</h2><p>${text}</p>
    <div class="mbtns">
      <button class="btn ghost" id="mCancel">Để sau</button>
      <button class="btn ${danger?'red':''}" id="mOk">${okText}</button>
    </div>`);
  m.querySelector('#mCancel').onclick=()=>m.remove();
  m.querySelector('#mOk').onclick=()=>{m.remove();cb();};
}

/* ================= ĐIỀU HƯỚNG TAB ================= */
function show(id){
  ['scr-home','scr-vocab','scr-profile'].forEach(s=>$('#'+s).classList.toggle('hidden',s!==id));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.scr===id));
  if(id==='scr-home'){renderHome();renderTop();}
  if(id==='scr-vocab')renderVocab();
  if(id==='scr-profile')renderProfile();
  window.scrollTo(0,0);
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>show(t.dataset.scr)));

function renderTop(){
  $('#hStreak span').textContent=effStreak();
  $('#hXp span').textContent=S.xp;
  $('#btnSound').innerHTML=`<i data-lucide="${S.sound?'volume-2':'volume-x'}"></i>`;icons();
  const h=new Date().getHours();
  const g=h<11?"Chào buổi sáng":h<18?"Chào buổi chiều":"Chào buổi tối";
  $('#greet').innerHTML=`${g}! Giữ nhịp học đều mỗi ngày nhé.`;
}
 $('#btnSound').addEventListener('click',()=>{
  S.sound=!S.sound;save();renderTop();
  if(!S.sound&&'speechSynthesis' in window)speechSynthesis.cancel();
  toast(S.sound?"Đã bật âm thanh":"Đã tắt âm thanh");
});

/* ================= LỘ TRÌNH ================= */
const unitWordCount=u=>u.lessons.reduce((s,L)=>s+L[1].length,0);
function lessonDone(u,li){return !!S.done[`${u}-${li}`];}
function unitDone(u){return u.lessons.every((_,li)=>lessonDone(u.no,li));}

function renderHome(){
  const path=$('#path');path.innerHTML='';
  UNITS.forEach(u=>path.appendChild(buildUnit(u)));
  renderRevCard();icons();
  requestAnimationFrame(()=>{
    const cur=path.querySelector('.node.cur')||path.querySelector('.n-open');
    if(cur)cur.scrollIntoView({block:'center'});
  });
}
function buildUnit(u){
  const sec=document.createElement('div');sec.className='unit';
  const nDone=u.lessons.filter((_,li)=>lessonDone(u.no,li)).length;
  const all=unitDone(u)&&S.cp[u.no];
  sec.innerHTML=`
  <div class="ubanner">
    <div class="useal han">${u.seal}</div>
    <div class="utxt">
      <div class="uname">${u.name}<span class="uhsk">HSK ${u.hsk}</span></div>
      <div class="udesc">${u.lessons.length} bài · ${unitWordCount(u)} từ</div>
    </div>
    ${all?`<div class="udone" title="Đã vượt tổng kết"><i data-lucide="trophy"></i></div>`
         :`<div class="uprog"><b>${nDone}/${u.lessons.length}</b><div class="ubar"><i style="width:${u.lessons.length?100*nDone/u.lessons.length:0}%"></i></div></div>`}
  </div>`;
  const wrap=document.createElement('div');wrap.className='pathwrap';
  wrap.style.setProperty('--acc',u.acc);
  sec.appendChild(wrap);
  const items=u.lessons.map((L,li)=>({kind:'l',li}));
  items.push({kind:'cp'});
  const W=Math.max(280,wrap.clientWidth||340);
  const cx=W/2,amp=Math.min(66,W*.19),sp=94,top=58;
  const pts=items.map((_,i)=>({x:cx+Math.sin(i*1.1)*amp,y:top+i*sp}));
  wrap.style.height=(pts[pts.length-1].y+70)+'px';
  const NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('width',W);svg.setAttribute('height',parseInt(wrap.style.height));
  svg.setAttribute('class','pathsvg');
  let d=`M ${pts[0].x} ${pts[0].y}`;
  for(let i=1;i<pts.length;i++){const my=(pts[i-1].y+pts[i].y)/2;
    d+=` C ${pts[i-1].x} ${my} ${pts[i].x} ${my} ${pts[i].x} ${pts[i].y}`;}
  const p=document.createElementNS(NS,'path');p.setAttribute('d',d);svg.appendChild(p);
  wrap.appendChild(svg);
  const curLi=u.lessons.findIndex((_,li)=>!lessonDone(u.no,li));
  const cpReady=unitDone(u);
  items.forEach((it,i)=>{
    const node=document.createElement('button');
    node.className='node'+(it.kind==='cp'?' cp':'');
    node.style.left=pts[i].x+'px';node.style.top=pts[i].y+'px';
    node.style.setProperty('--acc',u.acc);node.style.setProperty('--accd',u.accd);
    let ic,bubble=false;
    if(it.kind==='l'){
      const open=(it.li===0||lessonDone(u.no,it.li-1));
      const done=lessonDone(u.no,it.li);
      const isCur=(it.li===curLi);
      if(done){node.classList.add('n-done');ic='check';
        const st=S.done[`${u.no}-${it.li}`];
        node.insertAdjacentHTML('beforeend',
          `<span class="nstars">${[1,2,3].map(k=>`<span class="${k<=st?'f':'e'}"><i data-lucide="star"></i></span>`).join('')}</span>`);
      }else if(open){node.classList.add('n-open');ic='star';
        if(isCur&&S.cur===u.no){bubble=true;}
        if(isCur)node.classList.add('cur');
      }else{node.classList.add('n-lock');ic='lock';}
      const lesson=u.lessons[it.li];
      node.addEventListener('click',()=>{
        if(node.classList.contains('n-lock')){toast("Hoàn thành bài trước đó để mở khóa nhé");return;}
        const words=WORDS.filter(w=>w.u===u.no&&w.li===it.li);
        startSession({type:'lesson',unit:u.no,li:it.li,words,label:`HSK ${u.hsk} · ${lesson[0]}`});
      });
      if(bubble)node.insertAdjacentHTML('beforeend',`<span class="bubble">BẮT ĐẦU</span>`);
    }else{
      if(S.cp[u.no]){node.classList.add('n-done');ic='trophy';}
      else if(cpReady){node.classList.add('n-open');node.classList.add('cur');ic='flag';
        if(S.cur===u.no)node.insertAdjacentHTML('beforeend',`<span class="bubble">TỔNG KẾT</span>`);}
      else{node.classList.add('n-lock');ic='lock';}
      node.insertAdjacentHTML('beforeend',`<span class="ncap">Tổng kết</span>`);
      node.addEventListener('click',()=>{
        if(!cpReady&&!S.cp[u.no]){toast("Hoàn thành hết các bài của phần này trước nhé");return;}
        const pool=shuffle(WORDS.filter(w=>w.u===u.no));
        startSession({type:'cp',unit:u.no,words:pool.slice(0,10),label:`Tổng kết HSK ${u.hsk}`});
      });
    }
    node.insertAdjacentHTML('afterbegin',`<span class="nic"><i data-lucide="${ic}"></i></span>`);
    wrap.appendChild(node);
  });
  return sec;
}

/* ================= ÔN TẬP THÔNG MINH ================= */
function smartWords(){
  const now=Date.now();
  const learned=WORDS.filter(w=>S.words[w.id]);
  const scored=learned.map(w=>{
    const st=S.words[w.id];
    const days=(now-(st.t||now))/86400000;
    return {w,sc:(st.w||0)*3+days};
  }).sort((a,b)=>b.sc-a.sc);
  let list=scored.map(x=>x.w).slice(0,10);
  if(list.length<10&&learned.length>list.length)list=list.concat(shuffle(learned.filter(w=>!list.includes(w))).slice(0,10-list.length));
  return list;
}
function renderRevCard(){
  const box=$('#revcard');const learned=WORDS.filter(w=>S.words[w.id]).length;
  if(learned<8){box.innerHTML="";return;}
  const list=smartWords();const wrong=WORDS.filter(w=>(S.words[w.id]||{}).w>0).length;
  box.innerHTML=`<div class="revcard">
    <div class="ric"><i data-lucide="repeat"></i></div>
    <div><h3>Ôn tập thông minh</h3>
      <p>${wrong?`${wrong} từ hay sai — ưu tiên củng cố trước`:"Giữ trí nhớ dài hạn với từ đã học"}</p></div>
    <button class="btn terra" id="btnRev">Luyện ngay</button>
  </div>`;
  $('#btnRev').onclick=()=>startSession({type:'rev',words:list,label:'Ôn tập thông minh'});
}

/* ================= PHIÊN BÀI HỌC ================= */
const L={open:false};
const MODE_LABEL={p2h:"PINYIN → CHỮ HÁN",m2h:"NGHĨA → CHỮ HÁN",h2m:"CHỮ HÁN → NGHĨA",h2p:"ĐỌC ÂM (PINYIN)",l2h:"NGHE & CHỌN CHỮ"};

function pickRevs(cur){
  const pool=shuffle(WORDS.filter(w=>S.words[w.id]&&!cur.includes(w)));
  return pool.slice(0,2);
}
function buildQueue(words,opts){
  const q=[];const easy=shuffle(['p2h','h2m']);
  words.forEach((w,i)=>{
    if(opts.intro)q.push({t:'intro',w});
    q.push({t:'mc',mode:easy[i%2],w});
  });
  const extra=[];
  shuffle(words).slice(0,Math.min(3,words.length)).forEach(w=>{
    const ms=(S.sound&&'speechSynthesis' in window&&hasZhVoice())?['l2h','m2h','h2p']:['m2h','h2p'];
    extra.push({t:'mc',mode:pick(ms),w});
  });
  shuffle(words.filter(w=>w.han.length>=2)).slice(0,2).forEach(w=>extra.push({t:'asm',w}));
  shuffle(extra).forEach(s=>q.push(s));
  (opts.revs||[]).forEach(w=>q.push({t:'mc',mode:pick(['m2h','h2m','p2h']),w,rev:true}));
  return q;
}
function startSession(cfg){
  L.open=true;L.cfg=cfg;L.type=cfg.type;L.practice=false;L.hearts=5;
  L.first={ok:0,tot:0};L.combo=0;L.dead=false;L.i=0;
  L.queue=buildQueue(cfg.words,{intro:cfg.type==='lesson',
    revs:cfg.type==='lesson'?pickRevs(cfg.words):[]});
  document.body.classList.add('noscroll');
  $('#lesson').classList.remove('hidden');
  $('#sheet').classList.add('hidden');
  updateHead();renderStep();
}
function closeLesson(){
  L.open=false;
  if('speechSynthesis' in window)speechSynthesis.cancel();
  $('#lesson').classList.add('hidden');
  $('#sheet').classList.add('hidden');
  document.body.classList.remove('noscroll');
  renderTop();renderHome();
}
 $('#lClose').addEventListener('click',()=>{
  confirmModal("Bỏ dở bài học?","Tiến trình của bài này sẽ không được lưu.",
    "Bỏ học",true,closeLesson);
});
function updateHead(){
  $('#pfill').style.width=(L.queue.length?100*L.i/L.queue.length:100)+'%';
  const h=$('#lHearts');
  if(L.type==='rev'||L.practice){
    h.innerHTML=`<i data-lucide="infinity"></i>`;h.style.color='var(--jade-d)';
  }else{
    h.innerHTML=`<i data-lucide="heart"></i><span>${L.hearts}</span>`;
  }
  const c=$('#lCombo');
  if(L.combo>=3){c.classList.add('on');c.querySelector('span').textContent='×'+L.combo;}
  else c.classList.remove('on');
  icons();
}
function bump(w,ok){const st=S.words[w.id]||(S.words[w.id]={r:0,w:0,t:0});
  ok?st.r++:st.w++;st.t=Date.now();}
function seen(w){const st=S.words[w.id]||(S.words[w.id]={r:0,w:0,t:0});st.t=Date.now();}

function renderStep(){
  const s=L.queue[L.i];
  $('#sheet').classList.add('hidden');
  $('#lfoot').classList.add('hidden');
  if(!s)return finish();
  updateHead();
  if(s.t==='intro')renderIntro(s);
  else if(s.t==='mc')renderMC(s);
  else renderASM(s);
}

/* ---- flashcard từ mới ---- */
function renderIntro(s){
  const w=s.w;
  $('#lbody').innerHTML=`
  <div class="qlabel"><span class="qtag new">TỪ MỚI</span><span>${L.cfg.label||''}</span></div>
  <div class="card intro">
    <div class="ihan han" id="iHan">${w.han}</div>
    <div class="ipin">${w.pin}</div>
    <div class="imean">${esc(w.mean)}</div>
    <div class="audiorow">
      <button class="sbtn" id="iS"><i data-lucide="volume-2"></i>Nghe</button>
      <button class="sbtn" id="iSS"><i data-lucide="turtle"></i>Chậm</button>
    </div>
  </div>`;
  $('#lfoot').classList.remove('hidden');
  $('#lfoot').innerHTML=`<button class="btn block" id="iNext">Tiếp tục</button>`;
  $('#iHan').onclick=()=>speak(w.han);
  $('#iS').onclick=()=>speak(w.han);
  $('#iSS').onclick=()=>speak(w.han,true);
  $('#iNext').onclick=()=>{seen(w);save();L.i++;renderStep();};
  icons();setTimeout(()=>speak(w.han),300);
}

/* ---- trắc nghiệm ---- */
function makeChoices(w,mode){
  const key=(mode==='h2m')?x=>x.mean:(mode==='h2p')?x=>x.pin:x=>x.han;
  const correct=key(w);
  /* p2h & l2h: loại phương án đồng âm (他/她 đều "tā") để câu hỏi không mơ hồ */
  const hom=x=>((mode==='p2h'||mode==='l2h')&&x.pin===w.pin);
  const sameL=shuffle(WORDS.filter(x=>x.id!==w.id&&x.li===w.li&&x.ui===w.ui&&key(x)!==correct&&!hom(x)));
  const rest=shuffle(WORDS.filter(x=>x.id!==w.id&&key(x)!==correct&&!(x.li===w.li&&x.ui===w.ui)&&!hom(x)));
  const ch=[w];
  for(const x of[...sameL,...rest]){if(ch.length>=4)break;ch.push(x);}
  return shuffle(ch);
}
function renderMC(s){
  const w=s.w,mode=s.mode;
  const ch=makeChoices(w,mode);
  const key=(mode==='h2m')?x=>x.mean:(mode==='h2p')?x=>x.pin:x=>x.han;
  s.correct=key(w);
  let prompt='',choiceCls='';
  if(mode==='p2h')prompt=`<div class="ppin">${w.pin}</div>`;
  else if(mode==='m2h')prompt=`<div class="pmean">${esc(w.mean)}</div><div class="psub">Chọn chữ Hán đúng</div>`;
  else if(mode==='h2m')prompt=`<div class="phan han" id="mSpk">${w.han}</div><div class="psub">Chạm chữ để nghe</div>`;
  else if(mode==='h2p')prompt=`<div class="phan han">${w.han}</div>`;
  else prompt=`<button class="spkbig" id="mSpk"><i data-lucide="volume-2"></i></button>
    <button class="sbtn spkslow" id="mSlow"><i data-lucide="turtle"></i>Nghe chậm</button>`;
  if(mode==='h2m')choiceCls='ctext';
  if(mode==='h2p')choiceCls='cpin';
  $('#lbody').innerHTML=`
  <div class="qlabel">${s.rev?'<span class="qtag rev">ÔN TẬP</span>':''}<span>${MODE_LABEL[mode]}</span></div>
  <div class="prompt">${prompt}</div>
  <div class="choices" id="mCh">
    ${ch.map(x=>`<button class="choice ${choiceCls}" data-val="${esc(key(x))}">
      ${mode==='p2h'||mode==='l2h'||mode==='m2h'?`<span class="han">${x.han}</span>`:esc(key(x))}
    </button>`).join('')}
  </div>`;
  if(mode==='l2h'){setTimeout(()=>speak(w.han),300);
    $('#mSpk').onclick=()=>speak(w.han);$('#mSlow').onclick=()=>speak(w.han,true);}
  if(mode==='h2m'){$('#mSpk').onclick=()=>speak(w.han);}
  $('#mCh').querySelectorAll('.choice').forEach(btn=>{
    btn.addEventListener('click',()=>answerMC(s,btn,btn.dataset.val));
  });
  icons();
}
function answerMC(s,btn,val){
  const ok=val===s.correct;
  $('#mCh').querySelectorAll('.choice').forEach(b=>{
    b.disabled=true;
    if(b.dataset.val===s.correct)b.classList.add('correct');
  });
  if(!ok)btn.classList.add('wrong');
  handleResult(s,ok);
}

/* ---- ghép chữ ---- */
function renderASM(s){
  const w=s.w;const chars=[...w.han];
  const distr=[];
  shuffle(WORDS.filter(x=>x.han.length===1&&!chars.includes(x.han)))
    .forEach(x=>{if(distr.length<2)distr.push(x.han);});
  const tiles=shuffle([...chars,...distr]);
  /* SỬA: sel lưu CHỈ SỐ ô trong tiles (không lưu ký tự)
     → 2 ô "爸" là 2 index khác nhau, không còn vô hiệu lẫn nhau */
  L.asm={sel:[],tiles,len:chars.length};
  $('#lbody').innerHTML=`
  <div class="qlabel"><span class="qtag new">GHÉP CHỮ</span><span>Ghép thành từ đúng</span></div>
  <div class="prompt">
    <div class="pmean">${esc(w.mean)}</div>
    <div class="ppin" style="font-size:22px">${w.pin}</div>
  </div>
  <div class="slots" id="aSlots"></div>
  <div class="tiles" id="aTiles">
    ${tiles.map((c,i)=>`<button class="tile han" data-i="${i}">${c}</button>`).join('')}
  </div>`;
  $('#lfoot').classList.remove('hidden');
  $('#lfoot').innerHTML=`<button class="btn block" id="aCheck" disabled>Kiểm tra</button>`;
  const draw=()=>{
    const sl=$('#aSlots');sl.innerHTML='';
    for(let i=0;i<L.asm.len;i++){
      const btn=document.createElement('button');btn.className='slot';
      const ti=L.asm.sel[i];
      if(ti!==undefined){          /* dùng !==undefined vì index 0 là falsy */
        btn.textContent=tiles[ti];
        btn.onclick=()=>{L.asm.sel.splice(i,1);draw();};
      }
      sl.appendChild(btn);
    }
    $('#aTiles').querySelectorAll('.tile').forEach(t=>
      t.classList.toggle('used',L.asm.sel.includes(+t.dataset.i)));
    $('#aCheck').disabled=L.asm.sel.length!==L.asm.len;
  };
  $('#aTiles').querySelectorAll('.tile').forEach(t=>t.addEventListener('click',()=>{
    if(t.classList.contains('used'))return;
    if(L.asm.sel.length>=L.asm.len)return;
    L.asm.sel.push(+t.dataset.i);draw();
  }));
  $('#aCheck').onclick=()=>{
    const ok=L.asm.sel.map(i=>tiles[i]).join('')===w.han;
    $('#aSlots').querySelectorAll('.slot').forEach((sl,i)=>{
      sl.classList.add(ok?'good':'bad');
      if(!ok&&tiles[L.asm.sel[i]]!==w.han[i])sl.style.borderColor='var(--red)';
    });
    handleResult(s,ok);
  };
  draw();icons();
}

/* ---- kết quả & bảng phản hồi ---- */
function handleResult(s,ok){
  bump(s.w,ok);save();
  if(!s.retry){L.first.tot++;if(ok)L.first.ok++;}
  L.combo=ok?L.combo+1:0;
  if(!ok){
    L.queue.push({t:'mc',mode:'p2h',w:s.w,retry:true});
    if(!L.practice&&L.type!=='rev'){L.hearts--;if(L.hearts<=0)L.dead=true;}
  }
  updateHead();
  showSheet(ok,s);
}
function showSheet(ok,s){
  const w=s.w;sfx(ok?'ok':'no');speak(w.han);
  const sh=$('#sheet');
  sh.className='sheet '+(ok?'ok':'no');
  sh.innerHTML=`
    <div class="stitlerow">
      <div class="sicon"><i data-lucide="${ok?'check':'x'}"></i></div>
      <div class="stitle">${ok?(L.combo>=3?`Chính xác! Chuỗi ×${L.combo}`:'Chính xác!'):'Chưa đúng'}</div>
    </div>
    ${ok?'':`<div class="srec">
      <span class="rhan han" id="sHan">${w.han}</span>
      <div class="rmeta"><div class="rpin">${w.pin}</div><div class="rmean">${esc(w.mean)}</div></div>
      <button class="rspk" id="sSpk"><i data-lucide="volume-2"></i></button>
    </div>`}
    <button class="btn ${ok?'':'red'}" id="sNext">Tiếp tục</button>`;
  sh.classList.remove('hidden');
  const han=$('#sHan');if(han)han.onclick=()=>speak(w.han);
  const spk=$('#sSpk');if(spk)spk.onclick=()=>speak(w.han);
  $('#sNext').onclick=continueStep;
  if(ok)sh.addEventListener('click',e=>{if(e.target===sh)continueStep();});
  icons();
}
function continueStep(){
  $('#sheet').classList.add('hidden');
  if(L.dead){renderFail();return;}
  L.i++;renderStep();
}

/* ---- hết mạng ---- */
function renderFail(){
  sfx('no');
  $('#lbody').innerHTML=`
  <div class="end">
    <div class="endicon"><i data-lucide="heart-crack"></i></div>
    <h2>Hết mạng rồi!</h2>
    <p>Sai vài câu là chuyện thường khi nhớ chữ.<br>Chọn cách tiếp tục nhé:</p>
    <div class="mbtns" style="width:100%;max-width:340px;margin-top:18px">
      <button class="btn terra block" id="fPr">Vào luyện tập — không mất mạng<br><span style="font:600 12px 'Be Vietnam Pro';opacity:.85">tiếp tục bài này, XP giảm một nửa</span></button>
      <button class="btn block" id="fRe">Học lại từ đầu</button>
      <button class="btn ghost block" id="fEx">Để sau</button>
    </div>
  </div>`;
  $('#lfoot').classList.add('hidden');
  $('#fPr').onclick=()=>{L.practice=true;L.dead=false;L.i++;renderStep();};
  $('#fRe').onclick=()=>startSession(L.cfg);
  $('#fEx').onclick=closeLesson;
  icons();
}

/* ---- hoàn thành ---- */
function finish(){
  const pct=L.first.tot?Math.round(100*L.first.ok/L.first.tot):100;
  const stars=pct>=90?3:pct>=70?2:1;
  let xp=L.type==='cp'?12+2*stars:L.type==='rev'?8:10+2*stars;
  if(L.practice)xp=Math.ceil(xp/2);
  if(L.type==='lesson'){const k=`${L.cfg.unit}-${L.cfg.li}`;
    S.done[k]=Math.max(S.done[k]||0,stars);S.cur=L.cfg.unit;}
  if(L.type==='cp'){S.cp[L.cfg.unit]=true;S.cur=L.cfg.unit;}
  touchDay();addXp(xp);save();
  sfx('win');confetti();
  const stamp=L.type==='cp'?['毕业','bìyè · tốt nghiệp đơn vị']:
              L.type==='rev'?['温习','wēnxí · ôn tập']:['过关','guòguān · vượt ải'];
  const title=L.type==='cp'?'Tổng kết hoàn thành!':L.type==='rev'?'Ôn tập xong rồi!':'Bài học hoàn thành!';
  $('#lbody').innerHTML=`
  <div class="end">
    <div class="stamp han"><span>${stamp[0]}</span></div>
    <div class="scap">${stamp[1]}</div>
    <h2>${title}</h2>
    <div class="estars">${[1,2,3].map(k=>`<i data-lucide="star" style="${k<=stars?'':'fill:none;color:#D8CDB0'}"></i>`).join('')}</div>
    <div class="epills">
      <div class="ep" style="color:var(--jade-d)"><i data-lucide="zap"></i>+${xp} XP</div>
      <div class="ep" style="color:#C96A1D"><i data-lucide="target"></i>${pct}% chính xác</div>
      <div class="ep" style="color:var(--red-d)"><i data-lucide="book-open"></i>${L.cfg.words.length} từ</div>
    </div>
    <button class="btn" id="eOk">Tiếp tục</button>
  </div>`;
  $('#lfoot').classList.add('hidden');
  $('#eOk').onclick=closeLesson;
  icons();
}

/* phím tắt */
document.addEventListener('keydown',e=>{
  if(!L.open||e.target.tagName==='INPUT')return;
  if(!$('#sheet').classList.contains('hidden')){
    if(e.key==='Enter'||e.key===' '){e.preventDefault();continueStep();}
    return;
  }
  if(/^[1-4]$/.test(e.key)){
    const cs=$('#mCh')&&$('#mCh').querySelectorAll('.choice:not(:disabled)');
    if(cs&&cs[+e.key-1])cs[+e.key-1].click();
  }
  if(e.key==='Enter'&&$('#iNext'))$('#iNext').click();
});

/* ================= SỔ TAY TỪ VỰNG ================= */
const V={q:'',f:'all'};
 $('#vsearch').addEventListener('input',e=>{V.q=e.target.value;renderVList();});
function renderVocab(){
  const chips=[['all','Tất cả'],['u1','HSK 1'],['u2','HSK 2'],['u3','HSK 3'],['learned','Đã học'],['wrong','Hay sai']];
  $('#vchips').innerHTML=chips.map(c=>
    `<button class="chip ${V.f===c[0]?'on':''}" data-f="${c[0]}">${c[1]}</button>`).join('');
  $('#vchips').querySelectorAll('.chip').forEach(c=>c.onclick=()=>{V.f=c.dataset.f;renderVocab();});
  renderVList();icons();
}
function renderVList(){
  const q=norm(V.q);
  let list=WORDS.filter(w=>{
    if(V.f==='u1'&&w.u!==1)return false;
    if(V.f==='u2'&&w.u!==2)return false;
    if(V.f==='u3'&&w.u!==3)return false;
    if(V.f==='learned'&&!S.words[w.id])return false;
    if(V.f==='wrong'&&!(S.words[w.id]||{}).w)return false;
    if(q&&!(norm(w.han)+norm(w.pin)+norm(w.mean)).includes(q))return false;
    return true;
  });
  const el=$('#vlist');
  if(!list.length){el.innerHTML=`<div class="vempty">Không tìm thấy từ nào phù hợp.</div>`;return;}
  el.innerHTML=list.map(w=>{
    const st=S.words[w.id]||{};
    return `<div class="vrow" data-id="${w.id}">
      <div class="vhan han">${w.han}</div>
      <div class="vmeta"><div class="vpin">${w.pin}</div><div class="vmean">${esc(w.mean)}</div></div>
      <div class="vbadges">
        <span class="bhsk">HSK ${w.u}</span>
        ${st.w?`<span class="bw">×${st.w} sai</span>`:''}
      </div>
    </div>`;}).join('');
  el.querySelectorAll('.vrow').forEach(r=>r.addEventListener('click',()=>wordModal(WORDS[+r.dataset.id])));
}
function wordModal(w){
  const st=S.words[w.id]||{r:0,w:0};
  const m=modal(`
    <div class="dhan han" id="wHan">${w.han}</div>
    <div class="dpin">${w.pin}</div>
    <div class="dmean">${esc(w.mean)}</div>
    <div class="dref">HSK ${w.u} · Bài ${w.li+1}: ${esc(w.t)}</div>
    <div class="dstats">
      <div class="ep" style="color:var(--jade-d)"><i data-lucide="check"></i>${st.r} đúng</div>
      <div class="ep" style="color:var(--red-d)"><i data-lucide="x"></i>${st.w} sai</div>
    </div>
    <div class="mbtns">
      <button class="btn ghost block" id="wS"><i data-lucide="volume-2"></i>Nghe</button>
      <button class="btn ghost block" id="wSS"><i data-lucide="turtle"></i>Nghe chậm</button>
      <button class="btn block" id="wC">Đóng</button>
    </div>`);
  m.querySelector('#wHan').onclick=()=>speak(w.han);
  m.querySelector('#wS').onclick=()=>speak(w.han);
  m.querySelector('#wSS').onclick=()=>speak(w.han,true);
  m.querySelector('#wC').onclick=()=>m.remove();
  speak(w.han);
}

/* ================= HỒ SƠ ================= */
function lastSyncTxt(){
  if(dirty)return "Có thay đổi chưa đồng bộ";
  const t=AUTH&&AUTH.lastSync;
  if(!t)return "Sẵn sàng đồng bộ";
  return "Đồng bộ lần cuối: "+new Date(t).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"});
}
function renderProfile(){
  const learned=WORDS.filter(w=>S.words[w.id]).length;
  const rs=WORDS.reduce((s,w)=>s+((S.words[w.id]||{}).r||0),0);
  const ws=WORDS.reduce((s,w)=>s+((S.words[w.id]||{}).w||0),0);
  const acc=(rs+ws)?Math.round(100*rs/(rs+ws)):0;
  const today=S.days[dayKey()]||0;
  const goal=Math.min(50,today);
  const C=2*Math.PI*34;
  const days=[];for(let i=20;i>=0;i--)days.push(dayKey(-i));

  let acctHtml;
  if(AUTH){
    acctHtml=`<div class="psec"><h2>TÀI KHOẢN ĐỒNG BỘ</h2>
      <div class="acct"><div class="aic">${esc(AUTH.user[0].toUpperCase())}</div>
        <div><b>${esc(AUTH.user)}</b><p>${lastSyncTxt()}</p></div>
        <button class="btn ghost" id="pSync">Đồng bộ ngay</button>
      </div>
      <button class="btn ghost block" id="pLogout" style="margin-top:10px">Đăng xuất</button>
    </div>`;
  }else if(CLOUD_ON()){
    acctHtml=`<div class="psec"><h2>TÀI KHOẢN ĐỒNG BỘ</h2>
      <div class="acct"><div class="aic"><i data-lucide="cloud"></i></div>
        <div><b>Đăng nhập để lưu tiến trình lên cloud</b>
        <p>Đổi máy, đổi trình duyệt vẫn giữ nguyên XP, sao và chuỗi ngày.</p></div></div>
      <button class="btn block" id="pLogin" style="margin-top:10px"><i data-lucide="log-in"></i>Đăng nhập / Tạo tài khoản</button>
    </div>`;
  }else{
    acctHtml=`<div class="psec"><h2>TÀI KHOẢN ĐỒNG BỘ</h2>
      <div class="acct"><div class="aic"><i data-lucide="cloud-off"></i></div>
        <div><b>Đồng bộ cloud chưa được bật</b>
        <p>Điền địa chỉ Cloudflare Worker vào biến <b>API_BASE</b> đầu file app.js để bật.</p></div></div>
    </div>`;
  }

  const el=$('#scr-profile');
  el.innerHTML=`
  ${acctHtml}
  <div class="phead">
    <div class="avatar han">学</div>
    <div><h1>Học viên chữ Hán</h1><p>${learned}/${WORDS.length} từ đã chạm · mục tiêu HSK 3</p></div>
  </div>
  <div class="psec"><div class="statgrid">
    <div class="stat"><div class="sic j"><i data-lucide="zap"></i></div><div><b>${S.xp}</b><span>XP tổng</span></div></div>
    <div class="stat"><div class="sic o"><i data-lucide="flame"></i></div><div><b>${effStreak()} ngày</b><span>chuỗi học</span></div></div>
    <div class="stat"><div class="sic r"><i data-lucide="book-open"></i></div><div><b>${learned}</b><span>từ đã học</span></div></div>
    <div class="stat"><div class="sic g"><i data-lucide="target"></i></div><div><b>${acc}%</b><span>độ chính xác</span></div></div>
  </div></div>
  <div class="psec"><h2>MỤC TIÊU HÔM NAY</h2>
    <div class="goalcard">
      <svg class="ring" width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r="34" fill="none" stroke="#E2DAC1" stroke-width="9"/>
        <circle cx="42" cy="42" r="34" fill="none" stroke="var(--jade)" stroke-width="9"
          stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-goal/50)}" transform="rotate(-90 42 42)"/>
        <text x="42" y="48" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="17" fill="var(--ink)">${today}</text>
      </svg>
      <div><b>${today} / 50 XP</b><p>${today>=50?"Đã hoàn thành hôm nay, tuyệt vời!":"Còn "+(50-today)+" XP nữa là đạt mục tiêu"}</p></div>
    </div>
  </div>
  <div class="psec"><h2>21 NGÀY GẦN ĐÂY</h2>
    <div class="caldays">${days.map((k,i)=>`<span class="dot ${S.days[k]?'on':''} ${i===20?'today':''}" title="${k}"></span>`).join('')}</div>
  </div>
  <div class="psec"><h2>ĐẤU ẤN TỔNG KẾT</h2>
    <div class="badges">${UNITS.map(u=>`
      <div class="ubadge ${S.cp[u.no]?'got':''}"><span class="bs han">${u.seal}</span>HSK ${u.hsk}</div>`).join('')}
    </div>
  </div>
  <div class="psec"><h2>CÀI ĐẶT</h2>
    <div class="switchrow"><i data-lucide="${S.sound?'volume-2':'volume-x'}"></i><span>Âm thanh (phát âm & hiệu ứng)</span>
      <button class="sw ${S.sound?'on':''}" id="pSound"></button></div>
    <button class="btn ghost block" id="pReset" style="color:var(--red);border-color:rgba(213,72,43,.4)">Đặt lại toàn bộ tiến trình</button>
  </div>
  <p class="pnote">Tiến trình lưu sẵn trên máy (localStorage)${CLOUD_ON()?"; đăng nhập để đồng bộ thêm lên cloud":""}.</p>`;

  const ps=$('#pSync');if(ps)ps.onclick=()=>doSync(true);
  const plo=$('#pLogout');if(plo)plo.onclick=logout;
  const pli=$('#pLogin');if(pli)pli.onclick=()=>authModal('login');
  $('#pSound').onclick=()=>{S.sound=!S.sound;save();renderProfile();renderTop();};
  $('#pReset').onclick=()=>confirmModal("Đặt lại tiến trình?","XP, chuỗi ngày, sao và lịch sử từ sẽ bị xóa hoàn thorough (kể cả trên cloud nếu đang đăng nhập).",
    "Xóa hết",true,()=>{S=Object.assign({},DEF);save();renderProfile();renderTop();renderHome();toast("Đã đặt lại từ đầu");});
  icons();
}

/* ================= KHỞI ĐỘNG ================= */
(async function boot(){
  const el=$('#loading');
  try{
    const r=await fetch('resources/data.json');
    if(!r.ok)throw new Error("HTTP "+r.status);
    DATA=await r.json();
  }catch(e){
    el.innerHTML=`Không tải được <b>data.json</b>.<br><br>
      Nếu đang mở file trực tiếp (double-click), hãy chạy qua server:<br>
      <code>python -m http.server</code> hoặc extension <b>Live Server</b> của VS Code,<br>
      hoặc dùng địa chỉ GitHub Pages sau khi deploy.`;
    return;
  }
  UNITS=DATA.units;
  UNITS.forEach(u=>u.lessons.forEach((Ls,li)=>Ls[1].forEach(w=>
    WORDS.push({id:WORDS.length,u:u.no,ui:u.no-1,li,t:Ls[0],han:w[0],pin:w[1],mean:w[2]}))));
  el.remove();
  show('scr-home');
  icons();
  if(CLOUD_ON())pullState();
  if(!S.welcomed){
    const m=modal(`
      <div style="text-align:center;margin-bottom:6px">
        <div style="display:inline-grid;width:64px;height:64px;border-radius:14px;background:var(--red);color:var(--paper);place-items:center;font:700 34px 'Noto Serif SC',serif;transform:rotate(-5deg);box-shadow:inset 0 0 0 2px rgba(255,253,246,.35)" class="han">汉</div>
      </div>
      <h2 style="text-align:center">Chào mừng đến Hàn Giai!</h2>
      <p style="text-align:center">Luyện chữ Hán theo kiểu Duolingo — đã biết pinyin, giờ chinh phục mặt chữ.</p>
      <div class="frow"><div class="fic"><i data-lucide="map"></i></div><p><b>45 bài</b> trên lộ trình cong — HSK 1, 2, 3 <b>không khóa lẫn nhau</b>, biết HSK3 rồi thì nhảy thẳng xuống dưới!</p></div>
      <div class="frow"><div class="fic"><i data-lucide="volume-2"></i></div><p><b>Phát âm từng từ</b> bằng giọng tiếng Trung của trình duyệt — chạm vào chữ để nghe.</p></div>
      <div class="frow"><div class="fic"><i data-lucide="flame"></i></div><p><b>Tim, chuỗi ngày, XP</b> và ôn tập thông minh ưu tiên từ hay sai.</p></div>
      <div class="mbtns"><button class="btn block" id="wGo">Bắt đầu học</button></div>`);
    m.querySelector('#wGo').onclick=()=>{S.welcomed=true;save();m.remove();};
  }
})();

let rszT;window.addEventListener('resize',()=>{
  clearTimeout(rszT);
  rszT=setTimeout(()=>{if(!L.open&&!$('#scr-home').classList.contains('hidden'))renderHome();},250);
});
