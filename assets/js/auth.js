/* ============================================================
 * 运动健康助手 · 登录/注册（纯前端演示）
 * 说明：账号与密码保存在本机浏览器 localStorage，未加密。
 *       仅用于演示登录/注册交互，请勿使用真实密码。
 * ============================================================ */
(function () {
  'use strict';
  const USERS_KEY = 'sport_users';
  const SESSION_KEY = 'sport_session';

  const $ = (s) => document.querySelector(s);

  function loadUsers() {
    try { const r = localStorage.getItem(USERS_KEY); return r ? JSON.parse(r) : []; }
    catch (e) { return []; }
  }
  function saveUsers(u) { try { localStorage.setItem(USERS_KEY, JSON.stringify(u)); } catch (e) {} }
  function loadSession() { try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; } }
  function setSession(u) { try { localStorage.setItem(SESSION_KEY, u); } catch (e) {} }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  let mode = 'login'; // login | register

  function show() { const ov = $('#auth'); if (ov) ov.classList.remove('hidden'); }
  function hide() { const ov = $('#auth'); if (ov) ov.classList.add('hidden'); }
  function setMsg(t) { const m = $('#auth-msg'); if (m) m.textContent = t || ''; }

  function setMode(m) {
    mode = m;
    const tLogin = $('#auth-tab-login'), tReg = $('#auth-tab-register');
    if (tLogin) tLogin.classList.toggle('on', m === 'login');
    if (tReg) tReg.classList.toggle('on', m === 'register');
    const cw = $('#auth-confirm-wrap');
    if (cw) cw.style.display = (m === 'register' ? 'block' : 'none');
    const btn = $('#auth-submit');
    if (btn) btn.textContent = (m === 'login' ? '登录' : '注册');
    // 切换模式时重置密码为密文，并清空提示
    const p = $('#auth-pass'); if (p) p.type = 'password';
    const eye = $('#auth-toggle'); if (eye) eye.textContent = '👁';
    setMsg('');
  }

  function togglePwd() {
    const p = $('#auth-pass');
    if (!p) return;
    const show = (p.type === 'password');
    p.type = show ? 'text' : 'password';
    const eye = $('#auth-toggle'); if (eye) eye.textContent = show ? '🙈' : '👁';
  }

  function submit(e) {
    e.preventDefault();
    const user = ($('#auth-user') && $('#auth-user').value || '').trim();
    const pass = ($('#auth-pass') && $('#auth-pass').value) || '';
    if (!user) { setMsg('请输入账号'); return; }
    if (!pass) { setMsg('请输入密码'); return; }
    const users = loadUsers();

    if (mode === 'register') {
      const pass2 = ($('#auth-confirm') && $('#auth-confirm').value) || '';
      if (pass.length < 4) { setMsg('密码至少 4 位'); return; }
      if (pass !== pass2) { setMsg('两次密码不一致'); return; }
      if (users.some(u => u.username === user)) { setMsg('该账号已存在，请直接登录'); return; }
      users.push({ username: user, password: pass });
      saveUsers(users);
      setSession(user);
      setMsg('');
      hide();
      if (window.App && window.App.render) window.App.render();
    } else {
      const found = users.find(u => u.username === user && u.password === pass);
      if (!found) { setMsg('账号或密码错误'); return; }
      setSession(user);
      setMsg('');
      hide();
      if (window.App && window.App.render) window.App.render();
    }
  }

  function setup() {
    const form = $('#auth-form'); if (form) form.addEventListener('submit', submit);
    const tLogin = $('#auth-tab-login'); if (tLogin) tLogin.addEventListener('click', () => setMode('login'));
    const tReg = $('#auth-tab-register'); if (tReg) tReg.addEventListener('click', () => setMode('register'));
    const eye = $('#auth-toggle'); if (eye) eye.addEventListener('click', togglePwd);

    if (loadSession()) { hide(); }
    else { setMode('login'); show(); }
  }

  // 供 app.js 调用：退出登录、查询当前账号
  window.Auth = {
    isLoggedIn: () => !!loadSession(),
    currentUser: () => loadSession(),
    logout: () => { clearSession(); setMode('login'); show(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
