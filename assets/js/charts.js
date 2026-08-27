/* ============================================================
 * 运动健康助手 · 自绘 SVG 图表库（无第三方依赖，离线可用）
 * 全局命名空间：window.Charts
 * 所有函数返回 SVG 字符串，可直接插入 innerHTML。
 * ============================================================ */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  // 进度环（大号，用于身体电量/恢复）
  function ring(percent, color, opts = {}) {
    const size = opts.size || 160, sw = opts.stroke || 14;
    const r = (size - sw) / 2, c = 2 * Math.PI * r;
    const off = c * (1 - percent / 100);
    const gid = 'g' + Math.random().toString(36).slice(2, 7);
    return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" class="svg-ring">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${opts.to || '#3DD6C4'}"/>
      </linearGradient></defs>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#EEF1F5" stroke-width="${sw}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="url(#${gid})" stroke-width="${sw}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
        transform="rotate(-90 ${size/2} ${size/2})" style="transition:stroke-dashoffset 1s ease"/>
      <text x="50%" y="46%" text-anchor="middle" font-size="${opts.fs || 38}" font-weight="800" fill="#1A1D26">${percent}</text>
      <text x="50%" y="64%" text-anchor="middle" font-size="13" fill="#6B7280">${opts.label || ''}</text>
    </svg>`;
  }

  // 小型进度环（无文字）
  function miniRing(percent, color) {
    const size = 44, sw = 5, r = (size - sw) / 2, c = 2 * Math.PI * r;
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#EEF1F5" stroke-width="${sw}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-percent/100)}"
        transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;
  }

  // 折线图（支持多条线对比 + 区间填充 + 目标线）
  function line(series, opts = {}) {
    // series: [{name,color,data:[..],dashed?}]
    const w = opts.w || 320, h = opts.h || 160, pad = 28;
    const all = series.flatMap(s => s.data);
    const min = opts.min != null ? opts.min : Math.min(...all);
    const max = opts.max != null ? opts.max : Math.max(...all);
    const span = (max - min) || 1;
    const n = Math.max(...series.map(s => s.data.length));
    const x = i => pad + (w - 2 * pad) * (i / (n - 1 || 1));
    const y = v => h - pad - (h - 2 * pad) * ((v - min) / span);
    let paths = '';
    series.forEach(s => {
      const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      if (s.fill && !s.dashed) {
        const area = `${x(0)},${h - pad} ${pts} ${x(s.data.length - 1)},${h - pad}`;
        paths += `<polygon points="${area}" fill="${s.color}22"/>`;
      }
      paths += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.4"
        ${s.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
      if (opts.dots) s.data.forEach((v, i) => { paths += `<circle cx="${x(i)}" cy="${y(v)}" r="2.5" fill="${s.color}"/>`; });
    });
    // 目标线
    let target = '';
    if (opts.target != null) {
      const ty = y(opts.target);
      target = `<line x1="${pad}" y1="${ty}" x2="${w-pad}" y2="${ty}" stroke="#FF8A5B" stroke-width="1.2" stroke-dasharray="4 3"/>
        <text x="${w-pad}" y="${ty-4}" text-anchor="end" font-size="9" fill="#FF8A5B">目标</text>`;
    }
    // x 轴标签
    let xlab = '';
    if (opts.xlabels) {
      opts.xlabels.forEach((lb, i) => {
        if (i % Math.ceil(opts.xlabels.length / 5) === 0 || i === opts.xlabels.length - 1)
          xlab += `<text x="${x(i)}" y="${h-8}" text-anchor="middle" font-size="9" fill="#9AA1AD">${lb}</text>`;
      });
    }
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">${paths}${target}${xlab}</svg>`;
  }

  // 柱状图
  function bars(data, opts = {}) {
    const w = opts.w || 320, h = opts.h || 140, pad = 20;
    const max = Math.max(...data.map(d => d.v)) || 1;
    const bw = (w - 2 * pad) / data.length * 0.6;
    const gap = (w - 2 * pad) / data.length;
    let s = '';
    data.forEach((d, i) => {
      const bh = (h - 2 * pad) * (d.v / max);
      const bx = pad + gap * i + (gap - bw) / 2;
      s += `<rect x="${bx}" y="${h - pad - bh}" width="${bw}" height="${bh}" rx="4" fill="${d.color || '#2ECC8F'}"/>`;
      s += `<text x="${bx + bw/2}" y="${h-pad+12}" text-anchor="middle" font-size="9" fill="#9AA1AD">${d.l}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">${s}</svg>`;
  }

  // 睡眠阶段堆叠条（横向时间轴）
  function sleepStages(stages) {
    const colors = { deep: '#3A4CB1', light: '#6E8BE8', rem: '#A18BFF', awake: '#FFB020' };
    const labels = { deep: '深睡', light: '浅睡', rem: 'REM', awake: '清醒' };
    const totalMin = stages.reduce((s, x) => s + x.dur, 0);
    const w = 340, h = 64, pad = 10;
    let cx = pad; let blocks = '';
    stages.forEach(sg => {
      const bw = (w - 2 * pad) * (sg.dur / totalMin);
      blocks += `<rect x="${cx}" y="14" width="${bw}" height="30" rx="3" fill="${colors[sg.stage]}"><title>${labels[sg.stage]} ${sg.dur}min</title></rect>`;
      cx += bw;
    });
    // 图例
    let leg = '';
    Object.keys(colors).forEach(k => {
      leg += `<rect x="${pad + Object.keys(colors).indexOf(k)*64}" y="52" width="9" height="9" rx="2" fill="${colors[k]}"/>
        <text x="${pad + Object.keys(colors).indexOf(k)*64 + 13}" y="61" font-size="9" fill="#6B7280">${labels[k]}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">${blocks}${leg}</svg>`;
  }

  // 活动热力图（年度，简化 18 周 x 7 天）
  function heatmap(values) {
    const cols = 18, rows = 7, cell = 14, gap = 3, pad = 4;
    const w = pad * 2 + cols * (cell + gap), h = pad * 2 + rows * (cell + gap);
    let s = '';
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const v = values[c * rows + r] || 0;
      const inten = Math.min(1, v / 60);
      const col = v === 0 ? '#EEF1F5' : `rgba(46,204,143,${0.25 + inten * 0.75})`;
      s += `<rect x="${pad + c*(cell+gap)}" y="${pad + r*(cell+gap)}" width="${cell}" height="${cell}" rx="3" fill="${col}"/>`;
    }
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">${s}</svg>`;
  }

  // 雷达/评分构成横向条
  function scoreBars(items) {
    return items.map(it => `
      <div class="sb-item">
        <span class="sb-k">${it.k}</span>
        <div class="sb-track"><div class="sb-fill" style="width:${it.v}%;background:${'#2ECC8F'}"></div></div>
        <span class="sb-v">${it.v}</span>
        <span class="sb-w">权重${it.w}%</span>
      </div>`).join('');
  }

  window.Charts = { ring, miniRing, line, bars, sleepStages, heatmap, scoreBars };
})();
