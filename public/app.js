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

function setMessage(text, error = false) {
  message.textContent = text;
  message.className = error ? 'message error' : 'message';
}
function updateAvailability() {
  const available = mode === 'login' ? authStatus?.enabled === true : authStatus?.registration === true;
  submit.disabled = !available;
  if (!available) setMessage(authStatus?.reason === 'CONFIG_MISSING' ? '帳號服務尚未設定完成。' : '正在確認帳號服務狀態，若持續無法操作請稍後重試。');
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
  setMessage('處理中…');
  try {
    const payload = registering ? { username, display_name: displayName.value.trim(), password: password.value } : { identifier: username, password: password.value };
    const response = await fetch('/api/auth/' + (registering ? 'register' : 'login'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.success) return setMessage(result.message || '目前無法完成操作。', true);
    password.value = '';
    confirmPassword.value = '';
    setMessage(registering ? '帳號建立成功，請返回登入頁。' : '登入成功。');
  } catch { setMessage('無法連線至伺服器，請稍後再試。', true); }
  finally { updateAvailability(); }
});
setMode('login');
refreshStatus();
