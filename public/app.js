'use strict';
const loginTab = document.getElementById('tab-login');
const registerTab = document.getElementById('tab-register');
const form = document.getElementById('auth-form');
const account = document.getElementById('account');
const password = document.getElementById('password');
const submit = document.getElementById('submit');
const message = document.getElementById('message');
const registerNote = document.getElementById('register-note');
let mode = 'login';
function setMode(next) {
  mode = next;
  loginTab.setAttribute('aria-selected', String(mode === 'login'));
  registerTab.setAttribute('aria-selected', String(mode === 'register'));
  submit.textContent = mode === 'login' ? '登入系統' : '建立帳號';
  password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  registerNote.hidden = mode !== 'register';
  message.textContent = '';
  message.className = 'message';
}
loginTab.addEventListener('click', () => setMode('login'));
registerTab.addEventListener('click', () => setMode('register'));
document.getElementById('toggle-password').addEventListener('click', (event) => {
  const show = password.type === 'password';
  password.type = show ? 'text' : 'password';
  event.currentTarget.textContent = show ? '隱藏' : '顯示';
  event.currentTarget.setAttribute('aria-label', show ? '隱藏密碼' : '顯示密碼');
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.className = 'message';
  if (!account.value.trim() || !password.value) {
    message.textContent = '請輸入帳號與密碼。';
    message.classList.add('error');
    return;
  }
  submit.disabled = true;
  message.textContent = '處理中…';
  try {
    const response = await fetch('/api/auth/' + (mode === 'login' ? 'login' : 'register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: account.value.trim(), password: password.value })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      message.textContent = result.message || '目前無法完成操作。';
      message.classList.add('error');
      return;
    }
    message.textContent = '操作成功。';
  } catch (_error) {
    message.textContent = '無法連線至伺服器，請稍後再試。';
    message.classList.add('error');
  } finally {
    submit.disabled = false;
  }
});
