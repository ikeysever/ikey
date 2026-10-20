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
const animationRoot = document.getElementById('animationRoot');
const welcomeVideo = document.getElementById('welcomeVideo');
let mode = 'login';
let authStatus = null;

async function prepareHomeAfterLogin() {
  const response = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' });
  const data = response.ok ? await response.json() : null;
  if (!data?.authenticated) throw new Error('HOME_NOT_READY');
  return data;
}
async function playWelcomeAndEnterHome() {
  // The approved MP4 contains its success state at 8.3s, so verify the real session/home prerequisite first.
  // This prevents the fixed preview from displaying a false success state on a failed home preload.
  await prepareHomeAfterLogin();
  animationRoot.hidden = false;
  document.body.classList.add('welcome-playing');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await new Promise(resolve => setTimeout(resolve, 650));
    window.location.assign('/home.html');
    return;
  }
  welcomeVideo.currentTime = 0;
  await new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('WELCOME_PLAYBACK_FAILED')); };
    const cleanup = () => { welcomeVideo.removeEventListener('ended', done); welcomeVideo.removeEventListener('error', failed); };
    welcomeVideo.addEventListener('ended', done, { once: true });
    welcomeVideo.addEventListener('error', failed, { once: true });
    const p = welcomeVideo.play();
    if (p && typeof p.catch === 'function') p.catch(() => { welcomeVideo.muted = true; welcomeVideo.play().catch(failed); });
  });
  window.location.assign('/home.html');
}
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
// Debounced account prefetch. Passwords and password hashes never leave their normal secure paths.
let prefetchTimer;
account.addEventListener('input', () => {
  clearTimeout(prefetchTimer);
  if (mode !== 'login') return;
  const identifier=account.value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{3,23}$/.test(identifier)) return;
  prefetchTimer=setTimeout(()=>{
    fetch('/api/auth/prefetch',{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier})}).catch(()=>{});
  },500);
});
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
  setMessage(registering ? '處理中…' : '登入中…');
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
      setMessage('登入成功，正在準備首頁…');
      try { await playWelcomeAndEnterHome(); }
      catch { animationRoot.hidden = true; document.body.classList.remove('welcome-playing'); setMessage('首頁準備失敗，請重新登入或稍後再試。', true); }
    }
  } catch { setMessage('無法連線至伺服器，請稍後再試。', true); }
  finally { updateAvailability(); }
});
setMode('login');
refreshStatus();
