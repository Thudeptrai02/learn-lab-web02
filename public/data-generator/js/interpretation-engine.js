// ====== INTERPRETATION ENGINE ======
// Module 6: Auto-generate academic interpretations from quality report data

// Generate full interpretation for a construct's quality metrics
function interpretConstructQuality(constructKey, metrics) {
  const { alpha, avgCorr, avgLoading, ave, kmo, eigenvalue, tve, nItems, role } = metrics;
  let parts = [];

  // Cronbach's Alpha
  if (alpha >= 0.95) {
    parts.push(`Cronbach's Alpha = ${alpha.toFixed(3)} cho thấy thang đo ${constructKey} có độ tin cậy rất cao, tuy nhiên cần kiểm tra hiện tượng trùng lặp item (redundancy) vì α > 0.95.`);
  } else if (alpha >= 0.80) {
    parts.push(`Cronbach's Alpha = ${alpha.toFixed(3)} > 0.80 cho thấy thang đo ${constructKey} đạt độ tin cậy tốt (Nunnally & Bernstein, 1994).`);
  } else if (alpha >= 0.70) {
    parts.push(`Cronbach's Alpha = ${alpha.toFixed(3)} > 0.70 cho thấy thang đo ${constructKey} đạt độ tin cậy chấp nhận được (Nunnally, 1978).`);
  } else if (alpha >= 0.60) {
    parts.push(`Cronbach's Alpha = ${alpha.toFixed(3)} ở mức chấp nhận được trong nghiên cứu khám phá (Hair et al., 2010).`);
  } else {
    parts.push(`Cronbach's Alpha = ${alpha.toFixed(3)} < 0.60 cho thấy thang đo ${constructKey} chưa đạt độ tin cậy. Cần xem xét điều chỉnh hoặc loại bỏ item yếu.`);
  }

  // Average loading
  if (avgLoading >= 0.70) {
    parts.push(`Hệ số tải nhân tố trung bình λ = ${avgLoading.toFixed(3)} ≥ 0.70, cho thấy các biến quan sát giải thích tốt cho nhân tố ${constructKey} (Hair et al., 2010).`);
  } else if (avgLoading >= 0.50) {
    parts.push(`Hệ số tải nhân tố trung bình λ = ${avgLoading.toFixed(3)} ≥ 0.50, đạt yêu cầu về giá trị hội tụ (convergent validity).`);
  } else {
    parts.push(`Hệ số tải nhân tố trung bình λ = ${avgLoading.toFixed(3)} < 0.50, cần xem xét loại bỏ biến có tải thấp.`);
  }

  // AVE
  if (ave >= 0.50) {
    parts.push(`AVE = ${ave.toFixed(3)} ≥ 0.50, thang đo đạt giá trị hội tụ (Fornell & Larcker, 1981).`);
  } else if (ave >= 0.30) {
    parts.push(`AVE = ${ave.toFixed(3)} ở mức chấp nhận được trong nghiên cứu khám phá (tuy nhiên lý tưởng nhất là ≥ 0.50).`);
  } else {
    parts.push(`AVE = ${ave.toFixed(3)} < 0.30 cho thấy phương sai trích chưa đạt yêu cầu.`);
  }

  // KMO
  if (kmo >= 0.80) {
    parts.push(`KMO = ${kmo.toFixed(3)} ≥ 0.80, cho thấy dữ liệu rất phù hợp để phân tích nhân tố (Kaiser, 1974).`);
  } else if (kmo >= 0.70) {
    parts.push(`KMO = ${kmo.toFixed(3)} ≥ 0.70, dữ liệu phù hợp để phân tích nhân tố.`);
  } else if (kmo >= 0.60) {
    parts.push(`KMO = ${kmo.toFixed(3)} ≥ 0.60, dữ liệu ở mức chấp nhận được cho phân tích nhân tố.`);
  } else {
    parts.push(`KMO = ${kmo.toFixed(3)} < 0.60, dữ liệu chưa thực sự phù hợp cho phân tích nhân tố.`);
  }

  // Eigenvalue
  if (eigenvalue > 1) {
    parts.push(`Eigenvalue = ${eigenvalue.toFixed(3)} > 1, nhân tố ${constructKey} giải thích được nhiều phương sai hơn một biến đơn lẻ (Kaiser criterion).`);
  } else {
    parts.push(`Eigenvalue = ${eigenvalue.toFixed(3)} < 1 theo Kaiser criterion, nhân tố này giải thích ít phương sai.`);
  }

  // TVE
  if (tve >= 0.50) {
    parts.push(`Phương sai trích (TVE) = ${(tve * 100).toFixed(1)}% ≥ 50%, nhân tố giải thích được phần lớn phương sai của các biến quan sát.`);
  } else {
    parts.push(`Phương sai trích TVE = ${(tve * 100).toFixed(1)}% < 50%, cần xem xét thêm biến quan sát để cải thiện.`);
  }

  return parts;
}

