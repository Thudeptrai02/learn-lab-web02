// ====== F-distribution approximation (for ANOVA) ======
function computeFPValue(F, df1, df2) {
  if (F <= 0 || df1 <= 0 || df2 <= 0) return 1;
  const x = df1 * F / (df1 * F + df2);
  function logBeta(a, b) { return Math.log(Math.abs(lgamma(a))) + Math.log(Math.abs(lgamma(b))) - Math.log(Math.abs(lgamma(a+b))); }
  function lgamma(z) {
    if (z < 0.5) return lgamma(z+1) - Math.log(z);
    const g = 7; const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let s = c[0]; for (let i = 1; i < g+2; i++) s += c[i] / (z + i - 1);
    const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z - 0.5) * Math.log(t) - t + Math.log(s);
  }
  function incBeta(a, b, x) {
    if (x < 0 || x > 1) return 0;
    if (x === 0 || x === 1) return x === 0 ? 0 : 1;
    const bt = Math.exp(logBeta(a, b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * contFrac(a, b, x) / a;
    return 1 - bt * contFrac(b, a, 1 - x) / b;
  }
  function contFrac(a, b, x) {
    const eps = 1e-10; let qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < eps) d = eps; d = 1 / d;
    let result = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < eps) d = eps; c = 1 + aa / c; if (Math.abs(c) < eps) c = eps;
      d = 1 / d; result *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < eps) d = eps; c = 1 + aa / c; if (Math.abs(c) < eps) c = eps;
      d = 1 / d; const del = d * c; result *= del;
      if (Math.abs(del - 1) < eps) break;
    }
    return result;
  }
  const a = df1 / 2, b = df2 / 2;
  const p = 1 - incBeta(a, b, x);
  return Math.max(0, Math.min(1, p));
}

// ====== INDEPENDENT SAMPLE T-TEST ======
function independentTTest(group1, group2, label1, label2) {
  const n1 = group1.length, n2 = group2.length;
  if (n1 < 2 || n2 < 2) return null;
  const m1 = group1.reduce((a,b)=>a+b,0)/n1;
  const m2 = group2.reduce((a,b)=>a+b,0)/n2;
  const v1 = group1.reduce((a,b)=>a+(b-m1)**2,0)/(n1-1);
  const v2 = group2.reduce((a,b)=>a+(b-m2)**2,0)/(n2-1);
  const pooledVar = ((n1-1)*v1 + (n2-1)*v2) / (n1+n2-2);
  const seEqual = Math.sqrt(pooledVar * (1/n1 + 1/n2));
  const tEqual = seEqual > 0 ? (m1 - m2) / seEqual : 0;
  const dfEqual = n1 + n2 - 2;
  const seWelch = Math.sqrt(v1/n1 + v2/n2);
  const tWelch = seWelch > 0 ? (m1 - m2) / seWelch : 0;
  const dfWelchNum = Math.pow(v1/n1 + v2/n2, 2);
  const dfWelchDen = Math.pow(v1/n1, 2)/(n1-1) + Math.pow(v2/n2, 2)/(n2-1);
  const dfWelch = dfWelchDen > 0 ? dfWelchNum / dfWelchDen : dfEqual;
  const grandMean = (m1*n1 + m2*n2) / (n1+n2);
  const z1 = group1.map(v => Math.abs(v - m1));
  const z2 = group2.map(v => Math.abs(v - m2));
  const zm1 = z1.reduce((a,b)=>a+b,0)/n1;
  const zm2 = z2.reduce((a,b)=>a+b,0)/n2;
  const gz = [...z1, ...z2]; const gzm = gz.reduce((a,b)=>a+b,0)/(n1+n2);
  const ssb = n1*(zm1-gzm)**2 + n2*(zm2-gzm)**2;
  const ssw = z1.reduce((a,b)=>a+(b-zm1)**2,0) + z2.reduce((a,b)=>a+(b-zm2)**2,0);
  const fLevene = ssw > 0 ? ssb / ssw * (n1+n2-2) : 0;
  const leveneP = computeFPValue(fLevene, 1, n1+n2-2);
  const equalVarAssumed = leveneP >= 0.05;
  const useWelch = !equalVarAssumed;
  const tStat = useWelch ? tWelch : tEqual;
  const df = useWelch ? dfWelch : dfEqual;
  const pVal = tDistP(tStat, df);
  const cohensD = Math.sqrt(pooledVar) > 0 ? Math.abs(m1 - m2) / Math.sqrt(pooledVar) : 0;

  return {
    n1, n2, m1, m2, v1, v2,
    tStat, df, pVal,
    cohensD,
    equalVarAssumed,
    fLevene, leveneP,
    useWelch
  };
}

function tDistP(t, df) {
  if (df <= 0 || !isFinite(t)) return 1;
  const fVal = t * t;
  const pOneTail = 1 - computeFPValue(fVal, 1, df);
  return 2 * Math.min(pOneTail, 0.5);
}

// ====== QUALITY REPORT ======
function clr(val, gl, gh, yl, yh) {
  if (val >= gl && val <= gh) return '#10b981';
  if (val >= yl && val <= yh) return '#d97706';
  return '#ef4444';
}

