// ====== DATA ASSISTANT (AI Chat) ======
let _aiBackup = null;

// Resize logic for sidebar
const AI_MIN_WIDTH = 260;
const AI_MAX_WIDTH = Math.min(700, window.innerWidth * 0.6);
function initAiResize() {
  const handle = document.getElementById('ai-resize-handle');
  const sidebar = document.getElementById('ai-sidebar');
  if (!handle || !sidebar) return;
  let startX = 0, startW = 0;
  const onDown = (e) => {
    startX = e.clientX;
    startW = sidebar.getBoundingClientRect().width;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };
  const onMove = (e) => {
    const w = Math.max(AI_MIN_WIDTH, Math.min(AI_MAX_WIDTH, startW + (e.clientX - startX)));
    sidebar.style.width = w + 'px';
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  handle.addEventListener('mousedown', onDown);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initAiResize(); syncAiBtn(); });
} else {
  initAiResize(); syncAiBtn();
}

function syncAiBtn() {
  const sidebar = document.getElementById('ai-sidebar');
  const btn = document.getElementById('ai-btn');
  if (!sidebar || !btn) return;
  const closed = sidebar.classList.contains('closed');
  btn.style.opacity = closed ? '1' : '0';
  btn.style.pointerEvents = closed ? 'auto' : 'none';
}

function toggleAiChat() {
  const sidebar = document.getElementById('ai-sidebar');
  const btn = document.getElementById('ai-btn');
  const closed = sidebar.classList.toggle('closed');
  btn.style.opacity = closed ? '1' : '0';
  btn.style.pointerEvents = closed ? 'auto' : 'none';
  if (!closed) {
    setTimeout(() => document.getElementById('ai-input')?.focus(), 100);
    if (document.getElementById('ai-msgs').children.length === 0) {
      aiHelp();
    }
  }
}