// Interpret regression results
function interpretRegression(dvKey, dvLabel, predictors, results) {
  const { rSquared, adjRSq, fStat, fSig, paths } = results;
  const n = generatedData ? generatedData.n : 200;
  let parts = [];

  // R²
  if (rSquared >= 0.50) {
    parts.push(`Mô hình hồi quy với biến phụ thuộc ${dvLabel} có R² = ${rSquared.toFixed(3)} (R² hiệu chỉnh = ${adjRSq.toFixed(3)}), cho thấy các biến độc lập giải thích được ${(rSquared * 100).toFixed(1)}% phương sai của ${dvLabel}. Đây là mức giải thích tốt trong nghiên cứu hành vi.`);
  } else if (rSquared >= 0.25) {
    parts.push(`Mô hình hồi quy với biến phụ thuộc ${dvLabel} có R² = ${rSquared.toFixed(3)} (R² hiệu chỉnh = ${adjRSq.toFixed(3)}), cho thấy mức độ giải thích ở mức trung bình. Các biến độc lập giải thích được ${(rSquared * 100).toFixed(1)}% phương sai của ${dvLabel}.`);
  } else {
    parts.push(`Mô hình hồi quy có R² = ${rSquared.toFixed(3)}, mức giải thích còn thấp. Có thể cần bổ sung thêm biến độc lập khác.`);
  }

  // F-test
  if (fSig < 0.05) {
    parts.push(`Kiểm định F cho thấy mô hình hồi quy có ý nghĩa thống kê (F(${Object.keys(paths).length}, ${n - Object.keys(paths).length - 1}) = ${fStat.toFixed(3)}, p = ${fSig.toFixed(4)} < 0.05).`);
  } else {
    parts.push(`Kiểm định F cho thấy mô hình hồi quy chưa có ý nghĩa thống kê (p = ${fSig.toFixed(4)} > 0.05).`);
  }

  // Individual paths
  const sigPaths = [];
  const nonSigPaths = [];
  Object.entries(paths).forEach(([p, info]) => {
    if (info.sig) {
      sigPaths.push({ name: p, beta: info.stdBeta });
    } else {
      nonSigPaths.push({ name: p, pValue: info.pValue });
    }
  });

  if (sigPaths.length > 0) {
    // Sort by absolute beta
    sigPaths.sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
    const strongest = sigPaths[0];
    parts.push(`Trong số các biến có ý nghĩa thống kê, ${strongest.name} có tác động mạnh nhất đến ${dvLabel} (β = ${strongest.beta.toFixed(3)}, p < 0.05).`);

    if (sigPaths.length > 1) {
      const orderStr = sigPaths.map((p, i) => `${i + 1}. ${p.name} (β = ${p.beta.toFixed(3)})`).join('; ');
      parts.push(`Thứ tự tác động từ mạnh đến yếu: ${orderStr}.`);
    }
  }

  if (nonSigPaths.length > 0) {
    parts.push(`Biến ${nonSigPaths.map(p => `${p.name} (p = ${p.pValue.toFixed(4)})`).join(', ')} chưa có ý nghĩa thống kê trong mô hình (p > 0.05).`);
  }

  return parts;
}

