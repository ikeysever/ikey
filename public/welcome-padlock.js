// iKey approved padlock welcome: adapted directly from handoff HTML Canvas renderer.
// Keep preview geometry/timing; production readiness is driven by the real data promise.
(function () {
  "use strict";
  let current = null;
  const assetBase = "/welcome-assets/";
  function create(prepareHome) {
    if (current) current.cancel();
    const overlay = document.createElement("div");
    overlay.className = "ikey-welcome-padlock";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "登入成功歡迎動畫");
    overlay.innerHTML = '<div class="ikey-welcome-stage"><canvas aria-label="iKey 掛鎖與鑰匙動畫"></canvas><div class="ikey-welcome-status" role="status">登入成功　載入中…</div><button type="button" class="ikey-welcome-retry" hidden>重新載入</button></div>';
    document.body.append(overlay);
    const canvas = overlay.querySelector("canvas"), ctx = canvas.getContext("2d");
    const status = overlay.querySelector(".ikey-welcome-status");
    const retry = overlay.querySelector(".ikey-welcome-retry");
    const duration = 9.8, C = "#67e8f9", G = "#7de2b1";
    let t = 0, origin = performance.now(), raf = 0, finished = false, resolved = false, ready = false, cancelled = false, failed = false, finalize = false;
    let audio = null;
    let endTimer = 0;
    let loadTimeout = 0;
    let onResolve, onReject, attemptCounter = 0;
    const completion = new Promise((resolve, reject) => { onResolve = resolve; onReject = reject; });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onResize = () => { if (!cancelled) draw(t); };
    const cleanup = () => { clearTimeout(loadTimeout); clearTimeout(endTimer); cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); if (audio) {audio.pause(); audio.src="";} overlay.remove(); if (current === controller) current = null; };
    const controller = { cancel() { if (cancelled) return; cancelled = true; cleanup(); if (!resolved) { resolved = true; onReject(new Error("歡迎動畫已取消")); } }, promise: completion };
    current = controller;
    const seedAudio = () => {
      try { audio = new Audio(assetBase + "welcome.wav"); audio.preload = "auto"; audio.volume = .7; audio.play().catch(() => {}); } catch (_) { /* audio is optional */ }
    };
    const paintFinal = () => { t=duration; draw(t); };
    const finish = () => {
      if (cancelled || resolved || !ready || !finished) return;
      if (!finalize) { finalize = true; status.textContent = "載入成功　歡迎使用"; status.classList.add("done"); endTimer = window.setTimeout(() => { if (cancelled) return; resolved = true; cleanup(); onResolve(); }, reduced ? 0 : 500); }
    };
    const attempt = () => {
      if (cancelled) return;
      failed = false; ready = false; finalize = false; retry.hidden = true;
      clearTimeout(loadTimeout);
      const thisAttempt = ++attemptCounter;
      status.textContent = "登入成功　載入中…"; status.classList.remove("done");
      loadTimeout = setTimeout(() => { if (cancelled || thisAttempt !== attemptCounter) return; failed = true; ready = false; status.textContent = "首頁載入逾時，請重新載入"; retry.hidden = false; }, 15000);
      Promise.resolve().then(prepareHome).then(() => { if (cancelled || thisAttempt !== attemptCounter || failed) return; clearTimeout(loadTimeout); ready = true; finish(); }, err => { if (cancelled || thisAttempt !== attemptCounter) return; clearTimeout(loadTimeout); failed = true; status.textContent = "首頁載入失敗：" + (err && err.message ? err.message : "請重試"); retry.hidden = false; });
    };
    retry.addEventListener("click", attempt);
    const clamp=x=>Math.max(0,Math.min(1,x)),p=(t,s,d)=>clamp((t-s)/d),ease=x=>1-(1-x)**3,mix=(a,b,v)=>a+(b-a)*v;
    let seed=18;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    const particles=Array.from({length:76},()=>[70+random()*820,85+random()*355,.6+random()*1.2,random()*Math.PI*2]);
function line(points,width=1.5,color=C,alpha=1){if(alpha<=0)return;ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore()}
function arc(x,y,r,start,end,width=2,color=C,alpha=1){if(alpha<=0||end<=start)return;ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.arc(x,y,r,start,end);ctx.stroke();ctx.restore()}
function rect(x,y,w,h,r,width=2,alpha=1,fill=false){ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=C;ctx.lineWidth=width;ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,r);if(fill){ctx.fillStyle='#102333';ctx.fill()}ctx.stroke();ctx.restore()}
function dot(x,y,r,color=C,alpha=1){ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore()}
function key(x,y,scale,build=1,alpha=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha*=alpha;arc(-48,0,30,0,2*Math.PI*Math.min(1,build*2),3);if(build>.22)arc(-59,0,8,0,2*Math.PI*p(build,.22,.25),2);const pts=[[-25,11],[-18,11],[-18,9],[57,9],[65,1],[57,-10],[49,-10],[44,-6],[39,-10],[34,-6],[29,-10],[24,-6],[19,-10],[14,-6],[9,-10],[4,-6],[-1,-10],[-6,-10],[-6,-13],[-18,-13],[-18,-11],[-25,-11],[-25,11]];const lengths=pts.slice(1).map((v,i)=>Math.hypot(v[0]-pts[i][0],v[1]-pts[i][1]));let remaining=lengths.reduce((a,b)=>a+b,0)*p(build,.4,.6);for(let i=0;i<lengths.length&&remaining>0;i++){let q=Math.min(1,remaining/lengths[i]);line([pts[i],[mix(pts[i][0],pts[i+1][0],q),mix(pts[i][1],pts[i+1][1],q)]],3);remaining-=lengths[i]}if(build>.8)line([[-15,0],[54,0]],.8,C,.45);ctx.restore()}
function padlock(x,y,scale=1,open=0,alpha=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);rect(0,20,74,48,5,3,alpha,true);const ax=-12*open,ay=-15-11*open;arc(ax,ay,23,Math.PI,Math.PI*2,3.5,C,alpha);line([[ax-23,ay],[ax-23,-4]],3.5,C,alpha);line([[ax+23,ay],[ax+23,ay+12*(1-open)]],3.5,C,alpha);arc(0,18,3,0,Math.PI*2,1.5,C,alpha);line([[0,21],[0,27]],2,C,alpha);ctx.restore()}
function ring(x,y,r,m=1){ctx.save();ctx.fillStyle='rgba(11,18,32,.4)';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.shadowColor='rgba(103,232,249,.2)';ctx.shadowBlur=8*m;arc(x,y,r,0,Math.PI*2,mix(2,3.5,m));ctx.shadowBlur=0;arc(x,y,r+6,-2.4,-.8,1,C,.5);arc(x,y,r+6,.12,1.4,1,C,.5);for(let i=0;i<16;i++){let a=i*Math.PI/8;line([[x+Math.cos(a)*(r-8),y+Math.sin(a)*(r-8)],[x+Math.cos(a)*(r-4),y+Math.sin(a)*(r-4)]],.8,C,.35)}ctx.restore()}
function draw(time){const box=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);if(canvas.width!==Math.round(box.width*dpr)||canvas.height!==Math.round(box.height*dpr)){canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr)}ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);const mobile=box.width<640;const W=mobile?540:960,H=540;const fit=Math.min(box.width/W,box.height/H);ctx.setTransform(fit*dpr,0,0,fit*dpr,(box.width-W*fit)/2*dpr,(box.height-H*fit)/2*dpr);
const morph=ease(p(time,6.05,.85));const initialX=mobile?340:595,initialY=mobile?200:248,finalX=mobile?270:315,finalY=mobile?160:255;const cx=mix(initialX,finalX,morph),cy=mix(initialY,finalY,morph),radius=mix(92,100,morph);const energy=p(time,0,.65)*(1-p(time,6.1,1))*.23;
for(const y of [194,248,302])line([[mobile?30:110,y],[215,y],[245,y-18],[680,y-18],[710,y],[850,y]],.7,C,energy);
for(const [px,py,r,ph]of particles){let gather=ease(p(time,.45,1.5)),baseX=mobile?160:300;let x=mix(mobile?px*.55:px,baseX+Math.cos(ph)*74,gather),y=mix(py,mobile?200+Math.sin(ph)*26:248+Math.sin(ph)*26,gather);dot(x,y,r,C,p(time,0,.7)*(1-p(time,1.85,.65))*(.25+.5*(.5+.5*Math.sin(time*3+ph))))}
const lockalpha=p(time,2.65,.55);if(lockalpha){ctx.save();ctx.globalAlpha=lockalpha;ring(cx,cy,radius,morph);ctx.restore()}
const opening=ease(p(time,5.25,.55));padlock(cx,cy+4,1.05,opening,lockalpha*(1-morph));
const travel=ease(p(time,3.55,.78)),keyStart=mobile?155:300;let kx=mix(keyStart,initialX-40,travel),ky=mix(mobile?200:248,initialY+25,travel);kx=mix(kx,finalX-12,morph);ky=mix(ky,finalY+48,morph);let ks=mix(1,.78,morph);const build=p(time,1.15,1.05),keyAlpha=p(time,1.15,.4);
if(morph<1){ctx.save();ctx.beginPath();ctx.rect(-200,-200,cx-39+200,1000);ctx.clip();key(kx,ky,ks,build,keyAlpha*(1-morph));ctx.restore()}
if(morph>0)key(kx,ky,ks,1,keyAlpha*morph);
if(time<2.3&&build>0)line([[kx-80+166*build,ky-35],[kx-80+166*build,ky+35]],1.3,C,(1-p(time,2.1,.2))*.65);
if(travel>0&&morph<1)line([[cx-39,cy+17],[cx-39,cy+33]],2.2,'#f8fafc',travel*(1-morph)*.65);
if(time>=4.3&&time<5.25){const a=(time-4.3)*Math.PI*2;arc(cx,cy,radius-17,a-.7,a+.4,3)}
for(const start of [5.25,5.46]){const q=p(time,start,.72);if(q>0&&q<1)arc(cx,cy,radius+q*58,0,Math.PI*2,1.8,G,1-q)}
if(time>=5.25)dot(cx+radius*.61,cy-radius*.66,3.3,G,p(time,5.25,.25));
if(morph>0)padlock(finalX+28,finalY-29,.85,0,morph);
const divider=p(time,6.85,.55);const copy=p(time,7.55,.6);
if(mobile){line([[190,300],[190+160*ease(divider),300]],1,'#ffffff',divider*.42);ctx.textAlign='center';ctx.fillStyle=`rgba(248,250,252,${copy})`;ctx.font='32px "iKey Welcome",system-ui,sans-serif';ctx.fillText('歡迎使用 iKey',270,365+10*(1-copy));}
else{const hh=210*ease(divider);line([[465,255-hh/2],[465,255+hh/2]],1,'#ffffff',divider*.42);ctx.textAlign='left';ctx.fillStyle=`rgba(248,250,252,${copy})`;ctx.font='38px "iKey Welcome",system-ui,sans-serif';ctx.fillText('歡迎使用 iKey',515,247+10*(1-copy));}

    }
    function tick(now) {
      if (cancelled) return;
      t = reduced ? duration : Math.min(duration, (now - origin)/1000);
      draw(t);
      if (t >= duration) { finished = true; finish(); return; }
      raf = requestAnimationFrame(tick);
    }
    window.addEventListener("resize",onResize);
    attempt();
    seedAudio();
    if (reduced) paintFinal();
    raf = requestAnimationFrame(tick);
    return controller;
  }
  window.iKeyPadlockWelcome = { create, stop() { if (current) current.cancel(); } };
})();