function showQualityReport(rawRows, constructs, n) {
  const card = document.getElementById('quality-card');
  const content = document.getElementById('quality-content');
  card.style.display = 'block';

  const constructKeys = Object.keys(constructs);
  let html = '<div class="variables-list" style="gap:.5rem">';

  let allPass = true;
  let warnings = [];

  const roleColor = { independent: '#2563eb', dependent: '#dc2626', mediating: '#d97706', moderating: '#7c3aed' };
  const roleLabels = { independent: 'Độc lập', dependent: 'Phụ thuộc', mediating: 'Trung gian', moderating: 'Điều tiết' };

  const compStats = {};
  constructKeys.forEach(key => {
    const items = constructs[key].map(v => v.name);
    const vals = rawRows.map(r => {
      let s=0, c=0; items.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){s+=v;c++;}});
      return c>0 ? s/c : null;
    }).filter(v=>v!==null);
    const m = vals.length;
    const mean = m>0 ? vals.reduce((a,b)=>a+b,0)/m : 0;
    const sd = m>1 ? Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/m) : 0;
    compStats[key] = { mean, sd, n: m };
  });

  let descHtml = `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
    <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">📊 Thống kê mô tả thang đo (Composite)</span></div>
    <div style="overflow-x:auto;font-size:.75rem;margin-top:.35rem"><table style="width:100%;border-collapse:collapse">
      <tr style="background:var(--gray-100);font-weight:600">
        <td style="padding:.3rem .5rem">Nhân tố</td><td style="padding:.3rem .5rem">Vai trò</td>
        <td style="padding:.3rem .5rem;text-align:center">Số items</td><td style="padding:.3rem .5rem;text-align:center">N</td>
        <td style="padding:.3rem .5rem;text-align:center">Mean</td><td style="padding:.3rem .5rem;text-align:center">SD</td></tr>`;
  constructKeys.forEach((key, i) => {
    const role = constructs[key][0]?.role || '';
    const label = constructs[key][0]?.constructLabel || key;
    const k = constructs[key].length;
    const st = compStats[key];
    descHtml += `<tr${i%2===1?' style="background:var(--gray-50)"':''}>
      <td style="padding:.2rem .5rem;font-weight:600">${label}</td>
      <td style="padding:.2rem .5rem;color:${roleColor[role]||'#666'}">${roleLabels[role]||''}</td>
      <td style="padding:.2rem .5rem;text-align:center">${k}</td>
      <td style="padding:.2rem .5rem;text-align:center">${st.n}</td>
      <td style="padding:.2rem .5rem;text-align:center;font-weight:600;color:var(--primary)">${st.mean.toFixed(2)}</td>
      <td style="padding:.2rem .5rem;text-align:center">${st.sd.toFixed(3)}</td></tr>`;
  });
  descHtml += `</table></div></div>`;
  html += descHtml;

  if (constructKeys.length > 0) {
    let normHtml = `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
      <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">📐 Đánh giá phân phối chuẩn — Skewness & Kurtosis</span>
      <span style="font-size:.7rem;color:var(--gray-500)">Skewness ∈ [±1.5]; Kurtosis ∈ [±3] (chuẩn) | ∈ [±2]; [±5] (tạm)</span></div>
      <div style="overflow-x:auto;font-size:.75rem;margin-top:.35rem"><table style="width:100%;border-collapse:collapse">
      <tr style="background:var(--gray-100);font-weight:600">
        <td style="padding:.3rem .5rem">Nhân tố</td>
        <td style="padding:.3rem .5rem;text-align:center">Items</td>
        <td style="padding:.3rem .5rem;text-align:center">Skewness TB</td>
        <td style="padding:.3rem .5rem;text-align:center">Kurtosis TB</td>
        <td style="padding:.3rem .5rem;text-align:center">Đánh giá</td></tr>`;
    constructKeys.forEach((key, i) => {
      const items = constructs[key].map(v => v.name);
      const itemSkew = items.map(name => {
        const vals = rawRows.map(r => r[name]).filter(v => typeof v === 'number' && !isNaN(v));
        return vals.length > 0 ? skewness(vals) : 0;
      });
      const itemKurt = items.map(name => {
        const vals = rawRows.map(r => r[name]).filter(v => typeof v === 'number' && !isNaN(v));
        return vals.length > 0 ? kurtosis(vals) : 0;
      });
      const avgSkew = itemSkew.reduce((a,b)=>a+b,0)/items.length;
      const avgKurt = itemKurt.reduce((a,b)=>a+b,0)/items.length;
      const passStrict = Math.abs(avgSkew) < 1.5 && Math.abs(avgKurt) < 3;
      const passModerate = Math.abs(avgSkew) < 2 && Math.abs(avgKurt) < 5;
      const label = constructs[key][0]?.constructLabel || key;
      const status = passStrict ? '✅ Chuẩn' : passModerate ? '⚠️ Tạm' : '❌ Không chuẩn';
      const color = passStrict ? '#10b981' : passModerate ? '#d97706' : '#ef4444';
      normHtml += `<tr${i%2===1?' style="background:var(--gray-50)"':''}>
        <td style="padding:.2rem .5rem;font-weight:600">${label}</td>
        <td style="padding:.2rem .5rem;text-align:center">${items.length}</td>
        <td style="padding:.2rem .5rem;text-align:center;color:${Math.abs(avgSkew)<1.5?'#10b981':Math.abs(avgSkew)<2?'#d97706':'#ef4444'}">${avgSkew.toFixed(3)}</td>
        <td style="padding:.2rem .5rem;text-align:center;color:${Math.abs(avgKurt)<3?'#10b981':Math.abs(avgKurt)<5?'#d97706':'#ef4444'}">${avgKurt.toFixed(3)}</td>
        <td style="padding:.2rem .5rem;text-align:center;font-weight:600;color:${color}">${status}</td></tr>`;
    });
    normHtml += `</table></div></div>`;
    html += normHtml;
  }

  const demoColors = ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];
  const demoVars = variables.filter(v => v.type === 'demographic' && !v.construct);
  if (demoVars.length > 0) {
    let demoHtml = `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
      <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">👤 Thống kê nhân khẩu học</span></div>`;
    demoVars.forEach(dv => {
      const counts = {}; let total = 0;
      const demoLabels = dv.customValues || ['Giá trị 1', 'Giá trị 2'];
      rawRows.forEach(r => { const v = r[dv.name]; if (v != null) { counts[v] = (counts[v]||0)+1; total++; } });
      const keys = Object.keys(counts).map(k => parseInt(k)).filter(k => !isNaN(k)).sort((a,b) => a-b);
      demoHtml += `<div style="margin-top:.5rem;font-size:.8rem;font-weight:600">${dv.label} (${dv.name}) — Mã: ${demoLabels.map((l,i)=>`${i+1}=${l}`).join(', ')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:start;margin-top:.25rem">
        <div style="flex-shrink:0"><table style="font-size:.75rem;border-collapse:collapse">
          <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.25rem .5rem">Mã</td><td style="padding:.25rem .5rem">Nhóm</td><td style="padding:.25rem .5rem;text-align:center">N</td><td style="padding:.25rem .5rem;text-align:center">%</td></tr>`;
      keys.forEach((k, li) => {
        const c = counts[k]; const p = total>0 ? (c/total*100) : 0;
        const l = demoLabels[k-1] || `Nhóm ${k}`;
        demoHtml += `<tr><td style="padding:.15rem .5rem;border-bottom:1px solid var(--gray-100);text-align:center;font-weight:600">${k}</td>
          <td style="padding:.15rem .5rem;border-bottom:1px solid var(--gray-100)"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${demoColors[li%demoColors.length]};margin-right:.35rem;vertical-align:middle"></span>${l}</td>
          <td style="padding:.15rem .5rem;text-align:center;border-bottom:1px solid var(--gray-100)">${c}</td>
          <td style="padding:.15rem .5rem;text-align:center;border-bottom:1px solid var(--gray-100)">${p.toFixed(1)}%</td></tr>`;
      });
      demoHtml += `</table></div>
        <div>${pieChartSVG(keys.map(k=>(demoLabels[k-1]||`Nhóm ${k}`)), keys.map(k=>counts[k]), total, 160, 120)}</div></div>`;
    });

    const twoGroupVars = demoVars.filter(dv => {
      const vals = new Set(); rawRows.forEach(r => { const v = r[dv.name]; if (v != null) vals.add(v); });
      return vals.size === 2;
    });
    if (twoGroupVars.length > 0 && constructKeys.length > 0) {
      demoHtml += `<div style="margin-top:.75rem;font-size:.75rem">
        <div style="font-weight:600;color:var(--gray-700);margin-bottom:.25rem">📊 Independent Sample t-test (so sánh trung bình theo nhóm)</div>`;
      twoGroupVars.forEach(dv => {
        const groups = {}; rawRows.forEach(r => { const v = r[dv.name]; if (v != null) { if (!groups[v]) groups[v]=[]; } });
        const grpLabels = Object.keys(groups).sort((a,b) => a-b);
        const grp1 = grpLabels[0], grp2 = grpLabels[1];
        const demoLabels = dv.customValues || [];
        const grp1Name = demoLabels[parseInt(grp1)-1] || `Nhóm ${grp1}`;
        const grp2Name = demoLabels[parseInt(grp2)-1] || `Nhóm ${grp2}`;
        constructKeys.forEach(ck => {
          const items = constructs[ck].map(v => v.name);
          const g1vals = [], g2vals = [];
          rawRows.forEach(r => {
            const g = r[dv.name];
            if (g == null) return;
            let sum=0,cnt=0;
            items.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){sum+=v;cnt++;}});
            const cs = cnt>0 ? sum/cnt : null;
            if (cs === null) return;
            if (g === grp1) g1vals.push(cs);
            else if (g === grp2) g2vals.push(cs);
          });
          if (g1vals.length < 2 || g2vals.length < 2) return;
          const tt = independentTTest(g1vals, g2vals, grp1, grp2);
          if (!tt) return;
          const label = constructs[ck][0]?.constructLabel || ck;
          const effSizeStr = tt.cohensD >= 0.8 ? 'Lớn' : tt.cohensD >= 0.5 ? 'Trung bình' : tt.cohensD >= 0.2 ? 'Nhỏ' : 'Không đáng kể';
          demoHtml += `<div style="background:#fff;padding:.4rem .6rem;border-radius:6px;border:1px solid var(--gray-200);margin-top:.3rem">
            <div style="font-weight:600;color:var(--primary);margin-bottom:.2rem">${label} × ${dv.label}</div>
            <table style="width:100%;border-collapse:collapse;font-size:.7rem">
              <tr style="background:var(--gray-100)">
                <td style="padding:.15rem .4rem;font-weight:600">Nhóm</td><td style="padding:.15rem .4rem;text-align:center">N</td>
                <td style="padding:.15rem .4rem;text-align:center">TB</td><td style="padding:.15rem .4rem;text-align:center">ĐLC</td></tr>
              <tr><td style="padding:.1rem .4rem">${grp1} (${grp1Name})</td>
                <td style="padding:.1rem .4rem;text-align:center">${tt.n1}</td>
                <td style="padding:.1rem .4rem;text-align:center;font-weight:600">${tt.m1.toFixed(2)}</td>
                <td style="padding:.1rem .4rem;text-align:center">${Math.sqrt(tt.v1).toFixed(3)}</td></tr>
              <tr style="background:var(--gray-50)"><td style="padding:.1rem .4rem">${grp2} (${grp2Name})</td>
                <td style="padding:.1rem .4rem;text-align:center">${tt.n2}</td>
                <td style="padding:.1rem .4rem;text-align:center;font-weight:600">${tt.m2.toFixed(2)}</td>
                <td style="padding:.1rem .4rem;text-align:center">${Math.sqrt(tt.v2).toFixed(3)}</td></tr>
            </table>
            <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.2rem;font-size:.65rem">
              <span>Levene: F=${tt.fLevene.toFixed(3)} (p=${tt.leveneP.toFixed(4)}) → ${tt.equalVarAssumed?'Phương sai bằng nhau':'Phương sai khác nhau'}</span>
              <span style="font-weight:700">t(${tt.df.toFixed(1)}) = ${tt.tStat.toFixed(3)}</span>
              <span style="color:${tt.pVal<0.05?'#10b981':'#ef4444'};font-weight:600">p = ${tt.pVal.toFixed(4)}${tt.pVal<0.05?' ✅ (có ý nghĩa)':' (không ý nghĩa)'}</span>
              <span>Cohen's d = ${tt.cohensD.toFixed(3)} (${effSizeStr})</span>
            </div>
          </div>`;
        });
      });
      demoHtml += `</div>`;
    }
    demoHtml += `</div>`;
    html += demoHtml;
  }

  function pieChartSVG(labels, counts, total, w, h) {
    const cx = w*0.4, cy = h/2, r = Math.min(w*0.35, h*0.45);
    let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
    let a0 = -Math.PI/2;
    counts.forEach((c, i) => {
      const angle = (c/total)*2*Math.PI;
      const a1 = a0 + angle;
      const x1 = cx + r*Math.cos(a0), y1 = cy + r*Math.sin(a0);
      const x2 = cx + r*Math.cos(a1), y2 = cy + r*Math.sin(a1);
      const large = angle > Math.PI ? 1 : 0;
      if (c > 0) {
        svg += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${demoColors[i%demoColors.length]}" stroke="#fff" stroke-width="1"/>`;
      }
      a0 = a1;
    });
    let ly = 10;
    labels.forEach((l, i) => {
      svg += `<rect x="${w*0.7}" y="${ly}" width="8" height="8" rx="1" fill="${demoColors[i%demoColors.length]}"/><text x="${w*0.7+12}" y="${ly+7}" font-size="7" fill="#374151">${l} (${((counts[i]/total)*100).toFixed(0)}%)</text>`;
      ly += 16;
    });
    svg += '</svg>';
    return svg;
  }

  constructKeys.forEach(key => {
    const items = constructs[key].map(v => v.name);
    const role = constructs[key][0]?.role || '';
    const label = constructs[key][0]?.constructLabel || key;

    const scoreMatrix = items.map(name => rawRows.map(r => {
      const v = r[name]; return (typeof v === 'number' && !isNaN(v)) ? v : null;
    }));
    const validRows = [];
    for (let i = 0; i < n; i++) { if (scoreMatrix.every(col => col[i] !== null)) validRows.push(i); }
    const m = validRows.length;
    if (m < 3) { html += `<div style="padding:.5rem;background:#fef2f2;border-radius:var(--radius);margin-bottom:.5rem"><strong>${label}</strong> — Không đủ dữ liệu</div>`; return; }

    const itemStats = items.map((name, idx) => {
      const vals = validRows.map(i => scoreMatrix[idx][i]);
      const mean = vals.reduce((a,b) => a+b, 0) / vals.length;
      const var_ = vals.reduce((a,b) => a + (b-mean)**2, 0) / vals.length;
      return { name, mean, sd: Math.sqrt(var_) };
    });

    const k = items.length;
    const covM = [], corrM = [];
    for (let i = 0; i < k; i++) {
      covM[i] = []; corrM[i] = [];
      for (let j = 0; j < k; j++) {
        let cov = 0; validRows.forEach(ri => cov += (scoreMatrix[i][ri]-itemStats[i].mean)*(scoreMatrix[j][ri]-itemStats[j].mean)); cov /= m;
        covM[i][j] = cov;
        corrM[i][j] = itemStats[i].sd>0&&itemStats[j].sd>0 ? cov/(itemStats[i].sd*itemStats[j].sd) : 0;
      }
    }

    let sumCorr = 0, corrCount = 0;
    for (let i = 0; i < k; i++) for (let j = i+1; j < k; j++) { sumCorr += corrM[i][j]; corrCount++; }
    const avgCorr = corrCount > 0 ? sumCorr / corrCount : 0;

    let sumVar = 0, totalVar = 0;
    for (let i = 0; i < k; i++) sumVar += covM[i][i];
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) totalVar += covM[i][j];
    const alpha = totalVar > 0 ? (k / (k - 1)) * (1 - sumVar / totalVar) : 0;

    const itemTotalCorr = items.map((name, idx) => {
      const itemScores = validRows.map(ri => scoreMatrix[idx][ri]);
      const totalScores = validRows.map(ri => items.reduce((a, n, j) => a + (j===idx?0:scoreMatrix[j][ri]||0), 0));
      const mI = itemScores.reduce((a,b)=>a+b,0)/m;
      const mT = totalScores.reduce((a,b)=>a+b,0)/m;
      const sdI = Math.sqrt(itemScores.reduce((a,b)=>a+(b-mI)**2,0)/m);
      const sdT = Math.sqrt(totalScores.reduce((a,b)=>a+(b-mT)**2,0)/m);
      const covIT = itemScores.reduce((a,b,i)=>a+(b-mI)*(totalScores[i]-mT),0)/m;
      return sdI>0&&sdT>0 ? covIT/(sdI*sdT) : 0;
    });

    const corrForKMO = items.map((_, i) => items.map((__, j) => corrM[i][j]));
    const pc = firstPC(corrForKMO);
    const itemLoading = pc.vector.map((_, i) => pc.loadings[i]);
    const avgLoading = itemLoading.reduce((a, b) => a + Math.abs(b), 0) / k;
    const ave = itemLoading.reduce((a, b) => a + b * b, 0) / k;

    const kmo = computeKMO(corrForKMO);
    const bartlett = bartlettTest(corrForKMO, m);
    const eig = pc.eigval;
    const tve = k > 0 ? Math.min(1, eig / k) : 0;

    const itemSkew = items.map((name, idx) => skewness(validRows.map(ri => scoreMatrix[idx][ri])));
    const itemKurt = items.map((name, idx) => kurtosis(validRows.map(ri => scoreMatrix[idx][ri])));

    const alphaSuspicious = alpha > 0.95;
    const bartlettSig = bartlett.p < 0.05;
    const eigTarget = eig > 1;

    if (clr(alpha, 0.80, 0.95, 0.60, 0.95) === '#ef4444') { allPass = false; warnings.push(`${label}: α=${alpha.toFixed(3)} < 0.6`); }
    if (kmo < 0.5) warnings.push(`${label}: KMO=${kmo.toFixed(3)} < 0.5`);

    html += `<div class="var-item" style="margin-bottom:.5rem">
      <div class="var-item-header">
        <div>
          <span class="var-item-name">${label}</span>
          <span style="font-size:.75rem;color:${roleColor[role]||'#666'};font-weight:600;margin-left:.5rem">${roleLabels[role]||''}</span>
          <span class="var-item-type" style="margin-left:.5rem">${k} items</span>
          ${alphaSuspicious ? '<span style="color:#dc2626;font-size:.7rem;margin-left:.5rem">⚠️ α > 0.95 (đáng nghi)</span>' : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.5rem;margin-top:.5rem">
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(alpha,0.80,0.95,0.60,0.95)}">${alpha.toFixed(3)}
            <span class="adjust-group"><button class="cell-adjust-btn up" data-adjust="alpha" data-key="${key}" data-delta="0.03" title="Tăng α">+</button><button class="cell-adjust-btn down" data-adjust="alpha" data-key="${key}" data-delta="-0.03" title="Giảm α">−</button></span>
          </div>
          <div style="font-size:.7rem;color:var(--gray-500)">α Cronbach ≥ 0.6</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(avgCorr,0.30,0.80,0.20,0.88)}">${avgCorr.toFixed(3)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">r̅ Inter-item [0.20;0.88]</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(avgLoading,0.50,0.95,0.50,0.95)}">${avgLoading.toFixed(3)}
            <span class="adjust-group"><button class="cell-adjust-btn up" data-adjust="loading" data-key="${key}" data-delta="0.04" title="Tăng loading">+</button><button class="cell-adjust-btn down" data-adjust="loading" data-key="${key}" data-delta="-0.04" title="Giảm loading">−</button></span>
          </div>
          <div style="font-size:.7rem;color:var(--gray-500)">λ̅ Loading ≥ 0.5</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(ave,0.40,Infinity,0.30,Infinity)}">${ave.toFixed(3)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">AVE ≥ 0.30</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(kmo,0.50,1.0,0.50,1.0)}">${kmo.toFixed(3)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">KMO ≥ 0.5</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.1rem;font-weight:700;color:${bartlettSig?'#10b981':'#ef4444'}">${bartlett.chiSq.toFixed(1)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">Bartlett χ² ${bartlettSig?'p<0.05 ✅':'p≥0.05'}</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${eigTarget?'#10b981':'#ef4444'}">${eig.toFixed(3)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">Eigenvalue ${eigTarget?'>1 ✅':'<1'}</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(tve,0.50,1.0,0.50,1.0)}">${(tve*100).toFixed(1)}%</div>
          <div style="font-size:.7rem;color:var(--gray-500)">TVE ≥ 50%</div>
        </div>
      </div>
      <div style="margin-top:.4rem;font-size:.75rem;border-top:1px solid var(--gray-100);padding-top:.35rem">`;

    html += `<div style="margin-bottom:.2rem"><strong>λ Factor Loading (≥ 0.5):</strong> `;
    items.forEach((name, idx) => {
      const l = itemLoading[idx];
      html += `<span style="margin-right:.6rem;color:${clr(l,0.50,0.95,0.50,0.95)}">${name}=${l.toFixed(3)}</span>`;
    });
    html += `</div>`;

    html += `<div style="margin-bottom:.2rem"><strong>Corrected Item-Total r (≥ 0.3):</strong> `;
    items.forEach((name, idx) => {
      const r = itemTotalCorr[idx];
      html += `<span style="margin-right:.6rem;color:${clr(r,0.30,0.88,0.30,0.92)}">${name}=${r.toFixed(3)}</span>`;
    });
    html += `</div>`;

    html += `<div style="margin-bottom:.2rem"><strong>Skewness [±1.5]; Kurtosis [±3]:</strong> `;
    items.forEach((name, idx) => {
      const s = itemSkew[idx];
      html += `<span style="margin-right:.6rem;color:${clr(Math.abs(s),0,1.5,0,3)}">Skew ${name}=${s.toFixed(3)}</span>`;
    });
    html += `| `;
    items.forEach((name, idx) => {
      const k2 = itemKurt[idx];
      html += `<span style="margin-right:.6rem;color:${clr(Math.abs(k2),0,3,0,5)}">Kurt ${name}=${k2.toFixed(3)}</span>`;
    });
    html += `</div>`;

    html += `<div><strong>Mean [2.8–4.5]; SD [0.5–1.5]:</strong> `;
    itemStats.forEach(s => {
      const mC = clr(s.mean, 2.8, 4.5, 2.5, 4.8);
      const sdC = clr(s.sd, 0.5, 1.5, 0.3, 1.8);
      html += `<span style="margin-right:.6rem">${s.name}: M=${s.mean.toFixed(2)} <span style="color:${mC}">●</span> SD=${s.sd.toFixed(3)} <span style="color:${sdC}">●</span></span>`;
    });
    html += `</div>`;

    html += `</div></div>`;
  });

  const allItemNames = [];
  constructKeys.forEach(k => {
    constructs[k].forEach(v => {
      if (v.type === 'likert5' || v.type === 'likert7') allItemNames.push(v.name);
    });
  });
  if (allItemNames.length >= 3) {
    const validRows = [];
    for (let i = 0; i < n; i++) {
      if (allItemNames.every(name => typeof rawRows[i][name] === 'number' && !isNaN(rawRows[i][name]))) validRows.push(i);
    }
    const m = validRows.length;
    if (m >= 30) {
      const k2 = allItemNames.length;
      const R = corrMatrixFromData(validRows.map(ri => { const o = {}; allItemNames.forEach(n => { o[n] = rawRows[ri][n]; }); return o; }), allItemNames);
      const pca = firstPC(R);
      const tve = pca.eigval / k2;
      const cmbPass = tve < 0.50;
      html += `<div class="var-item" style="margin-bottom:.5rem;background:${cmbPass?'#f0fdf4':'#fef2f2'};border-color:${cmbPass?'#86efac':'#fca5a5'}">
        <div style="font-size:.85rem;font-weight:600;margin-bottom:.25rem">🧪 Common Method Bias — Harman Single-Factor Test</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.5rem">
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:${pca.eigval > 1 ? '#10b981' : '#ef4444'}">${pca.eigval.toFixed(3)}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">Eigenvalue (PC1)</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:${cmbPass?'#10b981':'#ef4444'}">${(tve*100).toFixed(1)}%</div>
            <div style="font-size:.7rem;color:var(--gray-500)">Phương sai trích PC1 ${cmbPass?'< 50% ✅':'≥ 50% ⚠️'}</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--gray-700)">${k2}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">Tổng số items</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--gray-700)">${m}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">Số quan sát</div>
          </div>
        </div>
        <div style="margin-top:.35rem;font-size:.75rem;color:${cmbPass?'#166534':'#991b1b'};font-weight:500;text-align:center">
          ${cmbPass ? '✅ Không có Common Method Bias — phương sai trích PC1 < 50%.' : '⚠️ Có thể tồn tại Common Method Bias — phương sai trích PC1 ≥ 50%. Cần kiểm tra thêm.'}
        </div>
      </div>`;
    }
  }

  const nonDemoKeys = constructKeys.filter(k => constructs[k][0]?.role !== 'moderating');
  if (nonDemoKeys.length > 1) {
    const compScores = {};
    nonDemoKeys.forEach(k => {
      const its = constructs[k].map(v => v.name);
      compScores[k] = rawRows.map(r => {
        let sum = 0, cnt = 0;
        its.forEach(n => { const v = r[n]; if (typeof v === 'number' && !isNaN(v)) { sum += v; cnt++; } });
        return cnt > 0 ? sum / cnt : null;
      });
    });
    const valid = [];
    for (let i = 0; i < n; i++) { if (nonDemoKeys.every(k => compScores[k][i] !== null)) valid.push(i); }
    const m = valid.length;
    if (m > 3) {
      const R = corrMatrixFromData(valid.map(ri => { const o = {}; nonDemoKeys.forEach(k => { o[k] = compScores[k][ri]; }); return o; }), nonDemoKeys);
      html += `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
        <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">📊 Ma trận tương quan giữa các nhân tố (Mean-based Pearson)</span></div>
        <div style="overflow-x:auto;font-size:.75rem;margin-top:.35rem"><table style="width:100%;border-collapse:collapse">
          <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.3rem .5rem">Nhân tố</td>${nonDemoKeys.map(k => `<td style="padding:.3rem .5rem;text-align:center">${k}</td>`).join('')}<td style="padding:.3rem .5rem;text-align:center">Mean</td><td style="padding:.3rem .5rem;text-align:center">SD</td></tr>`;
      const means = nonDemoKeys.map(k => compScores[k].reduce((a, v) => a + v, 0) / m);
      const sds = nonDemoKeys.map((k, i) => Math.sqrt(compScores[k].reduce((a, v) => a + (v - means[i]) ** 2, 0) / m));
      nonDemoKeys.forEach((ki, i) => {
        html += `<tr${i%2===1?' style="background:var(--gray-50)"':''}><td style="padding:.3rem .5rem;font-weight:600">${ki}</td>`;
        nonDemoKeys.forEach((kj, j) => {
          const r = R[i][j];
          const sig = m > 2 ? (Math.abs(r) * Math.sqrt(m - 2) / Math.sqrt(1 - r * r)) : 0;
          const pVal = 2 * (1 - 0.5 * (1 + erf(Math.abs(sig) / Math.SQRT2)));
          const pPass = pVal < 0.05;
          html += `<td style="padding:.3rem .5rem;text-align:center;color:${clr(Math.abs(r),0.25,0.85,0.15,0.92)}">${r.toFixed(3)}${pPass?'*':''}</td>`;
        });
        html += `<td style="padding:.3rem .5rem;text-align:center">${means[i].toFixed(2)}</td>`;
        html += `<td style="padding:.3rem .5rem;text-align:center">${sds[i].toFixed(3)}</td></tr>`;
      });
      html += `<tr style="font-size:.65rem;color:var(--gray-400)"><td></td>${nonDemoKeys.map(() => '<td style="text-align:center">* p<.05</td>').join('')}<td></td><td></td></tr>`;
      html += `</table></div></div>`;

      if (nonDemoKeys.length > 1) {
        const sqrtAve = {};
        nonDemoKeys.forEach(k => {
          const its = constructs[k].map(v => v.name);
          const scoreMatrix = its.map(name => rawRows.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
          const validRows = [];
          for (let i = 0; i < n; i++) { if (scoreMatrix.every(col => col[i] !== null)) validRows.push(i); }
          const m = validRows.length;
          if (m < 3) { sqrtAve[k] = 0; return; }
          const itemStats = its.map((name, idx) => {
            const vals = validRows.map(i => scoreMatrix[idx][i]);
            const mean = vals.reduce((a,b)=>a+b,0)/m;
            return { name, mean };
          });
          const corrM = [];
          for (let i = 0; i < its.length; i++) {
            corrM[i]=[];
            for (let j = 0; j < its.length; j++) {
              let cov = 0;
              validRows.forEach(ri => cov += (scoreMatrix[i][ri]-itemStats[i].mean)*(scoreMatrix[j][ri]-itemStats[j].mean));
              cov /= m;
              const sdi = Math.sqrt(scoreMatrix[i].reduce((a,b,ri2)=>a+(b-itemStats[i].mean)**2,0)/m);
              const sdj = Math.sqrt(scoreMatrix[j].reduce((a,b,ri2)=>a+(b-itemStats[j].mean)**2,0)/m);
              corrM[i][j] = sdi>0&&sdj>0 ? cov/(sdi*sdj) : 0;
            }
          }
          const pc = firstPC(corrM);
          const loadings = pc.loadings;
          const ave = loadings.reduce((a,b)=>a+b*b,0)/its.length;
          sqrtAve[k] = Math.sqrt(Math.max(0, ave));
        });
        let flHtml = `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
          <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">🔷 Fornell-Larcker — Phân biệt giữa các nhân tố</span>
          <span style="font-size:.7rem;color:var(--gray-500)">(Chéo: tương quan; Chéo đậm: √AVE > tương quan → đạt)</span></div>
          <div style="overflow-x:auto;font-size:.75rem;margin-top:.35rem"><table style="width:100%;border-collapse:collapse">
          <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.3rem .5rem">Nhân tố</td>${nonDemoKeys.map(k => `<td style="padding:.3rem .5rem;text-align:center">${k}</td>`).join('')}</tr>`;
        nonDemoKeys.forEach((ki, i) => {
          flHtml += `<tr${i%2===1?' style="background:var(--gray-50)"':''}><td style="padding:.3rem .5rem;font-weight:600">${ki}</td>`;
          nonDemoKeys.forEach((kj, j) => {
            if (i === j) {
              const val = sqrtAve[ki] || 0;
              const pass = val > Math.max(...nonDemoKeys.map((k2, k2i) => k2i !== i ? Math.abs(R[i][k2i]) : 0));
              flHtml += `<td style="padding:.3rem .5rem;text-align:center;font-weight:700;background:${pass?'#d1fae5':'#fef3c7'};color:${pass?'#065f46':'#92400e'}">${val.toFixed(3)}</td>`;
            } else {
              const r = R[i][j];
              flHtml += `<td style="padding:.3rem .5rem;text-align:center;color:${Math.abs(r) > (sqrtAve[ki]||0) ? '#ef4444' : '#6b7280'}">${r.toFixed(3)}</td>`;
            }
          });
          flHtml += `</tr>`;
        });
        flHtml += `</table></div></div>`;
        html += flHtml;
      }

      if (nonDemoKeys.length > 1) {
        const htmtMatrix = Array.from({length:nonDemoKeys.length}, () => Array(nonDemoKeys.length).fill(0));
        for (let a = 0; a < nonDemoKeys.length; a++) {
          for (let b = a+1; b < nonDemoKeys.length; b++) {
            const ka = nonDemoKeys[a], kb = nonDemoKeys[b];
            const itemsA = constructs[ka].map(v => v.name);
            const itemsB = constructs[kb].map(v => v.name);
            const validRows = [];
            for (let i = 0; i < n; i++) {
              let ok = true;
              itemsA.forEach(n => { if (rawRows[i][n] == null || isNaN(rawRows[i][n])) ok = false; });
              itemsB.forEach(n => { if (rawRows[i][n] == null || isNaN(rawRows[i][n])) ok = false; });
              if (ok) validRows.push(i);
            }
            if (validRows.length < 10) continue;
            const m = validRows.length;
            let sumMonoA = 0, monoCountA = 0;
            for (let i = 0; i < itemsA.length; i++) {
              for (let j = i+1; j < itemsA.length; j++) {
                let cov = 0, s1=0, s2=0, m1=0, m2=0;
                validRows.forEach(ri => { m1 += rawRows[ri][itemsA[i]]; m2 += rawRows[ri][itemsA[j]]; });
                m1/=m; m2/=m;
                validRows.forEach(ri => { const d1=rawRows[ri][itemsA[i]]-m1, d2=rawRows[ri][itemsA[j]]-m2; cov+=d1*d2; s1+=d1*d1; s2+=d2*d2; });
                const r = Math.sqrt(s1*s2)>0 ? cov/Math.sqrt(s1*s2) : 0;
                sumMonoA += r; monoCountA++;
              }
            }
            let sumMonoB = 0, monoCountB = 0;
            for (let i = 0; i < itemsB.length; i++) {
              for (let j = i+1; j < itemsB.length; j++) {
                let cov=0, s1=0, s2=0, m1=0, m2=0;
                validRows.forEach(ri => { m1 += rawRows[ri][itemsB[i]]; m2 += rawRows[ri][itemsB[j]]; });
                m1/=m; m2/=m;
                validRows.forEach(ri => { const d1=rawRows[ri][itemsB[i]]-m1, d2=rawRows[ri][itemsB[j]]-m2; cov+=d1*d2; s1+=d1*d1; s2+=d2*d2; });
                const r = Math.sqrt(s1*s2)>0 ? cov/Math.sqrt(s1*s2) : 0;
                sumMonoB += r; monoCountB++;
              }
            }
            const avgMonoA = monoCountA > 0 ? sumMonoA/monoCountA : 0;
            const avgMonoB = monoCountB > 0 ? sumMonoB/monoCountB : 0;
            let sumHetero = 0, heteroCount = 0;
            for (let i = 0; i < itemsA.length; i++) {
              for (let j = 0; j < itemsB.length; j++) {
                let cov=0, s1=0, s2=0, m1=0, m2=0;
                validRows.forEach(ri => { m1 += rawRows[ri][itemsA[i]]; m2 += rawRows[ri][itemsB[j]]; });
                m1/=m; m2/=m;
                validRows.forEach(ri => { const d1=rawRows[ri][itemsA[i]]-m1, d2=rawRows[ri][itemsB[j]]-m2; cov+=d1*d2; s1+=d1*d1; s2+=d2*d2; });
                const r = Math.sqrt(s1*s2)>0 ? cov/Math.sqrt(s1*s2) : 0;
                sumHetero += r; heteroCount++;
              }
            }
            const avgHetero = heteroCount > 0 ? sumHetero/heteroCount : 0;
            const denominator = Math.sqrt(avgMonoA * avgMonoB);
            htmtMatrix[a][b] = htmtMatrix[b][a] = denominator > 0 ? avgHetero/denominator : 0;
          }
        }
        let htmtHtml = `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
          <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">🔗 HTMT — Heterotrait-Monotrait Ratio</span>
          <span style="font-size:.7rem;color:var(--gray-500)">HTMT &lt; 0.85 (strict) hoặc &lt; 0.90 (mềm) → đạt phân biệt</span></div>
          <div style="overflow-x:auto;font-size:.75rem;margin-top:.35rem"><table style="width:100%;border-collapse:collapse">
          <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.3rem .5rem">Cặp nhân tố</td><td style="padding:.3rem .5rem;text-align:center">HTMT</td><td style="padding:.3rem .5rem;text-align:center">Đạt 0.85</td><td style="padding:.3rem .5rem;text-align:center">Đạt 0.90</td></tr>`;
        for (let a = 0; a < nonDemoKeys.length; a++) {
          for (let b = a+1; b < nonDemoKeys.length; b++) {
            const htmt = htmtMatrix[a][b];
            const pass85 = htmt < 0.85;
            const pass90 = htmt < 0.90;
            htmtHtml += `<tr${(a+b)%2===0?' style="background:var(--gray-50)"':''}>
              <td style="padding:.3rem .5rem;font-weight:600">${nonDemoKeys[a]} ↔ ${nonDemoKeys[b]}</td>
              <td style="padding:.3rem .5rem;text-align:center;font-weight:700;color:${pass85?'#10b981':pass90?'#d97706':'#ef4444'}">${htmt.toFixed(3)}</td>
              <td style="padding:.3rem .5rem;text-align:center;color:${pass85?'#10b981':'#ef4444'}">${pass85?'✅':'❌'}</td>
              <td style="padding:.3rem .5rem;text-align:center;color:${pass90?'#10b981':'#ef4444'}">${pass90?'✅':'❌'}</td></tr>`;
          }
        }
        htmtHtml += `</table></div></div>`;
        html += htmtHtml;
      }
    }
  }

  const dvConstructs = constructKeys.filter(k => constructs[k][0]?.role === 'dependent');
  if (dvConstructs.length > 0) {
    dvConstructs.forEach(dvKey => {
      const ivConstructs = constructKeys.filter(k => constructs[k][0]?.role === 'independent');
      const medConstructs = constructKeys.filter(k => constructs[k][0]?.role === 'mediating');
      const modConstructs = constructKeys.filter(k => constructs[k][0]?.role === 'moderating');
      const predictors = [...ivConstructs, ...medConstructs, ...modConstructs];
      if (predictors.length === 0) return;

      const compScores = {};
      [...predictors, dvKey].forEach(k => {
        const its = constructs[k].map(v => v.name);
        compScores[k] = rawRows.map(r => {
          let sum = 0, cnt = 0;
          its.forEach(n => { const v = r[n]; if (typeof v === 'number' && !isNaN(v)) { sum += v; cnt++; } });
          return cnt > 0 ? sum / cnt : null;
        });
      });

      const dv = compScores[dvKey];
      const valid = [];
      for (let i = 0; i < n; i++) {
        if (dv[i] !== null && predictors.every(p => compScores[p][i] !== null)) valid.push(i);
      }
      const m2 = valid.length;
      if (m2 <= predictors.length + 5) return;

      const y = valid.map(idx => dv[idx]);
      const yMean = y.reduce((a,b)=>a+b,0)/m2;
      const ySd = Math.sqrt(y.reduce((a,b)=>a+(b-yMean)**2,0)/m2);
      const xMean = predictors.map(p => valid.reduce((a,i)=>a+compScores[p][i],0)/m2);
      const xSd = predictors.map(p => Math.sqrt(valid.reduce((a,i)=>a+(compScores[p][i]-xMean[predictors.indexOf(p)])**2,0)/m2));
      const R = corrMatrixFromData(valid.map(i=>{const o={__dv__:dv[i]};predictors.forEach(p=>{o[p]=compScores[p][i];});return o;}),['__dv__',...predictors]);
      const rY = predictors.map((_,j)=>R[0][j+1]);
      const Rxx = predictors.map((_,i)=>predictors.map((_,j)=>R[i+1][j+1]));
      let RxxInv = matInverse(Rxx);
      if (!RxxInv) { const lam=1e-8*predictors.length; RxxInv=matInverse(Rxx.map((r,i)=>r.map((v,j)=>i===j?v+lam:v))); }
      let stdBeta=[], rSquared=0;
      if (RxxInv) { stdBeta=RxxInv.map(r=>r.reduce((a,v,j)=>a+v*rY[j],0)); rSquared=stdBeta.reduce((a,b,j)=>a+b*rY[j],0); }
      if (rSquared<0) rSquared=0; if (rSquared>1) rSquared=1;
      const rawBeta = [yMean - stdBeta.reduce((a,b,j)=>a+b*ySd*xMean[j]/(xSd[j]||1),0)];
      predictors.forEach((_,j)=>rawBeta.push(xSd[j]>0?stdBeta[j]*ySd/xSd[j]:0));
      const yHat = valid.map(i=>rawBeta[0]+predictors.reduce((a,p,j)=>a+rawBeta[j+1]*compScores[p][i],0));
      const residuals = valid.map((i,ri)=>dv[i]-yHat[ri]);
      const ssRes = residuals.reduce((a,r)=>a+r*r,0);
      const ssTot = y.reduce((a,yi)=>a+(yi-yMean)**2,0);
      if (rSquared<=0&&ssTot>0) rSquared=Math.max(0,1-ssRes/ssTot);
      const adjRSq = 1-(1-rSquared)*(m2-1)/(m2-predictors.length-1);
      const dw = durbinWatson(residuals);

      const mse = Math.max(ssRes/(m2-predictors.length-1),1e-10);
      const se = predictors.map((_,j)=>RxxInv?Math.sqrt(mse*RxxInv[j][j]/(m2-1)*ySd*ySd/(xSd[j]*xSd[j]||1)):1);
      const tStat = predictors.map((_,j)=>se[j]>0?rawBeta[j+1]/se[j]:0);
      const pValue = tStat.map(t=>{const z=Math.abs(t);return 2*(1-0.5*(1+erf(z/Math.SQRT2)));});

      const vif = predictors.map((_, j) => RxxInv ? RxxInv[j][j] : 10);
      const tolerance = vif.map(v => 1 / v);

      const ssReg = ssTot - ssRes;
      const dfReg = predictors.length;
      const dfRes = m2 - predictors.length - 1;
      const dfTot = m2 - 1;
      const msReg = ssReg / dfReg;
      const msRes = mse;
      const fStat = msRes > 0 ? msReg / msRes : 0;
      const fPValue = computeFPValue(fStat, dfReg, dfRes);

      _regressionResults = {
        dvKey: dvKey,
        rSquared: rSquared,
        adjRSq: adjRSq,
        fStat: fStat,
        fSig: fPValue,
        paths: {}
      };
      predictors.forEach((p, idx) => {
        _regressionResults.paths[p] = {
          stdBeta: stdBeta[idx],
          pValue: pValue[idx],
          sig: pValue[idx] < 0.05
        };
      });

      const adjDiff = Math.abs(rSquared - adjRSq);
      const rSqSuspicious = rSquared > 0.85;
      const fSigPass = fPValue < 0.05;

      html += `<div class="var-item" style="margin-bottom:.5rem;background:#f0fdf4;border-color:#86efac">
        <div style="font-size:.85rem;font-weight:600;margin-bottom:.25rem">
          📈 Hồi quy — ${constructs[dvKey][0]?.constructLabel || dvKey}
          ${rSqSuspicious ? '<span style="color:#dc2626;font-size:.7rem;margin-left:.5rem">⚠️ R² > 0.85 (đáng nghi)</span>' : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.5rem;margin-bottom:.4rem">
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:${clr(rSquared,0.50,1.0,0.50,1.0)}">${rSquared.toFixed(3)}
              <span class="adjust-group"><button class="cell-adjust-btn up" data-adjust="rsq" data-delta="0.03" title="Tăng R²">+</button><button class="cell-adjust-btn down" data-adjust="rsq" data-delta="-0.03" title="Giảm R²">−</button></span>
            </div>
            <div style="font-size:.7rem;color:var(--gray-500)">R² ≥ 0.50</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:${clr(adjDiff,0,0.05,0,0.08)}">${adjRSq.toFixed(3)}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">R²ₐdj (chênh ${adjDiff.toFixed(3)})</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:${clr(dw,1.5,2.5,1.3,2.7)}">${dw.toFixed(3)}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">DW [1.5;2.5]</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--gray-700)">${m2}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">Số quan sát</div>
          </div>
        </div>`;

      html += `<div style="margin-top:.4rem;font-size:.75rem"><strong>📋 ANOVA (F-test)</strong></div>
      <div style="overflow-x:auto;font-size:.75rem;margin-top:.2rem"><table style="width:100%;border-collapse:collapse">
        <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.25rem .5rem">Nguồn</td>
        <td style="padding:.25rem .5rem;text-align:center">SS</td><td style="padding:.25rem .5rem;text-align:center">df</td>
        <td style="padding:.25rem .5rem;text-align:center">MS</td><td style="padding:.25rem .5rem;text-align:center">F</td>
        <td style="padding:.25rem .5rem;text-align:center">Sig.</td></tr>
        <tr><td style="padding:.2rem .5rem">Hồi quy</td>
          <td style="padding:.2rem .5rem;text-align:center">${ssReg.toFixed(3)}</td><td style="padding:.2rem .5rem;text-align:center">${dfReg}</td>
          <td style="padding:.2rem .5rem;text-align:center">${msReg.toFixed(3)}</td>
          <td style="padding:.2rem .5rem;text-align:center;font-weight:700">${fStat.toFixed(3)}</td>
          <td style="padding:.2rem .5rem;text-align:center;color:${fSigPass?'#10b981':'#ef4444'};font-weight:600">${fPValue.toFixed(4)}${fSigPass?' ✅':''}</td></tr>
        <tr style="background:var(--gray-50)"><td style="padding:.2rem .5rem">Phần dư</td>
          <td style="padding:.2rem .5rem;text-align:center">${ssRes.toFixed(3)}</td><td style="padding:.2rem .5rem;text-align:center">${dfRes}</td>
          <td style="padding:.2rem .5rem;text-align:center">${msRes.toFixed(3)}</td><td></td><td></td></tr>
        <tr><td style="padding:.2rem .5rem;font-weight:600">Tổng</td>
          <td style="padding:.2rem .5rem;text-align:center;font-weight:600">${ssTot.toFixed(3)}</td><td style="padding:.2rem .5rem;text-align:center">${dfTot}</td><td></td><td></td><td></td></tr>
      </table></div>`;

      html += `<div style="margin-top:.4rem;font-size:.75rem"><strong>📊 Hệ số hồi quy</strong></div>
      <div style="overflow-x:auto;font-size:.75rem;margin-top:.2rem"><table style="width:100%;border-collapse:collapse">
        <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.25rem .5rem">Predictor</td>
        <td style="padding:.25rem .5rem">β chuẩn</td><td style="padding:.25rem .5rem">β thô</td>
        <td style="padding:.25rem .5rem">t</td><td style="padding:.25rem .5rem">Sig.</td>
        <td style="padding:.25rem .5rem">VIF</td><td style="padding:.25rem .5rem">Tolerance</td></tr>`;
      predictors.forEach((p, idx) => {
        const sigPass = pValue[idx] < 0.05;
        const vifLikertWarn = vif[idx] > 2;
        if (!sigPass) { allPass = false; warnings.push(`${p}: Sig=${pValue[idx].toFixed(4)} > 0.05 (không ý nghĩa)`); }
        if (vifLikertWarn) warnings.push(`${p}: VIF=${vif[idx].toFixed(2)} > 2 (đa cộng tuyến với thang đo Likert)`);
        html += `<tr${idx%2===1?' style="background:var(--gray-50)"':''}>
          <td style="padding:.25rem .5rem;font-weight:600">${p}</td>
          <td style="padding:.25rem .5rem;color:${clr(Math.abs(stdBeta[idx]),0.10,0.65,0.05,0.75)}">${stdBeta[idx].toFixed(3)}</td>
          <td style="padding:.25rem .5rem">${(rawBeta[idx+1]||0).toFixed(4)}</td>
          <td style="padding:.25rem .5rem">${tStat[idx].toFixed(3)}</td>
          <td style="padding:.25rem .5rem;color:${clr(pValue[idx],-Infinity,0.05,-Infinity,0.10)}">${pValue[idx].toFixed(4)}${sigPass?' ✅':' ⚠️'}</td>
          <td style="padding:.25rem .5rem;color:${vifLikertWarn?'#d97706':clr(vif[idx],1.0,2.0,1.0,2.0)}">${vif[idx].toFixed(2)}${vifLikertWarn?' ⚠️':''}</td>
          <td style="padding:.25rem .5rem;color:${1/vif[idx]<0.10?'#ef4444':clr(1/vif[idx],0.20,1,0.10,1)}">${(1/vif[idx]).toFixed(3)}</td>
        </tr>`;
      });
      html += `</table></div>`;

      const nBins = Math.min(20, Math.max(8, Math.round(Math.sqrt(m2))));
      const minR = Math.min(...residuals);
      const maxR = Math.max(...residuals);
      const binW = (maxR - minR) / nBins || 0.01;
      const bins = Array(nBins).fill(0);
      residuals.forEach(r => { const bi = Math.min(nBins-1, Math.max(0, Math.floor((r - minR) / binW))); bins[bi]++; });
      const maxBin = Math.max(...bins, 1);
      const bh = 100, bw = 280;
      let histSvg = `<svg width="${bw}" height="${bh+30}" viewBox="0 0 ${bw} ${bh+30}" xmlns="http://www.w3.org/2000/svg">
        <text x="${bw/2}" y="${bh+20}" text-anchor="middle" font-size="8" fill="#6b7280">Phần dư (Residual)</text>
        <text x="2" y="${bh/2}" text-anchor="middle" font-size="7" fill="#6b7280" transform="rotate(-90,2,${bh/2})">TS</text>`;
      bins.forEach((c, i) => {
        const x = 30 + i * (bw-30) / nBins;
        const w = (bw-30) / nBins - 1;
        const h = (c / maxBin) * (bh-10);
        histSvg += `<rect x="${x}" y="${bh-10-h}" width="${Math.max(1,w)}" height="${h}" fill="#4f46e5" opacity="0.7" rx="1"/>`;
      });
      const zMin = -3, zMax = 3, zStep = 0.1;
      let curvePath = '';
      for (let z = zMin; z <= zMax; z += zStep) {
        const x = 30 + (z - zMin) / (zMax - zMin) * (bw-30);
        const y = bh-10 - (Math.exp(-z*z/2)/Math.sqrt(2*Math.PI)) / 0.4 * (bh-10);
        curvePath += (z === zMin ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      histSvg += `<path d="${curvePath}" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,3"/>`;
      histSvg += `<line x1="30" y1="${bh-10}" x2="${bw}" y2="${bh-10}" stroke="#d1d5db" stroke-width="1"/></svg>`;

      const minP = Math.min(...yHat);
      const maxP = Math.max(...yHat);
      const pRange = maxP - minP || 1;
      const sResiduals = residuals.map(r => r / Math.sqrt(msRes));
      const sw = 280, sh = 200;
      let scatterSvg = `<svg width="${sw}" height="${sh+20}" viewBox="0 0 ${sw} ${sh+20}" xmlns="http://www.w3.org/2000/svg">
        <text x="${sw/2}" y="${sh+16}" text-anchor="middle" font-size="7" fill="#6b7280">Giá trị dự đoán (Predicted)</text>
        <text x="4" y="${sh/2}" text-anchor="middle" font-size="7" fill="#6b7280" transform="rotate(-90,4,${sh/2})">Phần dư</text>`;
      yHat.forEach((p, i) => {
        const px = 30 + (p - minP) / pRange * (sw - 35);
        const py = sh/2 - sResiduals[i] / 4 * sh/2;
        if (px >= 30 && px <= sw && py >= 5 && py <= sh-5) {
          scatterSvg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.5" fill="#4f46e5" opacity="0.4"/>`;
        }
      });
      scatterSvg += `<line x1="30" y1="${sh/2}" x2="${sw}" y2="${sh/2}" stroke="#dc2626" stroke-width="1" stroke-dasharray="4,3"/></svg>`;

      html += `<div style="display:flex;flex-wrap:wrap;gap:.75rem;margin-top:.5rem;justify-content:center">
        <div style="background:#fff;padding:.5rem;border-radius:8px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:.7rem;font-weight:600;color:var(--gray-500);margin-bottom:.25rem">📊 Histogram phần dư</div>${histSvg}</div>
        <div style="background:#fff;padding:.5rem;border-radius:8px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:.7rem;font-weight:600;color:var(--gray-500);margin-bottom:.25rem">📉 Scatter plot (Predicted vs Residual)</div>${scatterSvg}</div>
      </div>`;

      html += `</div>`;

      if (medConstructs.length > 0 && ivConstructs.length > 0) {
        html += `<div class="var-item" style="margin-bottom:.5rem;background:#fefce8;border-color:#fbbf24">`;
        html += `<div style="font-size:.85rem;font-weight:600;margin-bottom:.4rem">🔗 Phân tích trung gian (Mediation) — DV: ${constructs[dvKey][0]?.constructLabel || dvKey}</div>`;
        const simpleReg = (xv, yv, label) => {
          const vv = [];
          for (let i = 0; i < n; i++) { if (xv[i] !== null && yv[i] !== null) vv.push(i); }
          const mv = vv.length;
          if (mv < 5) return null;
          const xs = vv.map(i => xv[i]), ys = vv.map(i => yv[i]);
          const mx = xs.reduce((a,b)=>a+b,0)/mv, my = ys.reduce((a,b)=>a+b,0)/mv;
          const sx2 = xs.reduce((a,v)=>a+(v-mx)**2,0), sy2 = ys.reduce((a,v)=>a+(v-my)**2,0);
          const sxy = xs.reduce((a,v,i)=>a+(v-mx)*(ys[i]-my),0);
          const b = sx2>0?sxy/sx2:0;
          const r = Math.sqrt(sx2*sy2)>0?sxy/Math.sqrt(sx2*sy2):0;
          const yh = xs.map(x=>b*(x-mx)+my);
          const ssr = ys.reduce((a,y,i)=>a+(y-yh[i])**2,0);
          const seB = Math.sqrt(ssr/(mv-2))/Math.sqrt(sx2)||1;
          const tVal = seB>0?b/seB:0;
          const z2 = Math.abs(tVal);
          const pV = 2*(1-0.5*(1+erf(z2/Math.SQRT2)));
          return {b,seB,stdBeta:r,t:tVal,p:pV,valid:mv,R2:r*r};
        };
        const medRows = [];
        medConstructs.forEach(mk => {
          const mLbl = constructs[mk][0]?.constructLabel || mk;
          ivConstructs.forEach(ivk => {
            const ivLbl = constructs[ivk][0]?.constructLabel || ivk;
            const aRes = simpleReg(compScores[ivk], compScores[mk], `a (${ivLbl}→${mLbl})`);
            if (!aRes) return;
            const bIdx = predictors.indexOf(mk);
            const bRes = bIdx>=0?{b:rawBeta[bIdx+1],seB:se[bIdx],stdBeta:stdBeta[bIdx],t:tStat[bIdx],p:pValue[bIdx]}:null;
            if (!bRes) return;
            const cPrimeIdx = predictors.indexOf(ivk);
            const cPrm = cPrimeIdx>=0?{b:rawBeta[cPrimeIdx+1],stdBeta:stdBeta[cPrimeIdx],p:pValue[cPrimeIdx]}:null;
            const cRes = simpleReg(compScores[ivk], compScores[dvKey], `c (${ivLbl}→DV)`);
            if (!cRes) return;
            const indirectAB = aRes.b * bRes.b;
            const seAB = Math.sqrt(bRes.b*bRes.b*aRes.seB*aRes.seB + aRes.b*aRes.b*bRes.seB*bRes.seB) || 1;
            const sobelZ = indirectAB / seAB;
            const sobelP = 2*(1-0.5*(1+erf(Math.abs(sobelZ)/Math.SQRT2)));
            const totalC = indirectAB + (cPrm?cPrm.b:0);
            const VAF = totalC!==0?Math.abs(indirectAB/totalC):0;
            medRows.push({ivLbl,mLbl,ivk,mk,aRes,bRes,cRes,cPrm,indirectAB,seAB,sobelZ,sobelP,VAF,totalC});
          });
        });
        if (medRows.length > 0) {
          html += `<div style="overflow-x:auto;font-size:.75rem"><table style="width:100%;border-collapse:collapse">`;
          html += `<tr style="background:var(--gray-100);font-weight:600">
            <td style="padding:.25rem .5rem">Đường dẫn</td>
            <td style="padding:.25rem .5rem;text-align:center">a (IV→Med)</td><td style="padding:.25rem .5rem;text-align:center">p(a)</td>
            <td style="padding:.25rem .5rem;text-align:center">b (Med→DV)</td><td style="padding:.25rem .5rem;text-align:center">p(b)</td>
            <td style="padding:.25rem .5rem;text-align:center">c' (trực tiếp)</td><td style="padding:.25rem .5rem;text-align:center">c (tổng)</td>
            <td style="padding:.25rem .5rem;text-align:center">a×b (gián tiếp)</td>
            <td style="padding:.25rem .5rem;text-align:center">Sobel Z</td><td style="padding:.25rem .5rem;text-align:center">Sobel p</td>
            <td style="padding:.25rem .5rem;text-align:center">VAF</td>
          </tr>`;
          let allMedOk = true;
          medRows.forEach(r => {
            const sigA = r.aRes.p < 0.05, sigB = r.bRes.p < 0.05;
            const sigSobel = r.sobelP < 0.05;
            const vafOk = r.VAF >= 0.20;
            if (!sigSobel) allMedOk = false;
            const pathLabel = `${r.ivLbl} → ${r.mLbl} → DV`;
            html += `<tr style="border-top:1px solid #e5e7eb">
              <td style="padding:.25rem .5rem;font-weight:600;white-space:nowrap">${pathLabel}</td>
              <td style="padding:.25rem .5rem;text-align:center;color:${sigA?'#059669':'#dc2626'}">${r.aRes.b.toFixed(3)} (${r.aRes.stdBeta.toFixed(3)})${sigA?' ✅':' ⚠️'}</td>
              <td style="padding:.25rem .5rem;text-align:center">${r.aRes.p.toFixed(4)}</td>
              <td style="padding:.25rem .5rem;text-align:center;color:${sigB?'#059669':'#dc2626'}">${r.bRes.b.toFixed(3)} (${r.bRes.stdBeta.toFixed(3)})${sigB?' ✅':' ⚠️'}</td>
              <td style="padding:.25rem .5rem;text-align:center">${r.bRes.p.toFixed(4)}</td>
              <td style="padding:.25rem .5rem;text-align:center;color:${r.cPrm?.p<0.05?'#059669':'#dc2626'}">${r.cPrm?r.cPrm.b.toFixed(3)+' ('+r.cPrm.stdBeta.toFixed(3)+') '+(r.cPrm.p<0.05?'✅':'⚠️'):'—'}</td>
              <td style="padding:.25rem .5rem;text-align:center">${r.cRes.b.toFixed(3)} (${r.cRes.stdBeta.toFixed(3)})</td>
              <td style="padding:.25rem .5rem;text-align:center;font-weight:700;color:#7c3aed">${r.indirectAB.toFixed(4)}</td>
              <td style="padding:.25rem .5rem;text-align:center;font-weight:700;color:${sigSobel?'#059669':'#dc2626'}">${r.sobelZ.toFixed(3)}${sigSobel?' ✅':' ⚠️'}</td>
              <td style="padding:.25rem .5rem;text-align:center">${r.sobelP.toFixed(4)}</td>
              <td style="padding:.25rem .5rem;text-align:center;font-weight:700;color:${vafOk?'#059669':'#d97706'}">${(r.VAF*100).toFixed(1)}%${vafOk?' ✅':r.VAF>0?' ⚠️':' 🚫'}</td>
            </tr>`;
            if (!sigSobel) warnings.push(`${pathLabel}: Sobel p=${r.sobelP.toFixed(4)} > 0.05 (không có trung gian)`);
            if (!vafOk && r.VAF>0) warnings.push(`${pathLabel}: VAF=${(r.VAF*100).toFixed(1)}% < 20% (trung gian một phần yếu)`);
          });
          html += `</table></div>`;
          html += `<div style="margin-top:.4rem;font-size:.7rem;color:var(--gray-500)">
            <b>Hướng dẫn:</b> a (IV→Med) × b (Med→DV) = hiệu ứng gián tiếp. Sobel Z kiểm tra ý nghĩa gián tiếp.
            VAF = (a×b)/(c' + a×b): ≥80% = trung gian hoàn toàn; 20–80% = trung gian một phần; &lt;20% = không có trung gian.
            ${allMedOk?'✅ Tất cả đường dẫn trung gian có ý nghĩa.':'⚠️ Một số đường dẫn trung gian chưa có ý nghĩa thống kê.'}
          </div>`;
        }
        html += `</div>`;
      }
    });
  }

  const nWarn = warnings.length;
  const overall = nWarn === 0 ? '✅ Dữ liệu mô phỏng đạt chất lượng tốt — các chỉ tiêu trong khoảng lý tưởng'
    : `⚠️ ${nWarn} chỉ tiêu ở mức cảnh báo: ${warnings.slice(0,3).join('; ')}${warnings.length>3 ? `... (+${warnings.length-3})` : ''}. Kiểm tra các chỉ số màu vàng/đỏ.`;
  const bg = nWarn === 0 ? '#f0fdf4;color:#166534' : nWarn <= 2 ? '#fefce8;color:#92400e' : '#fef2f2;color:#991b1b';
  html += `<div style="padding:.5rem;border-radius:var(--radius);text-align:center;font-weight:600;font-size:.85rem;background:${bg}">${overall}</div>`;

  html += '</div>';
  content.innerHTML = html;

  const badge = document.getElementById('quality-badge');
  badge.textContent = `${constructKeys.length} nhân tố · ${warnings.length === 0 ? '✅ Đạt' : warnings.length + ' ⚠️'}`;
}

// ====== EXPORT REPORT ======
function exportReport() {
  const content = document.getElementById('quality-content');
  const title = 'BÁO CÁO KIỂM ĐỊNH CHẤT LƯỢNG DỮ LIỆU';
  const now = new Date().toLocaleString('vi-VN');
  const n = document.getElementById('sample-size').value || 200;
  const nVars = variables.length;
  const constructKeys = [...new Set(variables.filter(v => v.construct).map(v => v.construct))];
  const c3 = (v,gl,gh,yl,yh) => v>=gl&&v<=gh?'pass':v>=yl&&v<=yh?'warn':'fail';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { margin: 1.5cm; size: A4 portrait; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11pt; color: #1f2937; line-height: 1.5; max-width: 210mm; margin: 0 auto; padding: 20px; }
  h1 { font-size: 16pt; text-align: center; color: #1e40af; margin-bottom: 4pt; }
  h2 { font-size: 13pt; color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 4pt; margin-top: 18pt; }
  h3 { font-size: 11pt; color: #374151; margin: 10pt 0 4pt; }
  .meta { text-align: center; font-size: 9pt; color: #6b7280; margin-bottom: 14pt; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0; font-size: 9pt; }
  th, td { border: 1px solid #d1d5db; padding: 4pt 6pt; text-align: center; }
  th { background: #f3f4f6; font-weight: 600; }
  .pass { color: #059669; }
  .warn { color: #d97706; }
  .fail { color: #dc2626; }
  .section { margin-bottom: 10pt; page-break-inside: avoid; }
  .badge { display:inline-block; background:#e5e7eb; padding:1pt 6pt; border-radius:4pt; font-size:8pt; }
  .summary-box { background:#f0fdf4; border:1px solid #86efac; border-radius:6pt; padding:8pt 12pt; margin:8pt 0; font-size:10pt; }
  .warn-box { background:#fef2f2; border:1px solid #fca5a5; border-radius:6pt; padding:8pt 12pt; margin:8pt 0; font-size:10pt; }
  .footer { text-align: center; font-size: 8pt; color: #9ca3af; margin-top: 20pt; border-top: 1px solid #e5e7eb; padding-top: 6pt; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style></head><body>
<h1>${title}</h1>
<div class="meta">Ngày: ${now} · Cỡ mẫu: ${n} · Tổng biến: ${nVars} · Nhân tố: ${constructKeys.length}</div>

<div class="section">
  <h2>1. Độ tin cậy Cronbach's Alpha</h2>
  <table><tr><th>Nhân tố</th><th>Vai trò</th><th>Số items</th><th>α</th>
  <th>r̅ Inter-item</th><th>λ̅ Loading</th><th>AVE</th><th>KMO</th><th>Eigenvalue</th><th>TVE</th></tr>
`;

  const cons = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!cons[v.construct]) cons[v.construct] = [];
      cons[v.construct].push(v);
    }
  });

  const roleLabels = { independent:'Độc lập', dependent:'Phụ thuộc', mediating:'Trung gian', moderating:'Điều tiết' };
  const roleColors = { independent:'#2563eb', dependent:'#dc2626', mediating:'#d97706', moderating:'#7c3aed' };

  let rowsHtml = '';

  Object.keys(cons).forEach(key => {
    const items = cons[key];
    const role = items[0]?.role || '';
    const k = items.length;
    const itemNames = items.map(v => v.name);
    const rawRows2 = generatedData?.rawRows || [];

    const scoreMatrix = itemNames.map(name => rawRows2.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
    const valid = [];
    for (let i = 0; i < n; i++) { if (scoreMatrix.every(col => col[i] !== null)) valid.push(i); }
    const m = valid.length;
    if (m < 3) return;

    const itemStats = itemNames.map((name, idx) => {
      const vals = valid.map(i => scoreMatrix[idx][i]);
      const mean = vals.reduce((a,b)=>a+b,0)/m;
      const var_ = vals.reduce((a,b)=>a+(b-mean)**2,0)/m;
      return { name, mean, sd: Math.sqrt(var_) };
    });

    const covM = [], corrM = [];
    for (let i = 0; i < k; i++) {
      covM[i]=[]; corrM[i]=[];
      for (let j = 0; j < k; j++) {
        let cov = 0; valid.forEach(ri => cov += (scoreMatrix[i][ri]-itemStats[i].mean)*(scoreMatrix[j][ri]-itemStats[j].mean)); cov /= m;
        covM[i][j] = cov;
        corrM[i][j] = itemStats[i].sd>0&&itemStats[j].sd>0 ? cov/(itemStats[i].sd*itemStats[j].sd) : 0;
      }
    }

    let sumCorr=0, corrCount=0;
    for(let i=0;i<k;i++) for(let j=i+1;j<k;j++){sumCorr+=corrM[i][j];corrCount++;}
    const avgCorr = corrCount>0 ? sumCorr/corrCount : 0;

    let sumVar=0, totalVar=0;
    for(let i=0;i<k;i++) sumVar+=covM[i][i];
    for(let i=0;i<k;i++) for(let j=0;j<k;j++) totalVar+=covM[i][j];
    const alpha = totalVar>0 ? (k/(k-1))*(1-sumVar/totalVar) : 0;

    const corrForKMO = items.map((_,i)=>items.map((__,j)=>corrM[i][j]));
    const pc = firstPC(corrForKMO);
    const itemLoading = pc.loadings;
    const avgLoading = itemLoading.reduce((a, b) => a + Math.abs(b), 0) / k;
    const ave = itemLoading.reduce((a, b) => a + b * b, 0) / k;
    const kmo = computeKMO(corrForKMO);
    const eig = pc.eigval;
    const tve = k>0 ? Math.min(1, eig/k) : 0;

    const rc = roleColors[role]||'#666';
    rowsHtml += `<tr><td style="font-weight:600">${key}</td>
      <td><span style="color:${rc}">${roleLabels[role]||''}</span></td>
      <td>${k}</td>
      <td class="${c3(alpha,0.75,0.93,0.70,0.95)}">${alpha.toFixed(3)}</td>
      <td class="${c3(avgCorr,0.35,0.80,0.20,0.88)}">${avgCorr.toFixed(3)}</td>
      <td class="${c3(avgLoading,0.55,0.92,0.45,0.96)}">${avgLoading.toFixed(3)}</td>
      <td class="${c3(ave,0.40,Infinity,0.30,Infinity)}">${ave.toFixed(3)}</td>
      <td class="${c3(kmo,0.70,0.95,0.55,0.98)}">${kmo.toFixed(3)}</td>
      <td class="${eig>1?'pass':'fail'}">${eig.toFixed(3)}</td>
      <td class="${c3(tve,0.50,0.85,0.35,0.92)}">${(tve*100).toFixed(1)}%</td>
    </tr>`;

    rowsHtml += `<tr style="background:#f9fafb;font-size:8pt"><td colspan="10" style="text-align:left;padding:2pt 6pt">
      <strong>Items:</strong> ${itemNames.join(', ')} | `;
    itemNames.forEach((nm, idx) => {
      const l = itemLoading[idx];
      rowsHtml += `${nm}(λ=${l.toFixed(3)}, M=${itemStats[idx].mean.toFixed(2)}, SD=${itemStats[idx].sd.toFixed(3)}) `;
    });
    rowsHtml += `</td></tr>`;
  });

  const htmlWithRows = html + rowsHtml + `</table></div>`;

  const ivCons = Object.keys(cons).filter(k => cons[k][0]?.role === 'independent');
  const depCons = Object.keys(cons).filter(k => cons[k][0]?.role === 'dependent');
  let restHtml = '';
  if (depCons.length > 0) {
    restHtml += `<div class="section"><h2>2. Hồi quy & Kiểm định mô hình</h2>`;
    depCons.forEach(dvKey => {
      const predictors = [...ivCons];
      const medCon = Object.keys(cons).filter(k => cons[k][0]?.role === 'mediating');
      predictors.push(...medCon);
      if (predictors.length === 0) return;

      const compScores = {};
      [...predictors, dvKey].forEach(k => {
        const its = cons[k].map(v => v.name);
        compScores[k] = (generatedData?.rawRows||[]).map(r => {
          let sum=0,cnt=0; its.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){sum+=v;cnt++;}}); return cnt>0?sum/cnt:null;
        });
      });

      const dv = compScores[dvKey];
      const valid2 = [];
      for (let i = 0; i < n; i++) { if (dv[i] !== null && predictors.every(p => compScores[p][i] !== null)) valid2.push(i); }
      const m2 = valid2.length;
      if (m2 <= predictors.length + 5) return;

      const y = valid2.map(idx => dv[idx]);
      const yMean2 = y.reduce((a,b)=>a+b,0)/m2;
      const ySd2 = Math.sqrt(y.reduce((a,b)=>a+(b-yMean2)**2,0)/m2);
      const xMean2 = predictors.map(p => valid2.reduce((a,i)=>a+compScores[p][i],0)/m2);
      const xSd2 = predictors.map(p => Math.sqrt(valid2.reduce((a,i)=>a+(compScores[p][i]-xMean2[predictors.indexOf(p)])**2,0)/m2));

      const R2 = corrMatrixFromData(valid2.map(i=>{
        const o={__dv__:dv[i]}; predictors.forEach(p=>{o[p]=compScores[p][i];}); return o;
      }), ['__dv__',...predictors]);
      const rY2 = predictors.map((_,j)=>R2[0][j+1]);
      const Rxx2 = predictors.map((_,i)=>predictors.map((_,j)=>R2[i+1][j+1]));
      let Rxx2Inv = matInverse(Rxx2);
      if (!Rxx2Inv) { const lam=1e-8*predictors.length; Rxx2Inv=matInverse(Rxx2.map((r,i)=>r.map((v,j)=>i===j?v+lam:v))); }

      let stdBeta2=[], rSquared2=0;
      if (Rxx2Inv) {
        stdBeta2 = Rxx2Inv.map(r=>r.reduce((a,v,j)=>a+v*rY2[j],0));
        rSquared2 = stdBeta2.reduce((a,b,j)=>a+b*rY2[j],0);
      }
      if (rSquared2<0) rSquared2=0; if (rSquared2>1) rSquared2=1;

      const rawBeta2 = [yMean2 - stdBeta2.reduce((a,b,j)=>a+b*ySd2*xMean2[j]/(xSd2[j]||1),0)];
      predictors.forEach((_,j)=>rawBeta2.push(xSd2[j]>0?stdBeta2[j]*ySd2/xSd2[j]:0));

      const yHat2 = valid2.map(i=>rawBeta2[0]+predictors.reduce((a,p,j)=>a+rawBeta2[j+1]*compScores[p][i],0));
      const residuals2 = valid2.map((i,ri)=>dv[i]-yHat2[ri]);

      const ssRes2 = residuals2.reduce((a,r)=>a+r*r,0);
      const ssTot2 = y.reduce((a,yi)=>a+(yi-yMean2)**2,0);
      if (rSquared2<=0&&ssTot2>0) rSquared2=Math.max(0,1-ssRes2/ssTot2);
      const adjRSq2 = 1-(1-rSquared2)*(m2-1)/(m2-predictors.length-1);
      const dw2 = durbinWatson(residuals2);

      const mse2 = Math.max(ssRes2/(m2-predictors.length-1),1e-10);
      const se2 = predictors.map((_,j)=>Rxx2Inv?Math.sqrt(mse2*Rxx2Inv[j][j]/(m2-1)*ySd2*ySd2/(xSd2[j]*xSd2[j]||1)):1);
      const tStat2 = predictors.map((_,j)=>se2[j]>0?rawBeta2[j+1]/se2[j]:0);
      const pValue2 = tStat2.map(t=>{const z=Math.abs(t);return 2*(1-0.5*(1+erf(z/Math.SQRT2)));});
      const vif2 = predictors.map((_,j)=>Rxx2Inv?Rxx2Inv[j][j]:10);

      const ssReg2 = ssTot2 - ssRes2;
      const dfReg2 = predictors.length;
      const dfRes2 = m2 - predictors.length - 1;
      const dfTot2 = m2 - 1;
      const msReg2 = ssReg2 / dfReg2;
      const msRes2 = mse2;
      const fStat2 = msRes2 > 0 ? msReg2 / msRes2 : 0;
      const fPVal2 = computeFPValue(fStat2, dfReg2, dfRes2);
      const fSig2 = fPVal2 < 0.05;

      restHtml += `<h3>DV: ${dvKey}</h3>
      <table style="font-size:9pt"><tr><th>Chỉ tiêu</th><th>Giá trị</th><th>Đánh giá</th></tr>
      <tr><td>R²</td><td>${rSquared2.toFixed(3)}</td><td class="${c3(rSquared2,0.50,1.0,0.50,1.0)}">${rSquared2>=0.50?'Đạt':'Kém'}</td></tr>
      <tr><td>R² hiệu chỉnh</td><td>${adjRSq2.toFixed(3)}</td><td class="${c3(Math.abs(rSquared2-adjRSq2),0,0.05,0,0.08)}">Chênh ${Math.abs(rSquared2-adjRSq2).toFixed(3)}</td></tr>
      <tr><td>Durbin-Watson</td><td>${dw2.toFixed(3)}</td><td class="${c3(dw2,1.5,2.5,1.3,2.7)}">${dw2>=1.5&&dw2<=2.5?'Đạt':dw2>=1.3&&dw2<=2.7?'Chấp nhận':'Cần xem xét'}</td></tr>
      </table>`;

      restHtml += `<table style="font-size:8pt;margin-top:4pt">
        <tr><th>Nguồn</th><th>SS</th><th>df</th><th>MS</th><th>F</th><th>Sig.</th></tr>
        <tr><td>Hồi quy</td><td>${ssReg2.toFixed(3)}</td><td>${dfReg2}</td><td>${msReg2.toFixed(3)}</td>
          <td style="font-weight:700">${fStat2.toFixed(3)}</td>
          <td style="font-weight:600;color:${fSig2?'#059669':'#dc2626'}">${fPVal2.toFixed(4)}${fSig2?' ✅':''}</td></tr>
        <tr><td>Phần dư</td><td>${ssRes2.toFixed(3)}</td><td>${dfRes2}</td><td>${msRes2.toFixed(3)}</td><td></td><td></td></tr>
        <tr style="font-weight:600"><td>Tổng</td><td>${ssTot2.toFixed(3)}</td><td>${dfTot2}</td><td></td><td></td><td></td></tr>
      </table>
      <table style="font-size:8pt"><tr><th>Predictor</th><th>β chuẩn</th><th>β thô</th><th>t</th><th>Sig.</th><th>VIF</th><th>Tolerance</th></tr>`;
      predictors.forEach((p,idx) => {
        const sigP = pValue2[idx]<0.05;
        restHtml += `<tr><td style="font-weight:600">${p}</td>
          <td class="${c3(Math.abs(stdBeta2[idx]),0.1,0.65,0.05,0.75)}">${stdBeta2[idx].toFixed(3)}</td>
          <td>${(rawBeta2[idx+1]||0).toFixed(4)}</td>
          <td>${tStat2[idx].toFixed(3)}</td>
          <td class="${c3(pValue2[idx],-Infinity,0.05,-Infinity,0.10)}">${pValue2[idx].toFixed(4)}${sigP?' ✅':' ⚠️'}</td>
          <td class="${c3(vif2[idx],1,2.0,1,2.0)}">${vif2[idx].toFixed(2)}</td>
          <td class="${c3((1/vif2[idx]),0.20,1,0.10,1)}">${(1/vif2[idx]).toFixed(3)}</td>
        </tr>`;
      });
      restHtml += `</table>`;

      const nBins2 = Math.min(16, Math.max(6, Math.round(Math.sqrt(m2))));
      const minR2 = Math.min(...residuals2);
      const maxR2 = Math.max(...residuals2);
      const binW2 = (maxR2 - minR2) / nBins2 || 0.01;
      const bins2 = Array(nBins2).fill(0);
      residuals2.forEach(r => { const bi = Math.min(nBins2-1, Math.max(0, Math.floor((r - minR2) / binW2))); bins2[bi]++; });
      restHtml += `<table style="font-size:7pt;margin-top:4pt"><tr><th colspan="2">Phân phối phần dư (Residuals)</th></tr>`;
      bins2.forEach((c, i) => {
        const lo = (minR2 + i * binW2).toFixed(2);
        const hi = (minR2 + (i+1) * binW2).toFixed(2);
        const bar = '█'.repeat(Math.round(c / Math.max(...bins2) * 20));
        restHtml += `<tr><td style="text-align:right;padding:1pt 4pt">[${lo}, ${hi})</td><td style="text-align:left;padding:1pt 4pt">${bar} ${c}</td></tr>`;
      });
      restHtml += `</table>`;
    });
    restHtml += `</div>`;
  }

  const demoVars2 = variables.filter(v => v.type === 'demographic' && !v.construct);
  const twoGroupVars2 = demoVars2.filter(dv => {
    const vals = new Set(); (generatedData?.rawRows||[]).forEach(r => { const v = r[dv.name]; if (v != null) vals.add(v); });
    return vals.size === 2;
  });
  if (twoGroupVars2.length > 0 && Object.keys(cons).length > 0) {
    restHtml += `<div class="section"><h2>3. Independent Sample t-test</h2>`;
    twoGroupVars2.forEach(dv => {
      const grpLabels = [...new Set((generatedData?.rawRows||[]).map(r => r[dv.name]).filter(v => v != null))];
      const grp1 = grpLabels[0], grp2 = grpLabels[1];
      Object.keys(cons).forEach(ck => {
        const items = cons[ck].map(v => v.name);
        const g1vals = [], g2vals = [];
        (generatedData?.rawRows||[]).forEach(r => {
          const g = r[dv.name];
          if (g == null) return;
          let sum=0,cnt=0; items.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){sum+=v;cnt++;}});
          const cs = cnt>0 ? sum/cnt : null;
          if (cs === null) return;
          if (g === grp1) g1vals.push(cs); else if (g === grp2) g2vals.push(cs);
        });
        if (g1vals.length < 2 || g2vals.length < 2) return;
        const tt = independentTTest(g1vals, g2vals, grp1, grp2);
        if (!tt) return;
        const label = cons[ck][0]?.constructLabel || ck;
        const effSz = tt.cohensD >= 0.8 ? 'Lớn' : tt.cohensD >= 0.5 ? 'Trung bình' : tt.cohensD >= 0.2 ? 'Nhỏ' : 'Không';
        restHtml += `<div style="margin-top:6pt;padding:4pt 8pt;border:1px solid #e5e7eb;border-radius:4pt;font-size:9pt">
          <strong>${label} × ${dv.label}</strong><br>
          ${grp1}: N=${tt.n1}, TB=${tt.m1.toFixed(2)}, ĐLC=${Math.sqrt(tt.v1).toFixed(3)} &nbsp;|&nbsp;
          ${grp2}: N=${tt.n2}, TB=${tt.m2.toFixed(2)}, ĐLC=${Math.sqrt(tt.v2).toFixed(3)}<br>
          Levene F=${tt.fLevene.toFixed(3)} (p=${tt.leveneP.toFixed(4)}) → ${tt.equalVarAssumed?'Giả định bằng nhau':'Không bằng nhau'}<br>
          <strong>t(${tt.df.toFixed(1)}) = ${tt.tStat.toFixed(3)}, p = ${tt.pVal.toFixed(4)}${tt.pVal<0.05?' (có ý nghĩa)':''}</strong><br>
          Cohen's d = ${tt.cohensD.toFixed(3)} (${effSz})
        </div>`;
      });
    });
    restHtml += `</div>`;
  }

  const allCons = Object.keys(cons).filter(k => cons[k][0]?.role !== 'moderating');
  if (allCons.length > 1) {
    const compScores = {};
    allCons.forEach(k => {
      const its = cons[k].map(v => v.name);
      compScores[k] = (generatedData?.rawRows||[]).map(r => {
        let sum=0,cnt=0; its.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){sum+=v;cnt++;}}); return cnt>0?sum/cnt:null;
      });
    });
    const valid3 = [];
    for(let i=0;i<n;i++){if(allCons.every(k=>compScores[k][i]!==null))valid3.push(i);}
    if(valid3.length>3){
      const R = corrMatrixFromData(valid3.map(ri=>{const o={};allCons.forEach(k=>{o[k]=compScores[k][ri];});return o;}), allCons);
      restHtml += `<div class="section"><h2>4. Tương quan giữa các nhân tố</h2>
      <table><tr><th>Nhân tố</th>${allCons.map(k=>`<th>${k}</th>`).join('')}</tr>`;
      allCons.forEach((ki,i)=>{
        restHtml+=`<tr><td style="font-weight:600">${ki}</td>`;
        allCons.forEach((kj,j)=>{
          const r = R[i][j];
          restHtml+=`<td class="${c3(Math.abs(r),0.25,0.85,0.15,0.92)}">${r.toFixed(3)}</td>`;
        });
        restHtml+=`</tr>`;
      });
      restHtml+=`</table><div style="font-size:8pt;color:#6b7280">N = ${valid3.length}</div></div>`;
    }
  }

  const finalHtml = htmlWithRows + restHtml +
    `<div class="footer">Báo cáo được tạo tự động bởi Công cụ Mô phỏng Dữ liệu SPSS &mdash; ${now}</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    showToast('❌ Trình duyệt chặn mở cửa sổ mới khi chạy từ file://. Hãy dùng live server: npm install -g serve && serve .', 'error');
    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bao-cao-spss.html';
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  win.document.write(finalHtml);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

/* ---- Adjust functions: modify raw data to improve quality metrics ---- */

function adjustAlpha(constructKey, delta) {
  try {
  if (!generatedData?.rawRows) { showToast('adjustAlpha: no rawRows','error'); return; }
  const constructs = generatedData.constructs || {};
  const items = constructs[constructKey];
  if (!items || !items.length) { showToast('adjustAlpha: no items for '+constructKey,'error'); return; }

  const colHeaders = generatedData.colNames || [];
  const idxMap = items.map(item => colHeaders.indexOf(item.name || item)).filter(i => i >= 0);
  if (idxMap.length < 2) return;
  const nRows = generatedData.rawRows.length;

  // Clamp: Likert scale bounds
  const scaleMin = 1, scaleMax = 7;

  // Collect row means for these items to compute per-row target
  const rowMeans = generatedData.rawRows.map(r => {
    const vals = idxMap.map(i => Number(r[colHeaders[i]])).filter(v => !isNaN(v) && v > 0);
    return vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : 0;
  });

  for (let r = 0; r < nRows; r++) {
    const row = generatedData.rawRows[r];
    const mean = rowMeans[r];
    if (mean === 0) continue;
    const step = delta > 0 ? 1 : -1;
    idxMap.forEach((ci, ii) => {
      const colName = colHeaders[ci];
      let val = Number(row[colName]);
      if (isNaN(val) || val <= 0) return;
      const dir = val >= mean ? 1 : -1;
      const oldVal = val;
      val = Math.round(val + step * dir);
      val = Math.max(scaleMin, Math.min(scaleMax, val));
      if (val !== oldVal) {
        row[colName] = val;
        if (!window._changedCells) window._changedCells = {};
        if (!window._changedCells[r]) window._changedCells[r] = {};
        window._changedCells[r][colName] = { oldVal: oldVal, newVal: val };
      }
    });
  }
  if (generatedData.constructQualities) delete generatedData.constructQualities;
  if (generatedData.regressionCache) delete generatedData.regressionCache;

  // Update quality report container
  const qc = document.getElementById('qualityContent');
  if (qc) {
    const c = generatedData?.constructs || {};
    showQualityReport(generatedData.rawRows || [], c, (generatedData.rawRows || []).length);
  }
  if (typeof showImportData === 'function') showImportData();
  } catch(e) { showToast('adjustAlpha: '+e.message,'error'); console.error(e); }
}

function adjustConstructLoading(constructKey, delta) {
  if (!generatedData?.rawRows) return;
  const constructs = generatedData.constructs || {};
  const items = constructs[constructKey];
  if (!items || !items.length) return;

  const colHeaders = generatedData.colNames || [];
  const idxMap = items.map(item => colHeaders.indexOf(item.name || item)).filter(i => i >= 0);
  if (idxMap.length < 2) return;
  const nRows = generatedData.rawRows.length;

  // Compute construct composite (person-mean across all items)
  const composites = generatedData.rawRows.map(r => {
    const vals = idxMap.map(i => Number(r[colHeaders[i]])).filter(v => !isNaN(v) && v > 0);
    return vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : 0;
  });

  const scaleMin = 1, scaleMax = 7;
  const step = delta > 0 ? 1 : -1;

  for (let r = 0; r < nRows; r++) {
    const row = generatedData.rawRows[r];
    const comp = composites[r];
    if (comp === 0) continue;
    idxMap.forEach((ci) => {
      const colName = colHeaders[ci];
      let val = Number(row[colName]);
      if (isNaN(val) || val <= 0) return;
      const oldVal = val;
      if (delta > 0) {
        val += val < comp ? 1 : -1;
      } else {
        val += val <= comp ? -1 : 1;
      }
      val = Math.max(scaleMin, Math.min(scaleMax, val));
      if (val !== oldVal) {
        row[colName] = val;
        if (!window._changedCells) window._changedCells = {};
        if (!window._changedCells[r]) window._changedCells[r] = {};
        window._changedCells[r][colName] = { oldVal: oldVal, newVal: val };
      }
    });
  }
  if (generatedData.constructQualities) delete generatedData.constructQualities;
  if (generatedData.regressionCache) delete generatedData.regressionCache;
  const qc = document.getElementById('qualityContent');
  if (qc) {
    const c = generatedData?.constructs || {};
    showQualityReport(generatedData.rawRows || [], c, (generatedData.rawRows || []).length);
  }
  if (typeof showImportData === 'function') showImportData();
}

function adjustRSq(delta) {
  if (!generatedData?.rawRows) return;
  // Find IV construct(s) and DV construct from the most recent regression
  const regInfo = generatedData?.regressionInput || generatedData?.lastRegression;
  if (!regInfo) {
    // Fallback: find constructs with 2+ items as IV, 1+ items as DV
    const sorted = generatedData.constructs || generatedData.constructQualities;
    if (!sorted) return;
    const keys = Object.keys(sorted);
    if (keys.length < 2) return;
    const ivKey = keys[0], dvKey = keys[keys.length - 1];
    adjustRSqByKeys(ivKey, dvKey, delta);
  } else {
    adjustRSqByKeys(regInfo.ivKey, regInfo.dvKey, delta);
  }
}

function adjustRSqByKeys(ivKey, dvKey, delta) {
  const constructs = generatedData.constructs || {};
  const ivItems = constructs[ivKey] || [];
  const dvItems = constructs[dvKey] || [];

  const colHeaders = generatedData.colNames || [];
  const ivIdx = ivItems.map(item => colHeaders.indexOf(item.name || item)).filter(i => i >= 0);
  const dvIdx = dvItems.map(item => colHeaders.indexOf(item.name || item)).filter(i => i >= 0);
  if (!ivIdx.length || !dvIdx.length) return;

  const nRows = generatedData.rawRows.length;
  const scaleMin = 1, scaleMax = 7;
  const step = delta > 0 ? 1 : -1;

  // Compute IV composite per row
  const ivComposites = generatedData.rawRows.map(r => {
    const vals = ivIdx.map(i => Number(r[colHeaders[i]])).filter(v => !isNaN(v) && v > 0);
    return vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : 0;
  });

  for (let r = 0; r < nRows; r++) {
    const row = generatedData.rawRows[r];
    const iv = ivComposites[r];
    if (iv === 0) continue;
    dvIdx.forEach((ci) => {
      const colName = colHeaders[ci];
      let val = Number(row[colName]);
      if (isNaN(val) || val <= 0) return;
      const oldVal = val;
      if (delta > 0) {
        val += val < iv ? 1 : val > iv ? -1 : 0;
      } else {
        if (val <= iv) val = Math.max(scaleMin, val - 1);
        else val = Math.min(scaleMax, val + 1);
      }
      val = Math.max(scaleMin, Math.min(scaleMax, val));
      if (val !== oldVal) {
        row[colName] = val;
        if (!window._changedCells) window._changedCells = {};
        if (!window._changedCells[r]) window._changedCells[r] = {};
        window._changedCells[r][colName] = { oldVal: oldVal, newVal: val };
      }
    });
  }
  if (generatedData.constructQualities) delete generatedData.constructQualities;
  if (generatedData.regressionCache) delete generatedData.regressionCache;
  const qc = document.getElementById('qualityContent');
  if (qc) {
    const c = generatedData?.constructs || {};
    showQualityReport(generatedData.rawRows || [], c, (generatedData.rawRows || []).length);
  }
  if (typeof showImportData === 'function') showImportData();
}
