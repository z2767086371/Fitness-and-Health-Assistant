/* ============================================================
 * 运动健康助手 · 主应用（路由 + 状态 + 全部页面与交互）
 * 依赖：window.DB (data.js)、window.Charts (charts.js)
 * 形态：单页移动端 Web App，零依赖，可直接运行。
 * ============================================================ */
(function () {
  'use strict';
  const DB = window.DB, C = window.Charts, U = DB.util;
  const $ = (s, r = document) => r.querySelector(s);
  const view = () => $('#view');
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  // 头像：emoji，或用户上传的图片（dataURL/URL）则渲染为 <img>
  function avatarHTML(a) {
    if (a && (a.indexOf('data:') === 0 || a.indexOf('http') === 0)) {
      return `<img src="${a}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"/>`;
    }
    return a || '🙂';
  }

  // ---------------- 全局状态 ----------------
  const App = {
    tab: 'home',
    sub: null,          // 子页面标识
    params: {},
    tracking: null,     // 进行中运动状态
    trackTimer: null,
    sheet: null,
    state: { waterCups: DB.waterCups }
  };
  window.App = App;
  App.render = render; App.go = go; App.handle = handle;

  // ---------------- 路由 ----------------
  function render() {
    const map = {
      home: screenHome, sport: screenSport, insight: screenInsight,
      community: screenCommunity, profile: screenProfile
    };
    const builder = map[App.tab] || screenHome;
    view().innerHTML = builder();
    // 更新 tab 高亮
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === App.tab);
    });
    window.scrollTo(0, 0);
    bindScreen();
  }
  function go(tab, sub, params) {
    App._prev = { tab: App.tab, sub: App.sub };
    App.tab = tab; App.sub = sub || null; App.params = params || {};
    if (App.trackTimer) { clearInterval(App.trackTimer); App.trackTimer = null; }
    render();
  }

  // ---------------- 事件委托 ----------------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const [act, arg] = t.dataset.act.split(':');
    handle(act, arg, t);
  });

  function handle(act, arg, el) {
    switch (act) {
      case 'nav': go(arg); break;
      case 'start': startSport(arg); break;
      case 'track': trackControl(arg); break;
      case 'sheet': openSheet(arg); break;
      case 'closeSheet': closeSheet(); break;
      case 'why': showWhy(); break;
      case 'water': addWater(arg); break;
      case 'plan': genPlan(); break;
      case 'camp': go('sport', 'camp', { level: arg }); break;
      case 'pet': feedPet(); break;
      case 'challenge': joinChallenge(arg); break;
      case 'chdetail': go('community', 'challenge', { id: arg }); break;
      case 'like': toggleLike(arg); break;
      case 'post': openPost(arg); break;
      case 'onboard': go('profile', 'onboard'); break;
      case 'obSubmit': submitOnboard(); break;
      case 'editProfile': go('profile', 'edit'); break;
      case 'saveProfile': doSaveProfile(); break;
      case 'resetProfile': doResetProfile(); break;
      case 'avatarUpload': triggerAvatarUpload(); break;
      case 'privacy': go('profile', 'privacy'); break;
      case 'alg': go('profile', 'alg'); break;
      case 'member': toast('已为你预留会员入口（演示）'); break;
      case 'shop': toast('商城模块预留位（演示）'); break;
      case 'coach': toast('在线私教预约预留位（演示）'); break;
      case 'metric': go('insight', 'metric', { key: arg }); break;
      case 'finish': finishSport(); break;
      case 'back': { const p = App._prev || { tab: 'home', sub: null }; App.tab = p.tab; App.sub = p.sub; App.params = {}; render(); break; }
    }
  }

  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast';
      t.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(26,29,38,.9);color:#fff;padding:12px 18px;border-radius:12px;font-size:14px;z-index:200;opacity:0;transition:opacity .2s;pointer-events:none;max-width:80%';
      document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._h); t._h = setTimeout(() => t.style.opacity = '0', 1600);
  }

  // ============================================================
  //  首页 HOME
  // ============================================================
  function screenHome() {
    const r = DB.recovery, p = DB.profile;
    const today = DB.today;
    const ring = C.ring(r.score, r.color, { label: '身体电量', size: 132, stroke: 12, fs: 32 });
    // 今日关键指标
    const metrics = [
      { k: '静息心率', v: today.restingHR, u: 'bpm', d: '↓2', cls: 'up' },
      { k: 'HRV', v: today.hrv, u: 'ms', d: '↑4', cls: 'up' },
      { k: '睡眠', v: today.sleepHours, u: 'h', d: '良好', cls: '' },
      { k: '压力', v: today.stress, u: '', d: '适中', cls: '' },
      { k: '血氧', v: today.spo2, u: '%', d: '正常', cls: '' },
      { k: '体温', v: today.temp, u: '℃', d: '', cls: '' }
    ];
    const mHTML = metrics.map(m => `<div class="metric"><div class="v">${m.v}<span style="font-size:11px;color:var(--text-3)">${m.u}</span></div><div class="k">${m.k}</div><div class="d ${m.cls}">${m.d}</div></div>`).join('');

    return `
    <div class="topbar">
      <div><h1>早安，${esc(p.name)} 👋</h1><div class="sub">${U.todayKey()} · 第 ${p.streak} 天连续打卡</div></div>
      <div class="avatar">${avatarHTML(p.avatar)}</div>
    </div>
    <div class="scroll">
      <div class="hero">
        <span class="tag">今日核心建议</span>
        <h2>${r.level === '偏低' ? '今天先养精蓄锐 💤' : '今天，动起来！💪'}</h2>
        <div class="advice">${r.advice}。建议：${p.goal === '减脂塑形' ? '40min 燃脂有氧 + 15min 拉伸' : '按个性化计划执行今日训练'}。</div>
      </div>

      <div class="card">
        <div class="card-title">📊 身体电量 / 恢复评分 <span class="more" data-act="nav:insight">详情</span></div>
        <div class="recovery-row">
          <div class="ring-wrap">${ring}</div>
          <div class="recovery-info">
            <div class="lv" style="color:${r.color}">${r.level} · ${r.score}分</div>
            <div class="ad">${r.advice}</div>
            <button class="why-btn" data-act="why">❓ 为什么给我这个建议</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">⚡ 快捷开始</div>
        <div class="quick-grid">
          <div class="quick" data-act="start:run"><div class="ic">🏃</div><div class="lb">跑步</div></div>
          <div class="quick" data-act="start:walk"><div class="ic">🚶</div><div class="lb">步行</div></div>
          <div class="quick" data-act="start:ride"><div class="ic">🚴</div><div class="lb">骑行</div></div>
          <div class="quick" data-act="start:strength"><div class="ic">🏋️</div><div class="lb">力量</div></div>
          <div class="quick" data-act="sheet:meal"><div class="ic">🍱</div><div class="lb">记录饮食</div></div>
          <div class="quick" data-act="water:add"><div class="ic">💧</div><div class="lb">喝水</div></div>
          <div class="quick" data-act="nav:sport"><div class="ic">🎯</div><div class="lb">训练计划</div></div>
          <div class="quick" data-act="nav:community"><div class="ic">🦊</div><div class="lb">我的宠物</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🔎 今日关键数据</div>
        <div class="metrics">${mHTML}</div>
      </div>

      <div class="card">
        <div class="card-title">🏅 连续打卡 & 等级</div>
        <div class="flex between center">
          <div><div style="font-size:22px;font-weight:800">🔥 ${p.streak} 天</div><div class="tiny">坚持就是胜利</div></div>
          <div class="lv-chip">Lv.${p.level_num}</div>
        </div>
        <div class="progress mt12"><i style="width:${Math.round(p.exp / p.exp_next * 100)}%"></i></div>
        <div class="tiny mt8">经验 ${p.exp}/${p.exp_next} · 距升级还差 ${p.exp_next - p.exp}</div>
      </div>
    </div>`;
  }

  // ============================================================
  //  运动 SPORT
  // ============================================================
  function screenSport() {
    if (App.sub === 'camp') return screenCamp();
    if (App.sub === 'tracking') return screenTracking();
    if (App.sub === 'done') return screenDone(App.params.s);
    const types = DB.sportTypes;
    const groups = {};
    types.forEach(t => { (groups[t.group] = groups[t.group] || []).push(t); });
    let grid = '';
    Object.keys(groups).forEach(g => {
      grid += `<div class="tiny" style="margin:6px 2px">${g}</div><div class="sport-grid">` +
        groups[g].map(t => `
          <div class="sport" data-act="start:${t.id}">
            <div class="si" style="background:${t.color}22">${t.icon}</div>
            <div><div class="sn">${t.name}</div><div class="sd">点击开始 / 自动记录</div></div>
          </div>`).join('') + `</div>`;
    });

    // 计划预览
    const plan = DB.generatePlan(DB.profile);
    const planRows = plan.days.slice(0, 3).map(d => `
      <div class="row"><div class="ri" style="background:var(--bg)">📅</div>
        <div class="rt"><div class="t">第 ${d.day} 天 · ${d.type}</div><div class="s">${d.detail} · ${d.hrZone}</div></div>
        <div class="rv">${d.intensity}%</div></div>`).join('');

    return `
    <div class="topbar"><div><h1>运动</h1><div class="sub">多源记录 · 科学指导</div></div></div>
    <div class="scroll">
      <div class="card">
        <div class="card-title">🎯 选择运动类型</div>
        ${grid}
      </div>

      <div class="card">
        <div class="card-title">🤖 我的个性化计划 <span class="more" data-act="sheet:plan">重新生成</span></div>
        <div class="tiny">目标：${plan.goal} · 周训练 ${plan.totalMin} 分钟</div>
        ${planRows}
        <div class="tiny mt8">${plan.weekNote}</div>
      </div>

      <div class="card">
        <div class="card-title">🏃 智能跑步教练</div>
        <div class="wrap">
          ${['5K','10K','半马','全马'].map(l => `<div class="chip ${l==='半马'?'on':''}" data-act="camp:${l}">${l}训练营</div>`).join('')}
        </div>
        <div class="tiny mt12">基于目标与水平动态生成课表，含间歇跑/节奏跑/LSD 等。</div>
      </div>
    </div>`;
  }

  // 跑步训练营详情
  function screenCamp() {
    const lvl = App.params.level || '半马';
    const camp = DB.runCamp(lvl);
    const weeks = Array.from({ length: camp.weeks }, (_, i) => i + 1);
    const sessions = camp.sessions;
    return `
    <div class="topbar"><div><h1>${lvl} 训练营</h1><div class="sub">共 ${camp.weeks} 周 · 智能跑步教练</div></div>
      <div class="avatar" data-act="back">←</div></div>
    <div class="scroll">
      <div class="hero"><span class="tag">${lvl}</span>
        <h2>从 0 到 ${lvl} 🏁</h2>
        <div class="advice">每周 4 次课，循序渐进：轻松跑打底 + 强度课提升 + 长距离积蓄耐力。</div>
      </div>
      <div class="card">
        <div class="card-title">📚 课程类型</div>
        ${sessions.map((s, i) => `<div class="row"><div class="ri">${['🟢','🟠','🔴','🔵'][i]}</div>
          <div class="rt"><div class="t">${s}</div><div class="s">${['低强度有氧基础','阈值/节奏提升','最大摄氧间歇','耐力长距离'][i]}</div></div></div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title">🗓️ 周计划（${camp.weeks} 周）</div>
        <div class="wrap">${weeks.map(w => `<span class="pill">第${w}周</span>`).join('')}</div>
        <div class="tiny mt12">示例（第 6 周）：周二 T 跑 2×1.6km · 周四 I 跑 6×400m · 周日 LSD 18km</div>
        <button class="btn mt16" data-act="start:run">开始今日训练</button>
      </div>
    </div>`;
  }

  // 进行中运动
  function startSport(typeId) {
    const t = DB.sportTypes.find(x => x.id === typeId) || DB.sportTypes[0];
    App.tracking = { type: t, t: 0, dist: 0, cal: 0, hr: 120, pace: 6.0, running: true, points: 0 };
    go('sport', 'tracking');
    App.trackTimer = setInterval(() => {
      const s = App.tracking; if (!s || !s.running) return;
      s.t += 1; s.dist += 0.012 + Math.random() * 0.004;
      s.cal += 2.2 + Math.random(); s.hr = Math.round(130 + Math.sin(s.t / 30) * 18 + Math.random() * 6);
      s.pace = +((5.6 + Math.sin(s.t / 20) * 0.8)).toFixed(2);
      s.points += 1;
      updateTrackingUI();
    }, 1000);
  }
  function updateTrackingUI() {
    const s = App.tracking; if (!s) return;
    const mm = String(Math.floor(s.t / 60)).padStart(2, '0');
    const ss = String(s.t % 60).padStart(2, '0');
    const dur = $('#tk-dur'), dist = $('#tk-dist'), cal = $('#tk-cal'), hr = $('#tk-hr'), pace = $('#tk-pace');
    if (dur) dur.textContent = `${mm}:${ss}`;
    if (dist) dist.textContent = s.dist.toFixed(2);
    if (cal) cal.textContent = Math.round(s.cal);
    if (hr) hr.textContent = s.hr;
    if (pace) pace.textContent = s.pace.toFixed(2);
  }
  function trackControl(a) {
    if (a === 'pause') { App.tracking.running = !App.tracking.running;
      $('#tk-pause').textContent = App.tracking.running ? '⏸' : '▶'; }
    if (a === 'finish') finishSport();
  }
  function finishSport() {
    clearInterval(App.trackTimer); App.trackTimer = null;
    const s = App.tracking;
    // 沉淀：宠物获能 + 打卡
    DB.petGain('workout10'); DB.petGain('planDone');
    App.tracking = null;
    App.sub = 'done'; App.params = { s };
    render();
  }
  function screenTracking() {
    if (App.sub === 'done') return screenDone(App.params.s);
    const s = App.tracking;
    return `
    <div class="scroll no-tab" style="padding-bottom:90px">
      <div class="topbar"><div><h1>${s.type.name} 进行中</h1><div class="sub">GPS / 心率实时记录</div></div>
        <div class="avatar" id="tk-pause" data-act="track:pause">⏸</div></div>
      <div class="tracking">
        <div style="text-align:center"><div class="big" id="tk-dur">00:00</div><div class="tiny" style="opacity:.7">时长</div></div>
        <div class="map-ph">🗺️ 实时轨迹记录中…（演示地图）</div>
        <div class="stats">
          <div class="s"><div class="sv" id="tk-dist">0.00</div><div class="sk">距离 km</div></div>
          <div class="s"><div class="sv" id="tk-pace">6.00</div><div class="sk">配速 /km</div></div>
          <div class="s"><div class="sv" id="tk-cal">0</div><div class="sk">千卡</div></div>
        </div>
        <div class="stats">
          <div class="s"><div class="sv" id="tk-hr">120</div><div class="sk">心率 bpm</div></div>
          <div class="s"><div class="sv">Zone2</div><div class="sk">心率区间</div></div>
          <div class="s"><div class="sv">168</div><div class="sk">步频 spm</div></div>
        </div>
      </div>
      <button class="btn" data-act="track:finish">结束并保存</button>
    </div>`;
  }
  function screenDone(s) {
    return `
    <div class="scroll no-tab">
      <div class="card" style="margin-top:20px">
        <div class="celebrate">
          <div class="confetti">🎉</div>
          <h2>运动完成！</h2>
          <p>太棒了，${esc(DB.profile.name)}！今日 ${s.type.name} 已记录。</p>
        </div>
        <div class="metrics">
          <div class="metric"><div class="v">${s.dist.toFixed(2)}</div><div class="k">距离 km</div></div>
          <div class="metric"><div class="v">${Math.floor(s.t/60)}:${String(s.t%60).padStart(2,'0')}</div><div class="k">时长</div></div>
          <div class="metric"><div class="v">${Math.round(s.cal)}</div><div class="k">千卡</div></div>
        </div>
        <div class="row mt12"><div class="ri">🦊</div><div class="rt"><div class="t">元气狐 获得能量</div><div class="s">运动 +5 · 完成计划 +20</div></div><div class="rv up">+25 ⚡</div></div>
        <div class="tiny center mt12">已触发成就检查 · 数据已沉淀至趋势与恢复模型</div>
      </div>
      <button class="btn" data-act="nav:home">返回首页</button>
      <button class="btn sec mt12" data-act="post">分享到社区</button>
    </div>`;
  }

  // ============================================================
  //  数据 INSIGHTS
  // ============================================================
  function screenInsight() {
    if (App.sub === 'metric') return screenMetric(App.params.key);
    const hs = DB.healthSeries;
    const last = hs[hs.length - 1];
    const r = DB.recovery;

    // 健康仪表盘卡片
    const dash = [
      { ic: '❤️', k: '静息心率', v: last.restingHR, u: 'bpm', c: '#FF5B6E' },
      { ic: '📈', k: 'HRV', v: last.hrv, u: 'ms', c: '#4C8DFF' },
      { ic: '🩸', k: '血氧', v: last.spo2, u: '%', c: '#2ECC8F' },
      { ic: '😌', k: '压力', v: last.stress, u: '', c: '#FF8A5B' },
      { ic: '🌡️', k: '体温', v: last.temp, u: '℃', c: '#FFB020' },
      { ic: '💤', k: '睡眠', v: last.sleepHours, u: 'h', c: '#A18BFF' }
    ].map(d => `<div class="metric" data-act="metric:${d.k}"><div class="v" style="color:${d.c}">${d.v}<span style="font-size:11px;color:var(--text-3)">${d.u}</span></div><div class="k">${d.ic} ${d.k}</div></div>`).join('');

    // 趋势：体重 vs 目标（近30天）
    const w30 = hs.slice(-30).map(d => d.weight);
    const trend = C.line([{ name: '体重', color: '#2ECC8F', data: w30, fill: true }],
      { min: 55, max: 61, h: 150, target: 55, xlabels: ['30天前', '', '', '', '', '', '今天'] });

    // 年热力图
    const heat = Array.from({ length: 18 * 7 }, () => Math.random() < .35 ? 0 : U.randInt(10, 70));
    const heatSvg = C.heatmap(heat);

    return `
    <div class="topbar"><div><h1>数据洞察</h1><div class="sub">恢复 · 趋势 · 睡眠</div></div></div>
    <div class="scroll">
      <div class="card">
        <div class="card-title">🔋 恢复与训练准备度 <button class="why-btn" data-act="why" style="margin:0">❓为什么</button></div>
        <div class="recovery-row">
          <div class="ring-wrap">${C.ring(r.score, r.color, { label: '电量', size: 120, stroke: 11, fs: 30 })}</div>
          <div class="recovery-info"><div class="lv" style="color:${r.color}">${r.level} ${r.score}</div>
          <div class="ad">${r.advice}</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🩺 健康仪表盘 <span class="more">每日更新</span></div>
        <div class="metrics">${dash}</div>
      </div>

      <div class="card">
        <div class="card-title">📉 体重趋势（近30天）</div>
        ${trend}
        <div class="tiny mt8">当前 ${last.weight}kg · 目标 55kg · 体脂 ${last.bodyFat}% · 肌肉 ${last.muscle}kg</div>
      </div>

      <div class="card">
        <div class="card-title">🔥 年度活跃热力图</div>
        ${heatSvg}
        <div class="tiny mt8">颜色越深代表当日运动强度越高</div>
      </div>

      <div class="card">
        <div class="card-title">💤 睡眠分析 <span class="more" data-act="metric:睡眠">详情</span></div>
        ${C.sleepStages(DB.sleepStages)}
        <div class="tiny mt8">深睡 1.6h · 浅睡 4.2h · REM 1.4h · 评分 ${last.sleepScore}</div>
      </div>
    </div>`;
  }

  function screenMetric(key) {
    if (key === '睡眠' || key === 'sleep') {
      return `
      <div class="topbar"><div><h1>睡眠分析</h1><div class="sub">深睡/浅睡/REM</div></div><div class="avatar" data-act="back">←</div></div>
      <div class="scroll">
        <div class="card">${C.sleepStages(DB.sleepStages)}</div>
        <div class="card"><div class="card-title">📋 阶段解读</div>
          <div class="row"><div class="ri">🌑</div><div class="rt"><div class="t">深睡 1.6h</div><div class="s">身体修复关键期</div></div><div class="rv up">优</div></div>
          <div class="row"><div class="ri">🌕</div><div class="rt"><div class="t">浅睡 4.2h</div><div class="s">占比正常</div></div><div class="rv">良</div></div>
          <div class="row"><div class="ri">💡</div><div class="rt"><div class="t">REM 1.4h</div><div class="s">记忆巩固</div></div><div class="rv">良</div></div>
        </div>
        <div class="card"><div class="card-title">💡 改善建议</div>
          <div class="row"><div class="ri">☕</div><div class="rt"><div class="t">咖啡因摄入晚于 14:00</div><div class="s">与入睡延迟相关，建议提前</div></div></div>
          <div class="row"><div class="ri">📱</div><div class="rt"><div class="t">睡前 30min 使用手机</div><div class="s">建议改为阅读/冥想</div></div></div>
          <div class="row"><div class="ri">🏃</div><div class="rt"><div class="t">晚间高强度运动</div><div class="s">建议提前至傍晚</div></div></div>
        </div>
      </div>`;
    }
    const hs = DB.healthSeries;
    const series = { '静息心率': hs.map(d=>d.restingHR), 'HRV': hs.map(d=>d.hrv), '血氧': hs.map(d=>d.spo2),
      '体重': hs.map(d=>d.weight), '压力': hs.map(d=>d.stress), '体温': hs.map(d=>d.temp) }[key] || hs.map(d=>d.vo2max);
    const labels = hs.slice(-30).map(d => d.label);
    const chart = C.line([{ name: key, color: '#4C8DFF', data: series.slice(-30), fill: true }], { h: 170, xlabels: ['30天前','','','','','','今天'] });
    return `
    <div class="topbar"><div><h1>${key} 趋势</h1><div class="sub">周/月维度对比</div></div><div class="avatar" data-act="back">←</div></div>
    <div class="scroll">
      <div class="seg mt8"><button class="on">周</button><button>月</button><button>年</button></div>
      <div class="card mt12">${chart}
        <div class="legend mt8"><span><i style="background:#4C8DFF"></i>${key}（近30天）</span></div>
      </div>
      <div class="card"><div class="card-title">📌 解读</div>
        <div class="tiny">${key} 近期呈稳定${series[series.length-1]>=series[series.length-8]?'向好':'波动'}趋势。结合恢复评分与睡眠，建议关注长期一致性而非单日波动。</div>
      </div>
    </div>`;
  }

  // ============================================================
  //  社区 COMMUNITY
  // ============================================================
  function screenCommunity() {
    if (App.sub === 'challenge') return screenChallenge(App.params.id);
    const pet = DB.pet;
    DB.updatePetForm();
    const feed = DB.community.map(p => `
      <div class="feed">
        <div class="head"><div class="av">${p.avatar}</div>
          <div style="flex:1"><div class="un">${p.user} <span class="topic">#${p.topic}</span></div><div class="tm">${p.time}</div></div>
          <span class="pill" data-act="post:${p.id}">详情</span></div>
        <div class="txt">${p.text}</div>
        <div class="img">${p.img}</div>
        <div class="acts">
          <span class="${p.liked?'liked':''}" data-act="like:${p.id}">${p.liked?'❤️':'🤍'} ${p.like}</span>
          <span data-act="post:${p.id}">💬 ${p.comment}</span>
          <span>↗ 分享</span>
        </div>
      </div>`).join('');

    const chHTML = DB.challenges.slice(0, 2).map(c => `
      <div class="card tight" data-act="chdetail:${c.id}">
        <div class="flex between center"><div style="font-size:26px">${c.cover}</div>
          <span class="pill">${c.type==='team'?'团队':'个人'} · 剩${c.daysLeft}天</span></div>
        <div style="font-weight:700;margin-top:6px">${c.name}</div>
        <div class="progress mt8"><i style="width:${Math.min(100, c.progress/c.goal*100)}%"></i></div>
        <div class="tiny mt8">进度 ${c.progress}/${c.goal}${c.unit} · 排名 ${c.rank>0?('#'+c.rank):'未加入'}/${c.total}</div>
      </div>`).join('');

    return `
    <div class="topbar"><div><h1>社区</h1><div class="sub">动态 · 挑战 · 宠物</div></div>
      <div class="avatar" data-act="sheet:post">＋</div></div>
    <div class="scroll">
      <div class="card">
        <div class="card-title">🦊 我的虚拟宠物 · ${pet.name}</div>
        <div class="pet-stage">
          <div class="pet-emoji ${pet.form==='瞌睡'?'sleep':''}">${pet.emoji}</div>
          <div class="pet-name">${pet.name} · Lv.${pet.level}</div>
          <div class="pet-form">状态：${pet.form}</div>
          <div class="energy-bar"><i style="width:${pet.energy}%"></i></div>
          <div class="tiny">能量 ${pet.energy}/100 · 运动 +5/10min · 完成计划 +20 · 连续打卡 +10</div>
          <button class="btn sm acc mt12" data-act="pet">🍖 陪它运动充能</button>
        </div>
      </div>

      <div class="card"><div class="card-title">🏆 进行中的挑战 <span class="more" data-act="chdetail:${DB.challenges[0].id}">全部</span></div>${chHTML}</div>

      <div class="card-title" style="margin:4px 4px">📣 动态</div>
      ${feed}
    </div>`;
  }

  function screenChallenge(id) {
    const c = DB.challenges.find(x => x.id === id) || DB.challenges[0];
    const pct = Math.min(100, c.progress / c.goal * 100);
    const board = [
      { u: '风一样的男子', v: c.goal * 0.98, me: false },
      { u: 'Yoga_Lily', v: c.goal * 0.91, me: false },
      { u: esc(DB.profile.name), v: c.progress, me: true },
      { u: '小步快跑', v: c.goal * 0.55, me: false },
      { u: '阿May', v: c.goal * 0.4, me: false }
    ].sort((a,b)=>b.v-a.v);
    return `
    <div class="topbar"><div><h1>${c.name}</h1><div class="sub">${c.type==='team'?'团队模式':'个人模式'} · 剩 ${c.daysLeft} 天</div></div>
      <div class="avatar" data-act="back">←</div></div>
    <div class="scroll">
      <div class="hero"><span class="tag">${c.cover}</span><h2>${c.desc}</h2>
        <div class="advice">我的进度 ${c.progress}/${c.goal}${c.unit}（${Math.round(pct)}%）</div></div>
      <div class="card"><div class="progress"><i style="width:${pct}%"></i></div>
        <div class="tiny mt8">目标 ${c.goal}${c.unit} · 参与 ${c.total} 人</div></div>
      <div class="card"><div class="card-title">🥇 排行榜</div>
        ${board.map((b,i)=>`<div class="row"><div class="ri">${i<3?['🥇','🥈','🥉'][i]:(i+1)}</div>
          <div class="rt"><div class="t" style="${b.me?'color:var(--primary-d)':''}">${b.u}${b.me?' （我）':''}</div></div>
          <div class="rv">${b.v}${c.unit}</div></div>`).join('')}
      </div>
      ${c.joined
        ? `<button class="btn sec" data-act="back">已加入 · 返回</button>`
        : `<button class="btn" data-act="challenge:${c.id}">立即加入挑战</button>`}
    </div>`;
  }

  // ============================================================
  //  我的 PROFILE
  // ============================================================
  function screenProfile() {
    if (App.sub === 'onboard') return screenOnboard();
    if (App.sub === 'edit') return screenEditProfile();
    if (App.sub === 'privacy') return screenPrivacy();
    if (App.sub === 'alg') return screenAlg();
    const p = DB.profile;
    const ach = DB.achievements;
    const got = ach.filter(a => a.got).length;
    const badgeHTML = ach.map(a => `<div class="badge ${a.got?'got':''}">
      <div class="bi">${a.icon}</div><div class="bn">${a.name}</div>
      ${a.got?`<div class="tiny">${a.date}</div>`:`<div class="bp">${a.progress}%</div>`}</div>`).join('');

    return `
    <div class="topbar"><div><h1>我的</h1><div class="sub">健康管家中心</div></div></div>
    <div class="scroll">
      <div class="card">
        <div class="flex center gap12">
          <div class="avatar" style="width:56px;height:56px;font-size:30px">${avatarHTML(p.avatar)}</div>
          <div style="flex:1"><div style="font-size:18px;font-weight:800">${esc(p.name)}</div>
            <div class="tiny">${p.gender} · ${p.age}岁 · ${p.height}cm · ${p.weight}kg</div>
            <div class="tiny mt8">🎯 ${p.goal} · ${p.level}</div></div>
          <div class="lv-chip">Lv.${p.level_num}</div>
        </div>
        <button class="btn sm mt12" data-act="editProfile">👤 编辑个人资料</button>
        <button class="btn sm sec mt12" data-act="onboard">✏️ 重新体能测评</button>
      </div>

      <div class="card">
        <div class="card-title">🏅 成就墙（${got}/${ach.length}）</div>
        <div class="badge-grid">${badgeHTML}</div>
      </div>

      <div class="card">
        <div class="card-title">⚙️ 设置与合规</div>
        <div class="row" data-act="alg"><div class="ri">🧠</div><div class="rt"><div class="t">算法透明度</div><div class="s">查看建议背后的逻辑</div></div><span class="pill">合规</span></div>
        <div class="row" data-act="privacy"><div class="ri">🔒</div><div class="rt"><div class="t">隐私与数据权利</div><div class="s">GDPR / 个人信息保护法</div></div><span class="pill">合规</span></div>
        <div class="row" data-act="nav:insight"><div class="ri">📊</div><div class="rt"><div class="t">数据与设备</div><div class="s">健康/运动设备同步</div></div><span class="pill">连接</span></div>
      </div>

      <div class="card">
        <div class="card-title">💎 商业化预留（不影响核心）</div>
        <div class="wrap">
          <div class="chip" data-act="member">👑 会员 Pro</div>
          <div class="chip" data-act="shop">🛒 运动商城</div>
          <div class="chip" data-act="coach">🎓 在线私教</div>
        </div>
        <div class="tiny mt12">以上为信息架构预留入口，核心功能免费完整可用。</div>
      </div>

      <div class="tiny center mt12">运动健康助手 v1.0 · 懂科学 · 有温度 · 能闭环</div>
    </div>`;
  }

  // 体能测评 Onboarding
  function screenOnboard() {
    return `
    <div class="topbar"><div><h1>体能测评</h1><div class="sub">科学定制你的计划</div></div><div class="avatar" data-act="back">←</div></div>
    <div class="scroll">
      <div class="hero"><span class="tag">Step 1/3</span><h2>了解你的目标 🎯</h2>
        <div class="advice">回答几个问题，AI 将生成专属训练计划。</div></div>
      <div class="card">
        <div class="field"><label>主要目标</label>
          <div class="wrap">
            ${['减脂塑形','增肌','健康维持','备战马拉松'].map((g,i)=>`<span class="chip ${i===0?'on':''}" data-goal="${g}">${g}</span>`).join('')}
          </div></div>
        <div class="field"><label>每周可用天数</label>
          <select id="ob-days"><option>3</option><option selected>4</option><option>5</option><option>6</option></select></div>
        <div class="field"><label>单次时长（分钟）</label>
          <select id="ob-mins"><option>30</option><option selected>45</option><option>60</option></select></div>
        <div class="field"><label>可用器械</label>
          <div class="wrap">
            ${['无器械','弹力带','瑜伽垫','哑铃','跑步机'].map((e,i)=>`<span class="chip ${i<3?'on':''}" data-eq="${e}">${e}</span>`).join('')}
          </div></div>
      </div>
      <div class="card"><div class="card-title">🏃 简单体能测试</div>
        <div class="tiny">1 分钟深蹲计数 / 步行测试（演示）：请输入估算值</div>
        <div class="field mt12"><label>1分钟深蹲（次）</label><input id="ob-sq" type="number" value="22" /></div>
      </div>
      <button class="btn" data-act="obSubmit">生成我的计划 →</button>
    </div>`;
  }
  function submitOnboard() {
    const goalEl = document.querySelector('[data-goal].on') || document.querySelector('[data-goal]');
    const goal = goalEl ? goalEl.dataset.goal : '减脂塑形';
    const days = +($('#ob-days')?.value || 4);
    const mins = +($('#ob-mins')?.value || 45);
    const sq = +($('#ob-sq')?.value || 20);
    // 推断水平
    const level = sq >= 30 ? '进阶' : sq >= 22 ? '中级' : '新手';
    DB.saveProfile({ goal, availDays: days, availMins: mins, level });
    toast(`已生成「${goal}」计划 · 水平评估：${level}`);
    go('sport');
  }

  // 编辑个人资料（覆盖 data.js 默认档案，localStorage 持久化）
  function screenEditProfile() {
    const p = DB.profile;
    const emojis = ['🦊', '🐯', '🐰', '🐻', '🐼', '🐨', '🐧', '🦁', '🐶', '🐱', '🐹', '🐷'];
    const eq = ['无器械', '弹力带', '瑜伽垫', '哑铃', '跑步机'];
    const chip = (list, attr, val) => list.map(x => `<span class="chip ${x === val ? 'on' : ''}" data-${attr}="${x}">${x}</span>`).join('');
    return `
    <div class="topbar"><div><h1>编辑个人资料</h1><div class="sub">本地保存 · 不上传服务器</div></div><div class="avatar" data-act="back">←</div></div>
    <div class="scroll">
      <div class="card">
        <div class="field"><label>头像</label>
          <div class="flex center gap12">
            <div class="avatar" id="pf-avatar-preview" style="width:64px;height:64px;font-size:32px">${avatarHTML(p.avatar)}</div>
            <button class="btn sec sm" data-act="avatarUpload">📷 上传照片</button>
          </div>
          <input type="file" id="pf-avatar-file" accept="image/*" style="display:none" />
          <input type="hidden" id="pf-avatar" />
          <div class="wrap mt8">${chip(emojis, 'avatar', p.avatar)}</div>
        </div>
        <div class="field"><label>姓名</label><input id="pf-name" type="text" maxlength="12" value="${esc(p.name)}" /></div>
        <div class="field"><label>性别</label><div class="wrap">${chip(['男', '女'], 'gender', p.gender)}</div></div>
        <div class="flex gap8">
          <div class="field" style="flex:1"><label>年龄</label><input id="pf-age" type="number" min="1" max="120" value="${p.age}" /></div>
          <div class="field" style="flex:1"><label>身高 cm</label><input id="pf-height" type="number" min="50" max="250" value="${p.height}" /></div>
          <div class="field" style="flex:1"><label>体重 kg</label><input id="pf-weight" type="number" min="20" max="300" step="0.1" value="${p.weight}" /></div>
        </div>
        <div class="field"><label>主要目标</label><div class="wrap">${chip(['减脂塑形', '增肌', '健康维持', '备战马拉松'], 'goal', p.goal)}</div></div>
        <div class="field"><label>训练水平</label><div class="wrap">${chip(['新手', '中级', '进阶'], 'level', p.level)}</div></div>
        <div class="field"><label>可用器械</label><div class="wrap">
          ${eq.map(e => `<span class="chip ${p.equipment.includes(e) ? 'on' : ''}" data-eq="${e}">${e}</span>`).join('')}
        </div></div>
      </div>
      <div class="card">
        <div class="card-title">📈 个人基线（影响恢复评分）</div>
        <div class="flex gap8">
          <div class="field" style="flex:1"><label>静息心率</label><input id="pf-rhr" type="number" value="${p.baseline.restingHR}" /></div>
          <div class="field" style="flex:1"><label>HRV ms</label><input id="pf-hrv" type="number" value="${p.baseline.hrv}" /></div>
        </div>
        <div class="flex gap8">
          <div class="field" style="flex:1"><label>睡眠评分</label><input id="pf-sleep" type="number" value="${p.baseline.sleepScore}" /></div>
          <div class="field" style="flex:1"><label>压力</label><input id="pf-stress" type="number" value="${p.baseline.stress}" /></div>
        </div>
        <div class="tiny">以你的个人基线做 z-score 标准化，避免与他人横向比较。</div>
      </div>
      <button class="btn" data-act="saveProfile">保存资料</button>
      <button class="btn sec mt12" data-act="resetProfile">恢复默认档案</button>
      <div class="tiny center mt12">资料仅保存在本机浏览器 localStorage，不会上传。</div>
    </div>`;
  }

  function doSaveProfile() {
    const num = (id, def) => { const el = $(id); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? def : v; };
    const one = (attr) => document.querySelector(`[data-${attr}].on`);
    const eq = Array.from(document.querySelectorAll('[data-eq].on')).map(c => c.dataset.eq);
    const b = DB.profile.baseline;
    DB.saveProfile({
      name: (($('#pf-name') && $('#pf-name').value) || '').trim() || '运动达人',
      avatar: ($('#pf-avatar') && $('#pf-avatar').value) || DB.profile.avatar || '🦊',
      gender: (one('gender') && one('gender').dataset.gender) || DB.profile.gender,
      age: Math.max(1, Math.round(num('#pf-age', DB.profile.age))),
      height: Math.max(50, Math.round(num('#pf-height', DB.profile.height))),
      weight: Math.max(20, num('#pf-weight', DB.profile.weight)),
      goal: (one('goal') && one('goal').dataset.goal) || DB.profile.goal,
      level: (one('level') && one('level').dataset.level) || DB.profile.level,
      equipment: eq.length ? eq : DB.profile.equipment,
      baseline: {
        restingHR: Math.round(num('#pf-rhr', b.restingHR)),
        hrv: Math.round(num('#pf-hrv', b.hrv)),
        sleepScore: Math.round(num('#pf-sleep', b.sleepScore)),
        stress: Math.round(num('#pf-stress', b.stress))
      }
    });
    toast('资料已保存，已按新基线重算恢复评分');
    go('profile');
  }

  function doResetProfile() {
    DB.resetProfile();
    toast('已恢复默认档案');
    go('profile');
  }

  function triggerAvatarUpload() { const f = $('#pf-avatar-file'); if (f) f.click(); }

  function setEditAvatar(url) {
    const inp = $('#pf-avatar'); if (inp) inp.value = url;
    const pv = $('#pf-avatar-preview'); if (pv) pv.innerHTML = avatarHTML(url);
    document.querySelectorAll('[data-avatar]').forEach(c => c.classList.remove('on'));
  }

  function handleAvatarFile(file) {
    if (!file || !file.type || file.type.indexOf('image') !== 0) { toast('请选择图片文件'); return; }
    if (typeof FileReader === 'undefined') { toast('当前环境不支持图片上传'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const max = 200; // 压缩到 200px 内，避免超出 localStorage 容量
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * k), h = Math.round(img.height * k);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        setEditAvatar(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => toast('图片读取失败，请换一张');
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // 隐私合规
  function screenPrivacy() {
    return `
    <div class="topbar"><div><h1>隐私与数据权利</h1><div class="sub">GDPR / 个人信息保护法</div></div><div class="avatar" data-act="back">←</div></div>
    <div class="scroll">
      <div class="card"><div class="card-title">📋 合规原则</div>
        <div class="row"><div class="ri">①</div><div class="rt"><div class="t">最小必要采集</div><div class="s">仅收集实现功能所必需的数据</div></div></div>
        <div class="row"><div class="ri">②</div><div class="rt"><div class="t">明确同意</div><div class="s">采集/共享前获取单独授权</div></div></div>
        <div class="row"><div class="ri">③</div><div class="rt"><div class="t">本地优先 + 加密</div><div class="s">敏感健康数据默认本地存储</div></div></div>
        <div class="row"><div class="ri">④</div><div class="rt"><div class="t">第三方共享二次确认</div><div class="s">共享前再次征得同意</div></div></div>
      </div>
      <div class="card"><div class="card-title">🔑 你的数据权利</div>
        <button class="btn sec sm mb0" data-act="member">导出我的数据</button>
        <button class="btn sec sm mt12" data-act="member">删除账户数据</button>
        <button class="btn sec sm mt12" data-act="member">撤回授权</button>
        <div class="tiny mt12">我们承诺不会在未经你明确同意的情况下，将健康数据用于广告或出售给第三方。</div>
      </div>
    </div>`;
  }

  // 算法透明
  function screenAlg() {
    const r = DB.recovery;
    return `
    <div class="topbar"><div><h1>算法透明度</h1><div class="sub">为什么给我这个建议</div></div><div class="avatar" data-act="back">←</div></div>
    <div class="scroll">
      <div class="card"><div class="card-title">🔋 恢复评分如何算出</div>
        <div class="recovery-row">
          <div class="ring-wrap">${C.ring(r.score, r.color, { label:'电量', size:120, stroke:11, fs:30 })}</div>
          <div class="recovery-info"><div class="lv" style="color:${r.color}">${r.level}</div>
          <div class="ad">${r.advice}</div></div>
        </div>
        <div class="card-title mt12">评分构成（相对你的个人基线，非与他人比较）</div>
        ${C.scoreBars(r.breakdown)}
        <div class="tiny mt8">采用相对个人基线的 z-score 标准化，避免不同体能基础用户的偏差；新手强度上限已设限。</div>
      </div>
      <div class="card"><div class="card-title">🤖 计划生成逻辑</div>
        <div class="tiny">输入：目标 + 体能基线 + 可用天数/时长 + 器械 → 输出：周计划（力量/有氧/柔韧比例 + 心率区间 + 渐进过载）。新手单日强度 ≤ 60% HRmax，强制休息日。</div>
      </div>
      <div class="card"><div class="card-title">⚠️ 算法局限性</div>
        <div class="tiny">本建议基于可穿戴与自报数据，不能替代医疗诊断。如有伤病或慢性疾病，请遵医嘱并下调强度。</div>
      </div>
    </div>`;
  }

  // ============================================================
  //  Sheet 弹层
  // ============================================================
  let sheetData = {};
  function openSheet(name) {
    let html = '';
    if (name === 'meal') html = mealSheet();
    else if (name === 'plan') html = planSheet();
    else if (name === 'post') html = postSheet();
    $('#sheet').innerHTML = `<div class="handle"></div><h3>${sheetTitle(name)}</h3>${html}<button class="btn sec mt16" data-act="closeSheet">关闭</button>`;
    $('#sheet-mask').classList.add('show'); $('#sheet').classList.add('show');
  }
  function sheetTitle(n){ return {meal:'🍱 记录饮食',plan:'🤖 重新生成计划',post:'📝 发布动态'}[n]||''; }
  function closeSheet() { $('#sheet-mask').classList.remove('show'); $('#sheet').classList.remove('show'); }

  function mealSheet() {
    const n = DB.nutritionSummary();
    const foods = DB.foodDB.slice(0, 6).map(f => `<div class="chip" data-food="${f.name}" style="width:46%">${f.emoji} ${f.name} ${f.cal}kcal</div>`).join('');
    const waterPct = Math.round(App.state.waterCups / DB.waterGoal * 100);
    return `
      <div class="tiny">今日营养</div>
      <div class="metrics mt8">
        <div class="metric"><div class="v">${n.cal}</div><div class="k">千卡</div></div>
        <div class="metric"><div class="v">${n.p}g</div><div class="k">蛋白质</div></div>
        <div class="metric"><div class="v">${n.c}g</div><div class="k">碳水</div></div>
      </div>
      <div class="card-title mt12">⚡ 快速添加（最近常吃 / 扫码 / 拍照）</div>
      <div class="wrap">${foods}<div class="chip" style="width:46%">📷 拍照识别</div><div class="chip" style="width:46%">🔍 扫码录入</div></div>
      <div class="card-title mt12">💧 饮水 ${App.state.waterCups}/${DB.waterGoal} 杯</div>
      <div class="flex gap8 center">
        <button class="btn sec sm" data-act="water:remove">－</button>
        <div class="progress" style="flex:1"><i style="width:${waterPct}%"></i></div>
        <button class="btn sm acc" data-act="water:add">＋ 一杯</button>
      </div>`;
  }
  function planSheet() {
    const plan = DB.generatePlan(DB.profile);
    return `<div class="tiny">基于目标「${plan.goal}」动态生成</div>
      ${plan.days.map(d=>`<div class="row"><div class="ri">📅</div>
        <div class="rt"><div class="t">第${d.day}天 · ${d.type}</div><div class="s">${d.detail}</div></div>
        <div class="rv">${d.intensity}%</div></div>`).join('')}
      <div class="tiny mt8">${plan.weekNote} · 周训练 ${plan.totalMin} 分钟</div>`;
  }
  function postSheet() {
    return `<div class="field"><label>分享内容</label><textarea id="post-txt" rows="3" style="width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;font:inherit" placeholder="今天的运动心得…">今天完成训练，状态满分！💪</textarea></div>
      <div class="wrap"><span class="chip on">#晨跑</span><span class="chip">#减脂</span><span class="chip">#打卡</span></div>
      <button class="btn mt16" data-act="post:publish">发布到动态</button>`;
  }

  function addWater(act) {
    if (act === 'add') App.state.waterCups = Math.min(DB.waterGoal + 2, App.state.waterCups + 1);
    else App.state.waterCups = Math.max(0, App.state.waterCups - 1);
    // 刷新 sheet
    $('#sheet').innerHTML = `<div class="handle"></div><h3>🍱 记录饮食</h3>${mealSheet()}<button class="btn sec mt16" data-act="closeSheet">关闭</button>`;
  }

  function genPlan() { toast('已根据最新档案重新生成计划'); }
  function feedPet() { const e = DB.petGain('workout10'); toast(`元气狐能量 +5，当前 ${e}/100`); render(); }
  function joinChallenge(id) {
    const c = DB.challenges.find(x => x.id === id); if (c) c.joined = true;
    toast('已加入挑战，加油！'); render();
  }
  function toggleLike(id) {
    const p = DB.community.find(x => x.id === id); if (!p) return;
    p.liked = !p.liked; p.like += p.liked ? 1 : -1; render();
  }
  function openPost(id) {
    const p = DB.community.find(x => x.id === id);
    if (!p) { toast('动态已发布（演示）'); closeSheet(); render(); return; }
    if (id === 'publish') { toast('动态已发布（演示）'); closeSheet(); render(); return; }
    toast(`「${p.user}」的动态 · ${p.like} 赞`);
  }

  function showWhy() {
    const r = DB.recovery;
    $('#sheet').innerHTML = `<div class="handle"></div><h3>❓ 为什么建议「${r.advice}」</h3>
      <div class="recovery-row"><div class="ring-wrap">${C.ring(r.score, r.color, { label:'电量', size:110, stroke:10, fs:28 })}</div>
      <div class="recovery-info"><div class="lv" style="color:${r.color}">${r.level} ${r.score}分</div></div></div>
      <div class="card-title mt12">评分构成</div>${C.scoreBars(r.breakdown)}
      <div class="tiny mt8">示例：若昨夜深睡仅 1.2h，睡眠分项走低，系统会自动下调建议强度并提示优先恢复——一切以你的个人基线为准。</div>
      <button class="btn sec mt16" data-act="closeSheet">明白了</button>`;
    $('#sheet-mask').classList.add('show'); $('#sheet').classList.add('show');
  }

  // 绑定 sheet 遮罩点击关闭 + chip 选择
  function bindScreen() {
    const mask = $('#sheet-mask');
    if (mask) mask.onclick = (e) => { if (e.target === mask) closeSheet(); };
    // chip 单选/多选（测评页）
    document.querySelectorAll('[data-goal]').forEach(c => c.onclick = () => {
      document.querySelectorAll('[data-goal]').forEach(x => x.classList.remove('on')); c.classList.add('on');
    });
    document.querySelectorAll('[data-eq]').forEach(c => c.onclick = () => c.classList.toggle('on'));
    document.querySelectorAll('[data-food]').forEach(c => c.onclick = () => { toast('已添加 ' + c.dataset.food); });
    // 编辑资料页：单选 chips（性别 / 训练水平 / 头像 emoji）
    ['gender', 'level', 'avatar'].forEach(attr => {
      document.querySelectorAll(`[data-${attr}]`).forEach(c => c.onclick = () => {
        document.querySelectorAll(`[data-${attr}]`).forEach(x => x.classList.remove('on'));
        c.classList.add('on');
        if (attr === 'avatar') {
          const inp = $('#pf-avatar'); if (inp) inp.value = c.dataset.avatar;
          const pv = $('#pf-avatar-preview'); if (pv) pv.innerHTML = avatarHTML(c.dataset.avatar);
        }
      });
    });
    // 头像照片上传 + 隐藏域初始化
    const avFile = $('#pf-avatar-file');
    if (avFile) avFile.onchange = (e) => handleAvatarFile(e.target.files && e.target.files[0]);
    const avHidden = $('#pf-avatar');
    if (avHidden) avHidden.value = DB.profile.avatar;
  }

  // ---------------- 启动 ----------------
  document.addEventListener('DOMContentLoaded', () => { render(); });
  if (document.readyState !== 'loading') render();
})();