// Interpret mediation results
function interpretMediation(pathLabel, aRes, bRes, indirectAB, sobelZ, sobelP, VAF) {
  let parts = [];

  // Path a
  if (aRes.p < 0.05) {
    parts.push(`Tác động của IV lên biến trung gian (path a) có ý nghĩa thống kê (β = ${aRes.b.toFixed(3)}, p = ${aRes.p.toFixed(4)} < 0.05).`);
  } else {
    parts.push(`Tác động của IV lên biến trung gian (path a) chưa có ý nghĩa thống kê (β = ${aRes.b.toFixed(3)}, p = ${aRes.p.toFixed(4)} > 0.05).`);
  }

  // Path b
  if (bRes.p < 0.05) {
    parts.push(`Tác động của biến trung gian lên DV (path b) có ý nghĩa thống kê (β = ${bRes.b.toFixed(3)}, p = ${bRes.p.toFixed(4)} < 0.05).`);
  } else {
    parts.push(`Tác động của biến trung gian lên DV (path b) chưa có ý nghĩa thống kê (β = ${bRes.b.toFixed(3)}, p = ${bRes.p.toFixed(4)} > 0.05).`);
  }

  // Sobel
  if (sobelP < 0.05) {
    parts.push(`Kiểm định Sobel (Z = ${sobelZ.toFixed(3)}, p = ${sobelP.toFixed(4)} < 0.05) xác nhận hiệu ứng gián tiếp có ý nghĩa thống kê.`);
  } else {
    parts.push(`Kiểm định Sobel (Z = ${sobelZ.toFixed(3)}, p = ${sobelP.toFixed(4)} > 0.05) cho thấy hiệu ứng gián tiếp chưa có ý nghĩa thống kê.`);
  }

  // VAF
  if (VAF >= 0.80) {
    parts.push(`VAF = ${(VAF * 100).toFixed(1)}% ≥ 80% cho thấy biến trung gian đóng vai trò trung gian hoàn toàn (full mediation).`);
  } else if (VAF >= 0.20) {
    parts.push(`VAF = ${(VAF * 100).toFixed(1)}% (20-80%) cho thấy biến trung gian đóng vai trò trung gian một phần (partial mediation).`);
  } else {
    parts.push(`VAF = ${(VAF * 100).toFixed(1)}% < 20% cho thấy không có hiệu ứng trung gian đáng kể.`);
  }

  return parts;
}

// Generate full interpretation summary for the entire model
function generateFullInterpretation() {
  if (!_regressionResults) return 'Chưa có kết quả hồi quy để diễn giải.';

  const dvKey = _regressionResults.dvKey;
  const constructKeys = [...new Set(variables.filter(v => v.construct).map(v => v.construct))];
  const dvLabel = variables.find(v => v.construct === dvKey)?.constructLabel || dvKey;
  const predictors = Object.keys(_regressionResults.paths);

  let html = '<div class="var-item" style="background:#f0fdf4;border-color:#86efac;margin-bottom:.5rem">';
  html += '<div style="font-size:.85rem;font-weight:600;margin-bottom:.5rem">📝 Diễn giải kết quả nghiên cứu</div>';

  // Regression interpretation
  const regParts = interpretRegression(dvKey, dvLabel, predictors, _regressionResults);
  html += '<div style="margin-bottom:.35rem;font-size:.8rem">';
  regParts.forEach(p => { html += `<p style="margin:.2rem 0;padding-left:.5rem;border-left:3px solid var(--primary)">${p}</p>`; });
  html += '</div>';

  // Check if there's mediation
  const medConstructs = constructKeys.filter(k => variables.find(v => v.construct === k)?.role === 'mediating');
  if (medConstructs.length > 0) {
    html += '<div style="margin-top:.5rem;font-size:.8rem;font-weight:600;color:var(--gray-700)">🔗 Phân tích trung gian:</div>';
    // Simple mediation interpretation from available data
    html += '<p style="margin:.2rem 0;padding-left:.5rem;border-left:3px solid #d97706;font-size:.8rem">';
    medConstructs.forEach(mk => {
      const mLbl = variables.find(v => v.construct === mk)?.constructLabel || mk;
      html += `Biến trung gian ${mLbl} (${mk}) được kiểm định qua phân tích đường dẫn. Kiểm tra phần phân tích trung gian trong báo cáo chi tiết để xem kết quả Sobel test và VAF. `;
    });
    html += '</p>';
  }

  // Managerial implications
  html += '<div style="margin-top:.5rem;font-size:.8rem;font-weight:600;color:var(--gray-700)">💡 Hàm ý quản trị:</div>';
  html += '<div style="font-size:.8rem">';

  const sigPaths = Object.entries(_regressionResults.paths)
    .filter(([_, info]) => info.sig)
    .sort((a, b) => Math.abs(b[1].stdBeta) - Math.abs(a[1].stdBeta));

  if (sigPaths.length > 0) {
    const strongest = sigPaths[0];
    const strongestLabel = variables.find(v => v.construct === strongest[0])?.constructLabel || strongest[0];
    html += `<p style="margin:.2rem 0;padding-left:.5rem;border-left:3px solid #059669">Kết quả nghiên cứu cho thấy ${strongestLabel} là yếu tố có tác động mạnh nhất đến ${dvLabel}. Do đó, các nhà quản trị nên ưu tiên nguồn lực để cải thiện ${strongestLabel.toLowerCase()} nhằm nâng cao ${dvLabel.toLowerCase()}.</p>`;
  }

  if (sigPaths.length > 1) {
    html += '<p style="margin:.2rem 0;padding-left:.5rem;border-left:3px solid #059669">Các yếu tố khác cũng có tác động đáng kể bao gồm: ';
    sigPaths.slice(1).forEach((p, i) => {
      const lbl = variables.find(v => v.construct === p[0])?.constructLabel || p[0];
      html += `${lbl} (β = ${p[1].stdBeta.toFixed(3)})${i < sigPaths.length - 2 ? ', ' : i < sigPaths.length - 1 ? ' và ' : '. '}`;
    });
    html += 'Việc cải thiện đồng bộ các yếu tố này sẽ mang lại hiệu quả tổng thể cao hơn.</p>';
  }

  html += '</div></div>';

  return html;
}