function sendAiChat() {
  const input = document.getElementById('ai-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  document.getElementById('ai-send-btn').disabled = true;
  addAiMsg(text, 'user');
  setTimeout(() => processAiCommand(text), 200);
}
// ====== CHAT UI ======

function addAiMsg(text, role) {
  const container = document.getElementById('ai-msgs');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const ts = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = text + `<span class="ts">${ts}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function setAiThinking(show) {
  const el = document.getElementById('ai-thinking');
  const input = document.getElementById('ai-input');
  const btn = document.getElementById('ai-send-btn');
  if (show) {
    el.classList.add('show');
    input.disabled = true;
    btn.disabled = true;
  } else {
    el.classList.remove('show');
    input.disabled = false;
    btn.disabled = !input.value.trim();
  }
}

async function callDeepSeek(messages) {
  const resp = await fetch('/api/data-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages.map(m => ({
      role: m.role,
      content: m.role === 'system' ? m.content + '\n\nGiới hạn: actions tối đa 5, ưu tiên actions có tác động lớn nhất.' : m.content
    })) })
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error('API error ' + resp.status + (err ? ': ' + err : ''));
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

function buildDataContext() {
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = { label: v.constructLabel || v.construct, items: [], role: v.role || '' };
      constructs[v.construct].items.push(v.name);
    }
  });
  const keys = Object.keys(constructs);
  let ctx = 'DỮ LIỆU HIỆN TẠI:\n';
  ctx += '- Số mẫu: ' + (generatedData?.n || 0) + '\n';
  ctx += '- Thang đo: Likert 5 mức (1=Rất không đồng ý, 5=Rất đồng ý)\n';
  ctx += '- Các nhân tố và items:\n';
  keys.forEach(k => {
    const c = constructs[k];
    ctx += '  • ' + k + ' (' + c.label + ', vai trò: ' + c.role + '): ' + c.items.join(', ') + '\n';
  });
  if (generatedData) {
    ctx += '\nTHỐNG KÊ HIỆN TẠI:\n';
    keys.forEach(k => {
      const items = constructs[k].items;
      const vals = items.map(n => generatedData.rawRows.map(r => r[n]).filter(v => typeof v === 'number' && !isNaN(v)));
      const means = vals.map(v => (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2));
      const meanAll = (means.reduce((a, b) => a + parseFloat(b), 0) / means.length).toFixed(2);
      ctx += '  • ' + k + ': Mean=' + meanAll + ', items: ' + items.map((n, i) => n + '(' + means[i] + ')').join(', ') + '\n';
    });
    if (keys.length > 1) {
      ctx += '  • Tương quan giữa các cặp:\n';
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const items1 = constructs[keys[i]].items;
          const items2 = constructs[keys[j]].items;
          const s1 = generatedData.rawRows.map(r => { let s = 0, c = 0; items1.forEach(n => { const v = r[n]; if (typeof v === 'number' && !isNaN(v)) { s += v; c++; } }); return c > 0 ? s / c : null; }).filter(v => v !== null);
          const s2 = generatedData.rawRows.map(r => { let s = 0, c = 0; items2.forEach(n => { const v = r[n]; if (typeof v === 'number' && !isNaN(v)) { s += v; c++; } }); return c > 0 ? s / c : null; }).filter(v => v !== null);
          const n = Math.min(s1.length, s2.length);
          const m1 = s1.reduce((a, b) => a + b, 0) / n;
          const m2 = s2.reduce((a, b) => a + b, 0) / n;
          const sd1 = Math.sqrt(s1.reduce((a, b) => a + (b - m1) ** 2, 0) / n);
          const sd2 = Math.sqrt(s2.reduce((a, b) => a + (b - m2) ** 2, 0) / n);
          const r = sd1 > 0 && sd2 > 0 ? s1.reduce((a, b, i) => a + (b - m1) * (s2[i] - m2), 0) / n / (sd1 * sd2) : 0;
          ctx += '    - ' + keys[i] + '↔' + keys[j] + ': r=' + r.toFixed(3) + '\n';
        }
      }
    }
  }
  return ctx;
}

const AI_SYSTEM_PROMPT = `Bạn là trợ lý phân tích và can thiệp dữ liệu khảo sát SPSS chuyên sâu.

NGUYÊN TẮC TỐI ƯU:
- Cronbach's Alpha ≥ 0.80 (tốt), ≥ 0.60 (chấp nhận)
- Hệ số tải (loading) ≥ 0.50
- KMO ≥ 0.70
- Item-total correlation ≥ 0.30
- R² ≥ 0.50 (tốt)
- VIF < 2
- Durbin-Watson 1.5–2.5
- Tương quan giữa các nhân tố có Sig. < 0.05

Bạn có thể thực hiện các hành động sau:
1. "adjustMean": điều chỉnh mean của một nhân tố (delta: số dương = tăng, âm = giảm)
2. "addNoise": thêm nhiễu ngẫu nhiên cho nhân tố (amount: độ lệch chuẩn)
3. "setCorrelation": điều chỉnh tương quan giữa 2 nhân tố (construct1, construct2, target: r target)
4. "setRSquared": điều chỉnh R² của biến phụ thuộc (dependent, targetR2)
5. "adjustAlpha": điều chỉnh Cronbach's Alpha (construct, targetAlpha)
6. "showStats": hiển thị thống kê chi tiết
7. "regenerate": tạo lại toàn bộ dữ liệu
8. "respond": trả lời không thay đổi dữ liệu
9. "fixAll": chạy toàn bộ chu trình tối ưu (ko cần params)

LUÔN TRẢ LỜI BẰNG JSON CHUẨN, định dạng:
{"message": "câu trả lời bằng tiếng Việt, ngắn gọn", "actions": [{"type": "tên_hành_động", "params": {...}}]}

Nếu không cần thay đổi dữ liệu, actions là [].
Chỉ dùng đúng tên nhân tố có trong dữ liệu. Phân tích kỹ số liệu trước khi quyết định hành động. Ưu tiên dùng fixAll nếu cần cải thiện nhiều chỉ số cùng lúc.`;

async function processAiWithAI(text) {
  const constructs = [...new Set(variables.filter(v => v.construct).map(v => v.construct))];
  if (!generatedData) {
    aiRespond('❌ Chưa có dữ liệu. Hãy tạo dữ liệu trước!', 'system');
    return;
  }
  setAiThinking(true);
  try {
    const context = buildDataContext();
    const resp = await callDeepSeek([
      { role: 'system', content: AI_SYSTEM_PROMPT + '\n\n' + context },
      { role: 'user', content: text }
    ]);
    const parsed = JSON.parse(resp);
    const msg = parsed.message || '✅ Đã thực hiện yêu cầu.';
    if (parsed.actions && parsed.actions.length > 0) {
      executeAiActions(parsed.actions, constructs);
    }
    aiRespond(msg);
  } catch (e) {
    console.error('AI error:', e);
    processAiRuleBased(text);
  }
  setAiThinking(false);
}

function takeSnapshot() {
  if (!generatedData) return;
  _dataSnapshot = generatedData.rawRows.map(row => ({ ...row }));
}

function computeDiff() {
  _changedCells = {};
  if (!_dataSnapshot || !generatedData) return;
  const oldCols = generatedData.colNames;
  generatedData.rawRows.forEach((row, ri) => {
    const oldRow = _dataSnapshot[ri];
    if (!oldRow) return;
    oldCols.forEach(c => {
      const oldVal = oldRow[c];
      const newVal = row[c];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        if (!_changedCells[ri]) _changedCells[ri] = {};
        _changedCells[ri][c] = { oldVal, newVal };
      }
    });
  });
  _dataSnapshot = null;
}

function buildChangeSummary() {
  const totalChanged = Object.values(_changedCells).reduce((sum, cols) => sum + Object.keys(cols).length, 0);
  if (totalChanged === 0) return '';
  const rowCount = Object.keys(_changedCells).length;
  const changedCols = new Set();
  Object.values(_changedCells).forEach(cols => Object.keys(cols).forEach(c => changedCols.add(c)));
  return `📝 **${totalChanged}** ô dữ liệu đã thay đổi (${rowCount} dòng, ${changedCols.size} biến: ${[...changedCols].join(', ')}). Các ô được tô màu trong bảng preview.`;
}

function executeAiActions(actions, constructs) {
  const modifyActions = ['adjustMean','addNoise','setCorrelation','setRSquared','adjustAlpha','regenerate'];
  const hasModify = actions.some(a => modifyActions.includes(a.type));
  if (hasModify) takeSnapshot();

  actions.forEach(action => {
    try {
      const p = action.params || {};
      switch (action.type) {
        case 'adjustMean': aiAdjustMeanDirect(p.construct, p.delta, constructs); break;
        case 'addNoise': aiAddNoiseDirect(p.construct, p.amount || 0.3, constructs); break;
        case 'setCorrelation': aiSetCorrelationDirect(p.construct1, p.construct2, p.target, constructs); break;
        case 'setRSquared': aiSetRSquaredDirect(p.dependent, p.targetR2, constructs); break;
        case 'adjustAlpha': aiAdjustAlphaDirect(p.construct, p.targetAlpha, constructs); break;
        case 'showStats': aiShowStatsDirect(p.construct, constructs); break;
        case 'regenerate': _aiBackup = null; smartGenerate(); break;
        case 'fixAll': _execAutoFixAll(); break;
      }
    } catch (e) { console.error('Action error:', action, e); }
  });

  if (generatedData && hasModify) {
    computeDiff();
    refreshAfterChangeNoMsg();
    const summary = buildChangeSummary();
    if (summary) addAiMsg(summary, 'ai');
  }
}

function _flashCard() {
  const card = document.getElementById('quality-card');
  if (!card) return;
  card.style.transition = 'outline .3s, box-shadow .3s, transform .3s';
  card.style.outline = '3px solid #f59e0b';
  card.style.boxShadow = '0 0 24px rgba(245,158,11,0.45)';
  card.style.transform = 'scale(1.005)';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => {
    card.style.outline = '';
    card.style.boxShadow = '';
    card.style.transform = '';
  }, 1500);
}

function refreshAfterChangeNoMsg() {
  if (!generatedData) return;
  _dataVersion++;
  const { rawRows, colNames } = generatedData;
  updatePreview(rawRows, colNames);
  const cs = {};
  variables.forEach(v => { if (v.construct) { if (!cs[v.construct]) cs[v.construct] = []; cs[v.construct].push(v); } });
  try {
    showQualityReport(rawRows, cs, rawRows.length);
  } catch (e) {
    console.error('Quality report error:', e);
    showToast('❌ Lỗi cập nhật báo cáo: ' + e.message, 'error');
  }
  _flashCard();
  const statusEl = document.getElementById('gen-status');
  statusEl.textContent = '🤖 Dữ liệu đã được AI can thiệp (v' + _dataVersion + ')';
  showToast('📊 Báo cáo đã cập nhật (v' + _dataVersion + ')', 'info');
}

function aiAdjustMeanDirect(construct, delta, constructs) {
  if (!generatedData) return;
  const items = findAllItems(construct);
  if (!items.length) return;
  const itemNames = items.map(v => v.name);
  const scale = items[0]?.scale || 5;
  generatedData.rawRows.forEach(row => {
    itemNames.forEach(n => {
      if (typeof row[n] === 'number' && !isNaN(row[n])) {
        row[n] = Math.min(scale, Math.max(1, Math.round(row[n] + delta)));
      }
    });
  });
  items.forEach(v => {
    const idx = generatedData.colNames.indexOf(v.name);
    if (idx === -1 || !v.labels) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][v.name];
      lr[v.name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
}

function aiAddNoiseDirect(construct, amount, constructs) {
  if (!generatedData) return;
  const items = findAllItems(construct);
  if (!items.length) return;
  const itemNames = items.map(v => v.name);
  const scale = items[0]?.scale || 5;
  generatedData.rawRows.forEach(row => {
    itemNames.forEach(n => {
      if (typeof row[n] === 'number' && !isNaN(row[n])) {
        row[n] = Math.min(scale, Math.max(1, Math.round(row[n] + normalRandom(0, amount))));
      }
    });
  });
  items.forEach(v => {
    const idx = generatedData.colNames.indexOf(v.name);
    if (idx === -1 || !v.labels) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][v.name];
      lr[v.name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
}

function aiSetCorrelationDirect(c1, c2, targetR, constructs) {
  if (!generatedData || !c1 || !c2 || c1 === c2) return;
  const items1 = findAllItems(c1).map(v => v.name);
  const items2 = findAllItems(c2).map(v => v.name);
  const scale = findAllItems(c1)[0]?.scale || 5;
  const scores1 = generatedData.rawRows.map(r => { let s=0,c=0; items1.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){s+=v;c++;}}); return c>0?s/c:null; });
  const scores2 = generatedData.rawRows.map(r => { let s=0,c=0; items2.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){s+=v;c++;}}); return c>0?s/c:null; });
  const validIdxs = [];
  for (let i = 0; i < generatedData.n; i++) { if (scores1[i] !== null && scores2[i] !== null) validIdxs.push(i); }
  const n = validIdxs.length;
  if (n < 10) return;
  const valid1 = validIdxs.map(i => scores1[i]);
  const valid2 = validIdxs.map(i => scores2[i]);
  const m1 = valid1.reduce((a,b)=>a+b,0)/n;
  const m2 = valid2.reduce((a,b)=>a+b,0)/n;
  const sd1 = Math.sqrt(valid1.reduce((a,b)=>a+(b-m1)**2,0)/n);
  const sd2 = Math.sqrt(valid2.reduce((a,b)=>a+(b-m2)**2,0)/n);
  if (sd1 <= 0 || sd2 <= 0) return;
  const z1 = valid1.map(v => (v - m1) / sd1);
  const z2 = valid2.map(v => (v - m2) / sd2);
  const dot = z1.reduce((a,b,i)=>a+b*z2[i],0)/n;
  const z2_orth = z2.map((v,i) => v - dot * z1[i]);
  const orthNorm = Math.sqrt(z2_orth.reduce((a,b)=>a+b*b,0)/n) || 1;
  const z2_new = z1.map((v,i) => targetR * v + Math.sqrt(Math.max(0, 1 - targetR * targetR)) * z2_orth[i] / orthNorm);
  const newScores = z2_new.map(v => v * sd2 + m2);
  validIdxs.forEach((ri, idx) => {
    const delta = newScores[idx] - scores2[ri];
    items2.forEach(n => {
      if (typeof generatedData.rawRows[ri][n] === 'number' && !isNaN(generatedData.rawRows[ri][n])) {
        generatedData.rawRows[ri][n] = Math.min(scale, Math.max(1, Math.round(generatedData.rawRows[ri][n] + delta)));
      }
    });
  });
  findAllItems(c2).forEach(v => {
    const idx = generatedData.colNames.indexOf(v.name);
    if (idx === -1 || !v.labels) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][v.name];
      lr[v.name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
}

function aiSetRSquaredDirect(dvKey, targetR2, constructs) {
  if (!generatedData || !dvKey) return;
  const allVars = variables.filter(v => v.construct);
  const allCons = [...new Set(allVars.map(v => v.construct))];
  const predictors = allCons.filter(k => k !== dvKey && allVars.find(v => v.construct === k)?.role !== 'moderating');
  if (predictors.length === 0) return;

  const comp = {};
  [...predictors, dvKey].forEach(k => {
    const its = findAllItems(k).map(v => v.name);
    comp[k] = generatedData.rawRows.map(r => {
      let s=0,c=0; its.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){s+=v;c++;}}); return c>0?s/c:null;
    });
  });

  const valid = [];
  for (let i = 0; i < generatedData.n; i++) {
    if (comp[dvKey][i] !== null && predictors.every(p => comp[p][i] !== null)) valid.push(i);
  }
  const n = valid.length;
  if (n < 10) return;

  const y = valid.map(i => comp[dvKey][i]);
  const yMean = y.reduce((a,b)=>a+b,0)/n;
  const ySd = Math.sqrt(y.reduce((a,b)=>a+(b-yMean)**2,0)/n);
  if (ySd <= 0) return;
  const zY = y.map(v => (v - yMean) / ySd);

  const X = predictors.map(p => {
    const x = valid.map(i => comp[p][i]);
    const m = x.reduce((a,b)=>a+b,0)/n;
    const s = Math.sqrt(x.reduce((a,b)=>a+(b-m)**2,0)/n) || 1;
    return { raw: x, mean: m, sd: s || 1, z: x.map(v => (v - m) / (s || 1)) };
  });

  const k = predictors.length;
  const Z = X.map(xv => xv.z);
  const ZtZ = Array.from({length:k}, (_,i) => Array.from({length:k}, (_,j) => {
    let s=0; for(let ri=0; ri<n; ri++) s += Z[i][ri] * Z[j][ri];
    return s / n;
  }));
  const Zty = predictors.map((_,i) => {
    let s=0; for(let ri=0; ri<n; ri++) s += Z[i][ri] * zY[ri];
    return s / n;
  });
  const ZtZinv = matInverse(ZtZ);
  if (!ZtZinv) return;
  const beta = ZtZinv.map(r => r.reduce((a,v,j) => a + v * Zty[j], 0));

  const currentR2 = Math.max(0.01, Math.min(0.99, beta.reduce((a,b,j) => a + b * Zty[j], 0)));
  const targetR2clamped = Math.max(0.02, Math.min(0.98, targetR2));
  const scale = Math.sqrt(targetR2clamped / currentR2);

  const betaNew = beta.map(b => b * scale);

  const yHat = Array(n).fill(0);
  for (let ri = 0; ri < n; ri++) {
    for (let j = 0; j < k; j++) yHat[ri] += Z[j][ri] * betaNew[j];
  }
  const eOld = zY.map((v,i) => v - yHat[i]);
  const eVar = eOld.reduce((a,v)=>a+v*v,0)/n;
  const eScale = eVar > 0 ? Math.sqrt(Math.max(0, 1 - targetR2clamped) / eVar) : 1;
  const zYnew = yHat.map((yh, i) => yh + eOld[i] * eScale);
  const yNew = zYnew.map(v => v * ySd + yMean);

  const dvItems = findAllItems(dvKey).map(v => v.name);
  const dvScale = findAllItems(dvKey)[0]?.scale || 5;
  let totalChanged = 0;
  valid.forEach((ri, idx) => {
    const targetSum = yNew[idx] * dvItems.length;
    const currentSum = dvItems.reduce((s, n) => s + (typeof generatedData.rawRows[ri][n] === 'number' ? generatedData.rawRows[ri][n] : 0), 0);
    let needed = Math.round(targetSum - currentSum);
    if (needed === 0) return;
    let safety = 1000;
    while (needed !== 0 && safety-- > 0) {
      if (needed > 0) {
        const candidates = dvItems.map(n => ({ n, v: generatedData.rawRows[ri][n] }))
          .filter(x => typeof x.v === 'number' && !isNaN(x.v) && x.v < dvScale);
        if (!candidates.length) break;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        generatedData.rawRows[ri][pick.n] = pick.v + 1;
        needed--; totalChanged++;
      } else {
        const candidates = dvItems.map(n => ({ n, v: generatedData.rawRows[ri][n] }))
          .filter(x => typeof x.v === 'number' && !isNaN(x.v) && x.v > 1);
        if (!candidates.length) break;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        generatedData.rawRows[ri][pick.n] = pick.v - 1;
        needed++; totalChanged++;
      }
    }
  });
  findAllItems(dvKey).forEach(v => {
    const idx = generatedData.colNames.indexOf(v.name);
    if (idx === -1 || !v.labels) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][v.name];
      lr[v.name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
}

function aiAdjustAlphaDirect(construct, targetAlpha, constructs) {
  if (!generatedData || !construct) return;
  const items = findAllItems(construct).map(v => v.name);
  if (items.length < 3) return;
  const scale = findAllItems(construct)[0]?.scale || 5;

  const rows = generatedData.rawRows;
  const n = rows.length;
  const scores = items.map(name => rows.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
  const valid = [];
  for (let i = 0; i < n; i++) { if (scores.every(col => col[i] !== null)) valid.push(i); }
  const m = valid.length;
  if (m < 5) return;
  const itemMeans = items.map((_, idx) => {
    const vals = valid.map(i => scores[idx][i]);
    return vals.reduce((a,b)=>a+b,0)/m;
  });
  const itemVars = items.map((_, idx) => {
    const vals = valid.map(i => scores[idx][i]);
    const mn = itemMeans[idx];
    return vals.reduce((a,b)=>a+(b-mn)**2,0)/m;
  });
  const sumVar = itemVars.reduce((a,b)=>a+b,0);
  const totalVar = items.reduce((a,_,i)=>a + items.reduce((a2,_,j)=> {
    const valsI = valid.map(ri => scores[i][ri]);
    const valsJ = valid.map(ri => scores[j][ri]);
    const mnI = itemMeans[i], mnJ = itemMeans[j];
    return a2 + valsI.reduce((a3,b,ri2)=>a3+(b-mnI)*(valsJ[ri2]-mnJ),0)/m;
  }, 0), 0);
  const currentAlpha = totalVar > 0 ? (items.length/(items.length-1))*(1-sumVar/totalVar) : 0;
  if (currentAlpha <= 0) return;

  const composite = valid.map(ri => items.reduce((s,n)=>s+rows[ri][n],0)/items.length);

  const alphaDiff = targetAlpha - currentAlpha;
  const direction = alphaDiff > 0 ? 1 : -1;
  const nSteps = Math.ceil(Math.abs(alphaDiff) / 0.05);
  let totalChanged = 0;

  valid.forEach((ri, idx) => {
    const comp = composite[idx];
    const devs = items.map(name => ({ name, dev: rows[ri][name] - comp }));
    devs.sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev));

    if (direction > 0) {
      devs.forEach(({ name, dev }) => {
        const old = rows[ri][name];
        if (typeof old !== 'number' || isNaN(old)) return;
        if (Math.abs(dev) < 0.3) return;
        const steps = Math.min(nSteps, Math.ceil(Math.abs(dev) - 0.3));
        let newVal = old + (dev > 0 ? -steps : steps);
        newVal = Math.min(scale, Math.max(1, newVal));
        if (newVal !== old) { rows[ri][name] = newVal; totalChanged++; }
      });
    } else {
      devs.forEach(({ name, dev }) => {
        const old = rows[ri][name];
        if (typeof old !== 'number' || isNaN(old)) return;
        if (Math.abs(dev) > 0.8) return;
        const pushDir = dev >= 0 ? 1 : -1;
        const steps = Math.min(nSteps, 1);
        let newVal = old + pushDir * steps;
        newVal = Math.min(scale, Math.max(1, newVal));
        if (newVal !== old) { rows[ri][name] = newVal; totalChanged++; }
      });
      if (nSteps >= 2) {
        devs.forEach(({ name }) => {
          const old = rows[ri][name];
          if (typeof old !== 'number' || isNaN(old)) return;
          if (Math.random() > 0.3) return;
          const noise = Math.floor(Math.random() * 3) - 1;
          let newVal = old + noise;
          newVal = Math.min(scale, Math.max(1, newVal));
          if (newVal !== old) { rows[ri][name] = newVal; totalChanged++; }
        });
      }
    }
  });

  findAllItems(construct).forEach(v => {
    const idx = generatedData.colNames.indexOf(v.name);
    if (idx === -1 || !v.labels) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][v.name];
      lr[v.name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
}

function aiShowStatsDirect(construct, constructs) {
  aiShowStats(construct, constructs);
}

function processAiCommand(text) {
  try {
    processAiWithAI(text);
  } catch (e) {
    if (!generatedData) {
      aiRespond('❌ Chưa có dữ liệu. Hãy tạo dữ liệu trước!\n\n➡️ Click 1 trong các **mẫu nhanh** (3 IV → 1 DV, IV → Trung gian → DV,...) hoặc thêm nhân tố thủ công, sau đó bấm **🎯 Tạo dữ liệu**.', 'system');
      return;
    }
    processAiRuleBased(text);
  }
}

function processAiRuleBased(text) {
  const lower = text.toLowerCase().trim();
  const constructs = [...new Set(variables.filter(v => v.construct).map(v => v.construct))];

  if (/^(giúp|help|huong dan|hướng dẫn|\?)$/i.test(lower)) {
    return aiHelp();
  }

  if (/^(tạo lại|tao lai|reset|generate lại|gen lại)$/i.test(lower)) {
    if (!generatedData) return aiRespond('Chưa có dữ liệu để tạo lại. Hãy bấm "🎯 Tạo dữ liệu" trước.', 'system');
    _aiBackup = null;
    smartGenerate();
    return aiRespond('✅ Đã tạo lại dữ liệu hoàn toàn mới!');
  }

  let m = lower.match(/^(mean|trung bình|thống kê|thong ke|xem)\s+(.+)$/i);
  if (m) return aiShowStats(m[2].trim(), constructs);

  m = lower.match(/^(tăng|tang|increase)\s+(.+?)(?:\s+(lên|len|thêm|them)\s+)?(\d+\.?\d*)$/i);
  if (m) return aiAdjustMean(m[2].trim(), parseFloat(m[3]), 1, constructs);

  m = lower.match(/^(giảm|giam|decrease|reduce)\s+(.+?)(?:\s+(xuống|xuong|bớt|bot)\s+)?(\d+\.?\d*)$/i);
  if (m) return aiAdjustMean(m[2].trim(), parseFloat(m[3]), -1, constructs);

  m = lower.match(/^(nhiễu|nhieu|noise)\s+(.+?)(?:\s+(\d+\.?\d*))?$/i);
  if (m) return aiAddNoise(m[2].trim(), m[3] ? parseFloat(m[3]) : 0.3, constructs);

  m = lower.match(/^(?:r\s*[²2]|r-squared|r bình phương)\s+(.+?)(?:\s+(?:lên|là|thanh|thành|=)\s+)?(\d+\.?\d*)$/i);
  if (m) return aiSetRSquared(m[1].trim(), parseFloat(m[2]), constructs);
  m = lower.match(/^(?:tăng|tang|set|chỉnh|chinh|dieu chinh|điều chỉnh)\s+r\s*[²2]\s+(?:của|cua)\s+(.+?)(?:\s+(?:lên|là|thanh|thành|=)\s+)?(\d+\.?\d*)$/i);
  if (m) return aiSetRSquared(m[1].trim(), parseFloat(m[2]), constructs);

  m = lower.match(/^(?:alpha|cronbach)\s+(.+?)(?:\s+(?:lên|len|is|la|thanh|thành)\s+)?(\d+\.?\d*)$/i);
  if (m) return aiAdjustAlpha(m[1].trim(), parseFloat(m[2]), constructs);
  m = lower.match(/^(?:tăng|tang|set|chỉnh|chinh)\s+(?:alpha|cronbach)\s+(?:của|cua)\s+(.+?)(?:\s+(?:lên|len|is|la|thanh|thành|=)\s+)?(\d+\.?\d*)$/i);
  if (m) return aiAdjustAlpha(m[1].trim(), parseFloat(m[2]), constructs);

  m = lower.match(/^(tương quan|tuong quan|correlation)\s+(.+)$/i);
  if (m) return aiCorrelation(m[2].trim(), constructs);

  m = lower.match(/^corr\s+(.+?)\s+(.+?)\s+(\d+\.?\d*)$/i);
  if (m) return aiSetCorrelation(m[1].trim(), m[2].trim(), parseFloat(m[3]), constructs);

  // Module 2: Research knowledge commands
  m = lower.match(/^(?:knowledge|hiểu biết|phân tích)\s+(.+)$/i);
  if (m) {
    const topic = m[1].trim();
    const pattern = RESEARCH_KNOWLEDGE ? RESEARCH_KNOWLEDGE.matchResearchPattern(topic) : null;
    if (pattern) {
      let html = `📚 **${pattern.label}** — ${pattern.description}<br><br>`;
      html += `<strong>Các nhân tố phổ biến:</strong> ${pattern.commonConstructs.join(', ')}<br>`;
      html += `<strong>R² điển hình:</strong> ${pattern.typicalR2[0]}-${pattern.typicalR2[1]}<br><br>`;
      html += `<strong>Các mối quan hệ điển hình:</strong><br>`;
      pattern.typicalRelationships.forEach(([from, to, range]) => {
        html += `• ${from} → ${to}: β = [${range[0]}, ${range[1]}]<br>`;
      });
      return aiRespond(html);
    }
    return aiRespond(`❌ Không tìm thấy mẫu nghiên cứu nào cho chủ đề "${topic}". Thử: adoption, satisfaction, loyalty, TAM, purchase_intention, service_quality, UTAUT`, 'system');
  }

  m = lower.match(/^(?:gợi ý|suggest)\s+(.+)$/i);
  if (m && RESEARCH_KNOWLEDGE) {
    const construct = m[1].trim().toLowerCase();
    const hints = RESEARCH_KNOWLEDGE.constructRoleHints;
    const found = Object.keys(hints).find(k => k.toLowerCase().includes(construct) || construct.includes(k.toLowerCase()));
    if (found) {
      const h = hints[found];
      return aiRespond(`💡 **Gợi ý cho nhân tố "${found}":**<br>• Vai trò điển hình: ${h.role}<br>• Thang đo: ${h.typicalScale} (${h.items} items)<br>• Thường được sử dụng trong các mô hình ${RESEARCH_KNOWLEDGE.matchResearchPattern(found)?.label || 'nghiên cứu hành vi'}`);
    }
    const allNames = Object.keys(hints).join(', ');
    return aiRespond(`❌ Không tìm thấy "${construct}". Các nhân tố có sẵn: ${allNames}`, 'system');
  }

  // Module 6: Interpretation command
  m = lower.match(/^(?:diễn giải|dien giai|interpret|giải thích)$/i);
  if (m) {
    if (!_regressionResults) return aiRespond('❌ Chưa có kết quả hồi quy để diễn giải. Hãy tạo dữ liệu trước.', 'system');
    const html = generateFullInterpretation();
    return aiRespond(html);
  }

  // Module 7: Consistency check command
  m = lower.match(/^(?:nhất quán|nhat quan|consistency|kiểm tra|kiem tra)\s*(?:mô hình|mo hinh|nghiên cứu)?$/i);
  if (m) {
    showConsistencyReport();
    return aiRespond('🔄 Đã kiểm tra tính nhất quán của mô hình nghiên cứu. Xem kết quả trong phần báo cáo chất lượng.');
  }

  aiRespond(`🤔 Mình chưa hiểu yêu cầu "${text}".\n\nThử các lệnh:\n• \`tăng CL lên 0.5\`\n• \`giảm GC xuống 0.3\`\n• \`r² GC 0.6\`\n• \`alpha GC 0.85\`\n• \`nhiễu HL\`\n• \`tương quan CL và GC\`\n• \`mean CL\`\n• \`tạo lại\`\n• \`knowledge adoption\`\n• \`gợi ý Trust\`\n• \`diễn giải\`\n• \`kiểm tra\`\n• \`giúp\``, 'system');
}

