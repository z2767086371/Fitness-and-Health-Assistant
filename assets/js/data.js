/* ============================================================
 * 运动健康助手 · 数据层 & 算法实现 (Mock + 真实计算)
 * 全局命名空间：window.DB
 * 说明：所有"智能"功能均为可运行算法，输入 mock 数据后真实计算。
 * ============================================================ */
(function () {
  'use strict';

  // ---------- 工具 ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const round = (n, d = 0) => { const p = Math.pow(10, d); return Math.round(n * p) / p; };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => d.toISOString().slice(5, 10);

  // ---------- 用户档案（含算法基线） ----------
  // 默认档案仅作为首次使用的占位；用户可在「我的 → 编辑个人资料」中覆盖，
  // 并通过 localStorage 持久化（离线可用、无需后端）。
  const DEFAULT_PROFILE = {
    name: '小琳',
    avatar: '🦊',
    age: 25,
    gender: '女',
    height: 165,
    weight: 58,
    goal: '减脂塑形',
    level: '新手',
    memberDays: 128,
    streak: 7,
    level_num: 12,
    exp: 1840,
    exp_next: 2200,
    // 算法个性化基线（恢复评分 z-score 基准）
    baseline: {
      restingHR: 62,   // 静息心率基线
      hrv: 58,         // HRV 基线 ms
      sleepScore: 82,  // 睡眠基线
      stress: 35
    },
    equipment: ['无器械', '弹力带', '瑜伽垫'],
    availDays: 4,
    availMins: 45,
    onboarded: true
  };

  // 允许用户覆盖的标量字段白名单（其余字段如 level_num/exp 由系统维护）
  const PROFILE_KEYS = ['name', 'avatar', 'age', 'gender', 'height', 'weight', 'goal', 'level',
    'memberDays', 'streak', 'level_num', 'exp', 'exp_next', 'availDays', 'availMins', 'onboarded'];

  // 从 localStorage 读取用户此前保存的资料（首次使用返回 null）
  function loadProfile() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem('sport_profile');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // 将用户保存的资料合并进默认档案，返回全新对象（不污染 DEFAULT_PROFILE）
  function mergeProfile(saved) {
    const out = Object.assign({}, DEFAULT_PROFILE);
    out.baseline = Object.assign({}, DEFAULT_PROFILE.baseline);
    if (!saved) return out;
    if (saved.baseline) Object.assign(out.baseline, saved.baseline);
    if (Array.isArray(saved.equipment)) out.equipment = saved.equipment.slice();
    PROFILE_KEYS.forEach(k => { if (saved[k] !== undefined) out[k] = saved[k]; });
    return out;
  }

  const profile = mergeProfile(loadProfile());

  // ---------- 用户自录健康数据（覆盖/追加演示数据，localStorage 持久化） ----------
  // 结构：{ today:{date,...}, workouts:[...], meals:{...}, waterCups:number }
  function loadUserHealth() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem('sport_health_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  const userHealth = loadUserHealth() || {};

  function persistUserHealth() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem('sport_health_user', JSON.stringify(userHealth));
    } catch (e) { /* 存储超限/隐私模式时静默失败 */ }
  }

  // ---------- 生成最近 N 天健康时间序列 ----------
  function genHealthSeries(n) {
    const arr = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const wave = Math.sin(i / 3) * 4;
      arr.push({
        date: d.toISOString().slice(0, 10),
        label: fmtDate(d),
        restingHR: round(rand(58, 68) + wave * 0.6, 0),
        hrv: round(rand(48, 72) - wave, 0),
        spo2: round(rand(95, 99), 0),
        stress: round(rand(25, 60), 0),
        temp: round(rand(36.3, 36.9), 1),
        sleepHours: round(rand(6.2, 8.4), 1),
        sleepScore: round(rand(68, 92), 0),
        vo2max: round(rand(34, 41) + (n - i) * 0.05, 1),
        weight: round(59.4 - (n - i) * 0.012, 1),
        bodyFat: round(28.5 - (n - i) * 0.02, 1),
        muscle: round(22.1 + (n - i) * 0.008, 1)
      });
    }
    return arr;
  }
  const healthSeries = genHealthSeries(120); // 近 120 天用于年/月/周趋势

  // ---------- 睡眠阶段（昨晚） ----------
  // hours：目标总睡眠时长；不传则按默认 7.5h 生成
  function genSleepStages(hours) {
    // 生成 23:30 起的睡眠周期，按目标时长等比缩放
    const stages = [];
    let t = 23 * 60 + 30;
    const seq = ['light', 'deep', 'light', 'rem', 'light', 'deep', 'light', 'rem', 'light', 'deep', 'light', 'rem', 'light', 'awake', 'light', 'rem'];
    const baseTotal = 450; // 原固定周期的总分钟数
    const k = ((hours || 7.5) * 60) / baseTotal;
    seq.forEach((s, i) => {
      const base = (s === 'awake') ? 10 : (i === seq.length - 1 ? 20 : 30);
      const dur = Math.round(base * k);
      stages.push({ start: t, dur, stage: s });
      t = (t + dur) % (24 * 60);
    });
    return stages;
  }
  let sleepStages = genSleepStages();

  // ---------- 运动历史 ----------
  const sportTypes = [
    { id: 'run', name: '跑步', icon: '🏃', color: '#2ECC8F', group: '户外有氧' },
    { id: 'walk', name: '步行', icon: '🚶', color: '#4C8DFF', group: '户外有氧' },
    { id: 'ride', name: '骑行', icon: '🚴', color: '#FFB020', group: '户外有氧' },
    { id: 'swim', name: '游泳', icon: '🏊', color: '#3DD6C4', group: '水中' },
    { id: 'strength', name: '力量', icon: '🏋️', color: '#FF7A7A', group: '室内' },
    { id: 'yoga', name: '瑜伽', icon: '🧘', color: '#A18BFF', group: '室内' },
    { id: 'hiit', name: 'HIIT', icon: '🔥', color: '#FF8A5B', group: '室内' },
    { id: 'ball', name: '球类', icon: '⚽', color: '#5BC0EB', group: '球类' }
  ];

  function genWorkouts(n) {
    const arr = [];
    const now = new Date();
    const types = ['run', 'strength', 'yoga', 'ride', 'hiit', 'walk'];
    for (let i = 0; i < n; i++) {
      const d = new Date(now); d.setDate(now.getDate() - randInt(0, 118));
      const t = types[randInt(0, types.length - 1)];
      const meta = {
        run: { dist: rand(3, 10), pace: rand(5.2, 7.5), hr: rand(140, 168) },
        walk: { dist: rand(2, 6), pace: rand(10, 14), hr: rand(95, 115) },
        ride: { dist: rand(10, 35), pace: rand(3.5, 5.5), hr: rand(120, 150) },
        swim: { dist: rand(0.8, 2.5), pace: rand(2, 3.2), hr: rand(125, 150) },
        strength: { dist: 0, pace: 0, hr: rand(95, 130) },
        yoga: { dist: 0, pace: 0, hr: rand(80, 105) },
        hiit: { dist: 0, pace: 0, hr: rand(150, 178) },
        ball: { dist: rand(1, 4), pace: rand(6, 9), hr: rand(130, 160) }
      }[t];
      arr.push({
        id: 'w' + i,
        type: t,
        date: d.toISOString().slice(0, 10),
        duration: randInt(20, 75),
        calories: randInt(120, 620),
        distance: round(meta.dist, 2),
        pace: round(meta.pace, 2),
        avgHR: round(meta.hr, 0),
        steps: t === 'strength' || t === 'yoga' ? 0 : randInt(2000, 12000)
      });
    }
    return arr.sort((a, b) => a.date === b.date ? 0 : (a.date < b.date ? 1 : -1));
  }
  // 用户自录记录在前，演示记录在后，按日期倒序
  function mergeWorkouts(mock, user) {
    const u = Array.isArray(user) ? user : [];
    return [...u, ...mock].sort((a, b) => a.date === b.date ? 0 : (a.date < b.date ? 1 : -1));
  }
  const mockWorkouts = genWorkouts(60);
  let workouts = mergeWorkouts(mockWorkouts, userHealth.workouts);

  // ---------- 营养 / 饮水 ----------
  const foodDB = [
    { name: '鸡胸肉(100g)', cal: 165, p: 31, c: 0, f: 3.6, emoji: '🍗' },
    { name: '糙米饭(150g)', cal: 165, p: 3.5, c: 35, f: 1.2, emoji: '🍚' },
    { name: '西兰花(100g)', cal: 34, p: 2.8, c: 7, f: 0.4, emoji: '🥦' },
    { name: '燕麦(40g)', cal: 150, p: 5, c: 27, f: 3, emoji: '🥣' },
    { name: '鸡蛋(1个)', cal: 78, p: 6.3, c: 0.6, f: 5.3, emoji: '🥚' },
    { name: '香蕉(1根)', cal: 105, p: 1.3, c: 27, f: 0.4, emoji: '🍌' },
    { name: '牛油果(半个)', cal: 160, p: 2, c: 9, f: 15, emoji: '🥑' },
    { name: '三文鱼(100g)', cal: 208, p: 20, c: 0, f: 13, emoji: '🐟' }
  ];
  const DEFAULT_MEALS = {
    breakfast: [{ name: '燕麦(40g)', cal: 150, p: 5, c: 27, f: 3 }, { name: '鸡蛋(1个)', cal: 78, p: 6.3, c: 0.6, f: 5.3 }],
    lunch: [{ name: '鸡胸肉(100g)', cal: 165, p: 31, c: 0, f: 3.6 }, { name: '糙米饭(150g)', cal: 165, p: 3.5, c: 35, f: 1.2 }, { name: '西兰花(100g)', cal: 34, p: 2.8, c: 7, f: 0.4 }],
    dinner: [{ name: '三文鱼(100g)', cal: 208, p: 20, c: 0, f: 13 }, { name: '牛油果(半个)', cal: 160, p: 2, c: 9, f: 15 }],
    snack: []
  };
  function cloneMeals(m) {
    const out = {};
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(k => {
      out[k] = Array.isArray(m[k]) ? m[k].map(x => Object.assign({}, x)) : [];
    });
    return out;
  }
  let meals = cloneMeals(userHealth.meals || DEFAULT_MEALS);
  let waterCups = (userHealth.waterCups != null) ? userHealth.waterCups : 4; // 今日已喝杯数
  const waterGoal = 8;          // 目标杯数

  // ---------- 成就系统 ----------
  const achievements = [
    { id: 'a1', name: '首跑者', icon: '🏅', desc: '完成第一次跑步', got: true, date: '05-12' },
    { id: 'a2', name: '7日连击', icon: '🔥', desc: '连续打卡 7 天', got: true, date: '06-01' },
    { id: 'a3', name: '控卡达人', icon: '🥗', desc: '连续 5 天热量达标', got: true, date: '06-18' },
    { id: 'a4', name: '登顶者', icon: '⛰️', desc: '累计爬升 1000m', got: false, progress: 64 },
    { id: 'a5', name: '半马预备', icon: '🏃', desc: '完成半马训练营', got: false, progress: 38 },
    { id: 'a6', name: '早鸟', icon: '🌅', desc: '7 点前完成运动', got: true, date: '07-02' },
    { id: 'a7', name: '百炼成钢', icon: '💎', desc: '累计运动 100 次', got: false, progress: 72 },
    { id: 'a8', name: '社交达人', icon: '💬', desc: '发布 20 条动态', got: false, progress: 45 }
  ];

  // ---------- 挑战赛 ----------
  const challenges = [
    {
      id: 'c1', name: '盛夏减脂赛', type: 'team', joined: true,
      progress: 3.2, goal: 5, unit: 'kg', daysLeft: 12, rank: 3, total: 86,
      desc: '团队累计减重冲刺，瓜分奖金池', cover: '🔥'
    },
    {
      id: 'c2', name: '百日马拉松', type: 'solo', joined: true,
      progress: 142, goal: 421.95, unit: 'km', daysLeft: 64, rank: 2153, total: 9800,
      desc: '100 天累计跑量挑战全马距离', cover: '🏅'
    },
    {
      id: 'c3', name: '晨光打卡', type: 'solo', joined: false,
      progress: 0, goal: 21, unit: '天', daysLeft: 21, rank: 0, total: 5400,
      desc: '连续 21 天晨间运动打卡', cover: '🌅'
    }
  ];

  // ---------- 社区动态 ----------
  const mockCommunity = [
    { id: 'p1', user: '阿杰', avatar: '🐯', time: '12分钟前', topic: '晨跑', text: '今天配速破 5分30秒了！间歇跑真的有用 💪', like: 28, comment: 6, liked: false, img: '🏞️' },
    { id: 'p2', user: 'Yoga_Lily', avatar: '🐰', time: '1小时前', topic: '瑜伽', text: '坚持 30 天瑜伽，体态改善超明显～分享今日体态对比', like: 64, comment: 12, liked: true, img: '🧘' },
    { id: 'p3', user: '老王', avatar: '🐻', time: '今天 07:20', topic: '减脂餐', text: '低卡鸡胸+西兰花，控卡第 18 天，继续冲！', like: 41, comment: 9, liked: false, img: '🥗' },
    { id: 'p4', user: '跑步菌', avatar: '🐧', time: '昨天', topic: '装备', text: '新鞋上脚第一跑，缓震绝了，推荐给进阶跑者', like: 88, comment: 23, liked: false, img: '👟' }
  ];
  // 用户发布的动态在前，演示动态在后
  function mergeCommunity(mock, user) {
    const u = Array.isArray(user) ? user : [];
    return [...u, ...mock];
  }
  let community = mergeCommunity(mockCommunity, userHealth.posts);

  // ---------- 虚拟宠物 ----------
  function loadPet() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem('sport_pet');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  const pet = Object.assign({
    name: '元气狐', emoji: '🦊', energy: 76, level: 5,
    exp: 0, expNext: 100,
    form: '活力',   // 瞌睡 / 普通 / 活力 / 闪耀
    lastFed: todayKey()
  }, loadPet() || {});
  function persistPet() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem('sport_pet', JSON.stringify(pet));
    } catch (e) { /* 静默失败 */ }
  }

  // ============================================================
  //  ★ 核心算法 ★
  // ============================================================

  // 1) 恢复评分模型（0-100）
  function computeRecovery(today) {
    const b = profile.baseline;
    // z-score 相对个人基线（避免横向比较偏差）
    const zHRV = clamp((today.hrv - b.hrv) / 12, -2, 2);
    const zRHR = clamp((b.restingHR - today.restingHR) / 8, -2, 2); // 静息越低越好
    const sleepNorm = clamp((today.sleepScore - 50) / 50, 0, 1);
    const stressNorm = clamp((100 - today.stress) / 100, 0, 1);
    const R = round(
      100 * (0.28 * sleepNorm + 0.26 * ((zHRV + 2) / 4) + 0.24 * ((zRHR + 2) / 4) + 0.22 * stressNorm)
    );
    let level, advice, color;
    if (R >= 80) { level = '充沛'; advice = '状态很棒，可安排高强度 / 冲刺训练'; color = '#2ECC8F'; }
    else if (R >= 60) { level = '良好'; advice = '正常训练，保持节奏'; color = '#4C8DFF'; }
    else if (R >= 40) { level = '一般'; advice = '建议中低强度或技术训练，注意补水'; color = '#FFB020'; }
    else { level = '偏低'; advice = '身体在报警：拉伸 / 休息 / 优先睡眠恢复'; color = '#FF5B6E'; }
    const breakdown = [
      { k: '睡眠', v: round(sleepNorm * 100), w: 28 },
      { k: 'HRV', v: round(((zHRV + 2) / 4) * 100), w: 26 },
      { k: '静息心率', v: round(((zRHR + 2) / 4) * 100), w: 24 },
      { k: '压力', v: round(stressNorm * 100), w: 22 }
    ];
    return { score: R, level, advice, color, breakdown };
  }

  // 2) 个性化训练计划生成
  function generatePlan(p) {
    const goalMap = {
      '减脂塑形': { strength: 0.4, cardio: 0.4, flex: 0.2, intensity: 0.55 },
      '增肌': { strength: 0.6, cardio: 0.2, flex: 0.2, intensity: 0.7 },
      '健康维持': { strength: 0.33, cardio: 0.34, flex: 0.33, intensity: 0.5 },
      '备战马拉松': { strength: 0.2, cardio: 0.7, flex: 0.1, intensity: 0.75 }
    };
    const g = goalMap[p.goal] || goalMap['健康维持'];
    const days = p.availDays;
    const base = p.level === '新手' ? 0.9 : 1.0;
    const plan = [];
    const types = [];
    for (let i = 0; i < days; i++) {
      const r = Math.random();
      let type, detail, hrZone;
      if (r < g.strength) { type = '力量训练'; detail = p.equipment.includes('无器械') ? '自重循环：深蹲×4 臀桥×3 平板×3' : '分化训练：推/拉/腿'; hrZone = 'Zone2 (60-70%)'; }
      else if (r < g.strength + g.cardio) { type = '有氧'; detail = p.goal === '备战马拉松' ? '轻松跑 5km (E配速)' : '燃脂慢跑 30min / 快走'; hrZone = 'Zone2-3'; }
      else { type = '柔韧恢复'; detail = '瑜伽 / 拉伸 + 泡沫轴放松'; hrZone = 'Zone1'; }
      const intensityPct = round((g.intensity * base + (i % 3 === 2 ? 0.1 : 0)) * 100);
      const dur = round(p.availMins * (type === '柔韧恢复' ? 0.7 : 1));
      plan.push({ day: i + 1, type, detail, hrZone, intensity: clamp(intensityPct, 30, 85), dur });
    }
    // 渐进过载：第3周减载
    const weekNote = '每周强度 +5%~10%；第4周设为减载周（强度 -20%）';
    return { goal: p.goal, weekNote, days: plan, totalMin: plan.reduce((s, x) => s + x.dur, 0) };
  }

  // 3) 跑步训练营框架（5K→全马）
  function runCamp(level) {
    const camps = {
      '5K': { weeks: 8, sessions: ['E 轻松跑 20min', 'Walk/Run 间歇', 'E 轻松跑 30min', 'LSD 5K 测试'] },
      '10K': { weeks: 10, sessions: ['E 轻松跑 30min', 'T 节奏跑 2×1.6km', 'I 间歇 6×400m', 'LSD 10K'] },
      '半马': { weeks: 14, sessions: ['E 轻松跑 40min', 'T 阈值跑 3×2km', 'I 间歇 8×400m', 'LSD 18km'] },
      '全马': { weeks: 18, sessions: ['E 轻松跑 50min', 'M 马拉松配速 2×5km', 'I 间歇 10×400m', 'LSD 32km'] }
    };
    return camps[level] || camps['5K'];
  }

  // 4) 虚拟宠物能量规则（能量 + 经验 + 升级，持久化）
  function petGain(action) {
    const map = { workout10: 5, planDone: 20, streak: 10, challenge: 50, feed: 25 };
    const energyGain = map[action] || 0;
    pet.energy = clamp(pet.energy + energyGain, 0, 100);
    pet.exp = (pet.exp || 0) + energyGain;
    while (pet.exp >= pet.expNext) {
      pet.exp -= pet.expNext;
      pet.level = (pet.level || 1) + 1;
      pet.expNext = Math.round(pet.expNext * 1.5);
    }
    updatePetForm();
    persistPet();
    return pet;
  }
  function updatePetForm() {
    if (pet.energy >= 90) pet.form = '闪耀';
    else if (pet.energy >= 60) pet.form = '活力';
    else if (pet.energy >= 30) pet.form = '普通';
    else pet.form = '瞌睡';
  }

  // 5) 营养汇总
  function nutritionSummary() {
    let cal = 0, p = 0, c = 0, f = 0;
    Object.values(meals).forEach(list => list.forEach(m => { cal += m.cal; p += m.p; c += m.c; f += m.f; }));
    return { cal: round(cal), p: round(p, 1), c: round(c, 1), f: round(f, 1), goal: 1500 };
  }

  // 6) VO2max 估算（由配速 + 静息心率，简化公式）
  function estimateVO2max(paceMinPerKm, restingHR, maxHR) {
    // 简化：基于 1.0 英里跑经验公式的本土化近似
    const vo2 = 15.3 * (maxHR / restingHR) / (paceMinPerKm || 6);
    return round(clamp(vo2, 25, 65), 1);
  }

  // ---------- 今日健康快照（演示值 + 用户自录覆盖） ----------
  const mockToday = Object.assign({}, healthSeries[healthSeries.length - 1]); // 保留演示"今日"快照，供恢复用
  let today = healthSeries[healthSeries.length - 1];

  // 将用户自录的今日健康数据覆盖到 today，并按睡眠时长重建睡眠阶段（幂等）
  function applyTodayOverride() {
    const th = userHealth.today;
    if (!th || th.date !== todayKey()) return;
    const num = v => (v === undefined || v === null || v === '') ? undefined : (isNaN(+v) ? undefined : +v);
    ['restingHR', 'hrv', 'spo2', 'stress', 'temp', 'sleepHours', 'sleepScore', 'weight', 'bodyFat', 'muscle'].forEach(k => {
      const n = num(th[k]);
      if (n !== undefined) today[k] = n;
    });
    if (today.sleepHours) sleepStages = genSleepStages(today.sleepHours);
  }
  applyTodayOverride(); // 启动时叠加一次

  let recovery = computeRecovery(today);

  // 同步可变数据到 window.DB 引用
  function syncDB() {
    window.DB.today = today;
    window.DB.recovery = recovery;
    window.DB.sleepStages = sleepStages;
    window.DB.workouts = workouts;
    window.DB.meals = meals;
    window.DB.waterCups = waterCups;
    window.DB.community = community;
  }

  // 重算依赖个人档案的派生数据（如恢复评分，因其依赖 baseline）
  function recompute() {
    today = healthSeries[healthSeries.length - 1];
    recovery = computeRecovery(today);
    syncDB();
  }

  // 保存用户自录的今日健康数据（未填写的字段保留演示值）
  function saveTodayHealth(obj) {
    const keys = ['restingHR', 'hrv', 'spo2', 'stress', 'temp', 'sleepHours', 'sleepScore', 'weight', 'bodyFat', 'muscle'];
    const patch = { date: todayKey() };
    keys.forEach(k => {
      const v = obj && obj[k];
      if (v !== undefined && v !== null && v !== '' && !isNaN(+v)) patch[k] = +v;
    });
    userHealth.today = patch;
    persistUserHealth();
    applyTodayOverride();
    recompute();
    return patch;
  }

  // 新增一条运动记录（用户自录）
  function addWorkout(rec) {
    const w = {
      id: 'u' + new Date().getTime(),
      type: rec.type,
      date: rec.date || todayKey(),
      duration: Math.max(0, Math.round(rec.duration || 0)),
      calories: Math.max(0, Math.round(rec.calories || 0)),
      distance: Math.max(0, +(rec.distance || 0)),
      pace: Math.max(0, +(rec.pace || 0)),
      avgHR: Math.max(0, Math.round(rec.avgHR || 0)),
      steps: Math.max(0, Math.round(rec.steps || 0))
    };
    if (!Array.isArray(userHealth.workouts)) userHealth.workouts = [];
    userHealth.workouts.push(w);
    persistUserHealth();
    workouts = mergeWorkouts(mockWorkouts, userHealth.workouts);
    syncDB();
    return w;
  }

  // 向指定餐次添加食物
  function addMeal(type, item) {
    if (!meals[type]) meals[type] = [];
    meals[type].push(Object.assign({}, item));
    userHealth.meals = meals;
    persistUserHealth();
    syncDB();
    return meals;
  }

  // 清空全部饮食记录
  function clearMeals() {
    meals = { breakfast: [], lunch: [], dinner: [], snack: [] };
    userHealth.meals = meals;
    persistUserHealth();
    syncDB();
    return meals;
  }

  // 设置今日饮水量
  function setWaterCups(n) {
    waterCups = Math.max(0, Math.round(n));
    userHealth.waterCups = waterCups;
    persistUserHealth();
    syncDB();
    return waterCups;
  }

  // 清空所有用户自录数据，恢复纯演示数据
  function resetHealthData() {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem('sport_health_user'); } catch (e) {}
    userHealth.today = null;
    userHealth.workouts = [];
    userHealth.meals = null;
    userHealth.waterCups = null;
    Object.assign(healthSeries[healthSeries.length - 1], mockToday);
    today = healthSeries[healthSeries.length - 1];
    sleepStages = genSleepStages();
    workouts = mergeWorkouts(mockWorkouts, []);
    meals = cloneMeals(DEFAULT_MEALS);
    waterCups = 4;
    recovery = computeRecovery(today);
    syncDB();
  }

  // 用户经验值 + 升级（持久化到个人档案）
  function gainExp(n) {
    n = Math.max(0, Math.round(n || 0));
    profile.exp = (profile.exp || 0) + n;
    let leveledUp = false;
    while (profile.exp >= profile.exp_next) {
      profile.exp -= profile.exp_next;
      profile.level_num += 1;
      profile.exp_next = Math.round(profile.exp_next * 1.2);
      leveledUp = true;
    }
    persistProfile();
    return { exp: profile.exp, level: profile.level_num, expNext: profile.exp_next, leveledUp };
  }

  // 发布一条社区动态（用户自录）
  function addPost(p) {
    const text = (p.text || '').trim();
    if (!text) return null;
    const post = {
      id: 'u' + new Date().getTime(),
      user: profile.name || '我',
      avatar: profile.avatar || '🙂',
      time: '刚刚',
      topic: p.topic || '打卡',
      text,
      like: 0, comment: 0, liked: false,
      img: p.img || '📝'
    };
    if (!Array.isArray(userHealth.posts)) userHealth.posts = [];
    userHealth.posts.unshift(post); // 最新在前
    persistUserHealth();
    community = mergeCommunity(mockCommunity, userHealth.posts);
    syncDB();
    return post;
  }

  // 年度活跃热力图：按近 18 周运动记录（时长+热量）计算每日活跃度
  function activityHeatmap() {
    const days = 126; // 18 周 * 7 天
    const now = new Date();
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const byDate = {};
    workouts.forEach(w => {
      byDate[w.date] = (byDate[w.date] || 0) + Math.max(0, w.duration || 0) + Math.max(0, w.calories || 0) / 25;
    });
    const vals = dates.map(dt => Math.round(byDate[dt] || 0));
    const max = Math.max(...vals, 1);
    return vals.map(v => Math.min(70, Math.round(v / max * 70)));
  }

  // 睡眠阶段汇总（深睡/浅睡/REM/清醒 小时数）
  function sleepBreakdown() {
    const t = { deep: 0, light: 0, rem: 0, awake: 0 };
    sleepStages.forEach(s => { t[s.stage] = (t[s.stage] || 0) + s.dur; });
    const h = m => round(m / 60, 1);
    return {
      deep: h(t.deep), light: h(t.light), rem: h(t.rem), awake: h(t.awake),
      total: round(sleepStages.reduce((s, x) => s + x.dur, 0) / 60, 1)
    };
  }

  // 保存用户资料：合并写回 localStorage 供下次启动读取，并重算派生数据
  function saveProfile(patch) {
    if (patch) {
      if (patch.baseline) { Object.assign(profile.baseline, patch.baseline); delete patch.baseline; }
      Object.assign(profile, patch);
    }
    persistProfile();
    recompute();
    return profile;
  }

  // 恢复为默认占位档案
  function resetProfile() {
    Object.assign(profile, mergeProfile(null));
    persistProfile();
    recompute();
    return profile;
  }

  function persistProfile() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem('sport_profile', JSON.stringify(profile));
    } catch (e) { /* 隐私模式 / 存储超限时静默失败，不影响使用 */ }
  }

  // ---------- 导出 ----------
  window.DB = {
    util: { rand, randInt, round, clamp, todayKey, fmtDate },
    profile, healthSeries, sleepStages, sportTypes, workouts,
    foodDB, meals, waterCups, waterGoal, achievements, challenges,
    community, pet, today, recovery,
    computeRecovery, generatePlan, runCamp, petGain, updatePetForm,
    nutritionSummary, estimateVO2max, saveProfile, resetProfile,
    saveTodayHealth, addWorkout, addMeal, clearMeals, setWaterCups, resetHealthData,
    gainExp, addPost, activityHeatmap, sleepBreakdown,
    _state: { waterCups, selectedType: null }
  };
})();