// Show interpretation in quality report
function addInterpretationToReport() {
  const content = document.getElementById('quality-content');
  if (!content || !_regressionResults) return;
  const html = generateFullInterpretation();
  content.innerHTML += html;
}

// ====== MODULE 7: RESEARCH CONSISTENCY ENGINE ======

// Validate consistency between research model components
function checkResearchConsistency() {
  const constructKeys = [...new Set(variables.filter(v => v.construct).map(v => v.construct))];
  if (constructKeys.length === 0) return [];

  const issues = [];
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v);
    }
  });

  // 1. Check role consistency: DV should have predictors
  const dvKeys = constructKeys.filter(k => constructs[k][0]?.role === 'dependent');
  const ivKeys = constructKeys.filter(k => constructs[k][0]?.role === 'independent');
  const medKeys = constructKeys.filter(k => constructs[k][0]?.role === 'mediating');

  dvKeys.forEach(dv => {
    const allPossible = [...ivKeys, ...medKeys];
    if (allPossible.length === 0) {
      issues.push({ type: 'missing_predictors', severity: 'high',
        message: `Biến phụ thuộc ${dv} không có biến độc lập nào dự đoán. Mô hình hồi quy sẽ không chạy được.` });
    }
  });

  // 2. Check if mediating variables have both IV antecedents and DV consequences
  medKeys.forEach(med => {
    if (ivKeys.length === 0) {
      issues.push({ type: 'mediation_no_iv', severity: 'high',
        message: `Biến trung gian ${med} cần ít nhất một biến độc lập (IV) tác động vào nó.` });
    }
    if (dvKeys.length === 0) {
      issues.push({ type: 'mediation_no_dv', severity: 'high',
        message: `Biến trung gian ${med} cần ít nhất một biến phụ thuộc (DV) để tác động vào.` });
    }
  });

  // 3. Check construct number
  if (constructKeys.length < 2) {
    issues.push({ type: 'too_few_constructs', severity: 'medium',
      message: `Mô hình chỉ có ${constructKeys.length} nhân tố. Mô hình nghiên cứu thường có ít nhất 2-3 nhân tố.` });
  } else if (constructKeys.length > 8) {
    issues.push({ type: 'too_many_constructs', severity: 'low',
      message: `Mô hình có ${constructKeys.length} nhân tố. Có thể phức tạp cho phân tích EFA và hồi quy.` });
  }

  // 4. Check if construct names match known research patterns
  const allConstructLabels = constructKeys.map(k => (constructs[k][0]?.constructLabel || k).toLowerCase());
  const matchedPattern = Object.keys(RESEARCH_KNOWLEDGE.researchPatterns).find(pat => {
    const pattern = RESEARCH_KNOWLEDGE.researchPatterns[pat];
    const matchCount = pattern.commonConstructs.filter(c => {
      const cl = c.toLowerCase();
      return allConstructLabels.some(l => l.includes(cl) || cl.includes(l));
    }).length;
    return matchCount >= 2;
  });

  if (matchedPattern) {
    const pattern = RESEARCH_KNOWLEDGE.researchPatterns[matchedPattern];
    const missing = pattern.commonConstructs.filter(c => {
      const cl = c.toLowerCase();
      return !allConstructLabels.some(l => l.includes(cl) || cl.includes(l));
    });
    if (missing.length > 0 && missing.length < pattern.commonConstructs.length) {
      issues.push({ type: 'pattern_suggestion', severity: 'low',
        message: `Mô hình của bạn có vẻ thuộc "${pattern.label}". Các nhân tố thường gặp khác: ${missing.join(', ')}.` });
    }
  }

  // 5. Check regression results vs hypotheses (if data exists)
  if (_regressionResults) {
    const paths = _regressionResults.paths;
    const strongest = Object.entries(paths)
      .filter(([_, v]) => v.sig)
      .sort((a, b) => Math.abs(b[1].stdBeta) - Math.abs(a[1].stdBeta));

    if (strongest.length > 0) {
      const [topPred, topInfo] = strongest[0];
      const es = RESEARCH_KNOWLEDGE.getEffectSize(topPred, _regressionResults.dvKey);
      if (es && topInfo.stdBeta < es.range[0]) {
        issues.push({ type: 'effect_size_low', severity: 'medium',
          message: `${topPred} tác động lên ${_regressionResults.dvKey} với β=${topInfo.stdBeta.toFixed(3)}, thấp hơn kỳ vọng lý thuyết [${es.range[0]}-${es.range[1]}].` });
      }
    }

    const nonSigPaths = Object.entries(paths).filter(([_, v]) => !v.sig);
    if (nonSigPaths.length > 0) {
      issues.push({ type: 'non_significant', severity: 'medium',
        message: `Có ${nonSigPaths.length} biến không có ý nghĩa thống kê: ${nonSigPaths.map(([k]) => k).join(', ')}. Trong nghiên cứu thực tế, điều này có thể xảy ra và cần giải thích.` });
    }
  }

  // 6. Check sample size adequacy
  const n = parseInt(document.getElementById('sample-size')?.value) || 200;
  const nItems = variables.filter(v => v.construct).length;
  if (n / nItems < 10) {
    issues.push({ type: 'small_sample', severity: 'high',
      message: `Tỷ lệ mẫu/biến = ${(n/nItems).toFixed(1)} (< 10). Khuyến nghị ít nhất 10 mẫu cho mỗi biến quan sát (Hair et al., 2010).` });
  } else if (n / nItems < 20) {
    issues.push({ type: 'moderate_sample', severity: 'low',
      message: `Tỷ lệ mẫu/biến = ${(n/nItems).toFixed(1)}. Lý tưởng nhất là ≥ 20 mẫu/biến.` });
  }

  return issues;
}

