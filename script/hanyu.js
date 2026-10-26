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
const DEF={xp:0,streak:0,lastDay:null,days:{},done:{},cp:{},words:{},decks:{},sound:true,cur:1,welcomed:false,updatedAt:0};
let S=DEF;
try{const raw=localStorage.getItem(KEY);if(raw)S=Object.assign({},DEF,JSON.parse(raw));}catch(e){}
S.decks=S.decks||{};

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
  const base=API_BASE.replace(/\/+$/,"");   // tự bỏ dấu / thừa ở cuối API_BASE
  const headers={};
  if(body)headers["Content-Type"]="application/json";
  if(AUTH&&AUTH.token)headers["Authorization"]="Bearer "+AUTH.token;
  const r=await fetch(base+path,{method:body?"POST":"GET",headers,body:body?JSON.stringify(body):undefined});
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
let speakSeq=0;
function speak(txt,slow){
  if(!S.sound||!('speechSynthesis' in window))return;
  try{
    speechSynthesis.cancel();
    const seq=++speakSeq;                     // đánh số lệnh nói hiện hành
    const u=new SpeechSynthesisUtterance(txt);u.lang='zh-CN';u.rate=slow?0.45:0.85;
    const v=VOICES.find(x=>/^zh[-_]CN/i.test(x.lang))||VOICES.find(x=>/^zh/i.test(x.lang));
    if(v)u.voice=v;
    /* Chrome bug: cancel() ngay trước speak() làm mất tiếng → chờ 1 nhịp rồi nói */
    setTimeout(()=>{
      if(seq!==speakSeq)return;               // đã có lệnh nói mới hơn → bỏ
      try{speechSynthesis.resume();speechSynthesis.speak(u);}catch(e){}
    },60);
  }catch(e){}
}

/* Khởi động engine ở lần chạm/phím ĐẦU TIÊN — nằm trong cử chỉ người dùng
   để trình duyệt cấp quyền nói tự động cho các lần sau */