function aiHelp() {
  const help = `🤖 **Trợ lý Dữ liệu** — Tôi giúp bạn can thiệp vào dữ liệu sau khi đã tạo.

**Các lệnh hỗ trợ:**

📊 **Điều chỉnh mean**
• \`tăng CL lên 0.5\` — tăng mean của nhân tố CL
• \`giảm GC xuống 0.3\` — giảm mean của GC

📈 **Tương quan & R²**
• \`tương quan CL và GC\` — xem tương quan
• \`corr CL GC 0.6\` — đặt target tương quan
• \`r² GC 0.6\` — đặt R² của biến phụ thuộc GC
• \`tăng r² của GC lên 0.6\` — tăng R² của GC

📐 **Cronbach's Alpha**
• \`alpha CL 0.85\` — đặt alpha của CL
• \`tăng alpha của CL lên 0.9\` — tăng alpha

🌊 **Nhiễu**
• \`nhiễu HL\` — thêm nhiễu cho nhân tố HL
• \`nhiễu CL 0.5\` — nhiễu mức 0.5

📋 **Thống kê**
• \`mean CL\` — xem thống kê của CL

📚 **Research Knowledge** (Module 2)
• \`knowledge adoption\` — xem mẫu nghiên cứu adoption
• \`gợi ý Trust\` — xem gợi ý về nhân tố Trust

📝 **Diễn giải tự động** (Module 6)
• \`diễn giải\` — xem diễn giải học thuật tự động

🔄 **Kiểm tra nhất quán** (Module 7)
• \`kiểm tra\` — kiểm tra tính nhất quán của mô hình

🔄 **Khác**
• \`tạo lại\` — tạo lại toàn bộ dữ liệu
• \`giúp\` — xem hướng dẫn này`;
  aiRespond(help);
}

