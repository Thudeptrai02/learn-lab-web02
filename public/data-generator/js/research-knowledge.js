// ====== RESEARCH KNOWLEDGE BASE ======
// Module 2: Behavioral Logic Engine — construct relationships, effect sizes, patterns

const RESEARCH_KNOWLEDGE = {
  // Typical effect size between construct pairs (standardized beta ranges)
  // strong: 0.40-0.65, medium: 0.20-0.40, weak: 0.05-0.20, veryWeak: 0-0.05
  effectSizes: {
    // Trust-based models
    'Trust→Loyalty': { range: [0.35, 0.60], label: 'Mạnh', evidence: 'Morgan & Hunt (1994); Chaudhuri & Holbrook (2001)' },
    'Trust→Satisfaction': { range: [0.30, 0.55], label: 'Mạnh', evidence: 'Garbarino & Johnson (1999)' },
    'Trust→PurchaseIntention': { range: [0.25, 0.50], label: 'Trung bình-Mạnh', evidence: 'Pavlou (2003)' },
    'Trust→Adoption': { range: [0.20, 0.45], label: 'Trung bình-Mạnh', evidence: 'McKnight et al. (2002)' },
    // Satisfaction-based models
    'Satisfaction→Loyalty': { range: [0.45, 0.70], label: 'Rất mạnh', evidence: 'Fornell et al. (1996); Oliver (1999)' },
    'Satisfaction→RepurchaseIntention': { range: [0.40, 0.65], label: 'Rất mạnh', evidence: 'Mittal & Kamakura (2001)' },
    'Satisfaction→WordOfMouth': { range: [0.30, 0.55], label: 'Mạnh', evidence: 'Anderson (1998)' },
    // TAM models
    'PerceivedUsefulness→Adoption': { range: [0.30, 0.55], label: 'Mạnh', evidence: 'Davis (1989); Venkatesh et al. (2003)' },
    'PerceivedUsefulness→BehavioralIntention': { range: [0.25, 0.50], label: 'Trung bình-Mạnh', evidence: 'Taylor & Todd (1995)' },
    'PerceivedEaseOfUse→Adoption': { range: [0.15, 0.35], label: 'Trung bình', evidence: 'Davis (1989)' },
    'PerceivedEaseOfUse→PerceivedUsefulness': { range: [0.30, 0.55], label: 'Mạnh', evidence: 'Venkatesh & Davis (2000)' },
    'SocialInfluence→BehavioralIntention': { range: [0.10, 0.30], label: 'Yếu-Trung bình', evidence: 'Venkatesh et al. (2003)' },
    // Service quality
    'ServiceQuality→Satisfaction': { range: [0.40, 0.65], label: 'Rất mạnh', evidence: 'Parasuraman et al. (1988); Cronin & Taylor (1992)' },
    'ServiceQuality→Loyalty': { range: [0.25, 0.50], label: 'Trung bình-Mạnh', evidence: 'Zeithaml et al. (1996)' },
    // CRM / Relationship
    'Commitment→Loyalty': { range: [0.30, 0.55], label: 'Mạnh', evidence: 'Morgan & Hunt (1994)' },
    'Communication→Trust': { range: [0.20, 0.45], label: 'Trung bình-Mạnh', evidence: 'Anderson & Narus (1990)' },
    'PerceivedValue→Satisfaction': { range: [0.35, 0.60], label: 'Mạnh', evidence: 'Zeithaml (1988); Sweeney & Soutar (2001)' },
    'PerceivedValue→Loyalty': { range: [0.20, 0.45], label: 'Trung bình-Mạnh', evidence: 'Parasuraman & Grewal (2000)' },
    'BrandImage→Satisfaction': { range: [0.20, 0.40], label: 'Trung bình', evidence: 'Bloemer & de Ruyter (1998)' },
    'BrandImage→Loyalty': { range: [0.15, 0.35], label: 'Trung bình', evidence: 'Kandampully & Hu (2007)' },
    // Mediation paths
    'Satisfaction→Trust': { range: [0.30, 0.55], label: 'Mạnh', evidence: 'Delgado-Ballester & Munuera-Aleman (2001)' },
    // Moderation
    'Moderation→Dependent': { range: [0.08, 0.25], label: 'Yếu-Trung bình', evidence: 'Aiken & West (1991)' }
  },

  // Research context patterns — maps research topics to expected constructs and relationships
  researchPatterns: {
    'adoption': {
      label: 'Mô hình chấp nhận công nghệ',
      commonConstructs: ['PerceivedUsefulness', 'PerceivedEaseOfUse', 'SocialInfluence', 'FacilitatingConditions', 'BehavioralIntention', 'Adoption'],
      typicalRelationships: [
        ['PerceivedUsefulness', 'Adoption', [0.30, 0.55]],
        ['PerceivedEaseOfUse', 'Adoption', [0.15, 0.35]],
        ['PerceivedEaseOfUse', 'PerceivedUsefulness', [0.30, 0.55]],
        ['SocialInfluence', 'BehavioralIntention', [0.10, 0.30]]
      ],
      typicalR2: [0.35, 0.55],
      description: 'Người dùng chấp nhận công nghệ mới dựa trên nhận thức hữu ích và dễ sử dụng.'
    },
    'satisfaction': {
      label: 'Mô hình hài lòng khách hàng',
      commonConstructs: ['ServiceQuality', 'PerceivedValue', 'Expectation', 'Satisfaction', 'Loyalty', 'Complaint'],
      typicalRelationships: [
        ['ServiceQuality', 'Satisfaction', [0.40, 0.65]],
        ['PerceivedValue', 'Satisfaction', [0.35, 0.60]],
        ['Satisfaction', 'Loyalty', [0.45, 0.70]]
      ],
      typicalR2: [0.45, 0.70],
      description: 'Sự hài lòng được hình thành từ chất lượng dịch vụ và giá trị cảm nhận.'
    },
    'loyalty': {
      label: 'Mô hình trung thành khách hàng',
      commonConstructs: ['Satisfaction', 'Trust', 'Commitment', 'ServiceQuality', 'Loyalty', 'WordOfMouth'],
      typicalRelationships: [
        ['Satisfaction', 'Loyalty', [0.45, 0.70]],
        ['Trust', 'Loyalty', [0.35, 0.60]],
        ['ServiceQuality', 'Satisfaction', [0.40, 0.65]]
      ],
      typicalR2: [0.40, 0.65],
      description: 'Lòng trung thành được thúc đẩy bởi sự hài lòng, niềm tin và cam kết.'
    },
    'tam': {
      label: 'Technology Acceptance Model',
      commonConstructs: ['PerceivedUsefulness', 'PerceivedEaseOfUse', 'Attitude', 'BehavioralIntention', 'ActualUse'],
      typicalRelationships: [
        ['PerceivedUsefulness', 'BehavioralIntention', [0.25, 0.50]],
        ['PerceivedEaseOfUse', 'Attitude', [0.20, 0.40]],
        ['Attitude', 'BehavioralIntention', [0.30, 0.55]],
        ['BehavioralIntention', 'ActualUse', [0.40, 0.65]]
      ],
      typicalR2: [0.35, 0.55],
      description: 'Mô hình chấp nhận công nghệ cổ điển của Davis (1989).'
    },
    'purchase_intention': {
      label: 'Mô hình ý định mua hàng',
      commonConstructs: ['BrandImage', 'PerceivedQuality', 'PerceivedValue', 'Trust', 'PurchaseIntention'],
      typicalRelationships: [
        ['BrandImage', 'PurchaseIntention', [0.15, 0.35]],
        ['PerceivedValue', 'PurchaseIntention', [0.20, 0.45]],
        ['Trust', 'PurchaseIntention', [0.25, 0.50]]
      ],
      typicalR2: [0.35, 0.55],
      description: 'Ý định mua hàng chịu ảnh hưởng từ hình ảnh thương hiệu, giá trị và niềm tin.'
    },
    'service_quality': {
      label: 'Mô hình chất lượng dịch vụ',
      commonConstructs: ['Tangibles', 'Reliability', 'Responsiveness', 'Assurance', 'Empathy', 'ServiceQuality', 'Satisfaction'],
      typicalRelationships: [
        ['ServiceQuality', 'Satisfaction', [0.40, 0.65]]
      ],
      typicalR2: [0.40, 0.60],
      description: 'Chất lượng dịch vụ tổng thể đo lường qua 5 thành phần SERVQUAL.'
    },
    'utaut': {
      label: 'Unified Theory of Acceptance and Use of Technology',
      commonConstructs: ['PerformanceExpectancy', 'EffortExpectancy', 'SocialInfluence', 'FacilitatingConditions', 'BehavioralIntention', 'UseBehavior'],
      typicalRelationships: [
        ['PerformanceExpectancy', 'BehavioralIntention', [0.25, 0.50]],
        ['EffortExpectancy', 'BehavioralIntention', [0.10, 0.30]],
        ['SocialInfluence', 'BehavioralIntention', [0.10, 0.30]],
        ['FacilitatingConditions', 'UseBehavior', [0.15, 0.35]],
        ['BehavioralIntention', 'UseBehavior', [0.35, 0.60]]
      ],
      typicalR2: [0.35, 0.60],
      description: 'Mô hình UTAUT của Venkatesh et al. (2003) - hợp nhất 8 mô hình chấp nhận công nghệ.'
    }
  },

  // Construct role suggestions (what role a construct typically plays)
  constructRoleHints: {
    'Satisfaction': { role: 'dependent,mediating', typicalScale: 'likert5', items: 4 },
    'Loyalty': { role: 'dependent', typicalScale: 'likert5', items: 4 },
    'Trust': { role: 'independent,mediating', typicalScale: 'likert5', items: 4 },
    'PerceivedUsefulness': { role: 'independent', typicalScale: 'likert5', items: 4 },
    'PerceivedEaseOfUse': { role: 'independent', typicalScale: 'likert5', items: 4 },
    'ServiceQuality': { role: 'independent', typicalScale: 'likert5', items: 5 },
    'BehavioralIntention': { role: 'dependent,mediating', typicalScale: 'likert5', items: 3 },
    'PurchaseIntention': { role: 'dependent', typicalScale: 'likert5', items: 4 },
    'BrandImage': { role: 'independent', typicalScale: 'likert5', items: 4 },
    'PerceivedValue': { role: 'independent,mediating', typicalScale: 'likert5', items: 4 },
    'Commitment': { role: 'independent,mediating', typicalScale: 'likert5', items: 4 },
    'WordOfMouth': { role: 'dependent', typicalScale: 'likert5', items: 3 },
    'SocialInfluence': { role: 'independent', typicalScale: 'likert5', items: 3 },
    'FacilitatingConditions': { role: 'independent', typicalScale: 'likert5', items: 3 },
    'PerceivedQuality': { role: 'independent', typicalScale: 'likert5', items: 4 },
    'Expectation': { role: 'independent', typicalScale: 'likert5', items: 3 },
    'Complaint': { role: 'dependent', typicalScale: 'likert5', items: 3 }
  },

  // Distribution characteristics by construct type (for realism)
  distributionProfiles: {
    'Satisfaction': { skew: -0.6, kurtosis: 0.3, meanBias: 0.15, varianceScale: 0.9, ceilingEffect: 0.2 },
    'Loyalty': { skew: -0.4, kurtosis: 0.2, meanBias: 0.10, varianceScale: 1.0, ceilingEffect: 0.1 },
    'Trust': { skew: -0.3, kurtosis: 0.0, meanBias: 0.08, varianceScale: 1.0, ceilingEffect: 0.1 },
    'Complaint': { skew: 0.8, kurtosis: 0.5, meanBias: -0.20, varianceScale: 1.3, ceilingEffect: 0.0, floorEffect: 0.15 },
    'Stress': { skew: 0.5, kurtosis: 0.4, meanBias: -0.10, varianceScale: 1.4, floorEffect: 0.1 },
    'PerceivedUsefulness': { skew: -0.5, kurtosis: 0.2, meanBias: 0.12, varianceScale: 0.9, ceilingEffect: 0.15 },
    'PerceivedEaseOfUse': { skew: -0.3, kurtosis: 0.1, meanBias: 0.08, varianceScale: 1.0, ceilingEffect: 0.1 },
    'default': { skew: 0.0, kurtosis: 0.0, meanBias: 0.0, varianceScale: 1.0 }
  },

  // Cronbach's Alpha realism ranges per number of items
  alphaRealism: {
    2: { min: 0.45, max: 0.85, typical: 0.65 },
    3: { min: 0.55, max: 0.90, typical: 0.72 },
    4: { min: 0.65, max: 0.93, typical: 0.78 },
    5: { min: 0.70, max: 0.94, typical: 0.82 },
    6: { min: 0.72, max: 0.95, typical: 0.84 },
    7: { min: 0.75, max: 0.95, typical: 0.85 }
  },

  // KMO realism ranges
  kmoRealism: {
    poor: { min: 0.50, max: 0.60 },
    mediocre: { min: 0.60, max: 0.70 },
    middling: { min: 0.70, max: 0.80 },
    meritorious: { min: 0.80, max: 0.90 },
    marvelous: { min: 0.90, max: 1.00 }
  },

  // R² realism ranges by research context
  rSquaredRealism: {
    'behavioral': { min: 0.20, max: 0.50, typical: 0.35, note: 'Hành vi con người thường có R² thấp' },
    'attitude': { min: 0.30, max: 0.60, typical: 0.45, note: 'Thái độ có R² trung bình' },
    'technology': { min: 0.35, max: 0.65, typical: 0.50, note: 'Chấp nhận công nghệ R² khá' },
    'loyalty': { min: 0.40, max: 0.70, typical: 0.55, note: 'Trung thành thường có R² cao' }
  },

  // Typical loading ranges per item position (first items often have higher loadings)
  loadingProfiles: {
    first: { min: 0.65, max: 0.85 },
    middle: { min: 0.55, max: 0.80 },
    last: { min: 0.50, max: 0.75 }
  },

  // Helper: look up effect size for a construct pair
  getEffectSize: function(predictor, dependent) {
    const keys = Object.keys(this.effectSizes);
    // Try exact match
    const exact = predictor + '→' + dependent;
    if (keys.includes(exact)) return this.effectSizes[exact];
    // Try reverse
    const reverse = dependent + '→' + predictor;
    if (keys.includes(reverse)) return this.effectSizes[reverse];
    return null;
  },

  // Helper: get distribution profile for a construct name
  getDistributionProfile: function(constructName) {
    const normalized = constructName.replace(/[0-9]/g, '').trim();
    if (this.distributionProfiles[normalized]) return this.distributionProfiles[normalized];
    // Try matching substrings
    for (const key of Object.keys(this.distributionProfiles)) {
      if (normalized.includes(key) || key.includes(normalized)) return this.distributionProfiles[key];
    }
    return this.distributionProfiles.default;
  },

  // Helper: find research pattern matching a topic
  matchResearchPattern: function(topic) {
    const lower = topic.toLowerCase();
    for (const [key, pattern] of Object.entries(this.researchPatterns)) {
      if (lower.includes(key)) return { key, ...pattern };
    }
    return null;
  }
};
