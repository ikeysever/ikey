/* Approved handoff Canvas renderer; same geometry and easing as final export. */
(() => {
  const base = './assets/welcome/';
  let audioContext;
  function unlockAudio() {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume().catch(() => {});
    } catch { /* Browsers without Web Audio use silent playback. */ }
  }
  function image(name) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('歡迎動畫素材載入失敗'));
      img.src = base + name;
    });
  }
  let assetsPromise;
  function loadAssets() {
    if (!assetsPromise) assetsPromise = Promise.all([
      ...['ikey-approved-source.webp', 'fingerprint.png', 'connection-lines.png',
        'letter-i.png', 'letter-K.png', 'letter-e.png', 'letter-y.png'].map(image),
      document.fonts.load('28px "iKey Welcome TC"'),
      document.fonts.load('24px "iKey Status TC"')
    ]).catch(error => { assetsPromise = null; throw error; });
    return assetsPromise;
  }
  let audioPromise;
  function loadAudio() {
    if (!audioContext) return Promise.resolve([]);
    audioPromise ||= Promise.all(['intro.mp3', 'final-chord.mp3'].map(async name => {
      const response = await fetch(base + name, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('音訊載入失敗');
      return audioContext.decodeAudioData(await response.arrayBuffer());
    })).catch(() => { audioPromise = null; return []; });
    return audioPromise;
  }
  async function play(root, prepareHome) {
    if (!root) throw new Error('缺少 animationRoot');
    root.replaceChildren();
    root.classList.add('welcome-active');
    const canvas = document.createElement('canvas');
    canvas.width = 1920; canvas.height = 1080;
    canvas.className = 'ikey-welcome-canvas';
    canvas.setAttribute('aria-label', 'iKey 歡迎動畫');
    const status = document.createElement('div');
    status.className = 'ikey-welcome-status';
    status.setAttribute('role', 'status');
    status.innerHTML = '<span class="ikey-welcome-spinner"></span><span><span data-primary>登入成功</span><small data-secondary>載入中…</small></span>';
    const primary = status.querySelector('[data-primary]');
    const secondary = status.querySelector('[data-secondary]');
    const actions = document.createElement('div');
    actions.className = 'ikey-welcome-actions';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.textContent = '重新載入';
    actions.append(retry); actions.hidden = true;
    root.append(canvas, status, actions);
    const ctx = canvas.getContext('2d');
    const highlight = document.createElement('canvas');
    highlight.width = 215; highlight.height = 244;
    const highlightContext = highlight.getContext('2d');
    let logo, fingerprint, connectionLines, letters;
    const scale = 432/1254, left = 144, top = 32;
const clamp=v=>Math.max(0,Math.min(1,v)),progress=(t,s,d)=>clamp((t-s)/d),ease=x=>1-(1-x)**3,enter=(t,s,d)=>ease(progress(t,s,d)),mix=(a,b,v)=>a+(b-a)*v;
function paintCrop(sx,sy,sw,sh,dx,dy,dw,dh,alpha=1){if(alpha<=0)return;ctx.save();ctx.globalAlpha*=alpha;ctx.drawImage(logo,sx,sy,sw,sh,dx,dy,dw,dh);ctx.restore();}
function referenceCrop(x,y,w,h,alpha=1,rise=0){paintCrop(x,y,w,h,left+x*scale,top+y*scale+rise,w*scale,h*scale,alpha);}

function draw(t){t=t<1.15?t:(t<1.95?1.15+(t-1.15)*.375:t-.5);ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,1920,1080);ctx.setTransform(1080/610,0,0,1080/610,(1920-720*1080/610)/2,0);ctx.save();ctx.globalAlpha=1-enter(t,8.8,.4);
const resolved=t<5.425?0:1,move=enter(t,5.75,.6),targetScale=mix(1,.63,move),targetX=mix(360,210,move),targetY=mix(248,287,move);
// The approved original is behind the assembled layers; only the layers fade away.
ctx.save();ctx.translate(targetX,targetY);ctx.scale(targetScale,targetScale);ctx.translate(-360,-248);paintCrop(0,0,1254,1254,left,top,432,432,resolved);ctx.restore();
if(resolved<1){ctx.save();ctx.globalAlpha*=1-resolved;ctx.save();ctx.globalAlpha*=enter(t,.2,.35);ctx.fillStyle='#f8fafc';ctx.beginPath();ctx.arc(360,248,212,0,2*Math.PI);ctx.fill();ctx.restore();
const position=enter(t,1.48,.48),fw=mix(142,215*scale,position),fh=fw*244/215,fx=mix(360-fw/2,left+520*scale,position),fy=mix(248-fh/2,top+65*scale,position);ctx.save();ctx.globalAlpha*=enter(t,.65,.3);ctx.drawImage(fingerprint,fx,fy,fw,fh);ctx.restore();
// One fingerprint-bound flash, not a moving outline circle.
if(t>=1.15&&t<1.45){const v=progress(t,1.15,.3),a=Math.sin(v*Math.PI);highlightContext.clearRect(0,0,215,244);highlightContext.globalCompositeOperation='source-over';highlightContext.drawImage(fingerprint,0,0);highlightContext.globalCompositeOperation='source-in';highlightContext.fillStyle='#f8fafc';highlightContext.fillRect(0,0,215,244);highlightContext.globalCompositeOperation='source-over';ctx.save();ctx.globalAlpha*=a*.95;ctx.drawImage(highlight,fx,fy,fw,fh);ctx.restore();}
const ring=progress(t,1.5,.55);if(ring>0){ctx.save();ctx.beginPath();ctx.moveTo(360,248);ctx.arc(360,248,220,-Math.PI,-Math.PI+2*Math.PI*ring);ctx.closePath();ctx.clip();ctx.beginPath();ctx.arc(360,248,216,0,2*Math.PI);ctx.arc(360,248,201,0,2*Math.PI,true);ctx.clip('evenodd');paintCrop(0,0,1254,1254,left,top,432,432);ctx.restore();}
const lineDraw=progress(t,2.05,.45);if(lineDraw>0){ctx.save();ctx.beginPath();ctx.moveTo(360,248);ctx.arc(360,248,220,-Math.PI,-Math.PI+2*Math.PI*lineDraw);ctx.closePath();ctx.clip();ctx.drawImage(connectionLines,left,top,432,432);ctx.restore();}
referenceCrop(42,452,243,253,enter(t,2.55,.22));referenceCrop(967,452,243,253,enter(t,2.85,.22));
const shell=enter(t,3.15,.25);ctx.save();ctx.globalAlpha*=shell;ctx.beginPath();ctx.rect(left+280*scale,top+313*scale,690*scale,559*scale);for(let row=0;row<2;row++)for(let col=0;col<4;col++)ctx.rect(left+(369+col*144)*scale,top+(330+row*255)*scale,144*scale,255*scale);ctx.clip('evenodd');referenceCrop(280,313,690,559);ctx.restore();for(let i=0;i<8;i++){const v=enter(t,3.15+i*.11,.22);referenceCrop(369+(i%4)*144,330+Math.floor(i/4)*255,144,255,v,23*(1-v));}
for(let i=0;i<4;i++){const p=progress(t,4.3+i*.17,.28);if(!p)continue;const bounce=p<.7?mix(28,-7,ease(p/.7)):mix(-7,0,ease((p-.7)/.3));ctx.save();ctx.globalAlpha*=Math.min(1,p*4);ctx.drawImage(letters[i],left+351*scale,top+895*scale+bounce,576*scale,248*scale);ctx.restore();}ctx.restore();}
if(t>=5.2&&t<5.65){const flash=Math.sin(Math.PI*progress(t,5.2,.45));ctx.save();ctx.globalAlpha*=flash;ctx.fillStyle='#f8fafc';ctx.beginPath();ctx.arc(360,248,216,0,Math.PI*2);ctx.fill();ctx.restore();}
const divider=enter(t,6.4,.3);ctx.save();ctx.globalAlpha*=divider;ctx.strokeStyle='#a6b2c5';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(390,287-77*divider);ctx.lineTo(390,287+77*divider);ctx.stroke();ctx.restore();
function typeLine(text,y,start){const font=28;ctx.font='400 '+font+'px "iKey Welcome TC", sans-serif';let x=420;for(const [i,char]of [...text].entries()){const v=enter(t,start+i*.065,.25),width=ctx.measureText(char).width;ctx.save();ctx.translate(x,y);ctx.scale(1,.08+.92*v);ctx.globalAlpha*=v;ctx.fillStyle='#f8fafc';ctx.fillText(char,0,0);ctx.restore();x+=width+1;}}
typeLine('歡迎使用iKey',278,6.8);typeLine('智慧鑰匙管理系統',323,7.25);ctx.restore();}

    let prepared = false, failure = null, loading = false;
    async function prepare() {
      if (loading) return;
      loading = true; failure = null;
      actions.hidden = true;
      primary.textContent = '登入成功'; secondary.textContent = '載入中…';
      try { await prepareHome(); prepared = true; }
      catch (error) {
        failure = error;
        primary.textContent = '載入失敗';
        secondary.textContent = '請重新載入';
        actions.hidden = false;
      } finally { loading = false; }
    }
    retry.onclick = () => { unlockAudio(); prepare(); };
    prepare();
    const nodes = [];
    function sound(buffer) {
      if (!buffer || audioContext?.state !== 'running') return;
      const node = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      gain.gain.value = 0.325;
      node.buffer = buffer;
      node.connect(gain).connect(audioContext.destination);
      node.start(); nodes.push(node);
    }
    try {
      // Keep the login page hidden while required graphics load; retry asset failures.
      let assets;
      while (!assets) {
        try { assets = await loadAssets(); }
        catch {
          primary.textContent = '動畫載入失敗'; secondary.textContent = '請重新載入';
          actions.hidden = false;
          await new Promise(resolve => { retry.onclick = resolve; });
          actions.hidden = true;
          retry.onclick = () => { unlockAudio(); prepare(); };
          primary.textContent = failure ? '載入失敗' : '登入成功';
          secondary.textContent = failure ? '請重新載入' : '載入中…';
          actions.hidden = Boolean(failure) === false;
        }
      }
      [logo, fingerprint, connectionLines, ...letters] = assets.slice(0, 7);
      const buffers = await loadAudio();
      const startedAt = performance.now();
      sound(buffers[0]);
      await new Promise(resolve => {
        let finishAt = null, chordPlayed = false;
        function tick(now) {
          const elapsed = (now - startedAt) / 1000;
          // 8.3s is the original success/check point. Freeze here while loading.
          if (elapsed >= 8.3 && prepared && finishAt === null) {
            finishAt = now;
            primary.textContent = '載入成功'; secondary.textContent = '歡迎使用';
            status.querySelector('.ikey-welcome-spinner').outerHTML =
              '<svg class="ikey-welcome-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 5"/></svg>';
          }
          const ending = finishAt === null ? 0 : (now - finishAt) / 1000;
          const t = finishAt === null ? Math.min(elapsed, 8.3) : 8.3 + ending;
          draw(t);
          if (finishAt !== null && ending >= 1 && !chordPlayed) {
            chordPlayed = true; sound(buffers[1]);
          }
          if (finishAt !== null && ending >= 1) {
            status.style.opacity = String(Math.max(0, 1 - (ending - 1) / .4));
          }
          if (finishAt !== null && ending >= 1.4) resolve();
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    } finally {
      nodes.forEach(node => { try { node.stop(); } catch {} });
      root.replaceChildren(); root.classList.remove('welcome-active');
    }
  }
  window.iKeyWelcome = { play, unlockAudio };
  // Fetch small reusable image assets while the user is entering credentials.
  document.addEventListener('DOMContentLoaded', () => loadAssets().catch(() => {}));
})();
