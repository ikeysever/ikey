'use strict';
const loginTab = document.getElementById('tab-login');
const registerTab = document.getElementById('tab-register');
const form = document.getElementById('auth-form');
const account = document.getElementById('account');
const password = document.getElementById('password');
const displayName = document.getElementById('display-name');
const confirmPassword = document.getElementById('confirm');
const submit = document.getElementById('submit');
const message = document.getElementById('message');
const registerNote = document.getElementById('register-note');
let mode = 'login';
let authStatus = null;

// Unlock Web Audio during the actual login gesture. Keep the welcome animation
// in this same document so mobile browsers do not lose audio activation on navigation.
let welcomeAudioContext=null,welcomeAudioBuffer=null,welcomeAudioSource=null;
let welcomeStarted=false,welcomeCompleted=false,welcomeFrame=null;
let welcomeAssetsReady=false;
const welcomeAudioReady=(async()=>{
  try{
    const response=await fetch('/assets/welcome-3-0/welcome.wav',{cache:'force-cache'});
    if(!response.ok)throw Error('WELCOME_AUDIO_FETCH');
    const bytes=await response.arrayBuffer();
    // Decode only after an AudioContext exists (created by the submit gesture).
    return bytes;
  }catch{return null;}
})();
function unlockWelcomeAudio(){
  try{
    if(!welcomeAudioContext)welcomeAudioContext=new (window.AudioContext||window.webkitAudioContext)();
    welcomeAudioContext.resume().catch(()=>{});
  }catch{/* Sound may be restricted by the browser. */}
}
async function prepareWelcomeAudio(){
  if(!welcomeAudioContext)return;
  try{
    const bytes=await welcomeAudioReady;
    if(bytes&&!welcomeAudioBuffer)welcomeAudioBuffer=await welcomeAudioContext.decodeAudioData(bytes.slice(0));
  }catch{/* Animation must continue if audio is unavailable. */}
}
async function verifyWelcomeReadiness(){
  try{
    // A successful HTTP response alone does not establish backend readiness.
    const [sessionResponse,healthResponse,authStatusResponse]=await Promise.all([
      fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}),
      fetch('/api/health',{credentials:'same-origin',cache:'no-store'}),
      fetch('/api/auth/status',{credentials:'same-origin',cache:'no-store'})
    ]);
    if(!sessionResponse.ok||!healthResponse.ok||!authStatusResponse.ok)throw Error('API_UNAVAILABLE');
    const [session,health,status]=await Promise.all([sessionResponse.json(),healthResponse.json(),authStatusResponse.json()]);
    if(session.authenticated!==true||!session.user)throw Error('SESSION_INVALID');
    if(health.ok!==true||status.ready!==true||status.enabled!==true)throw Error('BACKEND_NOT_READY');
    // Confirm all currently implemented page entrypoints and their scripts/styles exist.
    const assets=['/home.html','/home.css','/home.js','/projects.html','/projects.js','/account.html','/account-edit.html','/project-create.html','/project-create.css','/project-create.js'];
    const responses=await Promise.all(assets.map(url=>fetch(url,{credentials:'same-origin',cache:'no-store'})));
    if(responses.some(response=>!response.ok))throw Error('PAGE_ASSET_UNAVAILABLE');
    welcomeAssetsReady=true;
    welcomeFrame?.contentWindow?.postMessage({type:'ikey-pages-ready'},location.origin);
  }catch(error){
    welcomeAssetsReady=false;
    welcomeFrame?.contentWindow?.postMessage({type:'ikey-pages-error'},location.origin);
    console.warn('Welcome readiness check failed:',error.message);
  }
}

function beginWelcome(){
  document.body.style.overflow='hidden';
  const overlay=document.createElement('div');
  overlay.id='welcome-overlay';
  Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'9999',background:'#070c16'});
  welcomeFrame=document.createElement('iframe');
  welcomeFrame.title='iKey 歡迎動畫';
  welcomeFrame.setAttribute('data-parent-audio','');
  welcomeFrame.allow='autoplay';
  Object.assign(welcomeFrame.style,{width:'100%',height:'100%',border:'0',display:'block'});
  overlay.appendChild(welcomeFrame);
  document.body.appendChild(overlay);
  // The iframe's real animation completion, not a guessed 9.8s timer,
  // is the only successful route to the home page.
  welcomeFrame.addEventListener('load',()=>{welcomeFrame.contentWindow?.postMessage({type:welcomeAssetsReady?'ikey-pages-ready':'ikey-pages-pending'},location.origin);});
  welcomeFrame.src='/welcome-3-0-production.html?v=20261024-readiness2';
  verifyWelcomeReadiness();
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==welcomeFrame?.contentWindow)return;
  if(event.data?.type==='ikey-welcome-start'&&!welcomeStarted){
    welcomeStarted=true;
    if(welcomeAudioContext&&welcomeAudioBuffer){
      try{
        welcomeAudioSource=welcomeAudioContext.createBufferSource();
        welcomeAudioSource.buffer=welcomeAudioBuffer;
        // +25% amplitude gain (1.25x); device output and clipping may limit loudness.
        const welcomeGain=welcomeAudioContext.createGain();
        welcomeGain.gain.value=1.25;
        welcomeAudioSource.connect(welcomeGain);
        welcomeGain.connect(welcomeAudioContext.destination);
        welcomeAudioSource.start(0);
      }catch{/* Keep the animation running if playback is blocked. */}
    }
  }
  if(event.data?.type==='ikey-welcome-complete'&&welcomeStarted&&welcomeAssetsReady&&!welcomeCompleted){
    welcomeCompleted=true;
    window.location.replace('/home.html');
  }
});