function aiRespond(text, type) {
  addAiMsg(text.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\`(.+?)\`/g, '<code style="background:var(--gray-200);padding:.1em .35em;border-radius:3px;font-size:.8em">$1</code>'), type || 'assistant');
}

function findConstruct(keyword, constructs) {
  const kw = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
  const allConstructs = [...new Set(variables.filter(v => v.construct).map(v => ({ key: v.construct, label: (v.constructLabel || '').toLowerCase() })))];
  let found = allConstructs.find(c => c.key.toLowerCase() === kw);
  if (found) return found.key;
  found = allConstructs.find(c => c.key.toLowerCase().startsWith(kw) || kw.startsWith(c.key.toLowerCase()));
  if (found) return found.key;
  found = allConstructs.find(c => c.label.includes(kw) || kw.includes(c.key.toLowerCase()));
  if (found) return found.key;
  return null;
}

function findAllItems(constructKey) {
  return variables.filter(v => v.construct === constructKey);
}

function refreshAfterChange(msg) {
  if (!generatedData) return;
  _dataVersion++;
  const { rawRows, colNames } = generatedData;
  computeDiff();
  updatePreview(rawRows, colNames);
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v);
    }
  });
  try {
    showQualityReport(rawRows, constructs, rawRows.length);
  } catch (e) {
    console.error('Quality report error:', e);
    showToast('❌ Lỗi cập nhật báo cáo: ' + e.message, 'error');
  }
  _flashCard();
  const statusEl = document.getElementById('gen-status');
  statusEl.textContent = '🤖 Dữ liệu đã được AI can thiệp (v' + _dataVersion + ')';
  const summary = buildChangeSummary();
  aiRespond(msg + (summary ? '<br>' + summary : ''));
  showToast('📊 Báo cáo đã cập nhật (v' + _dataVersion + ')', 'info');
}

function aiAdjustAlpha(keyword, targetAlpha, constructs) {
  if (!generatedData) return aiRespond('❌ Chưa có dữ liệu. Hãy tạo dữ liệu trước!', 'system');
  if (targetAlpha < 0.3 || targetAlpha > 0.98) return aiRespond('❌ Alpha target phải trong khoảng 0.3–0.98.', 'system');
  const c = findConstruct(keyword, constructs);
  if (!c) return aiRespond(`❌ Không tìm thấy nhân tố "${keyword}". Các nhân tố: ${constructs.join(', ')}`, 'system');
  takeSnapshot();
  aiAdjustAlphaDirect(c, targetAlpha, constructs);
  const label = constructs.find(k => findAllItems(k)[0]?.constructLabel) || c;
  const items = findAllItems(c).map(v => v.name);
  if (items.length < 2) { refreshAfterChange(`Đã điều chỉnh alpha của **${label}**.`); return; }
  const rows = generatedData.rawRows;
  const scores = items.map(name => rows.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
  const valid = []; const n2=rows.length;
  for (let i=0;i<n2;i++){if(scores.every(col=>col[i]!==null))valid.push(i);}
  const m2=valid.length;
  const itemMeans = items.map((_,idx)=>{const v=valid.map(i=>scores[idx][i]);return v.reduce((a,b)=>a+b,0)/m2;});
  const sumVar = items.reduce((a,_,i)=>{const v=valid.map(ri=>scores[i][ri]),mn=itemMeans[i];return a+v.reduce((a2,b)=>a2+(b-mn)**2,0)/m2;},0);
  const totalVar = items.reduce((a,_,i)=>a+items.reduce((a2,_,j)=>{
    const vI=valid.map(ri=>scores[i][ri]),vJ=valid.map(ri=>scores[j][ri]),mnI=itemMeans[i],mnJ=itemMeans[j];
    return a2+vI.reduce((a3,b,ri2)=>a3+(b-mnI)*(vJ[ri2]-mnJ),0)/m2;
  },0),0);
  const actualAlpha = totalVar>0 ? (items.length/(items.length-1))*(1-sumVar/totalVar) : 0;
  const diff = Math.abs(actualAlpha - targetAlpha);
  refreshAfterChange(`📊 Alpha của **${label}**: target=${targetAlpha}, thực tế=${actualAlpha.toFixed(3)} (${diff<0.05?'✅ đạt':'⚠️ lệch '+diff.toFixed(3)})`);
}

function aiSetRSquared(keyword, targetR2, constructs) {
  if (!generatedData) return aiRespond('❌ Chưa có dữ liệu. Hãy tạo dữ liệu trước!', 'system');
  const c = findConstruct(keyword, constructs);
  if (!c) return aiRespond(`❌ Không tìm thấy nhân tố "${keyword}". Các nhân tố: ${constructs.join(', ')}`, 'system');
  takeSnapshot();
  aiSetRSquaredDirect(c, targetR2, constructs);
  const label = constructs.find(k => findAllItems(k)[0]?.constructLabel) || c;
  const actualR2 = computeCompositeR2(c);
  const msg = actualR2 !== null
    ? `📈 R² của **${label}**: target=${targetR2}, thực tế=${actualR2.toFixed(3)} (${Math.abs(actualR2 - targetR2) < 0.05 ? '✅ đạt' : '⚠️ lệch ' + Math.abs(actualR2 - targetR2).toFixed(3)})`
    : `📈 Đã điều chỉnh R² của **${label}** → ${targetR2}`;
  refreshAfterChange(msg);
}

function computeCompositeR2(dvKey) {
  if (!generatedData) return null;
  const allVars = variables.filter(v => v.construct);
  const allCons = [...new Set(allVars.map(v => v.construct))];
  const predictors = allCons.filter(k => k !== dvKey && allVars.find(v => v.construct === k)?.role !== 'moderating');
  if (predictors.length === 0) return null;
  const comp = {};
  [...predictors, dvKey].forEach(k => {
    const its = findAllItems(k).map(v => v.name);
    comp[k] = generatedData.rawRows.map(r => {
      let s=0,c=0; its.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){s+=v;c++;}}); return c>0?s/c:null;
    });
  });
  const valid = [];
  for (let i = 0; i < generatedData.n; i++) {
    if (comp[dvKey][i] !== null && predictors.every(p => comp[p][i] !== null)) valid.push(i);
  }
  const n = valid.length;
  if (n < 5) return null;
  const y = valid.map(i => comp[dvKey][i]);
  const yMean = y.reduce((a,b)=>a+b,0)/n;
  const Z = predictors.map(p => {
    const x = valid.map(i => comp[p][i]);
    const m = x.reduce((a,b)=>a+b,0)/n;
    const s = Math.sqrt(x.reduce((a,b)=>a+(b-m)**2,0)/n) || 1;
    return x.map(v => (v - m) / s);
  });
  const zY = y.map(v => (v - yMean) / (Math.sqrt(y.reduce((a,b)=>a+(b-yMean)**2,0)/n) || 1));
  const k = predictors.length;
  const ZtZinv = matInverse(Array.from({length:k},(_,i)=>Array.from({length:k},(_,j)=>{
    let s=0; for(let ri=0;ri<n;ri++) s+=Z[i][ri]*Z[j][ri]; return s/n;
  })));
  if (!ZtZinv) return null;
  const Zty = predictors.map((_,i)=>{let s=0;for(let ri=0;ri<n;ri++)s+=Z[i][ri]*zY[ri];return s/n;});
  const beta = ZtZinv.map(r => r.reduce((a,v,j) => a+v*Zty[j], 0));
  return Math.max(0, Math.min(1, beta.reduce((a,b,j) => a+b*Zty[j], 0)));
}

function aiAdjustMean(keyword, amount, sign, constructs) {
  if (!generatedData) return aiRespond('❌ Chưa có dữ liệu. Hãy tạo dữ liệu trước!', 'system');
  takeSnapshot();
  const c = findConstruct(keyword, constructs);
  if (!c) return aiRespond(`❌ Không tìm thấy nhân tố "${keyword}". Các nhân tố: ${constructs.join(', ')}`, 'system');
  const items = findAllItems(c);
  const itemNames = items.map(v => v.name);
  const scale = items[0]?.scale || 5;
  const delta = sign * amount;
  let changed = 0;
  generatedData.rawRows.forEach(row => {
    itemNames.forEach(n => {
      if (typeof row[n] === 'number' && !isNaN(row[n])) {
        const old = row[n];
        row[n] = Math.min(scale, Math.max(1, Math.round(row[n] + delta)));
        if (row[n] !== old) changed++;
      }
    });
  });
  items.forEach(v => {
    const idx = generatedData.colNames.indexOf(v.name);
    if (idx === -1 || !v.labels) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][v.name];
      lr[v.name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
  refreshAfterChange(`✅ Đã ${sign > 0 ? 'tăng' : 'giảm'} mean của **${c}** lên ${amount}. ${changed} giá trị được điều chỉnh.`);
}

function aiAddNoise(keyword, amount, constructs) {
  if (!generatedData) return aiRespond('❌ Chưa có dữ liệu. Hãy tạo dữ liệu trước!', 'system');
  takeSnapshot();
  const c = findConstruct(keyword, constructs);
  if (!c) return aiRespond(`❌ Không tìm thấy nhân tố "${keyword}". Các nhân tố: ${constructs.join(', ')}`, 'system');
  const items = findAllItems(c);
  const itemNames = items.map(v => v.name);
  const scale = items[0]?.scale || 5;
  let changed = 0;
  generatedData.rawRows.forEach(row => {
    itemNames.forEach(n => {
      if (typeof row[n] === 'number' && !isNaN(row[n])) {
        const noise = normalRandom(0, amount);
        row[n] = Math.min(scale, Math.max(1, Math.round(row[n] + noise)));
        changed++;
      }
    });
  });
  items.forEach(v => {
    const idx = generatedData.colNames.indexOf(v.name);
    if (idx === -1 || !v.labels) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][v.name];
      lr[v.name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
  refreshAfterChange(`🌊 Đã thêm nhiễu (σ=${amount}) cho **${c}**. ${changed} giá trị được điều chỉnh.`);
}

function aiShowStats(keyword, constructs) {
  if (!generatedData) return aiRespond('❌ Chưa có dữ liệu.', 'system');
  const c = findConstruct(keyword, constructs);
  if (!c) return aiRespond(`❌ Không tìm thấy nhân tố "${keyword}".`, 'system');
  const items = findAllItems(c);
  if (items.length === 0) return aiRespond(`❌ Nhân tố "${c}" không có items.`, 'system');
  const itemNames = items.map(v => v.name);
  const vals = itemNames.map(n => generatedData.rawRows.map(r => r[n]).filter(v => typeof v === 'number' && !isNaN(v)));
  const means = vals.map(v => (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2));
  const sds = vals.map(v => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length).toFixed(3); });
  let html = `📊 **${c}** — ${items.length} items<br><table style="font-size:.8rem;border-collapse:collapse;margin-top:.3rem">`;
  html += '<tr style="font-weight:600"><td style="padding:.15rem .4rem">Item</td><td style="padding:.15rem .4rem;text-align:center">Mean</td><td style="padding:.15rem .4rem;text-align:center">SD</td></tr>';
  itemNames.forEach((n, i) => {
    html += `<tr><td style="padding:.1rem .4rem">${n}</td><td style="padding:.1rem .4rem;text-align:center">${means[i]}</td><td style="padding:.1rem .4rem;text-align:center">${sds[i]}</td></tr>`;
  });
  html += '</table>';
  aiRespond(html);
}

function aiCorrelation(args, constructs) {
  if (!generatedData) return aiRespond('❌ Chưa có dữ liệu.', 'system');
  const parts = args.split(/\s+(?:và|va|&|)\s+/).filter(Boolean);
  if (parts.length < 2) {
    const words = args.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return aiCorrelationDirect(words[0], words[1], constructs);
    }
    return aiRespond('❌ Vui lòng nhập: `tương quan CL và GC`', 'system');
  }
  return aiCorrelationDirect(parts[0], parts[1], constructs);
}

function aiCorrelationDirect(kw1, kw2, constructs) {
  const c1 = findConstruct(kw1, constructs);
  const c2 = findConstruct(kw2, constructs);
  if (!c1 || !c2) return aiRespond(`❌ Không tìm thấy nhân tố. Có: ${constructs.join(', ')}`, 'system');
  if (c1 === c2) return aiRespond('⚠️ Không thể tính tương quan của một nhân tố với chính nó.', 'system');
  const items1 = findAllItems(c1).map(v => v.name);
  const items2 = findAllItems(c2).map(v => v.name);
  const scores1 = generatedData.rawRows.map(r => { let s = 0, c = 0; items1.forEach(n => { const v = r[n]; if (typeof v === 'number' && !isNaN(v)) { s += v; c++; } }); return c > 0 ? s / c : null; }).filter(v => v !== null);
  const scores2 = generatedData.rawRows.map(r => { let s = 0, c = 0; items2.forEach(n => { const v = r[n]; if (typeof v === 'number' && !isNaN(v)) { s += v; c++; } }); return c > 0 ? s / c : null; }).filter(v => v !== null);
  const n = Math.min(scores1.length, scores2.length);
  const m1 = scores1.reduce((a, b) => a + b, 0) / n;
  const m2 = scores2.reduce((a, b) => a + b, 0) / n;
  const sd1 = Math.sqrt(scores1.reduce((a, b) => a + (b - m1) ** 2, 0) / n);
  const sd2 = Math.sqrt(scores2.reduce((a, b) => a + (b - m2) ** 2, 0) / n);
  const r = sd1 > 0 && sd2 > 0 ? scores1.reduce((a, b, i) => a + (b - m1) * (scores2[i] - m2), 0) / n / (sd1 * sd2) : 0;
  aiRespond(`📈 Tương quan **${c1}** ↔ **${c2}**: **${r.toFixed(3)}**\n• Mean ${c1}: ${m1.toFixed(2)} (SD=${sd1.toFixed(3)})\n• Mean ${c2}: ${m2.toFixed(2)} (SD=${sd2.toFixed(3)})\n• N = ${n}`);
}

function aiSetCorrelation(kw1, kw2, targetR, constructs) {
  if (!generatedData) return aiRespond('❌ Chưa có dữ liệu.', 'system');
  takeSnapshot();
  const c1 = findConstruct(kw1, constructs);
  const c2 = findConstruct(kw2, constructs);
  if (!c1 || !c2) return aiRespond(`❌ Không tìm thấy nhân tố.`, 'system');
  const items1 = findAllItems(c1).map(v => v.name);
  const items2 = findAllItems(c2).map(v => v.name);
  const scale = findAllItems(c1)[0]?.scale || 5;

  const scores1 = generatedData.rawRows.map(r => { let s = 0, c = 0; items1.forEach(n => { const v = r[n]; if (typeof v === 'number' && !isNaN(v)) { s += v; c++; } }); return c > 0 ? s / c : null; });
  const scores2 = generatedData.rawRows.map(r => { let s = 0, c = 0; items2.forEach(n => { const v = r[n]; if (typeof v === 'number' && !isNaN(v)) { s += v; c++; } }); return c > 0 ? s / c : null; });

  const validIdxs = [];
  for (let i = 0; i < generatedData.n; i++) { if (scores1[i] !== null && scores2[i] !== null) validIdxs.push(i); }
  const n = validIdxs.length;
  if (n < 10) return aiRespond('❌ Quá ít mẫu để điều chỉnh tương quan.', 'system');

  const valid1 = validIdxs.map(i => scores1[i]);
  const valid2 = validIdxs.map(i => scores2[i]);

  const m1 = valid1.reduce((a, b) => a + b, 0) / n;
  const m2 = valid2.reduce((a, b) => a + b, 0) / n;
  const sd1 = Math.sqrt(valid1.reduce((a, b) => a + (b - m1) ** 2, 0) / n);
  const sd2 = Math.sqrt(valid2.reduce((a, b) => a + (b - m2) ** 2, 0) / n);
  const currentR = sd1 > 0 && sd2 > 0 ? valid1.reduce((a, b, i) => a + (b - m1) * (valid2[i] - m2), 0) / n / (sd1 * sd2) : 0;

  const z1 = valid1.map(v => (v - m1) / sd1);
  const z2 = valid2.map(v => (v - m2) / sd2);
  const dot = z1.reduce((a, b, i) => a + b * z2[i], 0) / n;
  const z2_orth = z2.map((v, i) => v - dot * z1[i]);
  const orthNorm = Math.sqrt(z2_orth.reduce((a, b) => a + b * b, 0) / n) || 1;
  const z2_new = z1.map((v, i) => targetR * v + Math.sqrt(Math.max(0, 1 - targetR * targetR)) * z2_orth[i] / orthNorm);
  const newScores = z2_new.map(v => v * sd2 + m2);

  let changed = 0;
  validIdxs.forEach((ri, idx) => {
    const oldMean = scores2[ri];
    const newMean = newScores[idx];
    const delta = newMean - oldMean;
    items2.forEach(n => {
      if (typeof generatedData.rawRows[ri][n] === 'number' && !isNaN(generatedData.rawRows[ri][n])) {
        generatedData.rawRows[ri][n] = Math.min(scale, Math.max(1, Math.round(generatedData.rawRows[ri][n] + delta)));
        changed++;
      }
    });
  });

  findAllItems(c2).forEach(v => {
    const idx = generatedData.colNames.indexOf(v.name);
    if (idx === -1 || !v.labels) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][v.name];
      lr[v.name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });

  refreshAfterChange(`📈 Đã điều chỉnh tương quan **${c1} ↔ ${c2}**: **${currentR.toFixed(3)} → ${targetR.toFixed(3)}**. ${changed} giá trị được thay đổi.`);
}
