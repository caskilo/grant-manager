import { useState, useCallback } from 'react';
import {
  Container, Title, Text, Stack, Group, Tabs, Paper, TextInput, Textarea,
  Select, NumberInput, Button, Badge, ActionIcon, TagsInput,
  Grid, Alert, Accordion, ColorInput, CopyButton, Tooltip, Divider, Loader,
  ScrollArea, CloseButton, Box, SegmentedControl, Collapse,
} from '@mantine/core';
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import {
  IconBuilding, IconSitemap, IconBrain, IconCoins, IconPalette,
  IconAdjustments, IconDeviceFloppy, IconAlertTriangle, IconPlus, IconTrash,
  IconCopy, IconCheck, IconRefresh, IconUpload, IconSparkles, IconX, IconFileText, IconChevronDown,
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { notifications } from '@mantine/notifications';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Programme {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  themes: string[];
  methodologies: string[];
  outputTypes: string[];
}

interface OrgSettings {
  name: string;
  legalName: string;
  type: string;
  sector: string;
  staffCount: string;
  yearFounded: string;
  charityNumber: string;
  companyNumber: string;
  website: string;
  hqCity: string;
  hqCountry: string;
  description: string;
  mission: string;
  vision: string;
  programmes: Programme[];
  crossCuttingThemes: string[];
  geographicPriorities: string[];
  applicantTypeDescriptions: string[];
  discoveryContext: string;
  alignmentContext: string;
  applicationContext: string;
  fundingMinAward: number;
  fundingIdealMin: number;
  fundingIdealMax: number;
  fundingMaxAward: number;
  durationMinMonths: number;
  durationIdealMin: number;
  durationIdealMax: number;
  durationMaxMonths: number;
  preferredCurrencies: string[];
  primaryLogoUrl: string;
  secondaryLogoUrl: string;
  primaryColour: string;
  secondaryColour: string;
  accentColour: string;
  preferredLlmProvider: string;
  discoveryTemperature: number;
  alignmentTemperature: number;
  applicationTemperature: number;
}

// ─── Options ───────────────────────────────────────────────────────────────────

const ORG_TYPE_OPTIONS = [
  { value: 'fro', label: 'Focused Research Organisation (FRO)' },
  { value: 'research_institute', label: 'Research Institute' },
  { value: 'think_tank', label: 'Think Tank' },
  { value: 'ngo', label: 'NGO / Charity' },
  { value: 'university', label: 'University / Academic Institution' },
  { value: 'civil_society', label: 'Civil Society Organisation' },
  { value: 'social_enterprise', label: 'Social Enterprise' },
  { value: 'consultancy', label: 'Consultancy / Agency' },
  { value: 'government', label: 'Government / Public Body' },
  { value: 'other', label: 'Other' },
];

const STAFF_COUNT_OPTIONS = [
  { value: '1', label: 'Just me (1)' },
  { value: '2-5', label: '2–5' },
  { value: '6-15', label: '6–15' },
  { value: '16-50', label: '16–50' },
  { value: '51-200', label: '51–200' },
  { value: '200+', label: '200+' },
];

const LLM_PROVIDER_OPTIONS = [
  { value: 'gemini', label: 'Google Gemini (default)' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'auto', label: 'Auto (system default)' },
];

// ─── Default context strings (mirror current backend hardcoded values) ─────────

const DISCOVERY_CONTEXT_DEFAULT = `# Odyssean Institute Research Agenda

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
- **Applicant:** Research orgs, think tanks, NGOs, academic institutions, interdisciplinary teams`;

const APPLICATION_CONTEXT_DEFAULT = `The Odyssean Institute is a Focused Research Organization (FRO) dedicated to developing comprehensive, legitimate, and tractable approaches to Grand Challenges. We operate at the intersection of democratic innovation, systemic resilience, and long-term human flourishing.

## Our Work
Our research spans three strands: (1) the Odyssean Process — governance frameworks for decision-making under deep uncertainty using expert elicitation, DMDU, and citizen assemblies; (2) GRAIN — global resilience infrastructure against systemic collapse; and (3) Aeonic Flourishing — long-term wellbeing within planetary boundaries.

## Approach
We are committed to interdisciplinary, participatory approaches that bridge academic rigour with real-world policy impact. Our team brings expertise in futures methodologies, expert elicitation, citizen assemblies, and systems thinking.

## Organisational Capacity
[Describe past projects, publications, partnerships, and organisational infrastructure relevant to this application.]

## Strategic Alignment
[Describe how this specific opportunity aligns with our research agenda and organisational priorities.]`;

// ─── Default settings (pre-populated with current Odyssean Institute data) ─────

const DEFAULT_SETTINGS: OrgSettings = {
  name: 'Odyssean Institute',
  legalName: 'Odyssean Institute',
  type: 'fro',
  sector: 'Research & Policy',
  staffCount: '2-5',
  yearFounded: '2020',
  charityNumber: '',
  companyNumber: '',
  website: '',
  hqCity: 'London',
  hqCountry: 'UK',
  description: 'An anchor institution for ambitious, robust methods to address Grand Challenges. Operating as a Focused Research Organization (FRO) targeting real-world impact through interdisciplinary research and democratic innovation.',
  mission: 'To develop and deploy comprehensive, legitimate, and tractable decision-making processes for addressing Grand Challenges at civilisational scale.',
  vision: 'A world where humanity\'s most complex challenges are met with commensurate ambition, rigour, and democratic legitimacy — and where long-term flourishing is the guiding measure of success.',
  programmes: [
    {
      id: 'odyssean-process',
      name: 'Odyssean Process',
      description: 'A modular method for comprehensive, legitimate, and tractable decision making under conditions of extreme risk and uncertainty. Integrates expert elicitation, DMDU modeling, and citizen assemblies.',
      keywords: ['decision making', 'governance', 'democracy', 'democratic innovation', 'participatory democracy', 'deliberative democracy', 'citizen assembly', 'expert elicitation', 'risk', 'uncertainty', 'deep uncertainty', 'policy', 'AI governance', 'climate policy', 'systemic reform', 'institutional reform', 'polarization', 'consensus building'],
      themes: ['democratic legitimacy', 'public trust', 'governance quality', 'systemic change', 'paradigm shift', 'institutional capacity', 'political reform', 'civic engagement'],
      methodologies: ['expert elicitation', 'DMDU', 'exploratory modeling', 'scenario planning', 'citizen assemblies', 'deliberative polling', 'participatory methods', 'futures methodologies'],
      outputTypes: ['policy recommendations', 'governance frameworks', 'deliberative processes', 'institutional designs', 'public engagement tools', 'documentary', 'educational curriculum'],
    },
    {
      id: 'grain',
      name: 'GRAIN (Global Resilient Anticipatory Infrastructure Network)',
      description: 'Identifying key commodities, logistical hubs, and institutional qualities enabling recovery from, and reduction of exposure to global collapse or extinction.',
      keywords: ['resilience', 'infrastructure', 'supply chain', 'critical commodities', 'trade', 'logistics', 'futures', 'foresight', 'anticipatory', 'sustainability', 'development economics', 'circular economy', 'agroecology', 'onshoring', 'globalization'],
      themes: ['global resilience', 'collapse prevention', 'extinction risk', 'material flows', 'institutional capacity', 'technological innovation', 'adaptive capacity', 'positive tipping points'],
      methodologies: ['causal layered analysis', 'CLA', 'backcasting', '3 horizons framework', 'horizon scanning', 'systems mapping', 'trade analysis', 'supply chain modeling'],
      outputTypes: ['resilience frameworks', 'infrastructure designs', 'technology incubation', 'trade policy', 'industrial strategy', 'case studies', 'partnership models'],
    },
    {
      id: 'aeonic-flourishing',
      name: 'Aeonic Flourishing',
      description: 'Conceptualising a truly long-term yet ambitious, integrative view of human flourishing, in the context of accelerating crises and encroaching planetary boundaries.',
      keywords: ['wellbeing', 'flourishing', 'capabilities', 'capabilities approach', 'planetary boundaries', 'sustainability', 'justice', 'equity', 'intergenerational', 'long term', 'indigenous knowledge', 'commons', 'doughnut economics', 'buen vivir', 'community'],
      themes: ['human flourishing', 'existential hope', 'ecological sustainability', 'social justice', 'intergenerational fairness', 'community resilience', 'cultural wisdom', 'paradigm transformation'],
      methodologies: ['capabilities approach', 'socio-ecological systems', 'commons governance', 'participatory action research', 'philosophical synthesis', 'interdisciplinary integration'],
      outputTypes: ['theoretical frameworks', 'wellbeing indicators', 'community projects', 'local governance models', 'philosophical synthesis', 'practical interventions'],
    },
  ],
  crossCuttingThemes: ['systemic change', 'paradigmatic change', 'interdisciplinary', 'transdisciplinary', 'action research', 'focused research organization', 'public engagement', 'real world impact', 'policy impact', 'collapse risk', 'extinction risk', 'existential risk', 'tipping points', 'complexity', 'innovation', 'knowledge translation', 'capacity building'],
  geographicPriorities: ['global', 'international', 'UK', 'United Kingdom', 'Europe', 'European', 'developing countries', 'global south', 'Singapore', 'Switzerland', 'Nordic countries'],
  applicantTypeDescriptions: ['research organization', 'think tank', 'NGO', 'civil society', 'academic institution', 'independent researcher', 'interdisciplinary team', 'collaboration', 'partnership'],
  discoveryContext: DISCOVERY_CONTEXT_DEFAULT,
  alignmentContext: DISCOVERY_CONTEXT_DEFAULT,
  applicationContext: APPLICATION_CONTEXT_DEFAULT,
  fundingMinAward: 10000,
  fundingIdealMin: 50000,
  fundingIdealMax: 500000,
  fundingMaxAward: 2000000,
  durationMinMonths: 6,
  durationIdealMin: 12,
  durationIdealMax: 36,
  durationMaxMonths: 60,
  preferredCurrencies: ['GBP', 'EUR', 'USD'],
  primaryLogoUrl: '',
  secondaryLogoUrl: '',
  primaryColour: '#2874A6',
  secondaryColour: '#1e3a5f',
  accentColour: '#5DADE2',
  preferredLlmProvider: 'gemini',
  discoveryTemperature: 0,
  alignmentTemperature: 0.3,
  applicationTemperature: 0.7,
};

// ─── API helpers ───────────────────────────────────────────────────────────────

interface ApiOrgResponse {
  settings: ApiOrgSettings;
  version: number;
  updatedAt: string | null;
  seeded: boolean;
}

interface ApiOrgSettings extends Omit<OrgSettings,
  'fundingMinAward' | 'fundingIdealMin' | 'fundingIdealMax' | 'fundingMaxAward' |
  'durationMinMonths' | 'durationIdealMin' | 'durationIdealMax' | 'durationMaxMonths' |
  'preferredCurrencies'
> {
  funding: {
    minAward: number;
    idealMin: number;
    idealMax: number;
    maxAward: number;
    durationMinMonths: number;
    durationIdealMin: number;
    durationIdealMax: number;
    durationMaxMonths: number;
    preferredCurrencies: string[];
  };
}

function fromApi(s: ApiOrgSettings): OrgSettings {
  return {
    ...s,
    fundingMinAward: s.funding?.minAward ?? 10000,
    fundingIdealMin: s.funding?.idealMin ?? 50000,
    fundingIdealMax: s.funding?.idealMax ?? 500000,
    fundingMaxAward: s.funding?.maxAward ?? 2000000,
    durationMinMonths: s.funding?.durationMinMonths ?? 6,
    durationIdealMin: s.funding?.durationIdealMin ?? 12,
    durationIdealMax: s.funding?.durationIdealMax ?? 36,
    durationMaxMonths: s.funding?.durationMaxMonths ?? 60,
    preferredCurrencies: s.funding?.preferredCurrencies ?? ['GBP', 'EUR', 'USD'],
  } as OrgSettings;
}

function toApi(s: OrgSettings): Partial<ApiOrgSettings> {
  const { fundingMinAward, fundingIdealMin, fundingIdealMax, fundingMaxAward,
    durationMinMonths, durationIdealMin, durationIdealMax, durationMaxMonths,
    preferredCurrencies, ...rest } = s;
  return {
    ...rest,
    funding: {
      minAward: fundingMinAward,
      idealMin: fundingIdealMin,
      idealMax: fundingIdealMax,
      maxAward: fundingMaxAward,
      durationMinMonths,
      durationIdealMin,
      durationIdealMax,
      durationMaxMonths,
      preferredCurrencies,
    },
  };
}

async function fetchOrg(): Promise<OrgSettings> {
  const res = await api.get<ApiOrgResponse>('/organisation');
  return fromApi(res.data.settings);
}

async function putOrg(patch: OrgSettings): Promise<OrgSettings> {
  const res = await api.put<{ settings: ApiOrgSettings }>('/organisation', toApi(patch));
  return fromApi(res.data.settings);
}

async function resetOrgApi(): Promise<OrgSettings> {
  const res = await api.post<{ settings: ApiOrgSettings }>('/organisation/reset');
  return fromApi(res.data.settings);
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function tokenEstimate(text: string): number {
  return Math.ceil(wordCount(text) * 1.3);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Programme accordion item ─────────────────────────────────────────────────

function ProgrammeItem({
  prog,
  onUpdate,
  onDelete,
}: {
  prog: Programme;
  onUpdate: (id: string, patch: Partial<Programme>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Accordion.Item value={prog.id}>
      <Accordion.Control>
        <Text fw={500} size="sm">{prog.name || <Text component="span" c="dimmed" fs="italic" size="sm">Unnamed programme</Text>}</Text>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="sm" pt="xs">
          <Group justify="flex-end">
            <Button
              color="red" variant="subtle" size="xs"
              leftSection={<IconTrash size={12} />}
              onClick={() => onDelete(prog.id)}
            >
              Remove
            </Button>
          </Group>
          <TextInput
            label="Programme name"
            value={prog.name}
            onChange={(e) => onUpdate(prog.id, { name: e.target.value })}
          />
          <Textarea
            label="Description"
            value={prog.description}
            onChange={(e) => onUpdate(prog.id, { description: e.target.value })}
            minRows={2}
            autosize
          />
          <TagsInput
            label="Keywords"
            description="Terms used for grant discovery matching. Press Enter or comma to add."
            value={prog.keywords}
            onChange={(v) => onUpdate(prog.id, { keywords: v })}
            splitChars={[',']}
          />
          <TagsInput
            label="Themes"
            description="High-level thematic areas relevant to this programme."
            value={prog.themes}
            onChange={(v) => onUpdate(prog.id, { themes: v })}
            splitChars={[',']}
          />
          <TagsInput
            label="Methodologies"
            description="Research and engagement methods this programme uses."
            value={prog.methodologies}
            onChange={(v) => onUpdate(prog.id, { methodologies: v })}
            splitChars={[',']}
          />
          <TagsInput
            label="Output types"
            description="Types of deliverables or outputs this programme produces."
            value={prog.outputTypes}
            onChange={(v) => onUpdate(prog.id, { outputTypes: v })}
            splitChars={[',']}
          />
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

// ─── LLM context workspace ────────────────────────────────────────────────────

interface SourceEntry {
  id: string;
  name: string;
  text: string;
}

function ContextWorkspace({
  label,
  description,
  contextType,
  value,
  onChange,
  open,
  onToggle,
}: {
  label: string;
  description: string;
  contextType: 'discovery' | 'alignment' | 'application';
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [summarising, setSummarising] = useState(false);
  const [revising, setRevising] = useState(false);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const wc = wordCount(value);
  const tc = tokenEstimate(value);

  const addSource = useCallback((name: string, text: string) => {
    if (!text.trim()) return;
    setSources((prev) => [...prev, { id: uid(), name, text }]);
  }, []);

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handlePasteAdd = () => {
    if (!pasteText.trim()) return;
    addSource(`Pasted text ${sources.length + 1}`, pasteText);
    setPasteText('');
  };

  const handleDrop = useCallback((files: FileWithPath[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) addSource(file.name, text);
      };
      reader.readAsText(file);
    });
  }, [addSource]);

  const handleSummarise = async () => {
    if (sources.length === 0 && !value.trim()) return;
    setSummarising(true);
    try {
      const res = await api.post<{ summary: string }>('/organisation/summarise-context', {
        contextType,
        sources: sources.length > 0 ? sources.map((s) => s.text) : [value],
      });
      const result = res.data.summary;
      onChange(mode === 'append' && value.trim() ? value + '\n\n' + result : result);
      setSources([]);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Summarise failed';
      notifications.show({ color: 'red', title: 'Summarise failed', message: msg });
    } finally {
      setSummarising(false);
    }
  };

  const handleRevise = async () => {
    if (!value.trim() && sources.length === 0) return;
    setRevising(true);
    try {
      const allSources = [
        ...(value.trim() ? [value] : []),
        ...sources.map((s) => s.text),
      ];
      const res = await api.post<{ summary: string }>('/organisation/summarise-context', {
        contextType,
        sources: allSources,
      });
      onChange(res.data.summary);
      setSources([]);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Revise failed';
      notifications.show({ color: 'red', title: 'Revise failed', message: msg });
    } finally {
      setRevising(false);
    }
  };

  const accentMap = { discovery: 'blue', alignment: 'violet', application: 'teal' } as const;
  const accent = accentMap[contextType];

  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
      {/* Collapsible header strip */}
      <Box
        px="md" py={8}
        onClick={onToggle}
        style={{
          borderBottom: open ? '1px solid var(--mantine-color-default-border)' : undefined,
          background: `var(--mantine-color-${accent}-0)`,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Group justify="space-between" wrap="nowrap" gap="xs" align="center">
          <Group gap={10} wrap="nowrap" align="center" style={{ flex: 1, minWidth: 0 }}>
            <Box
              style={{
                width: 3,
                height: 28,
                borderRadius: 2,
                background: `var(--mantine-color-${accent}-4)`,
                flexShrink: 0,
              }}
            />
            <Box style={{ minWidth: 0 }}>
              <Text fw={700} size="sm" lh={1.2}>{label}</Text>
              {!open && wc > 0 && (
                <Text size="xs" c="dimmed" lh={1.2}>{wc.toLocaleString()} words · ~{tc.toLocaleString()} tokens</Text>
              )}
              {open && <Text size="xs" c="dimmed" lh={1.3} mt={2}>{description}</Text>}
            </Box>
          </Group>
          <IconChevronDown
            size={15}
            style={{
              color: 'var(--mantine-color-dimmed)',
              flexShrink: 0,
              transition: 'transform 150ms ease',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </Group>
      </Box>

      <Collapse in={open}>
      <Stack gap="sm" p="md">
        {/* Source inputs */}
        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={6} tt="uppercase" style={{ letterSpacing: '0.05em' }}>Source material</Text>

          {/* Two-column layout: paste area + drop zone */}
          <Group gap="sm" align="stretch" wrap="nowrap">

            {/* Left: fixed-height resizable paste area + toolbar */}
            <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
              {/* Resizable textarea wrapper */}
              <Box
                style={{
                  height: 120,
                  resize: 'vertical',
                  overflow: 'hidden',
                  minHeight: 72,
                  maxHeight: 300,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Textarea
                  placeholder="Paste text to add as a source..."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  style={{ flex: 1 }}
                  styles={{
                    root: { height: '100%', display: 'flex', flexDirection: 'column' },
                    wrapper: { flex: 1 },
                    input: { fontSize: 12, height: '100%', resize: 'none' },
                  }}
                />
              </Box>

              {/* Toolbar row below paste area */}
              <Group gap={6} wrap="nowrap" justify="space-between">
                {/* Left side: Add + Revise */}
                <Group gap={6} wrap="nowrap">
                  <Button
                    size="xs"
                    variant="default"
                    leftSection={<IconPlus size={12} />}
                    onClick={handlePasteAdd}
                    disabled={!pasteText.trim()}
                  >
                    Add
                  </Button>
                  <Tooltip label={!value.trim() ? 'Add context output first' : 'Holistically revise the context output using the current sources'} withArrow>
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<IconRefresh size={12} />}
                      onClick={handleRevise}
                      loading={revising}
                      disabled={!value.trim() && sources.length === 0}
                    >
                      Revise
                    </Button>
                  </Tooltip>
                </Group>

                {/* Right side: toggle + Summarise */}
                <Group gap={6} wrap="nowrap">
                  <SegmentedControl
                    size="xs"
                    value={mode}
                    onChange={(v) => setMode(v as 'replace' | 'append')}
                    data={[
                      { label: 'Replace', value: 'replace' },
                      { label: 'Append', value: 'append' },
                    ]}
                  />
                  <Tooltip
                    label={sources.length === 0 && !value.trim() ? 'Add source material first' : mode === 'append' ? 'Append summarised sources to existing context' : 'Replace context with summarised sources'}
                    withArrow
                  >
                    <Button
                      size="xs"
                      variant="light"
                      color="violet"
                      leftSection={<IconSparkles size={12} />}
                      onClick={handleSummarise}
                      loading={summarising}
                      disabled={sources.length === 0 && !value.trim()}
                    >
                      {`Summarise${sources.length > 0 ? ` (${sources.length})` : ''}`}
                    </Button>
                  </Tooltip>
                </Group>
              </Group>

              {/* Source list */}
              {sources.length > 0 && (
                <ScrollArea.Autosize mah={110}>
                  <Stack gap={4}>
                    {sources.map((s) => (
                      <Group key={s.id} gap="xs" wrap="nowrap"
                        style={{ background: 'var(--mantine-color-default-hover)', borderRadius: 4, padding: '3px 8px' }}
                      >
                        <IconFileText size={12} style={{ flexShrink: 0, color: 'var(--mantine-color-dimmed)' }} />
                        <Text size="xs" style={{ flex: 1 }} truncate>{s.name}</Text>
                        <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
                          {wordCount(s.text).toLocaleString()}w
                        </Badge>
                        <CloseButton size="xs" onClick={() => removeSource(s.id)} />
                      </Group>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              )}
            </Stack>

            {/* Right: drop zone — grid-aligned, matches left column height */}
            <Dropzone
              onDrop={handleDrop}
              accept={['text/plain', 'text/markdown', '.md']}
              maxSize={5 * 1024 * 1024}
              multiple
              style={{ width: 120, flexShrink: 0, alignSelf: 'flex-start' }}
              styles={{
                root: {
                  borderStyle: 'dashed',
                  height: 120,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                },
              }}
            >
              <Stack gap={6} align="center" style={{ pointerEvents: 'none' }}>
                <Dropzone.Accept><IconUpload size={20} color="var(--mantine-color-blue-6)" /></Dropzone.Accept>
                <Dropzone.Reject><IconX size={20} color="var(--mantine-color-red-6)" /></Dropzone.Reject>
                <Dropzone.Idle><IconUpload size={20} color="var(--mantine-color-dimmed)" /></Dropzone.Idle>
                <Text size="xs" c="dimmed" ta="center" lh={1.3} style={{ fontSize: 10 }}>Drop files<br />.txt · .md</Text>
              </Stack>
            </Dropzone>
          </Group>
        </Box>

        <Divider label="Context output" labelPosition="left" />

        {/* Context output field */}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minRows={10}
          autosize
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } }}
        />
        <Group gap={8} justify="space-between">
          <Group gap={6}>
            <Badge size="xs" variant="light" color="gray">{wc.toLocaleString()} words</Badge>
            <Badge size="xs" variant="light" color="violet">~{tc.toLocaleString()} tokens est.</Badge>
          </Group>
          <CopyButton value={value} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied' : 'Copy context to clipboard'} withArrow>
                <ActionIcon variant="subtle" size="sm" onClick={copy} color={copied ? 'teal' : 'gray'}>
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
      </Stack>
      </Collapse>
    </Paper>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function OrganisationPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data: remote, isLoading, isError } = useQuery({
    queryKey: ['organisation'],
    queryFn: fetchOrg,
    enabled: user?.role === 'ADMIN',
  });

  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  const [activeTab, setActiveTab] = useState<string>(() => {
    return sessionStorage.getItem('orgPage.tab') ?? 'identity';
  });
  const [ctxOpen, setCtxOpen] = useState<{ discovery: boolean; alignment: boolean; application: boolean }>(() => {
    try {
      const stored = sessionStorage.getItem('orgPage.ctxOpen');
      return stored ? JSON.parse(stored) : { discovery: true, alignment: true, application: true };
    } catch {
      return { discovery: true, alignment: true, application: true };
    }
  });

  const setCtxOpenPersisted = (updater: (prev: typeof ctxOpen) => typeof ctxOpen) => {
    setCtxOpen(prev => {
      const next = updater(prev);
      sessionStorage.setItem('orgPage.ctxOpen', JSON.stringify(next));
      return next;
    });
  };

  const effective = settings ?? remote ?? DEFAULT_SETTINGS;

  const saveMutation = useMutation({
    mutationFn: putOrg,
    onSuccess: (saved) => {
      queryClient.setQueryData(['organisation'], saved);
      setSettings(null);
      setDirty(false);
      notifications.show({ title: 'Saved', message: 'Organisation settings saved to database.', color: 'teal' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to save settings.';
      notifications.show({ title: 'Save failed', message: msg, color: 'red' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetOrgApi,
    onSuccess: (reset) => {
      queryClient.setQueryData(['organisation'], reset);
      setSettings(null);
      setDirty(false);
      notifications.show({ title: 'Reset', message: 'Settings reset to defaults.', color: 'orange' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to reset settings.';
      notifications.show({ title: 'Reset failed', message: msg, color: 'red' });
    },
  });

  if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  const update = (patch: Partial<OrgSettings>) => {
    setSettings(prev => ({ ...(prev ?? remote ?? DEFAULT_SETTINGS), ...patch }));
    setDirty(true);
  };

  const handleSave = () => saveMutation.mutate(effective);
  const handleReset = () => resetMutation.mutate();

  const addProgramme = () => {
    update({
      programmes: [
        ...effective.programmes,
        { id: uid(), name: '', description: '', keywords: [], themes: [], methodologies: [], outputTypes: [] },
      ],
    });
  };

  const updateProgramme = (id: string, patch: Partial<Programme>) => {
    update({ programmes: effective.programmes.map(p => p.id === id ? { ...p, ...patch } : p) });
  };

  const deleteProgramme = (id: string) => {
    update({ programmes: effective.programmes.filter(p => p.id !== id) });
  };

  if (isLoading) return <Container size="xl"><Stack align="center" py="xl"><Loader /><Text c="dimmed" size="sm">Loading organisation settings…</Text></Stack></Container>;
  if (isError) return <Container size="xl"><Alert color="red" icon={<IconAlertTriangle size={16} />} mt="lg">Failed to load organisation settings from the server.</Alert></Container>;

  return (
    <Container size="xl">
      <Stack gap="lg">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Group gap="sm" align="center">
              <Title order={1}>Organisation</Title>
              {dirty && <Badge color="orange" variant="filled" size="sm">Unsaved changes</Badge>}
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              Manage your organisation profile, programme areas, LLM context, and system preferences.
            </Text>
          </div>
          <Group gap="sm">
            <Button
              variant="subtle"
              size="sm"
              leftSection={<IconRefresh size={14} />}
              onClick={handleReset}
              loading={resetMutation.isPending}
            >
              Reset to defaults
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              disabled={!dirty}
              loading={saveMutation.isPending}
              color={dirty ? 'blue' : 'gray'}
            >
              Save changes
            </Button>
          </Group>
        </Group>

        {dirty && (
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
            <Text size="sm">You have unsaved changes. Click <strong>Save changes</strong> to persist to the database.</Text>
          </Alert>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onChange={(v) => { const t = v ?? 'identity'; setActiveTab(t); sessionStorage.setItem('orgPage.tab', t); }}>
          <Tabs.List>
            <Tabs.Tab value="identity" leftSection={<IconBuilding size={15} />}>Identity</Tabs.Tab>
            <Tabs.Tab value="programmes" leftSection={<IconSitemap size={15} />}>Programmes</Tabs.Tab>
            <Tabs.Tab value="llm-context" leftSection={<IconBrain size={15} />}>LLM Context</Tabs.Tab>
            <Tabs.Tab value="funding" leftSection={<IconCoins size={15} />}>Funding</Tabs.Tab>
            <Tabs.Tab value="branding" leftSection={<IconPalette size={15} />}>Branding</Tabs.Tab>
            <Tabs.Tab value="system" leftSection={<IconAdjustments size={15} />}>System</Tabs.Tab>
          </Tabs.List>

          {/* ── Identity ──────────────────────────────────────────────────── */}
          <Tabs.Panel value="identity" pt="md">
            <Stack gap="md">

              {/* Basic information */}
              <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                <Box px="md" py={8} style={{ borderBottom: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-gray-0)' }}>
                  <Group gap={10} wrap="nowrap" align="center">
                    <Box style={{ width: 3, height: 24, borderRadius: 2, background: 'var(--mantine-color-gray-4)', flexShrink: 0 }} />
                    <Text fw={700} size="sm">Basic information</Text>
                  </Group>
                </Box>
                <Box p="md">
                  <Grid gutter="sm">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label="Organisation name"
                        value={effective.name}
                        onChange={(e) => update({ name: e.target.value })}
                        required
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label="Legal name"
                        value={effective.legalName}
                        onChange={(e) => update({ legalName: e.target.value })}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label="Organisation type"
                        data={ORG_TYPE_OPTIONS}
                        value={effective.type}
                        onChange={(v) => update({ type: v || '' })}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label="Sector"
                        placeholder="e.g. Research & Policy, Environment, Health"
                        value={effective.sector}
                        onChange={(e) => update({ sector: e.target.value })}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 3 }}>
                      <TextInput
                        label="Year founded"
                        placeholder="e.g. 2020"
                        value={effective.yearFounded}
                        onChange={(e) => update({ yearFounded: e.target.value })}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 3 }}>
                      <Select
                        label="Staff count"
                        data={STAFF_COUNT_OPTIONS}
                        value={effective.staffCount}
                        onChange={(v) => update({ staffCount: v || '' })}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label="Website"
                        placeholder="https://..."
                        value={effective.website}
                        onChange={(e) => update({ website: e.target.value })}
                      />
                    </Grid.Col>
                  </Grid>
                </Box>
              </Paper>

              {/* Registration & location */}
              <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                <Box px="md" py={8} style={{ borderBottom: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-gray-0)' }}>
                  <Group gap={10} wrap="nowrap" align="center">
                    <Box style={{ width: 3, height: 24, borderRadius: 2, background: 'var(--mantine-color-gray-4)', flexShrink: 0 }} />
                    <Text fw={700} size="sm">Registration &amp; location</Text>
                  </Group>
                </Box>
                <Box p="md">
                  <Grid gutter="sm">
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <TextInput
                        label="Charity number"
                        placeholder="e.g. 1234567"
                        value={effective.charityNumber}
                        onChange={(e) => update({ charityNumber: e.target.value })}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <TextInput
                        label="Company number"
                        placeholder="e.g. 12345678"
                        value={effective.companyNumber}
                        onChange={(e) => update({ companyNumber: e.target.value })}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <TextInput
                        label="Other identifier"
                        placeholder="e.g. EIN, VAT number"
                        value={''}
                        readOnly
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <TextInput
                        label="HQ city"
                        value={effective.hqCity}
                        onChange={(e) => update({ hqCity: e.target.value })}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <TextInput
                        label="Country"
                        value={effective.hqCountry}
                        onChange={(e) => update({ hqCountry: e.target.value })}
                      />
                    </Grid.Col>
                  </Grid>
                </Box>
              </Paper>

              {/* Narrative */}
              <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                <Box px="md" py={8} style={{ borderBottom: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-gray-0)' }}>
                  <Group gap={10} wrap="nowrap" align="center">
                    <Box style={{ width: 3, height: 24, borderRadius: 2, background: 'var(--mantine-color-gray-4)', flexShrink: 0 }} />
                    <Box>
                      <Text fw={700} size="sm">Narrative</Text>
                      <Text size="xs" c="dimmed" lh={1.3}>Injected into LLM prompts across discovery, alignment, and application drafting.</Text>
                    </Box>
                  </Group>
                </Box>
                <Stack gap="sm" p="md">
                  <Textarea
                    label="Elevator pitch"
                    description="2–3 sentences used as a concise org summary throughout the pipeline."
                    value={effective.description}
                    onChange={(e) => update({ description: e.target.value })}
                    minRows={3}
                    autosize
                  />
                  <Grid gutter="sm">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        label="Mission"
                        description="What the organisation exists to do."
                        value={effective.mission}
                        onChange={(e) => update({ mission: e.target.value })}
                        minRows={3}
                        autosize
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Textarea
                        label="Vision"
                        description="The world the organisation wants to help create."
                        value={effective.vision}
                        onChange={(e) => update({ vision: e.target.value })}
                        minRows={3}
                        autosize
                      />
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Paper>

            </Stack>
          </Tabs.Panel>

          {/* ── Programmes ──────────────────────────────────────────────────── */}
          <Tabs.Panel value="programmes" pt="md">
            <Stack gap="md">
              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text fw={600}>Programme areas</Text>
                      <Text size="xs" c="dimmed">
                        Research strands or strategic programmes. Keywords and themes feed directly into LLM grant matching and alignment scoring.
                      </Text>
                    </div>
                    <Button
                      size="sm"
                      leftSection={<IconPlus size={14} />}
                      variant="light"
                      onClick={addProgramme}
                    >
                      Add programme
                    </Button>
                  </Group>

                  {effective.programmes.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="xl">
                      No programmes defined. Add one to configure grant matching criteria.
                    </Text>
                  ) : (
                    <Accordion variant="separated" chevronPosition="left">
                      {effective.programmes.map(prog => (
                        <ProgrammeItem
                          key={prog.id}
                          prog={prog}
                          onUpdate={updateProgramme}
                          onDelete={deleteProgramme}
                        />
                      ))}
                    </Accordion>
                  )}
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text fw={600}>Cross-cutting configuration</Text>
                  <Text size="xs" c="dimmed">
                    Themes, geographies, and applicant type descriptors that apply across all programmes and are used in matching heuristics.
                  </Text>
                  <TagsInput
                    label="Cross-cutting themes"
                    description="Themes relevant across all programme areas. Press Enter or comma to add."
                    value={effective.crossCuttingThemes}
                    onChange={(v) => update({ crossCuttingThemes: v })}
                    splitChars={[',']}
                  />
                  <TagsInput
                    label="Geographic priorities"
                    description="Regions and countries of particular strategic relevance."
                    value={effective.geographicPriorities}
                    onChange={(v) => update({ geographicPriorities: v })}
                    splitChars={[',']}
                  />
                  <TagsInput
                    label="Applicant type descriptors"
                    description="How this organisation should be described when matching grant eligibility criteria."
                    value={effective.applicantTypeDescriptions}
                    onChange={(v) => update({ applicantTypeDescriptions: v })}
                    splitChars={[',']}
                  />
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* ── LLM Context ─────────────────────────────────────────────────── */}
          <Tabs.Panel value="llm-context" pt="md">
            <Stack gap="md">
              <Alert color="blue" variant="light" icon={<IconBrain size={16} />}>
                <Text size="sm">
                  These blocks are injected into LLM prompts at different pipeline stages.
                  Changes saved here take effect immediately — the backend reads these values from the database on each request.
                  Token estimates are approximate (words × 1.3).
                </Text>
              </Alert>

              <ContextWorkspace
                label="Discovery context"
                description="Injected when assessing whether a web page is relevant to the organisation. Focus on themes, methods, and scope — keyword-rich and precise."
                contextType="discovery"
                value={effective.discoveryContext}
                onChange={(v) => update({ discoveryContext: v })}
                open={ctxOpen.discovery}
                onToggle={() => setCtxOpenPersisted(s => ({ ...s, discovery: !s.discovery }))}
              />

              <ContextWorkspace
                label="Alignment scoring context"
                description="Injected when scoring how well a grant aligns with the organisation's mission and programmes. Can be more detailed and nuanced than the discovery context."
                contextType="alignment"
                value={effective.alignmentContext}
                onChange={(v) => update({ alignmentContext: v })}
                open={ctxOpen.alignment}
                onToggle={() => setCtxOpenPersisted(s => ({ ...s, alignment: !s.alignment }))}
              />

              <ContextWorkspace
                label="Application writing context"
                description="Injected when generating application structures and drafting section content. Include boilerplate about the organisation, track record, and capacity."
                contextType="application"
                value={effective.applicationContext}
                onChange={(v) => update({ applicationContext: v })}
                open={ctxOpen.application}
                onToggle={() => setCtxOpenPersisted(s => ({ ...s, application: !s.application }))}
              />
            </Stack>
          </Tabs.Panel>

          {/* ── Funding ─────────────────────────────────────────────────────── */}
          <Tabs.Panel value="funding" pt="md">
            <Stack gap="md">
              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text fw={600}>Award parameters</Text>
                  <Text size="xs" c="dimmed">
                    Used in alignment scoring to assess practical feasibility of grant opportunities. All figures in the organisation's primary currency.
                  </Text>
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Minimum award"
                        description="Smallest grant worth pursuing"
                        value={effective.fundingMinAward}
                        onChange={(v) => update({ fundingMinAward: Number(v) })}
                        min={0}
                        thousandSeparator=","
                        prefix="£"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Maximum award"
                        description="Largest manageable grant"
                        value={effective.fundingMaxAward}
                        onChange={(v) => update({ fundingMaxAward: Number(v) })}
                        min={0}
                        thousandSeparator=","
                        prefix="£"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Ideal range — lower bound"
                        value={effective.fundingIdealMin}
                        onChange={(v) => update({ fundingIdealMin: Number(v) })}
                        min={0}
                        thousandSeparator=","
                        prefix="£"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Ideal range — upper bound"
                        value={effective.fundingIdealMax}
                        onChange={(v) => update({ fundingIdealMax: Number(v) })}
                        min={0}
                        thousandSeparator=","
                        prefix="£"
                      />
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text fw={600}>Duration parameters</Text>
                  <Text size="xs" c="dimmed">Grant duration ranges the organisation can realistically manage, in months.</Text>
                  <Grid>
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <NumberInput
                        label="Minimum (months)"
                        value={effective.durationMinMonths}
                        onChange={(v) => update({ durationMinMonths: Number(v) })}
                        min={1}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <NumberInput
                        label="Ideal min (months)"
                        value={effective.durationIdealMin}
                        onChange={(v) => update({ durationIdealMin: Number(v) })}
                        min={1}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <NumberInput
                        label="Ideal max (months)"
                        value={effective.durationIdealMax}
                        onChange={(v) => update({ durationIdealMax: Number(v) })}
                        min={1}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <NumberInput
                        label="Maximum (months)"
                        value={effective.durationMaxMonths}
                        onChange={(v) => update({ durationMaxMonths: Number(v) })}
                        min={1}
                      />
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text fw={600}>Preferred currencies</Text>
                  <TagsInput
                    label="ISO currency codes"
                    description="Currencies actively tracked and accepted (e.g. GBP, EUR, USD). Press Enter or comma to add."
                    value={effective.preferredCurrencies}
                    onChange={(v) => update({ preferredCurrencies: v })}
                    splitChars={[',', ' ']}
                  />
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* ── Branding ────────────────────────────────────────────────────── */}
          <Tabs.Panel value="branding" pt="md">
            <Stack gap="md">
              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text fw={600}>Logos</Text>
                  <Text size="xs" c="dimmed">
                    URLs to hosted logo assets. Used in generated documents, exports, and future white-label features.
                  </Text>
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label="Primary logo URL"
                        placeholder="https://example.com/logo.png"
                        value={effective.primaryLogoUrl}
                        onChange={(e) => update({ primaryLogoUrl: e.target.value })}
                      />
                      {effective.primaryLogoUrl && (
                        <img
                          src={effective.primaryLogoUrl}
                          alt="Primary logo preview"
                          style={{ marginTop: 8, maxHeight: 64, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label="Secondary / monochrome logo URL"
                        placeholder="https://example.com/logo-mono.png"
                        value={effective.secondaryLogoUrl}
                        onChange={(e) => update({ secondaryLogoUrl: e.target.value })}
                      />
                      {effective.secondaryLogoUrl && (
                        <img
                          src={effective.secondaryLogoUrl}
                          alt="Secondary logo preview"
                          style={{ marginTop: 8, maxHeight: 64, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text fw={600}>Colour palette</Text>
                  <Text size="xs" c="dimmed">
                    Brand colours. Informational for now — a theme system will use these to customise the UI per organisation.
                  </Text>
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <ColorInput
                        label="Primary colour"
                        value={effective.primaryColour}
                        onChange={(v) => update({ primaryColour: v })}
                        format="hex"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <ColorInput
                        label="Secondary colour"
                        value={effective.secondaryColour}
                        onChange={(v) => update({ secondaryColour: v })}
                        format="hex"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <ColorInput
                        label="Accent colour"
                        value={effective.accentColour}
                        onChange={(v) => update({ accentColour: v })}
                        format="hex"
                      />
                    </Grid.Col>
                  </Grid>
                  <Group gap="sm" mt={4}>
                    {[
                      { colour: effective.primaryColour, label: 'Primary' },
                      { colour: effective.secondaryColour, label: 'Secondary' },
                      { colour: effective.accentColour, label: 'Accent' },
                    ].map(({ colour, label }) => (
                      <Tooltip key={label} label={`${label}: ${colour}`} withArrow>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: colour, border: '1px solid rgba(0,0,0,0.12)', cursor: 'default' }} />
                          <Text size="xs" c="dimmed">{label}</Text>
                        </div>
                      </Tooltip>
                    ))}
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* ── System ──────────────────────────────────────────────────────── */}
          <Tabs.Panel value="system" pt="md">
            <Stack gap="md">
              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text fw={600}>LLM configuration</Text>
                  <Text size="xs" c="dimmed">
                    Provider is controlled by the{' '}
                    <Text component="span" ff="monospace" size="xs">LLM_PROVIDER</Text> env var on the backend (default: <Text component="span" ff="monospace" size="xs">gemini</Text>).
                    Temperature values are persisted here and will be read by the pipeline once per-call temperature configuration is wired.
                  </Text>
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label="Preferred LLM provider"
                        data={LLM_PROVIDER_OPTIONS}
                        value={effective.preferredLlmProvider}
                        onChange={(v) => update({ preferredLlmProvider: v || 'gemini' })}
                      />
                    </Grid.Col>
                  </Grid>

                  <Divider label="Temperature per use case" labelPosition="left" mt="xs" />
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <NumberInput
                        label="Discovery"
                        description="Relevance assessment. Lower = deterministic."
                        value={effective.discoveryTemperature}
                        onChange={(v) => update({ discoveryTemperature: Number(v) })}
                        min={0} max={1} step={0.1} decimalScale={1}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <NumberInput
                        label="Alignment scoring"
                        description="Fit scoring. Slight creativity for reasoning."
                        value={effective.alignmentTemperature}
                        onChange={(v) => update({ alignmentTemperature: Number(v) })}
                        min={0} max={1} step={0.1} decimalScale={1}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <NumberInput
                        label="Application writing"
                        description="Generative drafting. Higher = more varied."
                        value={effective.applicationTemperature}
                        onChange={(v) => update({ applicationTemperature: Number(v) })}
                        min={0} max={1} step={0.1} decimalScale={1}
                      />
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Paper>

            </Stack>
          </Tabs.Panel>

        </Tabs>
      </Stack>
    </Container>
  );
}
