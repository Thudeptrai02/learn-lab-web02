// ====== QUESTIONNAIRE INTELLIGENCE ======
// Module 3: Understanding constructs, detecting overlap, construct purity, reverse items

// ====== 1. CONSTRUCT UNDERSTANDING ======

// Check if an item label fits a construct (basic semantic matching)
function itemFitsConstruct(itemLabel, constructName, constructLabel) {
  if (!itemLabel) return true;
  const lowerItem = itemLabel.toLowerCase();
  const lowerCons = constructLabel ? constructLabel.toLowerCase() : constructName.toLowerCase();

  // Keywords that suggest satisfaction
  const satisfactionKeywords = ['hài lòng', 'satisf', 'thích', 'enjoy', 'pleasant', 'hạnh phúc', 'happy'];
  // Keywords that suggest ease of use
  const easeKeywords = ['dễ', 'easy', 'đơn giản', 'simple', 'thuận tiện', 'convenient', 'khó', 'difficult'];
  // Keywords that suggest usefulness
  const usefulnessKeywords = ['hữu ích', 'useful', 'hiệu quả', 'effective', 'có ích', 'beneficial', 'giúp', 'help'];
  // Keywords that suggest loyalty
  const loyaltyKeywords = ['trung thành', 'loyal', 'tiếp tục', 'continue', 'giới thiệu', 'recommend', 'ủng hộ', 'support'];
  // Keywords that suggest trust
  const trustKeywords = ['tin tưởng', 'trust', 'uy tín', 'reliable', 'đáng tin', 'honest', 'trung thực'];

  // Check for mismatches
  const isSatisfaction = satisfactionKeywords.some(k => lowerCons.includes(k));
  const isEase = easeKeywords.some(k => lowerCons.includes(k));
  const isUsefulness = usefulnessKeywords.some(k => lowerCons.includes(k));
  const isLoyalty = loyaltyKeywords.some(k => lowerCons.includes(k));
  const isTrust = trustKeywords.some(k => lowerCons.includes(k));

  if (isSatisfaction && easeKeywords.some(k => lowerItem.includes(k)) && !lowerCons.includes('dễ')) return false;
  if (isEase && satisfactionKeywords.some(k => lowerItem.includes(k))) return false;
  if (isUsefulness && satisfactionKeywords.some(k => lowerItem.includes(k))) return false;
  if (isLoyalty && easeKeywords.some(k => lowerItem.includes(k)) && !lowerCons.includes('dễ')) return false;

  return true;
}

// Analyze all items and flag potential misfits
function analyzeConstructItems() {
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v);
    }
  });

  const warnings = [];
  Object.entries(constructs).forEach(([key, items]) => {
    const label = items[0]?.constructLabel || key;
    items.forEach(v => {
      if (v.label && !itemFitsConstruct(v.label, key, label)) {
        warnings.push({
          type: 'misfit',
          construct: key,
          constructLabel: label,
          item: v.name,
          itemLabel: v.label,
          message: `Item "${v.label}" (${v.name}) có thể không phù hợp với nhân tố "${label}" (${key})`
        });
      }
    });
  });

  // Check for potential reverse items
  variables.forEach(v => {
    if (v.label) {
      const lower = v.label.toLowerCase();
      if (/không|not|never|difficult|khó/.test(lower) && v.type?.startsWith('likert')) {
        warnings.push({
          type: 'reverse',
          construct: v.construct || '',
          item: v.name,
          itemLabel: v.label,
          message: `Item "${v.label}" (${v.name}) có thể là reverse-coded item. Cần đảo ngược thang đo trước khi tính toán.`
        });
      }
    }
  });

  return warnings;
}

// ====== 2. OVERLAP DETECTION ======

// Detect overlapping items (items with very similar text)
function detectOverlap(items) {
  const overlaps = [];
  const itemList = items.filter(v => v.label);

  for (let i = 0; i < itemList.length; i++) {
    for (let j = i + 1; j < itemList.length; j++) {
      const a = itemList[i].label || '';
      const b = itemList[j].label || '';
      if (!a || !b) continue;

      // Cosine similarity of words
      const wordsA = a.toLowerCase().split(/\s+/).filter(Boolean);
      const wordsB = b.toLowerCase().split(/\s+/).filter(Boolean);
      const intersection = wordsA.filter(w => wordsB.includes(w));
      const similarity = (2 * intersection.length) / (wordsA.length + wordsB.length);

      if (similarity >= 0.6) {
        overlaps.push({
          item1: itemList[i].name,
          label1: a,
          item2: itemList[j].name,
          label2: b,
          similarity: similarity,
          message: `"${a}" và "${b}" có nội dung tương đồng cao (${(similarity * 100).toFixed(0)}%)`
        });
      }
    }
  }
  return overlaps;
}