// Show consistency report
function showConsistencyReport() {
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v);
    }
  });

  const constructKeys = Object.keys(constructs);
  if (constructKeys.length === 0) {
    showToast('Chưa có mô hình để kiểm tra.', 'error');
    return;
  }

  const issues = checkResearchConsistency();

  let html = '<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">';
  html += '<div class="var-item-header"><span style="font-size:.85rem;font-weight:600">🔄 Research Consistency Engine</span>';
  html += `<span class="badge" style="background:${issues.length === 0 ? '#d1fae5' : '#fef3c7'};color:${issues.length === 0 ? '#065f46' : '#92400e'}">${issues.length === 0 ? '✅ Nhất quán' : issues.length + ' vấn đề'}</span>`;
  html += '</div>';

  if (issues.length === 0) {
    html += '<p style="font-size:.8rem;color:#059669;margin:.5rem 0;padding:.5rem;background:#f0fdf4;border-radius:6px">✅ Toàn bộ mô hình nghiên cứu nhất quán. Cấu trúc nhân tố, dữ liệu và kết quả phân tích phù hợp với nhau.</p>';
  } else {
    issues.forEach(issue => {
      const colors = { high: '#fef2f2;border-color:#fca5a5;color:#991b1b', medium: '#fefce8;border-color:#fbbf24;color:#92400e', low: '#f0fdf4;border-color:#86efac;color:#065f46' };
      const c = colors[issue.severity] || colors.medium;
      html += `<div style="background:${c.split(';')[0]};border:1px solid ${c.split(';')[1].split(':')[1]};border-radius:6px;padding:.4rem .6rem;margin:.3rem 0;font-size:.78rem;color:${c.split(';')[2].split(':')[1]}">`;
      const icons = { high: '🔴', medium: '🟡', low: '🟢' };
      html += `${icons[issue.severity] || 'ℹ️'} ${issue.message}`;
      html += '</div>';
    });
  }

  html += '</div>';

  const content = document.getElementById('quality-content');
  if (content) {
    content.innerHTML += html;
  }
}
