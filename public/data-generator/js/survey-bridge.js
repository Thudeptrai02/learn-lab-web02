// ====== LEARNLAB SURVEY BRIDGE ======
let _llSurveySlug = null;

function initSurveyHours() {
  ['ll-hour-start', 'll-hour-end'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || sel.options.length > 0) return;
    for (let h = 0; h <= 23; h++) {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = String(h).padStart(2, '0') + ':00';
      sel.appendChild(opt);
    }
  });
  const hs = document.getElementById('ll-hour-start');
  const he = document.getElementById('ll-hour-end');
  if (hs) hs.value = '7';
  if (he) he.value = '22';
  const ds = document.getElementById('ll-date-start');
  const de = document.getElementById('ll-date-end');
  if (ds && !ds.value) { const d = new Date(); d.setDate(d.getDate() - 60); ds.value = d.toISOString().split('T')[0]; }
  if (de && !de.value) { de.value = new Date().toISOString().split('T')[0]; }
}

function getLikertLabel(scale, val) {
  const labels5 = ['Rất không đồng ý', 'Không đồng ý', 'Trung lập', 'Đồng ý', 'Rất đồng ý'];
  const labels7 = ['Rất không đồng ý', 'Không đồng ý', 'Hơi không đồng ý', 'Trung lập', 'Hơi đồng ý', 'Đồng ý', 'Rất đồng ý'];
  if (scale === 7) return labels7[val - 1] || String(val);
  return labels5[val - 1] || String(val);
}

async function createLearnLabSurvey() {
  if (variables.length === 0) {
    showToast('Chưa có mô hình. Hãy thêm nhân tố trước.', 'error');
    return;
  }

  const btn = document.getElementById('btn-ll-create');
  btn.disabled = true;
  btn.textContent = '⏳ Đang tạo...';

  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = { label: v.constructLabel || v.construct, role: v.role || 'independent' };
    }
  });

  const constructNames = Object.keys(constructs);
  const title = 'Khảo sát về ' + constructNames.map(k => constructs[k].label).join(' & ');

  const questions = variables
    .filter(v => v.construct)
    .map(v => ({
      variableName: v.name,
      questionText: v.label && v.label !== v.name ? v.label : 'Đánh giá phát biểu: ' + v.name,
      construct: v.construct,
      constructLabel: v.constructLabel || v.construct,
      questionType: 'likert5',
      required: true
    }));

  const description = 'Bài khảo sát này được thực hiện bởi LearnLab nhằm thu thập dữ liệu phục vụ nghiên cứu.';
  const introText = 'Vui lòng đọc kỹ từng phát biểu và chọn mức độ đồng ý của bạn theo thang 5 mức.';

  try {
    const res = await fetch('/api/survey/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, introText, questions })
    });
    const data = await res.json();

    if (data.success) {
      _llSurveySlug = data.slug;
      const badge = document.getElementById('ll-badge');
      badge.textContent = '✅ ' + questions.length + ' câu hỏi';
      badge.style.display = 'inline-block';

      const linkEl = document.getElementById('ll-survey-link');
      const fullUrl = window.location.origin + '/survey/' + data.slug;
      linkEl.innerHTML = '🔗 <a href="' + fullUrl + '" target="_blank" style="color:#0f172a;font-weight:600">' + fullUrl + '</a>';

      document.getElementById('ll-auto-fill').style.display = 'block';
      initSurveyHours();
      updateLLSummary();

      showToast('✅ Đã tạo khảo sát: ' + data.title, 'success');
    } else {
      showToast('Lỗi: ' + (data.error || 'Không thể tạo khảo sát'), 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối: ' + err.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = '📋 Tạo khảo sát từ mô hình';
}

function updateLLSummary() {
  const ds = document.getElementById('ll-date-start');
  const de = document.getElementById('ll-date-end');
  const rateMin = parseInt(document.getElementById('ll-rate-min').value) || 2;
  const rateMax = parseInt(document.getElementById('ll-rate-max').value) || 5;
  const el = document.getElementById('ll-status');
  if (!ds || !de || !ds.value || !de.value) { el.textContent = ''; return; }
  const start = new Date(ds.value);
  const end = new Date(de.value);
  let totalDays = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) totalDays++;
  const avgRate = (rateMin + rateMax) / 2;
  const hoursPerDay = 15;
  const estTotal = totalDays * hoursPerDay * avgRate;
  el.textContent = '⏱ ~' + estTotal + ' response · ' + start.toLocaleDateString('vi-VN') + ' → ' + end.toLocaleDateString('vi-VN');
}