// ====== 3. CONSTRUCT PURITY CHECK ======

// Check if items from one construct cross-load too much on other constructs
function checkConstructPurity(rawRows, constructs) {
  const results = {};
  const constructKeys = Object.keys(constructs);

  constructKeys.forEach(key => {
    const items = constructs[key].map(v => v.name);
    const otherItems = [];
    constructKeys.forEach(k2 => {
      if (k2 !== key) otherItems.push(...constructs[k2].map(v => v.name));
    });

    if (items.length === 0 || otherItems.length === 0) {
      results[key] = { pure: true, warnings: [] };
      return;
    }

    const warnings = [];
    items.forEach(item => {
      const itemScores = rawRows.map(r => r[item]).filter(v => typeof v === 'number' && !isNaN(v));
      const ownConstructScores = items.filter(i => i !== item).map(i =>
        rawRows.map(r => r[i]).filter(v => typeof v === 'number' && !isNaN(v))
      );
      // Check correlation with own construct vs other constructs
      const ownCorr = items.filter(i => i !== item).map(i => {
        const s2 = rawRows.map(r => r[i]).filter(v => typeof v === 'number' && !isNaN(v));
        const n = Math.min(itemScores.length, s2.length);
        if (n < 3) return 0;
        const m1 = itemScores.slice(0, n).reduce((a, b) => a + b, 0) / n;
        const m2 = s2.slice(0, n).reduce((a, b) => a + b, 0) / n;
        const sd1 = Math.sqrt(itemScores.slice(0, n).reduce((a, b) => a + (b - m1) ** 2, 0) / n);
        const sd2 = Math.sqrt(s2.slice(0, n).reduce((a, b) => a + (b - m2) ** 2, 0) / n);
        return sd1 > 0 && sd2 > 0 ? itemScores.slice(0, n).reduce((a, b, i) => a + (b - m1) * (s2[i] - m2), 0) / n / (sd1 * sd2) : 0;
      });
      const avgOwnCorr = ownCorr.reduce((a, b) => a + b, 0) / Math.max(ownCorr.length, 1);

      otherItems.forEach(other => {
        const s2 = rawRows.map(r => r[other]).filter(v => typeof v === 'number' && !isNaN(v));
        const n = Math.min(itemScores.length, s2.length);
        if (n < 3) return;
        const m1 = itemScores.slice(0, n).reduce((a, b) => a + b, 0) / n;
        const m2 = s2.slice(0, n).reduce((a, b) => a + b, 0) / n;
        const sd1 = Math.sqrt(itemScores.slice(0, n).reduce((a, b) => a + (b - m1) ** 2, 0) / n);
        const sd2 = Math.sqrt(s2.slice(0, n).reduce((a, b) => a + (b - m2) ** 2, 0) / n);
        const r = sd1 > 0 && sd2 > 0 ? itemScores.slice(0, n).reduce((a, b, i) => a + (b - m1) * (s2[i] - m2), 0) / n / (sd1 * sd2) : 0;

        const otherConstruct = constructKeys.find(k => constructs[k].some(v => v.name === other));
        if (Math.abs(r) > avgOwnCorr * 0.7 && Math.abs(r) > 0.4) {
          warnings.push({
            item: item,
            other: other,
            otherConstruct: otherConstruct,
            crossCorr: r,
            ownCorr: avgOwnCorr,
            message: `${item} tương quan cao với ${other} (${otherConstruct}) hơn so với các item cùng nhân tố (r=${r.toFixed(3)} vs r̅=${avgOwnCorr.toFixed(3)}). Có thể item không thuần khiết.`
          });
        }
      });
    });

    results[key] = {
      pure: warnings.length === 0,
      warnings: warnings
    };
  });

  return results;
}

// ====== 4. SUGGEST REVERSE ITEMS ======

// Suggest which items would work well as reverse-coded
function suggestReverseItems(constructKey) {
  const items = variables.filter(v => v.construct === constructKey && v.label);
  if (items.length < 3) return [];

  const suggestions = [];
  items.forEach((v, idx) => {
    const label = v.label || '';
    const lower = label.toLowerCase();

    // Check if the item already has negative wording
    const hasNegative = /không|not|never|difficult|khó|chưa|haven|without/.test(lower);

    if (!hasNegative) {
      suggestions.push({
        name: v.name,
        original: label,
        reverseSuggestion: `Không ${label.toLowerCase()}`,
        reason: `Item gốc: "${label}". Có thể tạo biến đảo ngược: "Không ${label.toLowerCase()}" để kiểm soát response bias.`
      });
    }
  });

  return suggestions;
}

