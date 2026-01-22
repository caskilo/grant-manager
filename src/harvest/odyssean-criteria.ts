/**
 * Odyssean Institute Research Agenda & Grant Matching Criteria
 * 
 * Extracted from: .idea/odyssean-tripartite-agenda.md
 * Purpose: Define structured criteria for LLM-based grant alignment scoring
 */

export interface ResearchStrand {
  name: string;
  description: string;
  keywords: string[];
  methodologies: string[];
  themes: string[];
  outputTypes: string[];
}

export const ODYSSEAN_RESEARCH_STRANDS: ResearchStrand[] = [
  {
    name: 'Odyssean Process',
    description: 'A modular method for comprehensive, legitimate, and tractable decision making under conditions of extreme risk and uncertainty. Integrates expert elicitation, DMDU modeling, and citizen assemblies.',
    keywords: [
      'decision making',
      'governance',
      'democracy',
      'democratic innovation',
      'participatory democracy',
      'deliberative democracy',
      'citizen assembly',
      'citizens assembly',
      'expert elicitation',
      'risk',
      'uncertainty',
      'deep uncertainty',
      'policy',
      'public policy',
      'agenda setting',
      'AI governance',
      'climate policy',
      'systemic reform',
      'institutional reform',
      'democratic backsliding',
      'polarization',
      'consensus building',
    ],
    methodologies: [
      'expert elicitation',
      'decision making under deep uncertainty',
      'DMDU',
      'exploratory modeling',
      'scenario planning',
      'citizen assemblies',
      'deliberative polling',
      'participatory methods',
      'futures methodologies',
    ],
    themes: [
      'democratic legitimacy',
      'public trust',
      'governance quality',
      'systemic change',
      'paradigm shift',
      'institutional capacity',
      'political reform',
      'civic engagement',
    ],
    outputTypes: [
      'policy recommendations',
      'governance frameworks',
      'deliberative processes',
      'institutional designs',
      'public engagement tools',
      'documentary',
      'educational curriculum',
    ],
  },
  {
    name: 'GRAIN (Global Resilient Anticipatory Infrastructure Network)',
    description: 'Identifying key commodities, logistical hubs, and institutional qualities enabling recovery from, and reduction of exposure to global collapse or extinction.',
    keywords: [
      'resilience',
      'infrastructure',
      'supply chain',
      'critical commodities',
      'trade',
      'logistics',
      'chokepoints',
      'futures',
      'foresight',
      'anticipatory',
      'sustainability',
      'sustainable development',
      'development economics',
      'industrial strategy',
      'agroecology',
      'circular economy',
      'hydroponic',
      'high yield',
      'technology',
      'social practices',
      'knowledge hubs',
      'scientific diplomacy',
      'onshoring',
      'comparative advantage',
      'globalization',
    ],
    methodologies: [
      'causal layered analysis',
      'CLA',
      'backcasting',
      '3 horizons framework',
      'futures methodologies',
      'foresight',
      'horizon scanning',
      'systems mapping',
      'trade analysis',
      'supply chain modeling',
    ],
    themes: [
      'global resilience',
      'collapse prevention',
      'extinction risk',
      'material flows',
      'institutional capacity',
      'technological innovation',
      'social innovation',
      'adaptive capacity',
      'self-sufficiency',
      'recovery capacity',
      'positive tipping points',
    ],
    outputTypes: [
      'resilience frameworks',
      'infrastructure designs',
      'technology incubation',
      'social practice innovation',
      'trade policy',
      'industrial strategy',
      'case studies',
      'partnership models',
    ],
  },
  {
    name: 'Aeonic Flourishing',
    description: 'Conceptualising a truly long term yet ambitious, integrative view of human flourishing, in the context of accelerating crises and encroaching planetary boundaries.',
    keywords: [
      'wellbeing',
      'flourishing',
      'capabilities',
      'capabilities approach',
      'subjective wellbeing',
      'hedonic',
      'eudaemonic',
      'conscience',
      'planetary boundaries',
      'ecological limits',
      'sustainability',
      'justice',
      'equity',
      'intergenerational',
      'long term',
      'longue durée',
      'indigenous',
      'indigenous knowledge',
      'wisdom traditions',
      'commons',
      'socio-ecological commons',
      'doughnut economics',
      'buen vivir',
      'democratic confederalism',
      'community',
      'local',
      'autonomy',
      'meaningful work',
    ],
    methodologies: [
      'capabilities approach',
      'integrative wellbeing theory',
      'socio-ecological systems',
      'commons governance',
      'participatory action research',
      'case study analysis',
      'comparative analysis',
      'philosophical synthesis',
      'interdisciplinary integration',
    ],
    themes: [
      'human flourishing',
      'existential hope',
      'ecological sustainability',
      'social justice',
      'intergenerational fairness',
      'community resilience',
      'cultural wisdom',
      'paradigm transformation',
      'values and ethics',
      'quality of life',
    ],
    outputTypes: [
      'theoretical frameworks',
      'wellbeing indicators',
      'community projects',
      'commons housing',
      'community gardens',
      'local governance models',
      'philosophical synthesis',
      'practical interventions',
    ],
  },
];