let speechPrimed=false;
function primeSpeech(){
  if(speechPrimed||!('speechSynthesis' in window))return;
  speechPrimed=true;
  try{const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u);}catch(e){}
}
document.addEventListener('pointerdown',primeSpeech,{once:true,capture:true});
document.addEventListener('keydown',primeSpeech,{once:true,capture:true});
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
  ['scr-home','scr-vocab','scr-decks','scr-profile'].forEach(s=>$('#'+s).classList.toggle('hidden',s!==id));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.scr===id));
  if(id==='scr-home'){renderHome();renderTop();}
  if(id==='scr-vocab')renderVocab();
  if(id==='scr-decks')renderDecks();
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
  renderRevCard();renderMilestones();icons();
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
/* ================= ÔN TẬP THEO MỐC HSK ================= */
function milestoneWords(no){
  const now=Date.now();
  return WORDS.filter(w=>w.u===no).map(w=>{
    const st=S.words[w.id];
    if(!st)return{w,sc:5};                                  // từ chưa chạm: ưu tiên vừa phải
    const days=Math.min((now-(st.t||now))/86400000,30);
    return{w,sc:(st.w||0)*3+days-(st.r||0)*.5};             // sai nhiều & lâu chưa ôn lên trước
  }).sort((a,b)=>b.sc-a.sc).slice(0,12).map(x=>x.w);
}
function renderMilestones(){
  const box=$('#milestones');if(!box)return;
  box.innerHTML=`<div class="msec">
    <div class="mtitle">ÔN TẬP THEO MỐC</div>
    <div class="mcards">
      ${UNITS.map(u=>{
        const pool=WORDS.filter(w=>w.u===u.no);
        const learned=pool.filter(w=>S.words[w.id]).length;
        const wrong=pool.filter(w=>(S.words[w.id]||{}).w>0).length;
        return `<button class="mcard" data-u="${u.no}" style="--acc:${u.acc};--accd:${u.accd}">
          ${wrong?`<span class="mw">${wrong} hay sai</span>`:''}
          <span class="mseal han">${u.seal}</span>
          <span class="mt">HSK ${u.hsk}</span>
          <span class="mp">${learned}/${pool.length} từ</span>
          <span class="mgo"><i data-lucide="dumbbell"></i>Ôn</span>
        </button>`;}).join('')}
    </div>
  </div>`;
  box.querySelectorAll('.mcard').forEach(c=>c.addEventListener('click',()=>{
    const un=UNITS.find(x=>x.no===+c.dataset.u);
    startSession({type:'hsk',unit:un.no,hsk:un.hsk,
      words:milestoneWords(un.no),label:`Ôn mốc HSK ${un.hsk}`});
  }));
}
/* ================= BỘ THẺ TỰ LÀM ================= */
function parseTextLines(text){
  return String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{
    let parts;
    if(l.includes('\t'))parts=l.split(/\t+/);
    else if(l.includes('|'))parts=l.split(/\|+/);
    else if(l.includes(';'))parts=l.split(/;+/);
    else if(/[，、]/.test(l))parts=l.split(/[，、]+/);
    else parts=l.split(/\s+[-–—]\s+|\s{2,}/);
    parts=parts.map(p=>p.trim()).filter(Boolean);
    return parts.length?parts.slice(0,3):null;
  }).filter(Boolean).map(p=>[p[0]||'',p[1]||'',p[2]||'']);
}
function parseExcelFile(file){
  return new Promise((res,rej)=>{
    const isCsv=/\.csv$/i.test(file.name);
    const fr=new FileReader();
    fr.onload=e=>{
      try{
        if(typeof XLSX==='undefined')return rej(new Error('Thư viện Excel chưa tải được'));
        const wb=isCsv?XLSX.read(e.target.result,{type:'string'}):XLSX.read(e.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        if(!ws)return rej(new Error('File không có sheet nào'));
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''}).map(r=>r.map(c=>String(c).trim()));
        res(rows.filter(r=>r.some(c=>c)));
      }catch(err){rej(err);}
    };
    fr.onerror=()=>rej(new Error('Không đọc được file'));
    if(isCsv)fr.readAsText(file);else fr.readAsArrayBuffer(file);
  });
}
/* Tự dò cột nào là chữ Hán / pinyin / nghĩa */
function detectColumns(rows){
  const CJK=/[\u4e00-\u9fff]/,
        PY=/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/,
        VN=/[ơưđạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịĩọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/;
  const head=(rows[0]||[]).join(' ').toLowerCase();
  let data=rows;
  if(/stt|tiếng trung|tieng trung|phiên âm|phien am|nghĩa|nghia|pinyin|meaning|chinese/.test(head)&&!CJK.test(head))data=rows.slice(1);
  if(!data.length)return[];
  const n=Math.max(...data.map(r=>r.length));
  const cands=[];
  for(let c=0;c<n;c++){
    let han=0,pin=0,mean=0,total=0,numeric=true;
    data.forEach(r=>{
      const v=(r[c]||'').trim();if(!v)return;total++;
      if(!/^\d+$/.test(v))numeric=false;
      if(CJK.test(v))han+=2;
      if(PY.test(v))pin+=2;
      if(VN.test(v))mean+=2;
      if(/[a-z]/i.test(v)&&!CJK.test(v)){if(VN.test(v))mean++;else pin++;}
    });
    if(numeric&&!total)data.length;   // giữ nguyên cấu trúc
    if(numeric){han=-9;pin=-9;mean=-9;}   // cột STT → loại
    cands.push({c,han,pin,mean});
  }
  const pick=(key,used)=>{let best=null;
    cands.forEach(x=>{if(used.has(x.c))return;if(!best||x[key]>best[key])best=x;});
    return best&&best[key]>0?best.c:null;};
  const used=new Set();
  let hc=pick('han',used);if(hc===null)hc=0;used.add(hc);
  let pc=pick('pin',used);if(pc!==null)used.add(pc);
  let mc=pick('mean',used);if(mc===null){
    const rest=cands.map(x=>x.c).filter(c=>!used.has(c));
    mc=rest.length?rest[rest.length-1]:null;
  }
  if(mc!==null)used.add(mc);
  return data.map(r=>[(r[hc]||'').trim(),pc!==null?(r[pc]||'').trim():'',mc!==null?(r[mc]||'').trim():''])
             .filter(r=>r[0]);
}
function startDeck(id){
  const d=S.decks[id];if(!d)return;
  if(!d.words.length){toast('Bộ thẻ trống — thêm từ trước nhé');return;}
  startSession({type:'deck',deckId:id,words:d.words,label:d.name});
}
function renderDecks(){
  const el=$('#decklist');const ids=Object.keys(S.decks);
  if(!ids.length){
    el.innerHTML=`<div class="vempty">Chưa có bộ thẻ nào.<br>Tạo bộ thẻ từ file Excel hoặc gõ/dán từ cần ôn —<br>tiến trình lật thẻ được lưu và đồng bộ như từ vựng thường.</div>`;
    return;
  }
  el.innerHTML=ids.map(id=>{
    const d=S.decks[id];
    const done=Object.keys(d.stats||{}).length;
    const wrong=Object.values(d.stats||{}).filter(s=>s.w>0).length;
    return `<div class="drow">
      <div class="dinfo" data-act="view" data-id="${id}">
        <b>${esc(d.name)}</b>
        <p>${done}/${d.words.length} từ đã ôn${wrong?` · ${wrong} hay sai`:''}</p>
      </div>
      <button class="dplay" data-act="play" data-id="${id}" title="Ôn tập"><i data-lucide="play"></i></button>
      <button class="ddel" data-act="del" data-id="${id}" title="Xóa bộ"><i data-lucide="trash-2"></i></button>
    </div>`;}).join('');
  el.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.id,act=b.dataset.act;
    if(act==='play')startDeck(id);
    if(act==='view')viewDeck(id);
    if(act==='del')confirmModal('Xóa bộ thẻ?','Bộ thẻ và thống kê lật thẻ của nó sẽ bị xóa vĩnh viễn.','Xóa bộ',true,()=>{
      delete S.decks[id];save();renderDecks();toast('Đã xóa bộ thẻ');
    });
  }));
  icons();
}
function viewDeck(id){
  const d=S.decks[id];if(!d)return;
  const m=modal(`
    <h2>${esc(d.name)}</h2>
    <div id="dkWords"></div>
    <div style="margin-top:14px">
      <div class="afield"><label>THÊM TỪ — mỗi dòng: 字 | pinyin | nghĩa</label>
        <textarea id="dkAdd" rows="3" placeholder="你好 | nǐ hǎo | chào"></textarea></div>
      <button class="btn terra block" id="dkAddBtn" style="margin-bottom:10px">Thêm vào bộ</button>
      <button class="btn block" id="dkPlay"><i data-lucide="play"></i>Ôn ngay bộ này</button>
      <div class="mbtns" style="margin-top:9px"><button class="btn ghost block" id="dkClose">Đóng</button></div>
    </div>`);
  const renderRows=()=>{
    const box=m.querySelector('#dkWords');
    box.innerHTML=d.words.length?d.words.map((w,i)=>`
      <div class="dwrow">
        <span class="dwh han" data-speak="${i}">${w[0]}</span>
        <div class="dwm"><div class="dwp">${esc(w[1]||'')}</div><div class="dwm2">${esc(w[2]||'')}</div></div>
        <button class="dwx" data-i="${i}"><i data-lucide="x"></i></button>
      </div>`).join(''):`<p class="ahint">Bộ thẻ trống.</p>`;
    box.querySelectorAll('.dwh').forEach(el=>el.onclick=()=>speak(d.words[+el.dataset.speak][0]));
    box.querySelectorAll('.dwx').forEach(b=>b.onclick=()=>{
      d.words.splice(+b.dataset.i,1);save();renderRows();
    });
    icons();
  };
  m.querySelector('#dkAddBtn').onclick=()=>{
    const rows=parseTextLines(m.querySelector('#dkAdd').value).filter(r=>r[0]);
    if(!rows.length){toast('Chưa có dòng nào hợp lệ');return;}
    d.words=d.words.concat(rows);save();
    m.querySelector('#dkAdd').value='';renderRows();
    toast('Đã thêm '+rows.length+' từ');
  };
  m.querySelector('#dkPlay').onclick=()=>{m.remove();startDeck(id);};
  m.querySelector('#dkClose').onclick=()=>m.remove();
  renderRows();
}
function newDeckModal(){
  let draft=[];
  const m=modal(`
    <h2>Tạo bộ thẻ</h2>
    <div class="atabs">
      <button class="atab on" data-m="text">Gõ / dán</button>
      <button class="atab" data-m="excel">Tải Excel</button>
    </div>
    <div class="afield"><label>TÊN BỘ THẺ</label>
      <input id="dkName" maxlength="40" placeholder="vd: Từ vựng bài 5"></div>
    <div id="dkPaneText">
      <div class="afield"><label>DANH SÁCH TỪ — mỗi dòng: 字 | pinyin | nghĩa</label>
        <textarea id="dkText" rows="7" placeholder="你好 | nǐ hǎo | chào&#10;谢谢 | xièxie | cảm ơn"></textarea></div>
      <button class="btn terra block" id="dkParseText">Xem trước</button>
      <p class="ahint">Ngăn cột bằng Tab, dấu |, dấu ; hoặc ，— thiếu pinyin cứ để trống, sửa lại được ở bước xem trước.</p>
    </div>
    <div id="dkPaneExcel" class="hidden">
      <label class="filebtn"><i data-lucide="file-spreadsheet"></i>Chọn file Excel / CSV
        <input type="file" id="dkFile" accept=".xlsx,.xls,.csv" hidden></label>
      <p class="ahint">App tự dò cột chữ Hán / pinyin / nghĩa (bỏ qua cột STT và dòng tiêu đề) — bạn xem trước, sửa tay rồi mới lưu.</p>
    </div>
    <div id="dkPreview" class="hidden"></div>`);
  m.querySelectorAll('.atab').forEach(t=>t.onclick=()=>{
    m.querySelectorAll('.atab').forEach(x=>x.classList.toggle('on',x===t));
    m.querySelector('#dkPaneText').classList.toggle('hidden',t.dataset.m!=='text');
    m.querySelector('#dkPaneExcel').classList.toggle('hidden',t.dataset.m!=='excel');
  });
  const renderPreview=()=>{
    const box=m.querySelector('#dkPreview');
    if(!draft.length){box.classList.add('hidden');box.innerHTML='';return;}
    box.classList.remove('hidden');
    box.innerHTML=`<div class="dkhead"><b>${draft.length} từ</b> — sửa trực tiếp hoặc xóa dòng trước khi lưu</div>
      <div class="dkrows">${draft.map((r,i)=>`
        <div class="dkrow">
          <input class="dk-han" data-i="${i}" data-f="0" value="${esc(r[0])}">
          <input data-i="${i}" data-f="1" value="${esc(r[1])}">
          <input data-i="${i}" data-f="2" value="${esc(r[2])}">
          <button class="dkx" data-i="${i}"><i data-lucide="x"></i></button>
        </div>`).join('')}</div>
      <button class="btn block" id="dkSave" style="margin-top:12px">Lưu bộ thẻ</button>`;
    box.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',()=>{
      draft[+inp.dataset.i][+inp.dataset.f]=inp.value;
    }));
    box.querySelectorAll('.dkx').forEach(b=>b.addEventListener('click',()=>{
      draft.splice(+b.dataset.i,1);renderPreview();
    }));
    m.querySelector('#dkSave').onclick=()=>{
      const name=m.querySelector('#dkName').value.trim()||('Bộ thẻ '+new Date().toLocaleDateString('vi-VN'));
      const words=draft.filter(r=>r[0]&&r[0].trim());
      if(!words.length){toast('Bộ thẻ cần ít nhất 1 từ có chữ Hán');return;}
      const id='d'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
      S.decks[id]={id,name,words:words.map(r=>[r[0].trim(),(r[1]||'').trim(),(r[2]||'').trim()]),stats:{},created:Date.now()};
      save();m.remove();show('scr-decks');toast('Đã tạo bộ thẻ: '+name);
    };
    icons();
  };
  m.querySelector('#dkParseText').onclick=()=>{
    draft=parseTextLines(m.querySelector('#dkText').value);
    if(!draft.length){toast('Chưa có dòng hợp lệ — dùng dấu | để ngăn cột');return;}
    renderPreview();
  };
  m.querySelector('#dkFile').addEventListener('change',async e=>{
    const f=e.target.files[0];if(!f)return;
    try{
      const rows=await parseExcelFile(f);
      draft=detectColumns(rows);
      if(!draft.length)toast('Không đọc được dòng nào từ file');
      renderPreview();
    }catch(err){toast('Lỗi đọc file: '+err.message);}
    e.target.value='';
  });
}
 $('#btnNewDeck').addEventListener('click',newDeckModal);

