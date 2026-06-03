// ====== REALISM ENGINE ======
// Modules 1, 4, 5: Distribution control, noise profiles, EFA realism, regression realism

// Global realism configuration
let _realismProfile = 'medium'; // 'low', 'medium', 'high'
let _noiseLevel = 0.5; // 0-1 scale

function setRealismProfile(profile) {
  _realismProfile = profile;
  switch (profile) {
    case 'low': _noiseLevel = 0.2; break;
    case 'medium': _noiseLevel = 0.5; break;
    case 'high': _noiseLevel = 0.8; break;
  }
}

// ====== 1. DISTRIBUTION CONTROL ======

// Generate a value with controlled skewness using power transform
// targetSkew > 0: right-skewed, < 0: left-skewed
function skewedRandom(targetSkew) {
  let x = normalRandom(0, 1);
  if (Math.abs(targetSkew) > 0.01) {
    const p = 1 + targetSkew * 0.3;
    if (targetSkew > 0) {
      x = Math.exp(x * 0.5 * (1 + targetSkew));
      x = (x - Math.exp(0.125)) / (Math.exp(0.5) - Math.exp(0.125)) * 2 - 1;
    } else {
      x = -Math.exp(-x * 0.5 * (1 - targetSkew));
      x = (x + Math.exp(0.125)) / (Math.exp(0.5) - Math.exp(0.125)) * 2 - 1;
    }
    x = Math.max(-3, Math.min(3, x));
  }
  return x;
}

// Apply ceiling/floor effects to a raw score (0-1 range)
function applyCeilingFloor(p, ceilingEffect, floorEffect) {
  let result = p;
  if (ceilingEffect > 0) {
    result = result + ceilingEffect * (1 - result) * (1 - result);
  }
  if (floorEffect > 0) {
    result = result - floorEffect * result * result;
  }
  return Math.max(0, Math.min(1, result));
}

// ====== 2. NOISE PROFILES ======

// Add realistic noise to a Likert value
function addRealisticNoise(val, scale, profile, noiseIntensity) {
  const baseNoise = _noiseLevel * noiseIntensity;
  const probInattentive = baseNoise * 0.15; // probability of inattentive response
  const probRandom = baseNoise * 0.10; // probability of random response
  const probStraightline = baseNoise * 0.08; // probability of straightlining
  const probOpposite = baseNoise * 0.05; // probability of opposite answer

  const r = Math.random();

  if (r < probRandom) {
    return Math.floor(Math.random() * scale) + 1;
  }
  if (r < probRandom + probStraightline) {
    const fixed = Math.round(scale / 2);
    return fixed;
  }
  if (r < probRandom + probStraightline + probOpposite) {
    return scale - val + 1;
  }
  if (r < probRandom + probStraightline + probOpposite + probInattentive) {
    const drift = Math.floor(Math.random() * 3) - 1;
    return Math.min(scale, Math.max(1, val + drift));
  }
  return val;
}

// ====== 3. LOADING REALISM ======

// Generate realistic loadings with natural variation
function generateRealisticLoading(nItems, index) {
  let profile;
  if (index === 0) profile = RESEARCH_KNOWLEDGE.loadingProfiles.first;
  else if (index === nItems - 1) profile = RESEARCH_KNOWLEDGE.loadingProfiles.last;
  else profile = RESEARCH_KNOWLEDGE.loadingProfiles.middle;
  const l = profile.min + Math.random() * (profile.max - profile.min);
  // Add realistic noise: items in the middle of a survey often have slightly lower loadings
  const positionNoise = (index / nItems - 0.5) * 0.04;
  return Math.min(0.90, Math.max(0.40, l + positionNoise + (Math.random() - 0.5) * 0.08));
}

// ====== 4. CROSS-LOADING CONTROL ======

// Add controlled cross-loadings between constructs for EFA realism
function addCrossLoadings(rawRows, constructs, constructKeys, n, crossLoadingLevel) {
  const itemVars = {};
  constructKeys.forEach(key => {
    itemVars[key] = constructs[key].map(v => v.name);
  });

  for (let iter = 0; iter < Math.floor(n * crossLoadingLevel); iter++) {
    const ri = Math.floor(Math.random() * n);
    const k1 = constructKeys[Math.floor(Math.random() * constructKeys.length)];
    let k2 = constructKeys[Math.floor(Math.random() * constructKeys.length)];
    if (k1 === k2) continue;
    const items1 = itemVars[k1];
    const items2 = itemVars[k2];
    if (items1.length === 0 || items2.length === 0) continue;
    // Slightly influence one item from k2 toward k1's pattern
    const pick = items2[Math.floor(Math.random() * items2.length)];
    const refVal = rawRows[ri][items1[Math.floor(Math.random() * items1.length)]];
    if (typeof rawRows[ri][pick] === 'number' && !isNaN(rawRows[ri][pick]) && typeof refVal === 'number') {
      const mix = (Math.random() * 0.15 + 0.05); // 5-20% cross-loading influence
      const scale = variables.find(v => v.name === pick)?.scale || 5;
      rawRows[ri][pick] = Math.min(scale, Math.max(1,
        Math.round(rawRows[ri][pick] * (1 - mix) + refVal * mix)
      ));
    }
  }
}

// ====== 5. REGRESSION REALISM ======

// Beta generation is now inlined in data-generation.js

// ====== 6. COMMUNALITY REALISM ======

// Adjust communalities to be realistic (not too perfect)
function adjustCommunalities(rawRows, constructs, constructKeys, n) {
  constructKeys.forEach(key => {
    const items = constructs[key].map(v => v.name);
    if (items.length < 2) return;
    const scale = constructs[key][0]?.scale || 5;
    // Randomly weaken one item slightly to create realistic communality variation
    const weakenIdx = Math.floor(Math.random() * items.length);
    const weakenItem = items[weakenIdx];
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.15) {
        const val = rawRows[i][weakenItem];
        if (typeof val === 'number' && !isNaN(val)) {
          rawRows[i][weakenItem] = Math.min(scale, Math.max(1, val + (Math.random() < 0.5 ? 1 : -1)));
        }
      }
    }
  });
}

// ====== 7. RESIDUAL REALISM ======

// Add heteroscedasticity to residuals (real data has uneven variance)
function addHeteroscedasticity(rawRows, colNames, n, strength) {
  for (let i = 0; i < n; i++) {
    const factor = 1 + (Math.random() - 0.5) * strength;
    colNames.forEach(c => {
      if (typeof rawRows[i][c] === 'number' && !isNaN(rawRows[i][c])) {
        const scale = variables.find(v => v.name === c)?.scale || 5;
        const noise = Math.round((Math.random() - 0.5) * strength * 0.5);
        if (noise !== 0) {
          rawRows[i][c] = Math.min(scale, Math.max(1, rawRows[i][c] + noise));
        }
      }
    });
  }
}

// ====== 7B. IRT RESPONSE FUNCTION ======

function irtResponse(theta, discrimination, difficulty) {
  return 1 / (1 + Math.exp(-discrimination * (theta - difficulty)));
}

// ====== 7C. CHOLESKY DECOMPOSITION ======

function choleskyDecomposition(matrix) {
  const n = matrix.length;
  const L = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(0, matrix[i][i] - sum));
      } else {
        L[i][j] = (matrix[i][j] - sum) / Math.max(L[j][j], 1e-10);
      }
    }
  }
  return L;
}

// ====== 8. REALISM SETUP ======

// Called from smartGenerate to set realism before generation
function setupRealism() {
  const profileEl = document.getElementById('realism-profile');
  if (profileEl) setRealismProfile(profileEl.value);
}