async function autoFillLearnLabSurvey() {
  if (!_llSurveySlug) { showToast('Chưa tạo khảo sát. Bấm "Tạo khảo sát từ mô hình" trước.', 'error'); return; }
  if (!generatedData || !generatedData.rawRows || generatedData.rawRows.length === 0) {
    showToast('Chưa có dữ liệu. Hãy tạo dữ liệu trước.', 'error');
    return;
  }

  const progressDiv = document.getElementById('ll-progress');
  progressDiv.style.display = 'block';
  progressDiv.innerHTML = '⏳ Đang chuẩn bị...';

  const ds = document.getElementById('ll-date-start').value;
  const de = document.getElementById('ll-date-end').value;
  const hStart = parseInt(document.getElementById('ll-hour-start').value);
  const hEnd = parseInt(document.getElementById('ll-hour-end').value);
  const rateMin = parseInt(document.getElementById('ll-rate-min').value) || 2;
  const rateMax = parseInt(document.getElementById('ll-rate-max').value) || 5;

  if (!ds || !de) { showToast('Chọn khoảng ngày hợp lệ', 'error'); return; }

  // Generate schedule matching the generated data size
  const schedule = [];
  const start = new Date(ds);
  const end = new Date(de);
  const targetCount = generatedData.rawRows.length;

  // Try to fit all responses within the date range
  let attempts = 0;
  while (schedule.length < targetCount && attempts < 1000) {
    attempts++;
    for (let d = new Date(start); d <= end && schedule.length < targetCount; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      for (let h = hStart; h <= hEnd && schedule.length < targetCount; h++) {
        const count = rateMin + Math.floor(Math.random() * (rateMax - rateMin + 1));
        for (let i = 0; i < count && schedule.length < targetCount; i++) {
          const minute = Math.floor(Math.random() * 60);
          const second = Math.floor(Math.random() * 60);
          const ts = new Date(d);
          ts.setHours(h, minute, second, 0);
          schedule.push(ts);
        }
      }
    }
    // If range too small, expand it
    if (schedule.length < targetCount) {
      end.setDate(end.getDate() + 7);
    }
  }

  // Sort chronologically
  schedule.sort((a, b) => a - b);

  const rawRows = generatedData.rawRows;
  const colNames = generatedData.colNames;

  // Build responses array
  const responses = [];
  for (let i = 0; i < Math.min(rawRows.length, schedule.length); i++) {
    const row = rawRows[i];
    const ts = schedule[i];
    const timeSpent = 120 + Math.floor(Math.random() * 480); // 2-10 minutes

    const answers = {};
    colNames.forEach(col => {
      if (row[col] !== undefined && row[col] !== null) {
        // Get variable info for mapping
        const varInfo = variables.find(v => v.name === col);
        if (varInfo && varInfo.construct) {
          answers[col] = row[col];
        }
      }
    });

    responses.push({
      submittedAt: ts.toISOString(),
      timeSpentSeconds: timeSpent,
      respondentId: 'auto_' + String(i + 1).padStart(4, '0'),
      answers
    });
  }

  const btn = document.getElementById('btn-ll-fill');
  btn.disabled = true;
  btn.textContent = '⏳ Đang gửi...';

  try {
    const res = await fetch('/api/survey/auto-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: _llSurveySlug, responses })
    });
    const data = await res.json();

    if (data.success) {
      progressDiv.innerHTML = '<div style="padding:.35rem;background:#f0fdf4;border-radius:4px;font-size:.8rem;color:#166534">✅ Đã tự động điền <b>' + data.count + '</b> response vào khảo sát.</div>';
      showToast('✅ Đã điền ' + data.count + ' response!', 'success');
    } else {
      progressDiv.innerHTML = '<div style="padding:.35rem;background:#fef2f2;border-radius:4px;font-size:.8rem;color:#dc2626">❌ Lỗi: ' + (data.error || 'Không thể điền') + '</div>';
      showToast('Lỗi: ' + (data.error || 'Không thể điền'), 'error');
    }
  } catch (err) {
    progressDiv.innerHTML = '<div style="padding:.35rem;background:#fef2f2;border-radius:4px;font-size:.8rem;color:#dc2626">❌ Lỗi: ' + err.message + '</div>';
    showToast('Lỗi kết nối: ' + err.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = '🚀 Tự động điền';
}

document.addEventListener('DOMContentLoaded', function() {
  ['ll-rate-min', 'll-rate-max'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateLLSummary);
  });
  ['ll-date-start', 'll-date-end'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateLLSummary);
  });
});