function setMessage(text, error = false) {
  message.textContent = text;
  message.className = error ? 'message error' : 'message';

}
function updateAvailability() {
  const available = mode === 'login' ? authStatus?.enabled === true : authStatus?.registration === true;
  submit.disabled = authStatus?.reason === 'CONFIG_MISSING';
  // Keep transient health-check failures out of the login form's status text.
}
function setMode(next) {
  mode = next;
  const registering = mode === 'register';
  loginTab.setAttribute('aria-selected', String(!registering));
  registerTab.setAttribute('aria-selected', String(registering));
  submit.textContent = registering ? '建立帳號' : '登入系統';
  password.autocomplete = registering ? 'new-password' : 'current-password';
  document.getElementById('register-fields').hidden = !registering;
  document.getElementById('confirm-field').hidden = !registering;
  displayName.disabled = !registering;
  confirmPassword.disabled = !registering;
  registerNote.hidden = !registering;
  account.maxLength = registering ? 24 : 128;
  account.placeholder = registering ? '例如 ikey_user' : '請輸入帳號';
  password.minLength = registering ? 8 : 0;
  setMessage('');
  updateAvailability();
}
function attachEye(id, field, openEye, closedEye) {
  const button = document.getElementById(id);
  button.addEventListener('click', () => {
    const show = field.type === 'password';
    field.type = show ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', show ? '隱藏密碼' : '顯示密碼');
    button.title = show ? '隱藏密碼' : '顯示密碼';
    if (openEye) document.getElementById(openEye).hidden = show;
    if (closedEye) document.getElementById(closedEye).hidden = !show;
  });
}
// Avoid speculative Apps Script lookups; login performs authoritative checks on submit.
loginTab.addEventListener('click', () => setMode('login'));
registerTab.addEventListener('click', () => setMode('register'));
attachEye('toggle-password', password, 'eye-open', 'eye-closed');
attachEye('toggle-confirm', confirmPassword);

async function refreshStatus() {
  try {
    const response = await fetch('/api/auth/status', { cache: 'no-store', credentials: 'same-origin' });
    authStatus = response.ok ? await response.json() : null;
  } catch { authStatus = null; }
  updateAvailability();
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if(mode==='login')unlockWelcomeAudio();
  const registering = mode === 'register';
  const username = account.value.trim();
  if (registering && !/^[a-z][a-z0-9_]{3,23}$/.test(username)) return setMessage('帳號須以小寫英文字母開頭，長度 4–24 字元，只能包含小寫英文、數字及底線。', true);
  if (registering && (!displayName.value.trim() || displayName.value.length > 80)) return setMessage('請填寫顯示名稱（最多 80 字元）。', true);
  if (!username || !password.value) return setMessage('請輸入帳號與密碼。', true);
  if (registering && (password.value.length < 8 || password.value.length > 128)) return setMessage('密碼長度須為 8–128 字元。', true);
  if (registering && password.value !== confirmPassword.value) return setMessage('兩次密碼不一致。', true);
  // Availability checks are advisory; the server performs all authentication and authorization.
  // Do not block a valid login merely because the separate health probe timed out.
  submit.disabled = true;
  setMessage(registering ? '處理中…' : '驗證中...請稍後');
  message.classList.toggle('loading', !registering);
  try {
    const payload = registering ? { username, display_name: displayName.value.trim(), password: password.value } : { identifier: username, password: password.value };
    const response = await fetch('/api/auth/' + (registering ? 'register' : 'login'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.success) return setMessage(result.message || '目前無法完成操作。', true);
    password.value = '';
    confirmPassword.value = '';
    if (registering) setMessage('帳號建立成功，請返回登入頁。');
    else {
      setMessage('登入成功。');
      await prepareWelcomeAudio();
      beginWelcome();
    }
  } catch { setMessage('無法連線至伺服器，請稍後再試。', true); }
  finally { updateAvailability(); }
});
setMode('login');
// Skip automatic remote health probe; login/register endpoints validate availability.