// Show questionnaire intelligence report
function showQuestionnaireIntelligence() {
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v);
    }
  });

  const constructKeys = Object.keys(constructs);
  if (constructKeys.length === 0) {
    showToast('Chưa có nhân tố để kiểm tra. Hãy xây dựng mô hình trước.', 'error');
    return;
  }

  let html = '<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">';
  html += '<div class="var-item-header"><span style="font-size:.85rem;font-weight:600">🔍 Kiểm tra bảng khảo sát (Questionnaire Intelligence)</span></div>';

  // 1. Construct fit analysis
  const fitWarnings = analyzeConstructItems();
  html += '<div style="margin-top:.5rem;font-size:.8rem;font-weight:600">1. Phân tích sự phù hợp của items với nhân tố:</div>';
  if (fitWarnings.length === 0) {
    html += '<p style="font-size:.8rem;color:#059669;margin:.2rem 0">✅ Tất cả items có vẻ phù hợp với nhân tố của chúng.</p>';
  } else {
    fitWarnings.forEach(w => {
      const bg = w.type === 'reverse' ? '#fefce8' : '#fef2f2';
      const border = w.type === 'reverse' ? '#fbbf24' : '#fca5a5';
      html += `<div style="background:${bg};border:1px solid ${border};border-radius:4px;padding:.3rem .5rem;margin:.2rem 0;font-size:.75rem">⚠️ ${w.message}</div>`;
    });
  }

  // 2. Overlap detection
  html += '<div style="margin-top:.5rem;font-size:.8rem;font-weight:600">2. Phát hiện item trùng lặp:</div>';
  const overlaps = detectOverlap(variables);
  if (overlaps.length === 0) {
    html += '<p style="font-size:.8rem;color:#059669;margin:.2rem 0">✅ Không phát hiện item nào bị trùng lặp nội dung.</p>';
  } else {
    overlaps.forEach(o => {
      html += `<div style="background:#fefce8;border:1px solid #fbbf24;border-radius:4px;padding:.3rem .5rem;margin:.2rem 0;font-size:.75rem">⚠️ ${o.message}</div>`;
    });
  }

  // 3. Reverse item suggestions
  html += '<div style="margin-top:.5rem;font-size:.8rem;font-weight:600">3. Gợi ý biến đảo ngược (Reverse-coded items):</div>';
  let hasReverseSuggestions = false;
  constructKeys.forEach(key => {
    const suggestions = suggestReverseItems(key);
    if (suggestions.length > 0) {
      hasReverseSuggestions = true;
      const label = constructs[key][0]?.constructLabel || key;
      html += `<div style="margin:.2rem 0;font-size:.75rem"><strong>${label}:</strong></div>`;
      suggestions.forEach(s => {
        html += `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:.2rem .5rem;margin:.15rem 0;font-size:.7rem">💡 ${s.reason}</div>`;
      });
    }
  });
  if (!hasReverseSuggestions) {
    html += '<p style="font-size:.8rem;color:var(--gray-500);margin:.2rem 0">Không có gợi ý. Kiểm tra nếu cần thêm items đảo ngược.</p>';
  }

  // 4. Construct purity (if data exists)
  if (generatedData && constructKeys.length > 1) {
    html += '<div style="margin-top:.5rem;font-size:.8rem;font-weight:600">4. Độ thuần khiết của nhân tố (Construct Purity):</div>';
    const purity = checkConstructPurity(generatedData.rawRows, constructs);
    let purityOk = true;
    constructKeys.forEach(key => {
      if (!purity[key]?.pure) {
        purityOk = false;
        purity[key].warnings.forEach(w => {
          html += `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;padding:.3rem .5rem;margin:.2rem 0;font-size:.75rem">⚠️ ${w.message}</div>`;
        });
      }
    });
    if (purityOk) {
      html += '<p style="font-size:.8rem;color:#059669;margin:.2rem 0">✅ Các nhân tố đạt độ thuần khiết tốt.</p>';
    }
  }

  html += '</div>';

  // Insert into quality content
  const content = document.getElementById('quality-content');
  if (content) {
    content.innerHTML += html;
  }
}