/* ================= FLASHCARD ================= */
function renderCard(s){
  const w=s.w;
  $('#lbody').innerHTML=`
  <div class="qlabel"><span class="qtag rev">FLASHCARD</span><span>${esc(L.cfg.label||'')}</span></div>
  <div class="fcard" id="fcard">
    <div class="fface front">
      <div class="fhan han" id="fHan">${w.han}</div>
      <div class="fhint">Chạm chữ để nghe · chạm thẻ để lật</div>
    </div>
    <div class="fface back hidden">
      <div class="fpin">${esc(w.pin||'—')}</div>
      <div class="fmean">${esc(w.mean||'—')}</div>
      <div class="audiorow">
        <button class="sbtn" id="fS"><i data-lucide="volume-2"></i>Nghe</button>
        <button class="sbtn" id="fSS"><i data-lucide="turtle"></i>Chậm</button>
      </div>
    </div>
  </div>
  <div class="fbtns hidden" id="fBtns">
    <button class="btn red" id="fNo"><i data-lucide="x"></i>Chưa nhớ</button>
    <button class="btn" id="fYes"><i data-lucide="check"></i>Đã nhớ</button>
  </div>`;
  const flip=()=>{
    $('#fcard').classList.add('flipped');
    document.querySelector('#fcard .front').classList.add('hidden');
    document.querySelector('#fcard .back').classList.remove('hidden');
    $('#fBtns').classList.remove('hidden');
    speak(w.han);
  };
  $('#fcard').onclick=flip;
  $('#fHan').onclick=e=>{e.stopPropagation();speak(w.han);};
  $('#fS').onclick=()=>speak(w.han);
  $('#fSS').onclick=()=>speak(w.han,true);
  $('#fNo').onclick=()=>answerCard(s,false);
  $('#fYes').onclick=()=>answerCard(s,true);
  icons();
  setTimeout(()=>speak(w.han),300);
}
function answerCard(s,ok){
  if(!s.counted){
    s.counted=true;
    L.first.tot++;if(ok)L.first.ok++;
    const d=S.decks&&S.decks[L.cfg.deckId];
    if(d){const st=d.stats[s.i]||(d.stats[s.i]={r:0,w:0,t:0});
      ok?st.r++:st.w++;st.t=Date.now();save();}
  }
  L.combo=ok?L.combo+1:0;
  sfx(ok?'ok':'no');
  if(!ok)L.queue.push({t:'card',w:s.w,i:s.i,retry:true});
  updateHead();
  L.i++;renderStep();
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
  if(cfg.type==='deck'){
    L.queue=shuffle(cfg.words.map((w,i)=>({t:'card',w:{han:w[0],pin:w[1],mean:w[2]},i})));
  }else{
    L.queue=buildQueue(cfg.words,{intro:cfg.type==='lesson',
      revs:cfg.type==='lesson'?pickRevs(cfg.words):[]});
  }
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
  if(L.type==='rev'||L.type==='hsk'||L.type==='deck'||L.practice){
    h.innerHTML=`<i data-lucide="infinity"></i>`;h.style.color='var(--jade-d)';
  }else{
    h.innerHTML=`<i data-lucide="heart"></i><span>${L.hearts}</span>`;h.style.color='';
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
  else if(s.t==='card')renderCard(s);
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
  /* sel lưu CHỈ SỐ ô trong tiles → 2 ô "爸" là 2 index khác nhau */
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
      if(ti!==undefined){          /* !==undefined vì index 0 là falsy */
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
    if(!L.practice&&L.type!=='rev'&&L.type!=='hsk'){L.hearts--;if(L.hearts<=0)L.dead=true;}
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
  let xp=(L.type==='cp'||L.type==='hsk')?12+2*stars:
         L.type==='deck'?8+2*stars:
         L.type==='rev'?8:10+2*stars;
  if(L.practice)xp=Math.ceil(xp/2);
  if(L.type==='lesson'){const k=`${L.cfg.unit}-${L.cfg.li}`;
    S.done[k]=Math.max(S.done[k]||0,stars);S.cur=L.cfg.unit;}
  if(L.type==='cp'){S.cp[L.cfg.unit]=true;S.cur=L.cfg.unit;}
  touchDay();addXp(xp);save();
  sfx('win');confetti();
  const stamp=L.type==='cp'?['毕业','bìyè · tốt nghiệp đơn vị']:
              L.type==='rev'?['温习','wēnxí · ôn tập']:
              L.type==='hsk'?['闯关','chuǎngguān · vượt ải mốc']:
              L.type==='deck'?['记牢','jìláo · nhớ chắc']:
              ['过关','guòguān · vượt ải'];
  const title=L.type==='cp'?'Tổng kết hoàn thành!':
              L.type==='rev'?'Ôn tập xong rồi!':
              L.type==='hsk'?`Vượt mốc HSK ${L.cfg.hsk}!`:
              L.type==='deck'?`Bộ "${L.cfg.label}" hoàn thành!`:
              'Bài học hoàn thành!';
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
  el.querySelectorAll('.vrow').forEach(r=>r.addEventListener('click',()=>{
    const w=WORDS.find(x=>x.id===r.dataset.id);
    if(w)wordModal(w);
  }));
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
  const DATA_URL="resources/data.json";
  const el=$('#loading');
  try{
    const r=await fetch(DATA_URL);
    if(!r.ok)throw new Error("HTTP "+r.status+" khi tải "+DATA_URL);
    DATA=await r.json();
    if(!DATA||!Array.isArray(DATA.units)||!DATA.units.length)
      throw new Error('JSON hợp lệ nhưng thiếu mảng "units"');
    UNITS=DATA.units;
    /* ID cố định "số đơn vị-chữ" → thêm/bớt từ không làm lệch tiến trình */
    const seen=new Set();
    UNITS.forEach(u=>u.lessons.forEach((Ls,li)=>Ls[1].forEach(w=>{
      let id=u.no+'-'+w[0];
      while(seen.has(id))id+='#';
      seen.add(id);
      WORDS.push({id,u:u.no,ui:u.no-1,li,t:Ls[0],han:w[0],pin:w[1],mean:w[2]});
    })));
  }catch(e){
    console.error("[Hàn Giai] Lỗi khởi động:",e);
    el.innerHTML=`<div style="font:800 17px 'Baloo 2';color:var(--red);margin-bottom:10px">Không tải được dữ liệu từ vựng</div>
      <div>${esc(e.message)}</div>`;
    return;
  }
  console.log("[Hàn Giai] Nạp xong:",UNITS.length,"đơn vị ·",WORDS.length,"từ");
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
      <div class="frow"><div class="fic"><i data-lucide="map"></i></div><p><b>Lộ trình cong HSK 1–3</b> — các đơn vị <b>không khóa lẫn nhau</b>, biết HSK3 rồi thì nhảy thẳng xuống dưới!</p></div>
      <div class="frow"><div class="fic"><i data-lucide="dumbbell"></i></div><p><b>Ôn tập theo mốc HSK</b> — 3 thẻ ngay đầu trang, ưu tiên từ hay sai và lâu chưa ôn.</p></div>
      <div class="frow"><div class="fic"><i data-lucide="volume-2"></i></div><p><b>Phát âm từng từ</b> bằng giọng tiếng Trung của trình duyệt — chạm vào chữ để nghe.</p></div>
      <div class="mbtns"><button class="btn block" id="wGo">Bắt đầu học</button></div>`);
    m.querySelector('#wGo').onclick=()=>{S.welcomed=true;save();m.remove();};
  }
})();

let rszT;window.addEventListener('resize',()=>{
  clearTimeout(rszT);
  rszT=setTimeout(()=>{if(!L.open&&!$('#scr-home').classList.contains('hidden'))renderHome();},250);
});

/* ================================================================
   HÀN GIAI — ADD-ON: GHÉP TỪ SIÊU TỐC (kiểu Match Madness) + DECK CỦA TÔI
   Cách cài: DÁN TOÀN BỘ block này vào CUỐI file scripts/hanyu.js
   (sau tất cả code cũ, kể cả phần boot). Không cần sửa style.css / index.html.
   Deck được lưu trong localStorage của trình duyệt (theo máy).
   ================================================================ */
(function(){
'use strict';
if (window.__MM_LOADED) return;   // chống dán trùng 2 lần
window.__MM_LOADED = true;

/* ---------------- 1) Tiện ích chung ---------------- */
var NFC = function(s){ return (s==null?'':String(s)).normalize('NFC'); };
var norm = function(s){ return NFC(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d'); };
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function shuf(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function rot(a,k){ k=((k%a.length)+a.length)%a.length; return a.slice(k).concat(a.slice(0,k)); }
function loadJSON(key,fb){ try{ var v=JSON.parse(localStorage.getItem(key)); return (v==null)?fb:v; }catch(e){ return fb; } }
function saveJSON(key,v){ try{ localStorage.setItem(key, JSON.stringify(v)); }catch(e){} }

/* Đọc trường từ vựng linh hoạt (hanzi/zi/z, pinyin/py/p, vi/viet/nghia/v) */
function wHanzi(w){ return NFC(w && (w.hanzi!=null?w.hanzi:(w.zi!=null?w.zi:(w.z!=null?w.z:(w.h!=null?w.h:(w.word!=null?w.word:(w.text!=null?w.text:'')))))) || ''); }
function wPinyin(w){ return NFC(w && (w.pinyin!=null?w.pinyin:(w.py!=null?w.py:(w.p!=null?w.p:''))) || ''); }
function wMeaning(w){ return NFC(w && (w.vi!=null?w.vi:(w.viet!=null?w.viet:(w.nghia!=null?w.nghia:(w.meaning!=null?w.meaning:(w.v!=null?w.v:''))))) || ''); }

function getApp(){ return document.getElementById('app') || document.querySelector('main') || document.body; }
function setApp(html){ var a=getApp(); a.innerHTML=html; hideFab(); window.scrollTo(0,0); }

function getData(){
  try{ if (typeof DATA!=='undefined' && DATA && DATA.units) return DATA; }catch(e){}
  return (window.DATA && window.DATA.units) ? window.DATA : null;
}
function dataReady(){ var D=getData(); return !!(D && Array.isArray(D.units) && D.units.length>0); }

/* Đọc toàn bộ từ vựng từ DATA để làm kho thêm vào deck */
var ALLWORDS=[];
function buildAllWords(){
  ALLWORDS=[];
  var D=getData(); if(!D || !Array.isArray(D.units)) return;
  D.units.forEach(function(u,ui){
    var ws=(u && u.words)||[];
    if(!ws.length) return;
    var ut=NFC(u.title || u.name || u.unit || ('Bài '+(ui+1)));
    ws.forEach(function(w){
      var h=wHanzi(w); if(!h) return;
      ALLWORDS.push({ w:w, ui:ui, ut:ut, h:h, p:wPinyin(w), v:wMeaning(w), key:ui+'|'+h+'|'+wMeaning(w) });
    });
  });
}

/* ---------------- 2) Đọc to (TTS) — dùng lại speak() của app nếu có ---------------- */
function matcherSpeak(text){
  try{
    var t=NFC(text); if(!t) return;
    if (typeof speak==='function'){ speak(t); return; }
    if (typeof speakSeq==='function'){ speakSeq([t]); return; }
    if (typeof primeSpeech==='function'){ try{ primeSpeech(); }catch(e){} }
    var u=new SpeechSynthesisUtterance(t); u.lang='zh-CN'; u.rate=0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(e){}
}

/* ---------------- 3) CSS tự inject (không cần sửa style.css) ---------------- */
var MMCSS = [
'.mm-screen{max-width:560px;margin:0 auto;padding:14px 12px 46px;color:#3c3c3c;font-family:inherit}',
'.mm-screen *{box-sizing:border-box}',
'.mm-h1{font-size:22px;font-weight:900;margin:4px 0 2px}',
'.mm-h2{font-size:16px;font-weight:800;margin:18px 0 8px}',
'.mm-sub{font-size:13px;color:#8a8a8a;margin-bottom:14px;line-height:1.45}',
'.mm-tip{font-size:12px;color:#b0b0b0;font-weight:400}',
'.mm-lab{display:block;font-size:13px;font-weight:800;color:#555;margin:14px 0 2px;text-transform:uppercase;letter-spacing:.04em}',
'.mm-empty{background:#fff;border:2px dashed #e0e0e0;border-radius:16px;padding:22px 16px;text-align:center;color:#999;font-size:14px;line-height:1.6;margin-bottom:6px}',
'.mm-rowline{display:flex;align-items:center;gap:6px;margin:10px 0 12px;font-size:14px}',
'.mm-btn{display:block;width:100%;margin-top:10px;padding:13px;border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;background:#e5e5e5;color:#afafaf;box-shadow:0 4px 0 #cfcfcf;font-family:inherit}',
'.mm-btn.primary{background:#58cc02;color:#fff;box-shadow:0 4px 0 #46a302}',
'.mm-btn.blue{background:#1cb0f6;color:#fff;box-shadow:0 4px 0 #1899d6}',
'.mm-btn:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.18)!important}',
'.mm-card{background:#fff;border:2px solid #e5e5e5;border-radius:16px;padding:13px 14px;margin-bottom:10px}',
'.mm-mini{padding:8px 13px;border-radius:11px;border:none;font-size:12.5px;font-weight:800;cursor:pointer;background:#eef4fb;color:#1899d6;font-family:inherit}',
'.mm-mini.go{background:#58cc02;color:#fff}',
'.mm-mini.warn{background:#ffecec;color:#d33131}',
'.mm-mini:active{transform:scale(.96)}',
/* entry card trên trang chủ */
'#mm-entry{display:flex;align-items:center;gap:12px;margin:8px 0 14px;padding:14px 16px;border-radius:16px;background:linear-gradient(135deg,#fff8e1,#ffe9a8);border:2px solid #f5c33b;box-shadow:0 3px 0 #e6b32e;cursor:pointer}',
'#mm-entry .mm-eico{font-size:26px;line-height:1}',
'#mm-entry .mm-etxt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
'#mm-entry .mm-etxt b{font-size:15px;color:#5d4700}',
'#mm-entry .mm-etxt span{font-size:12px;color:#8a6d00;line-height:1.35}',
'#mm-entry .mm-earr{font-size:22px;font-weight:900;color:#c79100}',
'#mm-fab{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9990;width:54px;height:54px;border-radius:50%;border:none;font-size:24px;background:#f5c33b;color:#5d4700;box-shadow:0 4px 0 #d9a300,0 6px 14px rgba(0,0,0,.22);cursor:pointer}',
/* deck list */
'.mm-deckinfo{display:flex;flex-direction:column;gap:2px;margin-bottom:10px}',
'.mm-deckinfo b{font-size:16px}',
'.mm-deckinfo span{font-size:12.5px;color:#999}',
'.mm-deckacts{display:flex;gap:8px;flex-wrap:wrap}',
/* chips */
'.mm-chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 4px}',
'.mm-chip{padding:9px 15px;border-radius:12px;border:2px solid #e5e5e5;background:#fff;font-weight:800;font-size:13.5px;cursor:pointer;color:#8a8a8a;font-family:inherit}',
'.mm-chip.on{border-color:#1cb0f6;background:#e8f6ff;color:#1899d6}',
'.mm-timebox{margin:16px 0 4px;padding:12px 14px;border-radius:14px;background:#fff8e1;border:2px solid #f5c33b;font-size:14px;color:#5d4700}',
/* editor */
'.mm-search{width:100%;padding:11px 14px;border:2px solid #e5e5e5;border-radius:12px;font-size:14.5px;font-family:inherit;background:#fff;color:#333;outline:none}',
'.mm-search:focus{border-color:#1cb0f6}',
'.mm-uchips{display:flex;gap:8px;overflow-x:auto;padding:8px 0 6px;margin:0 -2px;-webkit-overflow-scrolling:touch}',
'.mm-uchip{flex:0 0 auto;padding:8px 13px;border-radius:999px;border:2px solid #e5e5e5;background:#fff;font-size:12.5px;font-weight:700;color:#8a8a8a;cursor:pointer;white-space:nowrap;font-family:inherit}',
'.mm-uchip.on{border-color:#58cc02;background:#f0ffe4;color:#46a302}',
'.mm-wrow{display:flex;align-items:center;gap:11px;padding:10px 12px;border:2px solid #ececec;border-radius:13px;margin-bottom:8px;cursor:pointer;background:#fff}',
'.mm-wrow.in{border-color:#58cc02;background:#f4ffec}',
'.mm-wadd{width:30px;height:30px;border-radius:50%;background:#e8f6ff;color:#1899d6;font-weight:900;font-size:16px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}',
'.mm-wrow.in .mm-wadd{background:#58cc02;color:#fff}',
'.mm-wmain{flex:1;min-width:0}',
'.mm-whz{font-weight:800;font-size:16.5px}',
'.mm-wvi{font-size:13px;color:#6b6b6b;margin-top:1px}',
/* game */
'.mm-top{display:flex;align-items:center;gap:10px;margin-bottom:6px}',
'.mm-quit{width:36px;height:36px;border-radius:12px;border:2px solid #e5e5e5;background:#fff;color:#afafaf;font-size:16px;font-weight:900;cursor:pointer;flex:0 0 auto}',
'.mm-timer{flex:1}',
'.mm-timerbar{height:13px;border-radius:7px;background:#e5e5e5;overflow:hidden}',
'.mm-timerfill{height:100%;width:100%;background:#58cc02;border-radius:7px}',
'.mm-timerfill.mid{background:#f5c33b}',
'.mm-timerfill.low{background:#ff4b4b}',
'.mm-secs{font-size:14px;font-weight:900;color:#666;min-width:38px;text-align:right}',
'.mm-count{font-size:14px;font-weight:900;color:#1899d6;min-width:46px;text-align:right}',
'.mm-decktag{font-size:12px;color:#aaa;margin-bottom:8px}',
'.mm-board{display:flex;gap:10px;margin-top:8px}',
'.mm-col{flex:1;display:flex;flex-direction:column;gap:10px;min-width:0}',
'.mm-tile{min-height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:10px 8px;border:2px solid #e5e5e5;border-bottom-width:4px;border-radius:14px;background:#fff;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;text-align:center;transition:border-color .12s,background .12s,color .12s}',
'.mm-tile:active{transform:scale(.97)}',
'.mm-hz{font-size:22px;font-weight:800;line-height:1.2;color:#3c3c3c}',
'.mm-py{font-size:11.5px;color:#9a9a9a;line-height:1.2;font-family:"Be Vietnam Pro","Noto Sans",system-ui,sans-serif}',
'.mm-vi{font-size:13.5px;font-weight:700;line-height:1.3;color:#3c3c3c;word-break:break-word}',
'.mm-tile.mm-sel{border-color:#1cb0f6;background:#ddf4ff}',
'.mm-tile.mm-sel .mm-hz,.mm-tile.mm-sel .mm-vi{color:#1899d6}',
'.mm-tile.mm-ok{border-color:#58cc02!important;background:#d7ffb8!important;animation:mmPop .55s ease forwards}',
'.mm-tile.mm-bad{border-color:#ff4b4b!important;background:#ffdfe0!important;animation:mmShake .4s}',
'.mm-tile.mm-enter{animation:mmIn .34s ease}',
'@keyframes mmPop{0%{transform:scale(1);opacity:1}45%{transform:scale(1.07);opacity:1}100%{transform:scale(.55);opacity:0}}',
'@keyframes mmShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}',
'@keyframes mmIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}',
/* result */
'.mm-banner{border-radius:18px;padding:20px 16px;text-align:center;margin-bottom:12px}',
'.mm-banner.win{background:#d7ffb8;border:2px solid #58cc02}',
'.mm-banner.lose{background:#ffdfe0;border:2px solid #ff4b4b}',
'.mm-banner-t{font-size:22px;font-weight:900;color:#3c3c3c}',
'.mm-banner.win .mm-banner-t{color:#3f8f00}.mm-banner.lose .mm-banner-t{color:#c22}',
'.mm-stars{font-size:26px;letter-spacing:3px;margin-top:4px;color:#f5c33b}',
'.mm-banner-s{font-size:13.5px;color:#777;margin-top:4px}',
'.mm-stats{display:flex;gap:10px;margin-bottom:14px}',
'.mm-stat{flex:1;background:#fff;border:2px solid #e5e5e5;border-radius:14px;padding:11px 6px;text-align:center}',
'.mm-stat b{display:block;font-size:17px}',
'.mm-stat span{font-size:11.5px;color:#999}',
'.mm-word{display:flex;align-items:center;gap:10px;padding:10px 12px;border:2px solid #ececec;border-radius:13px;margin-bottom:8px;background:#fff;cursor:pointer}',
'.mm-word:active{background:#f4faff}',
'.mm-wl{flex:1;min-width:0;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
'.mm-wl b{font-size:17px}',
'.mm-wv{font-size:13px;color:#6b6b6b;text-align:right;max-width:45%}',
'.mm-wsp{font-size:12px;font-weight:800;color:#1899d6;flex:0 0 auto}'
].join('\n');
function mmInjectStyle(){
  if (document.getElementById('mm-style')) return;
  var s=document.createElement('style'); s.id='mm-style'; s.textContent=MMCSS;
  (document.head||document.documentElement).appendChild(s);
}

/* ---------------- 4) Deck: lưu localStorage ---------------- */
var LS_DECKS='hanyu_mm_decks_v1', LS_CFG='hanyu_mm_cfg_v1', LS_BEST='hanyu_mm_best_v1';
var DECKS = loadJSON(LS_DECKS, []);
if (!Array.isArray(DECKS)) DECKS=[];
function saveDecks(){ saveJSON(LS_DECKS, DECKS); }
function deckById(id){ for(var i=0;i<DECKS.length;i++) if(DECKS[i].id===id) return DECKS[i]; return null; }
function newDeck(name){
  var d={ id:'dk'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), name:name||'Deck mới', words:[] };
  DECKS.push(d); saveDecks(); return d;
}
function isInDeck(d,x){ return d.words.some(function(w){ return NFC(w.h)===x.h && NFC(w.v)===x.v; }); }

/* Cấu hình lần chơi gần nhất */
var S = Object.assign({ deckId:null, count:10, pace:3, hint:true }, loadJSON(LS_CFG, {}));
function saveCfg(){ saveJSON(LS_CFG, { count:S.count, pace:S.pace, hint:S.hint }); }

/* ---------------- 5) Chọn từ cho 1 ván (tránh trùng chữ / trùng nghĩa) ---------------- */
function pickWords(deck, n){
  var arr=shuf(deck.words.slice()), pool=[], seenH={}, seenV={};
  for (var i=0;i<arr.length && pool.length<n;i++){
    var s=arr[i]; if(!s) continue;
    var h=NFC(s.h), v=NFC(s.v);
    if(!h || seenH[h]) continue;
    var vk=v.toLowerCase();
    if(v && seenV[vk]) continue;
    seenH[h]=1; if(v) seenV[vk]=1;
    pool.push({ u:s.u, h:h, p:NFC(s.p), v:v });
  }
  return pool;
}

/* ---------------- 6) Trạng thái ván chơi ---------------- */
var G={ deck:null, words:[], n:0, pace:3, hint:true, queue:[], L:[], R:[], boardK:5,
        matched:0, mistakes:0, tLeft:0, total:0, timer:null, selL:-1, selR:-1, lock:false, running:false };
function stopTimer(){ if(G.timer){ clearInterval(G.timer); G.timer=null; } }
function colEl(side){ return document.getElementById(side==='L'?'mm-colL':'mm-colR'); }

/* ---------------- 7) Màn hình: DANH SÁCH DECK ---------------- */
function openDecks(){
  stopTimer(); hideFab();
  var B=loadJSON(LS_BEST,{}) || {};
  var list = DECKS.map(function(d){
    var st=(B[d.id]&&B[d.id].stars)||0;
    return '<div class="mm-card">'
      +'<div class="mm-deckinfo"><b>'+esc(d.name)+'</b><span>'+d.words.length+' từ'+(st?' · <span style="color:#f5a623">'+'★'.repeat(st)+'</span>':'')+'</span></div>'
      +'<div class="mm-deckacts">'
      +'<button class="mm-mini go" data-mm="play" data-id="'+d.id+'">Ôn ngay</button>'
      +'<button class="mm-mini" data-mm="edit" data-id="'+d.id+'">Sửa</button>'
      +'<button class="mm-mini warn" data-mm="del" data-id="'+d.id+'">Xóa</button>'
      +'</div></div>';
  }).join('');
  setApp('<div class="mm-screen">'
    +'<div class="mm-h1">Ghép từ siêu tốc</div>'
    +'<div class="mm-sub">Ghép nghĩa tiếng Việt (trái) với chữ Hán (phải) trước khi hết giờ. Bạn có thể tạo nhiều deck, đổi tên và thêm/bớt từ tùy thích.</div>'
    +(DECKS.length ? list : '<div class="mm-empty">Chưa có deck nào.<br>Nhấn <b>Tạo deck mới</b>, đặt tên rồi thêm từ vào để bắt đầu ôn nhé!</div>')
    +'<button class="mm-btn primary" data-mm="newdeck">Tạo deck mới</button>'
    +'<button class="mm-btn" data-mm="exit">Về trang chủ</button>'
    +'</div>');
}

/* ---------------- 8) Màn hình: CÀI ĐẶT VÁN ---------------- */
function openSetup(id){
  var d=deckById(id); if(!d){ openDecks(); return; }
  S.deckId=id;
  var size=d.words.length;
  if (S.count>size) S.count=size;
  saveCfg();
  if (size<2){
    setApp('<div class="mm-screen">'
      +'<div class="mm-h1">'+esc(d.name)+'</div>'
      +'<div class="mm-sub">Deck này còn '+size+' từ. Cần ít nhất <b>2 từ</b> để chơi ghép cặp.</div>'
      +'<button class="mm-btn blue" data-mm="edit" data-id="'+d.id+'">Thêm từ vào deck</button>'
      +'<button class="mm-btn" data-mm="decks">Danh sách deck</button>'
      +'</div>');
    return;
  }
  var counts=[5,10,15,20].filter(function(c){ return c<size; });
  counts.push(size); counts=counts.filter(function(c,i,a){ return a.indexOf(c)===i; });
  if (counts.indexOf(S.count)<0) S.count=size;
  var tot=S.count*S.pace;
  setApp('<div class="mm-screen">'
    +'<div class="mm-h1">'+esc(d.name)+'</div>'
    +'<div class="mm-sub">'+size+' từ trong deck · Cột trái: nghĩa tiếng Việt — Cột phải: chữ Hán</div>'
    +'<label class="mm-lab">Ôn bao nhiêu từ?</label>'
    +'<div class="mm-chips">'+counts.map(function(c){
        var lb=(c===size && c>20) ? ('Tất cả ('+c+')') : String(c);
        return '<button class="mm-chip'+(c===S.count?' on':'')+'" data-mm="count" data-n="'+c+'">'+lb+'</button>';
      }).join('')+'</div>'
    +'<label class="mm-lab">Tốc độ · mỗi cặp</label>'
    +'<div class="mm-chips">'+[[5,'Chậm · 5s'],[3,'Thường · 3s'],[2,'Siêu tốc · 2s']].map(function(p){
        return '<button class="mm-chip'+(p[0]===S.pace?' on':'')+'" data-mm="pace" data-v="'+p[0]+'">'+p[1]+'</button>';
      }).join('')+'</div>'
    +'<label class="mm-lab">Gợi ý pinyin trên thẻ chữ</label>'
    +'<div class="mm-chips">'
      +'<button class="mm-chip'+(S.hint?' on':'')+'" data-mm="hint">Bật</button>'
      +'<button class="mm-chip'+(!S.hint?' on':'')+'" data-mm="hint">Tắt</button>'
    +'</div>'
    +'<div class="mm-timebox">Thời gian: <b>'+tot+' giây</b> để ghép đúng <b>'+S.count+' cặp</b> ('+S.pace+'s/cặp)</div>'
    +'<button class="mm-btn primary" data-mm="start">Bắt đầu</button>'
    +'<button class="mm-btn blue" data-mm="edit" data-id="'+d.id+'">Sửa deck (thêm/bớt từ)</button>'
    +'<button class="mm-btn" data-mm="decks">Danh sách deck</button>'
    +'</div>');
}
function renderSetup(){ if (S.deckId) openSetup(S.deckId); else openDecks(); }

/* ---------------- 9) Màn hình: SỬA DECK (đổi tên / thêm-bớt từ) ---------------- */
var E={ id:null, q:'', unit:0, map:{} };
function openEditor(id){
  var d=deckById(id); if(!d){ openDecks(); return; }
  E={ id:id, q:'', unit:(E.id===id?E.unit:0), map:{} };
  renderEditor();
}
function unitChipsHTML(){
  var D=getData(), h='<button class="mm-uchip'+(E.unit<0?' on':'')+'" data-mm="unit" data-u="-1">Tất cả</button>';
  if (D && Array.isArray(D.units)) D.units.forEach(function(u,ui){
    var t=NFC(u.title||u.name||u.unit||('Bài '+(ui+1)));
    if (t.length>14) t=t.slice(0,13)+'…';
    h+='<button class="mm-uchip'+(E.unit===ui?' on':'')+'" data-mm="unit" data-u="'+ui+'">'+esc(t)+'</button>';
  });
  return h;
}
function editorFiltered(){
  var q=norm(E.q.trim()), out=[]; E.map={};
  ALLWORDS.forEach(function(x){
    if (E.unit>=0 && x.ui!==E.unit) return;
    if (q && norm(x.h).indexOf(q)<0 && norm(x.p).indexOf(q)<0 && norm(x.v).indexOf(q)<0) return;
    out.push(x); E.map[x.key]=x;
  });
  return out;
}
function editorRowsHTML(d){
  var fl=editorFiltered(), shown=fl.slice(0,60), rows='';
  shown.forEach(function(x){
    var inD=isInDeck(d,x);
    rows+='<div class="mm-wrow'+(inD?' in':'')+'" data-mm="wtoggle" data-k="'+esc(x.key)+'">'
      +'<div class="mm-wadd">'+(inD?'✓':'＋')+'</div>'
      +'<div class="mm-wmain"><div class="mm-whz">'+esc(x.h)+(x.p?' <span class="mm-py">'+esc(x.p)+'</span>':'')+'</div>'
      +'<div class="mm-wvi">'+(esc(x.v)||'&nbsp;')+'</div></div></div>';
  });
  if (!shown.length) rows='<div class="mm-empty">Không có từ nào khớp.</div>';
  else if (fl.length>60) rows+='<div class="mm-sub" style="margin-top:4px">…và '+(fl.length-60)+' từ nữa — thu hẹp bằng ô tìm kiếm hoặc chọn bài ở trên.</div>';
  return rows;
}
function renderEditor(){
  var d=deckById(E.id); if(!d){ openDecks(); return; }
  if (!ALLWORDS.length && dataReady()){ try{ buildAllWords(); }catch(e){} }
  if (!dataReady()){
    setApp('<div class="mm-screen"><div class="mm-h1">'+esc(d.name)+'</div>'
      +'<div class="mm-empty">Chưa tải được dữ liệu từ vựng.<br>Kiểm tra file <b>data/data.json</b> rồi thử lại.</div>'
      +'<button class="mm-btn" data-mm="decks">Danh sách deck</button></div>');
    return;
  }
  setApp('<div class="mm-screen">'
    +'<div class="mm-h2" style="margin-top:0">Sửa deck</div>'
    +'<input id="mm-name" class="mm-search" value="'+esc(d.name)+'" placeholder="Tên deck...">'
    +'<div class="mm-uchips">'+unitChipsHTML()+'</div>'
    +'<input id="mm-q" class="mm-search" placeholder="Tìm chữ Hán / pinyin / nghĩa..." value="'+esc(E.q)+'">'
    +'<div class="mm-rowline"><b id="mm-ecount">'+d.words.length+'</b><span>từ trong deck</span>'
    +'<button class="mm-mini go" data-mm="addall" style="margin-left:auto">＋ Thêm cả danh đang lọc</button></div>'
    +'<div id="mm-list">'+editorRowsHTML(d)+'</div>'
    +'<button class="mm-btn primary" data-mm="done-editor">Xong</button>'
    +'<button class="mm-btn" data-mm="decks">Danh sách deck</button>'
    +'</div>');
  var q=document.getElementById('mm-q');
  if (q) q.addEventListener('input', function(){ E.q=q.value; var L=document.getElementById('mm-list'); if(L) L.innerHTML=editorRowsHTML(d); });
  var nm=document.getElementById('mm-name');
  if (nm) nm.addEventListener('change', function(){ d.name=nm.value.trim()||'Deck mới'; saveDecks(); });
}

/* ---------------- 10) GAME: GHÉP TỪ SIÊU TỐC ---------------- */
function tileHTML(side,p,enter){
  var cls='mm-tile'+(enter?' mm-enter':'');
  if (side==='L')
    return '<div class="'+cls+'" data-mm="tile" data-side="L"><div class="mm-vi">'+esc(p.v||p.p||p.h)+'</div></div>';
  return '<div class="'+cls+'" data-mm="tile" data-side="R">'
    +((G.hint&&p.p)?'<div class="mm-py">'+esc(p.p)+'</div>':'')
    +'<div class="mm-hz">'+esc(p.h)+'</div></div>';
}
function paintCols(nl,nr){
  var L=colEl('L'), R=colEl('R'); if(!L||!R) return;
  L.innerHTML=G.L.map(function(p){ return tileHTML('L',p,p===nl); }).join('');
  R.innerHTML=G.R.map(function(p){ return tileHTML('R',p,p===nr); }).join('');
}
function paintTimer(){
  var f=document.getElementById('mm-fill'), s=document.getElementById('mm-sec');
  var pct=G.total? Math.max(0,G.tLeft/G.total*100):0;
  if (f){ f.style.width=pct+'%'; f.classList.toggle('mid',pct<50&&pct>=28); f.classList.toggle('low',pct<28); }
  if (s) s.textContent=Math.ceil(G.tLeft/1000)+'s';
}
function startTimer(){
  stopTimer();
  G.timer=setInterval(function(){
    if (!G.running) return;
    G.tLeft=Math.max(0,G.tLeft-100);
    paintTimer();
    if (G.tLeft<=0) endGame(false);
  },100);
}
function startGame(){
  var deck=deckById(S.deckId); if(!deck){ openDecks(); return; }
  var want=Math.max(2, Math.min(S.count||10, deck.words.length));
  var words=pickWords(deck, want);
  if (words.length<2){ alert('Deck cần ít nhất 2 từ không trùng nhau để chơi.'); return; }
  G.deck=deck; G.words=words; G.n=words.length;
  G.pace=S.pace; G.hint=!!S.hint;
  G.total=G.n*G.pace*1000; G.tLeft=G.total;
  G.matched=0; G.mistakes=0; G.selL=-1; G.selR=-1; G.lock=false; G.running=true;
  G.boardK=Math.min(5,G.n);
  G.L=words.slice(0,G.boardK);
  G.queue=words.slice(G.boardK);
  /* xáo cột phải, chọn phương án ít thẳng hàng với cột trái nhất */
  G.R=shuf(G.L.slice());
  if (G.boardK>1){
    var bestR=G.R, bestA=1e9;
    for (var t=0;t<12;t++){
      var cand=shuf(G.L.slice()), al=0;
      for (var z=0;z<cand.length;z++) if (cand[z]===G.L[z]) al++;
      if (al<bestA){ bestA=al; bestR=cand; if(al===0) break; }
    }
    G.R=bestR;
  }
  hideFab();
  setApp('<div class="mm-screen">'
    +'<div class="mm-top">'
      +'<button class="mm-quit" data-mm="quit">✕</button>'
      +'<div class="mm-timer"><div class="mm-timerbar"><div class="mm-timerfill" id="mm-fill"></div></div></div>'
      +'<div class="mm-secs" id="mm-sec">'+Math.ceil(G.total/1000)+'s</div>'
      +'<div class="mm-count" id="mm-count">0/'+G.n+'</div>'
    +'</div>'
    +'<div class="mm-decktag">'+esc(deck.name)+' · '+G.n+' cặp · '+G.pace+'s/cặp</div>'
    +'<div class="mm-board"><div class="mm-col" id="mm-colL"></div><div class="mm-col" id="mm-colR"></div></div>'
    +'</div>');
  paintCols(null,null);
  startTimer();
}
function pullPair(){
  if (!G.queue.length) return null;
  for (var k=0;k<G.queue.length;k++){
    var c=G.queue[k];
    var hConflict=G.R.some(function(x){ return NFC(x.h)===NFC(c.h); });
    var vConflict=G.L.some(function(x){ return c.v && NFC(x.v)===NFC(c.v); });
    if (!hConflict && !vConflict){ return G.queue.splice(k,1)[0]; }
  }
  return G.queue.shift();
}
function consumePair(p){
  if (!G.running) return;
  var li=G.L.indexOf(p); if(li>-1) G.L.splice(li,1);
  var ri=G.R.indexOf(p); if(ri>-1) G.R.splice(ri,1);
  G.selL=-1; G.selR=-1;
  var nl=null, nr=null;
  if (G.L.length<G.boardK && G.R.length<G.boardK && G.queue.length){
    var q=pullPair();
    if (q){
      G.L.push(q); nl=q;
      var pos=Math.floor(Math.random()*(G.R.length+1));
      G.R.splice(pos,0,q); nr=q;
    }
  }
  if (G.matched>=G.n){ paintCols(null,null); endGame(true); return; }
  paintCols(nl,nr);   // cặp mới trượt lên thay thế
  G.lock=false;
}
function paintSel(side){
  var col=colEl(side); if(!col) return;
  var sel= side==='L'?G.selL:G.selR;
  Array.prototype.forEach.call(col.children,function(el,idx){ el.classList.toggle('mm-sel', idx===sel); });
}
function tileClick(side){
  if (!G.running || G.lock) return;
  var cur= side==='L'?G.selL:G.selR;
  var col=colEl(side); if(!col) return;
  /* dùng phần tử DOM được bấm để tìm index (an toàn khi cột co giãn) */
  var idx=Array.prototype.indexOf.call(col.children, arguments[1]);
  if (idx<0) return;
  if (cur===idx){ if(side==='L')G.selL=-1; else G.selR=-1; paintSel(side); return; }
  if (side==='L') G.selL=idx; else G.selR=idx;
  paintSel(side);
  if (G.selL>=0 && G.selR>=0) judge();
}
function judge(){
  G.lock=true;
  var lp=G.L[G.selL], rp=G.R[G.selR];
  var Lel=colEl('L').children[G.selL], Rel=colEl('R').children[G.selR];
  if (lp && rp && lp===rp){
    Lel.classList.add('mm-ok'); Rel.classList.add('mm-ok');
    G.matched++;
    var c=document.getElementById('mm-count'); if(c) c.textContent=G.matched+'/'+G.n;
    matcherSpeak(lp.h);
    setTimeout(function(){ consumePair(lp); }, 620);
  } else {
    G.mistakes++;
    Lel.classList.add('mm-bad'); Rel.classList.add('mm-bad');
    setTimeout(function(){
      if(Lel) Lel.classList.remove('mm-bad');
      if(Rel) Rel.classList.remove('mm-bad');
      G.selL=-1; G.selR=-1; paintSel('L'); paintSel('R'); G.lock=false;
    }, 480);
  }
}
function endGame(win){
  if (!G.running) return;
  G.running=false; stopTimer();
  var stars = win ? (G.mistakes===0?3:(G.mistakes<=Math.max(1,Math.round(G.n*0.2))?2:1)) : 0;
  if (win){
    var B=loadJSON(LS_BEST,{}) || {};
    var cur=(B[G.deck.id]&&B[G.deck.id].stars)||0;
    if (stars>cur){ B[G.deck.id]={stars:stars}; saveJSON(LS_BEST,B); }
  }
  var starsHTML='';
  for (var i=0;i<3;i++) starsHTML+= i<stars?'★':'☆';
  var wlist=G.words.map(function(p){
    return '<div class="mm-word" data-mm="say" data-h="'+esc(p.h)+'">'
      +'<div class="mm-wl"><b>'+esc(p.h)+'</b>'+(p.p?'<span class="mm-py">'+esc(p.p)+'</span>':'')+'</div>'
      +'<div class="mm-wv">'+(esc(p.v)||'&nbsp;')+'</div><div class="mm-wsp">▶ Nghe</div></div>';
  }).join('');
  setApp('<div class="mm-screen">'
    +'<div class="mm-banner '+(win?'win':'lose')+'">'
      +'<div class="mm-banner-t">'+(win?'Tuyệt vời!':'Hết giờ!')+'</div>'
      +'<div class="mm-stars">'+starsHTML+'</div>'
      +'<div class="mm-banner-s">'+(win?('Ghép xong '+G.n+' cặp, còn '+Math.ceil(G.tLeft/1000)+'s'):('Đã ghép đúng '+G.matched+'/'+G.n+' cặp'))+'</div>'
    +'</div>'
    +'<div class="mm-stats">'
      +'<div class="mm-stat"><b>'+G.matched+'/'+G.n+'</b><span>Cặp đúng</span></div>'
      +'<div class="mm-stat"><b>'+G.mistakes+'</b><span>Lần sai</span></div>'
      +'<div class="mm-stat"><b>'+(win?(Math.ceil(G.tLeft/1000)+'s'):'—')+'</b><span>Thời gian</span></div>'
    +'</div>'
    +'<div class="mm-h2">Từ vừa ôn <span class="mm-tip">(chạm để nghe)</span></div>'
    +wlist
    +'<button class="mm-btn primary" data-mm="replay">Chơi lại</button>'
    +'<button class="mm-btn blue" data-mm="setup">Đổi số từ / cài đặt</button>'
    +'<button class="mm-btn" data-mm="decks">Danh sách deck</button>'
    +'</div>');
}

/* ---------------- 11) Vào/ra tích hợp trang chủ ---------------- */
function afterHome(){
  var app=getApp(); if(!app) return;
  if (app.querySelector('#mm-entry')) return;
  var div=document.createElement('div'); div.id='mm-entry';
  div.innerHTML='<div class="mm-eico">⚡</div><div class="mm-etxt"><b>Ghép từ siêu tốc</b><span>Ôn từ theo deck của bạn — ghép đúng cặp trước khi hết giờ</span></div><div class="mm-earr">›</div>';
  div.addEventListener('click', function(){ openDecks(); });
  app.insertBefore(div, app.firstChild);
}
function ensureFab(){
  if (document.getElementById('mm-fab')) return;
  var b=document.createElement('button'); b.id='mm-fab'; b.type='button';
  b.title='Ghép từ siêu tốc'; b.textContent='⚡';
  b.addEventListener('click', function(){ openDecks(); });
  document.body.appendChild(b);
}
function hideFab(){ var f=document.getElementById('mm-fab'); if(f) f.style.display='none'; }
function showFab(){ var f=document.getElementById('mm-fab'); if(f) f.style.display=''; }
var homeHooked=false;
function wrapRenders(){
  try{
    if (typeof renderHome==='function'){
      var orig=renderHome;
      renderHome=function(){
        var r=orig.apply(this,arguments);
        try{ afterHome(); }catch(e){}
        setTimeout(function(){ try{ afterHome(); }catch(e){} }, 400);  // đề phòng render bất đồng bộ
        return r;
 };
      homeHooked=true;
    }
  }catch(e){}
}
function exitToApp(){
  showFab();
  try{ if (typeof renderHome==='function'){ renderHome(); return; } }catch(e){}
  location.reload();
}

/* ---------------- 12) Uỷ quyền click + khởi động ---------------- */
document.addEventListener('click', function(e){
  var t=e.target && e.target.closest ? e.target.closest('[data-mm]') : null;
  if (!t) return;
  var a=t.getAttribute('data-mm');
  switch(a){
    case 'deck': case 'play': openSetup(t.getAttribute('data-id')); break;
    case 'edit': openEditor(t.getAttribute('data-id')); break;
    case 'del': {
      var dd=deckById(t.getAttribute('data-id'));
      if (dd && confirm('Xóa deck "'+dd.name+'"?')){ DECKS=DECKS.filter(function(x){ return x.id!==dd.id; }); saveDecks(); openDecks(); }
      break;
    }
    case 'newdeck': { var nd=newDeck('Deck mới'); openEditor(nd.id); break; }
    case 'exit': exitToApp(); break;
    case 'count': S.count=parseInt(t.getAttribute('data-n'),10)||10; renderSetup(); break;
    case 'pace': S.pace=parseInt(t.getAttribute('data-v'),10)||3; renderSetup(); break;
    case 'hint': S.hint=!S.hint; renderSetup(); break;
    case 'start': case 'replay': startGame(); break;
    case 'setup': if(S.deckId) renderSetup(); else openDecks(); break;
    case 'decks': openDecks(); break;
    case 'done-editor': openDecks(); break;
    case 'quit':
      if (G.running && G.matched>0 && !confirm('Thoát giữa chừng?')) break;
      stopTimer(); G.running=false; openDecks();
      break;
    case 'say': matcherSpeak(t.getAttribute('data-h')); break;
    case 'tile': tileClick(t.getAttribute('data-side'), t); break;
    case 'unit': E.unit=parseInt(t.getAttribute('data-u'),10); E.q=''; renderEditor(); break;
    case 'wtoggle': {
      var d=deckById(E.id); if(!d) break;
      var x=E.map[t.getAttribute('data-k')]; if(!x) break;
      var ix=d.words.findIndex(function(w){ return NFC(w.h)===x.h && NFC(w.v)===x.v; });
      var inD;
      if (ix>-1){ d.words.splice(ix,1); inD=false; } else { d.words.push({u:x.ui,h:x.h,p:x.p,v:x.v}); inD=true; }
      saveDecks();
      t.classList.toggle('in',inD);
      var ad=t.querySelector('.mm-wadd'); if(ad) ad.textContent=inD?'✓':'＋';
      var c=document.getElementById('mm-ecount'); if(c) c.textContent=d.words.length;
      break;
    }
    case 'addall': {
      var d2=deckById(E.id); if(!d2) break;
      var added=0;
      editorFiltered().forEach(function(x){
        if (!isInDeck(d2,x)){ d2.words.push({u:x.ui,h:x.h,p:x.p,v:x.v}); added++; }
      });
      saveDecks();
      if (added) renderEditor();
      break;
    }
  }
});
function whenReady(cb){
  var n=0;
  var iv=setInterval(function(){
    n++;
    if (dataReady() || n>=150){ clearInterval(iv); cb(); }  // chờ tối đa ~30s
  },200);
}
function init(){
  mmInjectStyle();
  try{ buildAllWords(); }catch(e){}
  wrapRenders();
  try{ afterHome(); }catch(e){}   // boot có thể đã vẽ trang chủ trước đó
  if (!homeHooked) ensureFab();   // phương án dự phòng: nút ⚡ góc phải
}
/* Tay cầm debug (mở Console dùng: __mm.state(), __mm.decks()...) */
window.__mm={ openDecks:openDecks, openSetup:openSetup, openEditor:openEditor,
  startGame:startGame, state:function(){ return G; }, cfg:function(){ return S; }, decks:function(){ return DECKS; } };
whenReady(init);
})();
