// ═══════════════════════════════════════════
// AVATARFORGE — Core Engine
// ═══════════════════════════════════════════

// ── Storage ──────────────────────────────────
const AvatarStore = {
  getAll() { try { return JSON.parse(localStorage.getItem('af_avatars')||'[]'); } catch{return[];} },
  save(a) {
    const all = this.getAll(); const i = all.findIndex(x=>x.id===a.id);
    if(i>=0)all[i]=a; else all.push(a);
    localStorage.setItem('af_avatars', JSON.stringify(all));
  },
  get(id) { return this.getAll().find(a=>a.id===id)||null; },
  delete(id) { localStorage.setItem('af_avatars', JSON.stringify(this.getAll().filter(a=>a.id!==id))); },
  export(id) {
    const a = this.get(id); if(!a)return;
    const blob = new Blob([JSON.stringify(a,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a'); el.href=url; el.download=`avatar-${a.name}.json`; el.click();
    URL.revokeObjectURL(url);
  },
  import(json) {
    try { const a=JSON.parse(json); if(!a.id)a.id=crypto.randomUUID(); this.save(a); return a; }
    catch{return null;}
  }
};

const KeyStore = {
  get(p) { return localStorage.getItem(`af_key_${p}`)||''; },
  set(p,k) { localStorage.setItem(`af_key_${p}`, k); }
};

// ── LLM Call ─────────────────────────────────
async function callLLM(avatar, messages) {
  const model = avatar.model || 'gpt-4o-mini';
  const isOpenAI = !model.startsWith('claude');
  const system = avatar.system_prompt || `You are ${avatar.name}${avatar.role?', '+avatar.role:''}. Tone: ${avatar.tone||'friendly'}. Language: ${avatar.language||'English'}.`;

  if (isOpenAI) {
    const key = KeyStore.get('openai');
    if (!key) throw new Error('OpenAI API key missing — open Settings');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
      body:JSON.stringify({ model, temperature:parseFloat(avatar.temperature)||0.7, messages:[{role:'system',content:system},...messages] })
    });
    if(!r.ok){const e=await r.json();throw new Error(e.error?.message||'OpenAI error');}
    return (await r.json()).choices[0].message.content;
  } else {
    const key = KeyStore.get('anthropic');
    if (!key) throw new Error('Anthropic API key missing — open Settings');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({ model, max_tokens:1024, system, messages })
    });
    if(!r.ok){const e=await r.json();throw new Error(e.error?.message||'Anthropic error');}
    return (await r.json()).content[0].text;
  }
}

// ── Encode / Decode ───────────────────────────
const encodeConfig = a => btoa(unescape(encodeURIComponent(JSON.stringify(a))));
const decodeConfig = s => { try{return JSON.parse(decodeURIComponent(escape(atob(s))));}catch{return null;} };
const getParam = k => new URLSearchParams(window.location.search).get(k);
const fmtTime = () => new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

// ── Toast ─────────────────────────────────────
function toast(msg, type='info', duration=3000) {
  let wrap = document.getElementById('toastWrap');
  if(!wrap){ wrap=document.createElement('div'); wrap.id='toastWrap'; wrap.className='toast-wrap'; document.body.appendChild(wrap); }
  const t = document.createElement('div');
  const icons = {success:'◆',error:'✕',info:'◈'};
  const colors = {success:'#00ff88',error:'#ff5080',info:'#06ffed'};
  t.className = `toast ${type}`;
  t.innerHTML = `<span style="color:${colors[type]};font-size:16px">${icons[type]}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(()=>{ t.style.animation='toastSlide 0.3s reverse'; setTimeout(()=>t.remove(),300); }, duration);
}

// ── Ripple ────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const r = document.createElement('span');
  r.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
  btn.appendChild(r); setTimeout(()=>r.remove(), 600);
});

// ── Custom Cursor ─────────────────────────────
(function initCursor() {
  const c = document.getElementById('cursor');
  const t = document.getElementById('cursor-trail');
  if (!c || !t) return;
  let mx=0,my=0,tx=0,ty=0;
  document.addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; c.style.left=mx+'px'; c.style.top=my+'px'; });
  function loop() {
    tx += (mx-tx)*0.15; ty += (my-ty)*0.15;
    t.style.left=tx+'px'; t.style.top=ty+'px';
    requestAnimationFrame(loop);
  } loop();
})();

// ── Particle Canvas ───────────────────────────
function initParticles(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], connections = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize); resize();

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random()*W; this.y = Math.random()*H;
      this.vx = (Math.random()-0.5)*0.4; this.vy = (Math.random()-0.5)*0.4;
      this.size = Math.random()*2+0.5;
      this.colors = ['#06ffed','#0080ff','#8b5cf6','#ff0080'];
      this.color = this.colors[Math.floor(Math.random()*this.colors.length)];
      this.alpha = Math.random()*0.6+0.2;
      this.life = Math.random()*200+100; this.age = 0;
    }
    update() {
      this.x += this.vx; this.y += this.vy; this.age++;
      if (this.x<0||this.x>W||this.y<0||this.y>H||this.age>this.life) this.reset();
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha * (1 - this.age/this.life);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  for(let i=0;i<120;i++) particles.push(new Particle());

  function drawConnections() {
    for(let i=0;i<particles.length;i++) {
      for(let j=i+1;j<particles.length;j++) {
        const dx = particles[i].x-particles[j].x;
        const dy = particles[i].y-particles[j].y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(dist<120) {
          ctx.save();
          ctx.globalAlpha = (1-dist/120)*0.12;
          ctx.strokeStyle = '#06ffed'; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(particles[i].x,particles[i].y); ctx.lineTo(particles[j].x,particles[j].y); ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // Grid lines
  function drawGrid() {
    ctx.save(); ctx.strokeStyle = '#06ffed'; ctx.lineWidth = 0.3;
    const step = 80;
    for(let x=0;x<W;x+=step) {
      ctx.globalAlpha = 0.03;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    }
    for(let y=0;y<H;y+=step) {
      ctx.globalAlpha = 0.03;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }
    ctx.restore();
  }

  function loop() {
    ctx.clearRect(0,0,W,H);
    drawGrid();
    drawConnections();
    particles.forEach(p=>{ p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }
  loop();
}

// ── Number counter animation ──────────────────
function animateCount(el, target, duration=800) {
  let start = 0; const step = target/40;
  const interval = setInterval(() => {
    start += step;
    if(start>=target){ el.textContent=target; clearInterval(interval); }
    else el.textContent = Math.floor(start);
  }, duration/40);
}