export const CROSS_CUTTING_THEMES = [
  'systemic change',
  'paradigmatic change',
  'interdisciplinary',
  'transdisciplinary',
  'action research',
  'focused research organization',
  'FRO',
  'public engagement',
  'public impact',
  'real world impact',
  'policy impact',
  'collapse risk',
  'extinction risk',
  'existential risk',
  'x-risk',
  'catastrophic risk',
  'tipping points',
  'complexity',
  'emergence',
  'innovation',
  'experimentation',
  'pilot projects',
  'demonstration',
  'scaling',
  'knowledge translation',
  'capacity building',
  'institutional change',
];

export const METHODOLOGICAL_PREFERENCES = [
  'futures methodologies',
  'foresight',
  'scenario planning',
  'exploratory modeling',
  'DMDU',
  'decision making under deep uncertainty',
  'expert elicitation',
  'citizen assemblies',
  'deliberative methods',
  'participatory research',
  'action research',
  'systems thinking',
  'complexity science',
  'interdisciplinary collaboration',
  'mixed methods',
  'qualitative research',
  'quantitative modeling',
  'case studies',
  'comparative analysis',
];

export const GEOGRAPHIC_PRIORITIES = [
  'global',
  'international',
  'UK',
  'United Kingdom',
  'Europe',
  'European',
  'developing countries',
  'global south',
  'trade chokepoints',
  'Singapore',
  'China',
  'Costa Rica',
  'Switzerland',
  'Japan',
  'Nordic countries',
  'Taiwan',
];

export const APPLICANT_TYPE_PREFERENCES = [
  'research organization',
  'think tank',
  'NGO',
  'civil society',
  'academic institution',
  'university',
  'independent researcher',
  'early career researcher',
  'interdisciplinary team',
  'collaboration',
  'partnership',
];

export const FUNDING_PREFERENCES = {
  minAward: 10000, // £10k minimum for meaningful work
  idealRange: [50000, 500000], // £50k-500k sweet spot
  maxAward: 2000000, // £2M max (beyond this, different application process)
  durationMonths: {
    min: 6,
    ideal: [12, 36],
    max: 60,
  },
};

/**
 * Generate a comprehensive prompt context for LLM-based grant analysis
 */
export function getOdysseanContextPrompt(): string {
  return `
# Odyssean Institute Research Agenda

The Odyssean Institute is an anchor institution for ambitious, robust methods to address Grand Challenges. It operates as a Focused Research Organization (FRO) targeting real-world impact through:

## Three Research Strands

### 1. Odyssean Process
Decision-making under extreme risk and uncertainty. Integrates expert elicitation, DMDU modeling, and citizen assemblies for comprehensive, legitimate governance.

**Focus areas:** Democratic innovation, participatory governance, AI governance, climate policy, systemic reform, public trust, institutional capacity

**Methods:** Expert elicitation, DMDU, exploratory modeling, citizen assemblies, deliberative polling, futures methodologies

### 2. GRAIN (Global Resilient Anticipatory Infrastructure Network)
Building resilience against global collapse/extinction through critical infrastructure, supply chains, and institutional capacity.

**Focus areas:** Supply chain resilience, critical commodities, futures/foresight, sustainable development, agroecology, circular economy, trade policy

**Methods:** Causal layered analysis, backcasting, 3 horizons, horizon scanning, systems mapping, supply chain modeling

### 3. Aeonic Flourishing
Long-term human flourishing within planetary boundaries, integrating wellbeing, justice, and ecological sustainability.

**Focus areas:** Wellbeing, capabilities approach, planetary boundaries, intergenerational justice, indigenous wisdom, commons governance, community resilience

**Methods:** Capabilities approach, socio-ecological systems, commons governance, participatory action research, philosophical synthesis

## Cross-Cutting Priorities
- Systemic/paradigmatic change (not incremental)
- Interdisciplinary collaboration
- Action research with real-world impact
- Public engagement and policy influence
- Collapse/extinction risk mitigation
- Institutional innovation
- Knowledge translation and capacity building

## Ideal Grant Characteristics
- **Scope:** Ambitious, systemic interventions (not narrow technical fixes)
- **Approach:** Interdisciplinary, participatory, futures-oriented
- **Impact:** Policy influence, institutional change, public engagement
- **Geography:** UK, Europe, global, or strategically important regions
- **Funding:** £50k-500k for 1-3 years (flexible)
- **Applicant:** Research orgs, think tanks, NGOs, academic institutions, interdisciplinary teams
`;
}

/**
 * Scoring weights for different alignment dimensions
 */
export const ALIGNMENT_WEIGHTS = {
  researchStrandMatch: 0.35, // 35% - Core research area alignment
  methodologicalFit: 0.20, // 20% - Methods match OI approach
  thematicAlignment: 0.20, // 20% - Themes align with OI priorities
  impactPotential: 0.15, // 15% - Real-world impact, policy influence
  practicalFeasibility: 0.10, // 10% - Timeline, budget, requirements realistic
};

/**
 * Confidence thresholds for automated decisions
 */
export const CONFIDENCE_THRESHOLDS = {
  highConfidence: 0.8, // Auto-recommend
  mediumConfidence: 0.5, // Needs review
  lowConfidence: 0.3, // Likely not relevant
};
