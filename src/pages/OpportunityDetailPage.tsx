import {
  Container,
  Title,
  Text,
  Paper,
  Stack,
  Group,
  Badge,
  Anchor,
  Button,
  Divider,
  List,
  ThemeIcon,
  Loader,
  Center,
  Alert,
  Tabs,
  Timeline,
  Progress,
  RingProgress,
  Modal,
  Textarea,
  TextInput,
  ActionIcon,
  Collapse,
} from '@mantine/core';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  IconExternalLink,
  IconCalendar,
  IconCoins,
  IconMapPin,
  IconBuildingBank,
  IconInfoCircle,
  IconAlertCircle,
  IconClock,
  IconCheck,
  IconUsers,
  IconTarget,
  IconFileText,
  IconSparkles,
  IconEdit,
  IconDeviceFloppy,
  IconX,
  IconRefresh,
  IconShieldCheck,
  IconLink,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import api from '../lib/api';
import { applicationsApi } from '../lib/applications';

interface DeadlineEntry {
  date?: string;
  description?: string;
  isRolling?: boolean;
  type?: string;
}

interface Opportunity {
  id: string;
  programName: string;
  description: string | null;
  rawDescription: string | null;
  sourceUrl: string;
  opportunityUrl: string | null;
  status: string;
  deadlines: DeadlineEntry[] | string[];
  geographies: string[];
  eligibleApplicantTypes: string[];
  declaredFocus: string[];
  processSteps: string[];
  minAward: number | null;
  maxAward: number | null;
  currency: string | null;
  durationMonths: number | null;
  aiFitScore: number | null;
  aiFitReasons: string[];
  aiRecommendedAction: string | null;
  aiConfidence: number | null;
  tags: string[];
  funder: {
    id: string;
    name: string;
    type: string;
    websiteUrl?: string | null;
    description?: string | null;
  } | null;
  applications?: Array<{
    id: string;
    title: string;
    stage: string;
    outcome: string;
    createdAt: string;
    updatedAt: string;
    leadOwner?: { id: string; name: string };
    _count?: { sections: number };
    sections?: Array<{ id: string; status: string }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

const CLOSING_TYPES = new Set(['deadline', 'closing', 'close']);

/** Extract the closing deadline date, ignoring opening/decision entries */
function getDeadlineDate(deadlines: DeadlineEntry[] | string[] | null): Date | null {
  if (!deadlines || !Array.isArray(deadlines) || deadlines.length === 0) return null;
  // Prefer explicitly typed closing/deadline entries
  const typed = (deadlines as DeadlineEntry[]).filter(
    d => typeof d === 'object' && d?.type && CLOSING_TYPES.has(d.type.toLowerCase())
  );
  const candidate = typed.length > 0 ? typed[0] : (
    // Fall back to untyped entries (never use opening/decision)
    (deadlines as DeadlineEntry[]).find(
      d => typeof d === 'object' && !d?.type
    ) ?? (typeof deadlines[0] === 'string' ? deadlines[0] : null)
  );
  if (!candidate) return null;
  if (typeof candidate === 'string') {
    const d = new Date(candidate);
    return isNaN(d.getTime()) ? null : d;
  }
  if ((candidate as DeadlineEntry)?.date) {
    const d = new Date((candidate as DeadlineEntry).date!);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Render a markdown string using Mantine typography — no external library needed. */
function renderMarkdown(text: string): React.ReactNode {
  // Inline bold: split on **…**
  function inlineParse(str: string): React.ReactNode {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    if (parts.length === 1) return str;
    return parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <span key={i} style={{ fontWeight: 600 }}>{p.slice(2, -2)}</span>
        : p
    );
  }

  const blocks = text.split(/\n{2,}/);
  return (
    <Stack gap="xs">
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter(l => l !== undefined);
        // Heading
        const headingMatch = lines[0]?.match(/^(#{1,3})\s+(.+)/);
        if (headingMatch) {
          return (
            <Text key={bi} size="sm" fw={600} mt={bi > 0 ? 4 : 0}>
              {inlineParse(headingMatch[2])}
            </Text>
          );
        }
        // List
        if (lines.every(l => /^[-*]\s+/.test(l) || /^\d+\.\s+/.test(l) || l.trim() === '')) {
          const items = lines.filter(l => l.trim()).map(l => l.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
          return (
            <List key={bi} size="sm" spacing={2}>
              {items.map((item, ii) => <List.Item key={ii}>{inlineParse(item)}</List.Item>)}
            </List>
          );
        }
        // Paragraph (join soft-wrapped lines)
        return (
          <Text key={bi} size="sm">
            {inlineParse(lines.join(' '))}
          </Text>
        );
      })}
    </Stack>
  );
}

function getDeadlineDescription(deadlines: DeadlineEntry[] | string[] | null): string | null {
  if (!deadlines || !Array.isArray(deadlines) || deadlines.length === 0) return null;
  const typed = (deadlines as DeadlineEntry[]).filter(
    d => typeof d === 'object' && d?.type && CLOSING_TYPES.has(d.type.toLowerCase())
  );
  const entry = typed.length > 0 ? typed[0] : deadlines[0];
  if (typeof entry === 'object' && (entry as DeadlineEntry)?.description) return (entry as DeadlineEntry).description!;
  return null;
}

// Weights MUST mirror backend ALIGNMENT_WEIGHTS in odyssean-criteria.ts
// (sum = 1.0). If you change one, change the other.
const DIM_WEIGHTS: Record<string, number> = {
  'Research Strand Match': 0.35,
  'Methodological Fit': 0.20,
  'Thematic Alignment': 0.20,
  'Impact Potential': 0.15,
  'Practical Feasibility': 0.10,
};

/** Extract dimension scores from tags like dim:research=30% */
function extractDimensions(tags: string[]): Record<string, number> {
  const dims: Record<string, number> = {};
  const dimLabels: Record<string, string> = {
    'dim:research': 'Research Strand Match',
    'dim:method': 'Methodological Fit',
    'dim:theme': 'Thematic Alignment',
    'dim:impact': 'Impact Potential',
    'dim:feasibility': 'Practical Feasibility',
  };
  for (const tag of tags) {
    for (const [prefix, label] of Object.entries(dimLabels)) {
      if (tag.startsWith(prefix + '=')) {
        const match = tag.match(/(\d+)%/);
        if (match) dims[label] = parseInt(match[1], 10);
      }
    }
  }
  return dims;
}

/**
 * Compute the weighted overall alignment (0-100) from dimensional scores.
 * Returns null if no dimensions present. Uses only the weights of dims
 * actually present (re-normalised) so partial data still produces a
 * meaningful score instead of silently undercounting.
 */
function computeOverallAlignment(dims: Record<string, number>): number | null {
  const entries = Object.entries(dims);
  if (entries.length === 0) return null;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [label, value] of entries) {
    const w = DIM_WEIGHTS[label];
    if (typeof w !== 'number') continue;
    weightedSum += value * w;
    weightTotal += w;
  }
  if (weightTotal === 0) return null;
  return Math.round(weightedSum / weightTotal);
}

function extractRecommendation(tags: string[]): string | null {
  const recTag = tags.find(t => t.startsWith('recommendation:'));
  return recTag ? recTag.replace('recommendation:', '') : null;
}

function getAlignmentColor(score: number): string {
  if (score >= 70) return 'green';
  if (score >= 50) return 'blue';
  if (score >= 30) return 'yellow';
  return 'gray';
}

function getRecommendationColor(rec: string): string {
  if (rec === 'highly_relevant') return 'green';
  if (rec === 'relevant') return 'blue';
  if (rec === 'somewhat_relevant') return 'yellow';
  return 'gray';
}

function formatRecommendation(rec: string): string {
  return rec.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default function OpportunityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Inline URL + deadline editing state
  const [editingUrls, setEditingUrls] = useState(false);
  const [editSourceUrl, setEditSourceUrl] = useState('');
  const [editOpportunityUrl, setEditOpportunityUrl] = useState('');
  const [editDeadlineDate, setEditDeadlineDate] = useState('');

  // Expandable scoring details state
  const [showScoringDetails, setShowScoringDetails] = useState(false);

  // Eligibility check state
  const [eligibilityResult, setEligibilityResult] = useState<{
    isEligible: boolean;
    reasons: string[];
    details: { geographyMatch: boolean; applicantTypeMatch: boolean; awardSizeMatch: boolean };
  } | null>(null);

  // Extra links for eligibility context
  const [extraLinks, setExtraLinks] = useState<Array<{ url: string; label: string }>>([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');

  const updateUrlsMutation = useMutation({
    mutationFn: async (data: { sourceUrl?: string; opportunityUrl?: string; deadlines?: any[] }) => {
      const payload: Record<string, any> = {};
      if (data.sourceUrl) payload.sourceUrl = data.sourceUrl;
      if (data.opportunityUrl !== undefined) payload.opportunityUrl = data.opportunityUrl;
      if (data.deadlines !== undefined) payload.deadlines = data.deadlines;
      return api.patch(`/opportunities/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
      setEditingUrls(false);
      notifications.show({ title: 'Updated', message: 'Saved successfully.', color: 'green', autoClose: 3000 });
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to update.', color: 'red' });
    },
  });

  const checkEligibilityMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get(`/opportunities/${id}/eligibility`);
      return res.data;
    },
    onSuccess: (data) => {
      setEligibilityResult(data);
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to check eligibility.', color: 'red' });
    },
  });

  const rescoreMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/opportunities/${id}/calculate-score`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
      notifications.show({ title: 'Rescored', message: 'Alignment scores updated.', color: 'teal', autoClose: 3000 });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to rescore.', color: 'red' });
    },
  });

  const { data: opportunity, isLoading, error } = useQuery<Opportunity>({
    queryKey: ['opportunity', id],
    queryFn: async () => {
      const response = await api.get(`/opportunities/${id}`);
      return response.data;
    },
  });

  const [appModalOpen, setAppModalOpen] = useState(false);
  const [manualContent, setManualContent] = useState('');
  const [useDefaults, setUseDefaults] = useState(false);

  const generateAppMutation = useMutation({
    mutationFn: () =>
      applicationsApi.generateFromOpportunity(id!, {
        manualContent: manualContent || undefined,
        useDefaults,
      }),
    onSuccess: (res) => {
      setAppModalOpen(false);
      setManualContent('');
      notifications.show({
        title: 'Application Created',
        message: `"${res.data.title}" has been created with ${res.data.sections?.length || 0} sections`,
        color: 'green',
      });
      navigate(`/applications/${res.data.id}`);
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 && data?.existingApplicationId) {
        notifications.show({
          title: 'Application Already Exists',
          message: 'Navigating to the existing application...',
          color: 'blue',
        });
        setAppModalOpen(false);
        navigate(`/applications/${data.existingApplicationId}`);
        return;
      }
      notifications.show({
        title: 'Error',
        message: data?.message || 'Failed to generate application',
        color: 'red',
      });
    },
  });

  if (isLoading) {
    return (
      <Container size="lg">
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  if (error || !opportunity) {
    return (
      <Container size="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" mt="xl">
          <Text size="sm">Opportunity not found or error loading data.</Text>
        </Alert>
        <Button mt="md" onClick={() => navigate('/opportunities')}>Back to Opportunities</Button>
      </Container>
    );
  }

  const rawScore = opportunity.aiFitScore;
  const scoreNumber =
    typeof rawScore === 'number'
      ? rawScore
      : rawScore != null
      ? Number(rawScore)
      : null;
  const hasValidScore = typeof scoreNumber === 'number' && !Number.isNaN(scoreNumber);

  const isHarvest = opportunity.tags?.some(tag => tag === 'HARVEST');

  const recommendation = extractRecommendation(opportunity.tags || []);
  const dimensions = extractDimensions(opportunity.tags || []);
  const hasDimensions = Object.keys(dimensions).length > 0;
  // Prefer the weighted overall computed from dimensions (this is the same
  // model the Dimensional Breakdown uses). Fall back to aiFitScore*10 only
  // when dimensional tags are absent.
  const overallAlignment: number | null = hasDimensions
    ? computeOverallAlignment(dimensions)
    : hasValidScore
    ? Math.round(scoreNumber * 10)
    : null;
  const hasOverall = typeof overallAlignment === 'number' && !Number.isNaN(overallAlignment);

  const awardRange = opportunity.minAward && opportunity.maxAward
    ? `${opportunity.currency || ''}${opportunity.minAward.toLocaleString()}–${opportunity.maxAward.toLocaleString()}`
    : opportunity.maxAward
    ? `Up to ${opportunity.currency || ''}${opportunity.maxAward.toLocaleString()}`
    : opportunity.minAward
    ? `${opportunity.currency || ''}${opportunity.minAward.toLocaleString()}+`
    : null;

  const deadlineDate = getDeadlineDate(opportunity.deadlines);
  const deadlineDesc = getDeadlineDescription(opportunity.deadlines);
  const isDeadlineSoon = deadlineDate && deadlineDate.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  const isPastDeadline = deadlineDate && deadlineDate.getTime() < Date.now();

  // Parse rawDescription (eligibility markdown) into sections
  const hasEligibility = !!opportunity.rawDescription && opportunity.rawDescription !== opportunity.description;
  const hasProcessSteps = opportunity.processSteps && opportunity.processSteps.length > 0;
  const hasApplicantTypes = opportunity.eligibleApplicantTypes && opportunity.eligibleApplicantTypes.length > 0;

  const linkedApp = opportunity.applications && opportunity.applications.length > 0
    ? opportunity.applications[0]
    : null;
  const completedSections = linkedApp?.sections?.filter(s => s.status === 'COMPLETE').length ?? 0;
  const totalSections = linkedApp?._count?.sections ?? linkedApp?.sections?.length ?? 0;
  const sectionProgress = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Button data-testid="back-to-opportunities" variant="subtle" onClick={() => navigate('/opportunities')}>
            ← Back to Opportunities
          </Button>
          <Group gap="xs">
            {isHarvest && <Badge color="violet">Harvest</Badge>}
            {recommendation && (
              <Badge color={getRecommendationColor(recommendation)} variant="filled">
                {formatRecommendation(recommendation)}
              </Badge>
            )}
            <Badge variant="light">{opportunity.status}</Badge>
          </Group>
        </Group>

        {/* Header */}
        <Paper p="xl" withBorder>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Title order={2} mb="xs" data-testid="opportunity-title">{opportunity.programName}</Title>
                {opportunity.funder && (
                  <Group gap={6}>
                    <ThemeIcon size="sm" variant="light" color="blue">
                      <IconBuildingBank size={14} />
                    </ThemeIcon>
                    <Anchor
                      size="sm"
                      onClick={() => navigate(`/funders/${opportunity.funder!.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      {opportunity.funder.name}
                    </Anchor>
                  </Group>
                )}
              </div>

              {hasOverall && (
                <Paper p="md" withBorder style={{ textAlign: 'center', minWidth: 120 }}>
                  <Text size="xs" c="dimmed" mb={4}>OI Alignment</Text>
                  <Badge
                    size="xl"
                    color={getAlignmentColor(overallAlignment!)}
                  >
                    {overallAlignment}%
                  </Badge>
                </Paper>
              )}
            </Group>

            {opportunity.description && (
              <Text size="md" c="dimmed">
                {opportunity.description}
              </Text>
            )}

            <Divider />

            {/* Quick Info */}
            <Group gap="xl" wrap="wrap">
              {deadlineDate && (
                <Group gap={8}>
                  <ThemeIcon
                    size="md"
                    variant="light"
                    color={isPastDeadline ? 'red' : isDeadlineSoon ? 'orange' : 'blue'}
                  >
                    <IconCalendar size={18} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">Application Deadline</Text>
                    <Text size="sm" fw={500} c={isPastDeadline ? 'red' : isDeadlineSoon ? 'orange' : undefined}>
                      {deadlineDesc || deadlineDate.toLocaleDateString()}
                      {isPastDeadline && ' (Closed)'}
                      {!isPastDeadline && isDeadlineSoon && ' (Soon)'}
                    </Text>
                  </div>
                </Group>
              )}

              {awardRange && (
                <Group gap={8}>
                  <ThemeIcon size="md" variant="light" color="teal">
                    <IconCoins size={18} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">Award Amount</Text>
                    <Text size="sm" fw={500}>{awardRange}</Text>
                  </div>
                </Group>
              )}

              {opportunity.durationMonths && (
                <Group gap={8}>
                  <ThemeIcon size="md" variant="light" color="grape">
                    <IconClock size={18} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">Duration</Text>
                    <Text size="sm" fw={500}>
                      {opportunity.durationMonths} months
                    </Text>
                  </div>
                </Group>
              )}

              {opportunity.geographies && opportunity.geographies.length > 0 && (
                <Group gap={8}>
                  <ThemeIcon size="md" variant="light" color="cyan">
                    <IconMapPin size={18} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">Geography</Text>
                    <Text size="sm" fw={500}>
                      {opportunity.geographies.join(', ')}
                    </Text>
                  </div>
                </Group>
              )}

              {hasApplicantTypes && (
                <Group gap={8}>
                  <ThemeIcon size="md" variant="light" color="indigo">
                    <IconUsers size={18} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">Eligible Applicants</Text>
                    <Text size="sm" fw={500}>
                      {opportunity.eligibleApplicantTypes.join(', ')}
                    </Text>
                  </div>
                </Group>
              )}
            </Group>

            {/* URL + deadline editing section */}
            {editingUrls ? (
              <Paper p="sm" withBorder mt="md" bg="gray.0">
                <Stack gap="sm">
                  <TextInput
                    label="Source URL"
                    placeholder="https://..."
                    value={editSourceUrl}
                    onChange={(e) => setEditSourceUrl(e.currentTarget.value)}
                    size="sm"
                  />
                  <TextInput
                    label="Opportunity URL (direct link to application page)"
                    placeholder="https://..."
                    value={editOpportunityUrl}
                    onChange={(e) => setEditOpportunityUrl(e.currentTarget.value)}
                    size="sm"
                  />
                  <TextInput
                    label="Application Deadline (override)"
                    description="YYYY-MM-DD — corrects the closing deadline date stored for this opportunity"
                    placeholder="e.g. 2026-06-10"
                    value={editDeadlineDate}
                    onChange={(e) => setEditDeadlineDate(e.currentTarget.value)}
                    size="sm"
                    leftSection={<IconCalendar size={14} />}
                  />
                  <Group gap="xs" justify="flex-end">
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={<IconX size={14} />}
                      onClick={() => setEditingUrls(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      leftSection={<IconDeviceFloppy size={14} />}
                      loading={updateUrlsMutation.isPending}
                      onClick={() => {
                        // Build updated deadlines: replace any existing closing deadline,
                        // keep opening/decision entries intact.
                        const existing = (opportunity!.deadlines as DeadlineEntry[]) || [];
                        let newDeadlines: DeadlineEntry[] = existing.filter(
                          d => typeof d === 'object' && d?.type && !CLOSING_TYPES.has((d.type || '').toLowerCase())
                        );
                        if (editDeadlineDate) {
                          newDeadlines = [...newDeadlines, { date: editDeadlineDate, type: 'deadline' }];
                        }
                        updateUrlsMutation.mutate({
                          sourceUrl: editSourceUrl,
                          opportunityUrl: editOpportunityUrl || undefined,
                          deadlines: editDeadlineDate ? newDeadlines : undefined,
                        });
                      }}
                    >
                      Save
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            ) : null}

            <Group gap="xs" mt="md">
              {linkedApp ? (
                <Button
                  data-testid="view-application-btn"
                  color="blue"
                  leftSection={<IconFileText size={16} />}
                  onClick={() => navigate(`/applications/${linkedApp.id}`)}
                >
                  View Application ({linkedApp.stage})
                </Button>
              ) : (
                <Button
                  data-testid="start-application-btn"
                  color="green"
                  leftSection={<IconFileText size={16} />}
                  onClick={() => setAppModalOpen(true)}
                >
                  Start Application
                </Button>
              )}
              <Button
                component="a"
                href={opportunity.opportunityUrl || opportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<IconExternalLink size={16} />}
                variant="light"
              >
                View Official Page
              </Button>
              {opportunity.opportunityUrl && opportunity.sourceUrl !== opportunity.opportunityUrl && (
                <Button
                  variant="light"
                  component="a"
                  href={opportunity.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  leftSection={<IconExternalLink size={16} />}
                >
                  View Source Page
                </Button>
              )}
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={() => {
                  setEditSourceUrl(opportunity.sourceUrl || '');
                  setEditOpportunityUrl(opportunity.opportunityUrl || '');
                  const existing = (opportunity.deadlines as DeadlineEntry[]) || [];
                  const closing = existing.find(
                    d => typeof d === 'object' && d?.type && CLOSING_TYPES.has((d.type || '').toLowerCase())
                  );
                  setEditDeadlineDate(closing?.date || '');
                  setEditingUrls(true);
                }}
                title="Edit URLs &amp; deadline"
              >
                <IconEdit size={18} />
              </ActionIcon>
            </Group>
          </Stack>
        </Paper>

        {/* Tabs */}
        <Tabs defaultValue={linkedApp ? 'application' : 'alignment'}>
          <Tabs.List>
            {linkedApp && (
              <Tabs.Tab value="application" leftSection={<IconFileText size={16} />}>
                Application
              </Tabs.Tab>
            )}
            <Tabs.Tab value="alignment" leftSection={<IconTarget size={16} />}>
              OI Alignment
            </Tabs.Tab>
            <Tabs.Tab value="eligibility" leftSection={<IconShieldCheck size={16} />}>
              Eligibility
            </Tabs.Tab>
            <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
              Details
            </Tabs.Tab>
          </Tabs.List>

          {/* Application Tab */}
          {linkedApp && (
            <Tabs.Panel value="application" pt="md">
              <Stack gap="md">
                <Paper p="lg" withBorder>
                  <Group justify="space-between" align="flex-start">
                    <Stack gap="xs">
                      <Text fw={600} size="lg">{linkedApp.title}</Text>
                      <Group gap="xs">
                        <Badge color={{
                          TRIAGE: 'gray', PREP: 'blue', DRAFTING: 'indigo',
                          REVIEW: 'orange', SUBMIT: 'teal', AWARDED: 'green', REJECTED: 'red',
                        }[linkedApp.stage] || 'gray'}>
                          {linkedApp.stage}
                        </Badge>
                        {linkedApp.outcome !== 'UNKNOWN' && (
                          <Badge variant="outline">{linkedApp.outcome}</Badge>
                        )}
                      </Group>
                      {linkedApp.leadOwner && (
                        <Text size="sm" c="dimmed">Lead: {linkedApp.leadOwner.name}</Text>
                      )}
                      <Text size="xs" c="dimmed">
                        Created {new Date(linkedApp.createdAt).toLocaleDateString()}
                        {linkedApp.updatedAt !== linkedApp.createdAt && (
                          <> · Updated {new Date(linkedApp.updatedAt).toLocaleDateString()}</>
                        )}
                      </Text>
                    </Stack>
                    <Button
                      variant="light"
                      onClick={() => navigate(`/applications/${linkedApp.id}`)}
                      leftSection={<IconFileText size={16} />}
                    >
                      Open Application
                    </Button>
                  </Group>

                  {totalSections > 0 && (
                    <Stack gap="xs" mt="md">
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>Section Progress</Text>
                        <Text size="sm" c="dimmed">{completedSections}/{totalSections} complete</Text>
                      </Group>
                      <Progress value={sectionProgress} size="lg" color={sectionProgress === 100 ? 'green' : 'blue'} />
                    </Stack>
                  )}
                </Paper>
              </Stack>
            </Tabs.Panel>
          )}

          {/* Alignment Tab - always visible */}
          <Tabs.Panel value="alignment" pt="md">
            <Stack gap="md">
              {!hasDimensions && !hasValidScore && (
                <Alert icon={<IconSparkles size={16} />} color="blue" variant="light">
                  <Group justify="space-between" align="center">
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>No alignment scores yet.</Text>
                      <Text size="xs" c="dimmed">Run basic scoring now, or re-run Smart Discovery for full dimensional analysis.</Text>
                    </Stack>
                    <Button
                      size="xs"
                      leftSection={<IconRefresh size={14} />}
                      loading={rescoreMutation.isPending}
                      onClick={() => rescoreMutation.mutate()}
                    >
                      Score Now
                    </Button>
                  </Group>
                </Alert>
              )}
              {!hasDimensions && hasValidScore && (
                <Paper p="md" withBorder>
                  <Group justify="space-between" align="center">
                    <Stack gap={2}>
                      <Text size="sm" fw={500}>Basic Fit Score</Text>
                      <Text size="xs" c="dimmed">Run Smart Discovery to get a full dimensional breakdown.</Text>
                    </Stack>
                    <Group gap="sm">
                      <Badge size="xl" color={getAlignmentColor(Math.round(scoreNumber! * 10))}>
                        {Math.round(scoreNumber! * 10)}%
                      </Badge>
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<IconRefresh size={14} />}
                        loading={rescoreMutation.isPending}
                        onClick={() => rescoreMutation.mutate()}
                      >
                        Rescore
                      </Button>
                    </Group>
                  </Group>
                  {opportunity.aiFitReasons && opportunity.aiFitReasons.length > 0 && (
                    <Stack gap="xs" mt="md">
                      {opportunity.aiFitReasons.map((r, i) => (
                        <Text key={i} size="sm" c="dimmed">• {r}</Text>
                      ))}
                    </Stack>
                  )}
                </Paper>
              )}
              {hasDimensions && (
              <Paper p="md" withBorder>
                <Group justify="space-between" align="flex-start" mb="md">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>Odyssean Institute Alignment</Text>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={() => setShowScoringDetails(!showScoringDetails)}
                      >
                        <IconInfoCircle size={16} />
                      </ActionIcon>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Automated analysis of how well this opportunity aligns with OI research strands and methodology.
                    </Text>
                  </Stack>
                    <Group gap="md" align="flex-start">
                    {hasOverall && (
                      <RingProgress
                        sections={[{ value: overallAlignment!, color: getAlignmentColor(overallAlignment!) }]}
                        label={
                          <div style={{ textAlign: 'center' }}>
                            <Text fw={700} size="lg">{overallAlignment}%</Text>
                            <Text size="xs" c="dimmed">Match</Text>
                          </div>
                        }
                        size={100}
                        thickness={8}
                      />
                    )}
                    {recommendation && (
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">Recommendation</Text>
                        <Badge
                          color={getRecommendationColor(recommendation)}
                          size="lg"
                          variant="filled"
                        >
                          {formatRecommendation(recommendation)}
                        </Badge>
                      </Stack>
                    )}
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={<IconRefresh size={14} />}
                      loading={rescoreMutation.isPending}
                      onClick={() => rescoreMutation.mutate()}
                      title="Re-run alignment scoring"
                    >
                      Rescore
                    </Button>
                  </Group>
                </Group>

                  <Collapse in={showScoringDetails}>
                    <Divider my="sm" />
                    <Stack gap="sm">
                      <Text size="xs" fw={600}>How the Alignment Score is Calculated</Text>
                      <Text size="xs" c="dimmed">
                        The AI analyzes the opportunity against Odyssean Institute's research priorities and methodology:
                      </Text>
                      <List size="xs" spacing="xs">
                        <List.Item>
                          <Text span fw={500}>Research Strand Match (35%):</Text> Alignment with OI's three main strands - 
                          Odyssean Process, GRAIN, and Aeonic Flourishing
                        </List.Item>
                        <List.Item>
                          <Text span fw={500}>Methodological Fit (20%):</Text> Preference for interdisciplinary, long-term, 
                          exploratory research with practical applications
                        </List.Item>
                        <List.Item>
                          <Text span fw={500}>Thematic Alignment (20%):</Text> Match with cross-cutting themes like 
                          collective intelligence, governance innovation, and human development
                        </List.Item>
                        <List.Item>
                          <Text span fw={500}>Impact Potential (15%):</Text> Potential for transformative outcomes and 
                          contribution to OI's mission
                        </List.Item>
                        <List.Item>
                          <Text span fw={500}>Practical Feasibility (10%):</Text> Geographic fit, funding amount, 
                          timeline compatibility, and administrative requirements
                        </List.Item>
                      </List>
                      <Text size="xs" c="dimmed" mt="xs">
                        Scores above 70% indicate strong alignment and are typically marked as "Highly Relevant". 
                        Scores between 50-70% suggest good fit with some limitations. Below 50% may have significant 
                        misalignments but could still be worth considering for specific aspects.
                      </Text>
                    </Stack>
                  </Collapse>
                </Paper>
              )}

                {hasDimensions && (
                <>
                {/* Dimensional Breakdown - from real tag data */}
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="md">Dimensional Breakdown</Text>
                  <Stack gap="md">
                    {Object.entries(dimensions).map(([label, value]) => (
                      <div key={label}>
                        <Group justify="space-between" mb={4}>
                          <Text size="sm">{label}</Text>
                          <Text size="sm" fw={600}>{value}%</Text>
                        </Group>
                        <Progress value={value} color={getAlignmentColor(value)} size="md" />
                      </div>
                    ))}
                  </Stack>
                </Paper>

                {/* Strengths and Concerns from aiFitReasons */}
                {opportunity.aiFitReasons && opportunity.aiFitReasons.length > 0 && (
                  <Paper p="md" withBorder>
                    <Text size="sm" fw={500} mb="md">Analysis</Text>
                    <Stack gap="sm">
                      {opportunity.aiFitReasons
                        .filter(r => r.startsWith('✓'))
                        .length > 0 && (
                        <>
                          <Text size="xs" fw={500} c="teal">Strengths</Text>
                          <List spacing="xs" size="sm" icon={
                            <ThemeIcon color="teal" size={18} radius="xl" variant="light">
                              <IconCheck size={11} />
                            </ThemeIcon>
                          }>
                            {opportunity.aiFitReasons
                              .filter(r => r.startsWith('✓'))
                              .map((r, i) => (
                                <List.Item key={i}>
                                  <Text size="sm">{r.replace(/^✓\s*/, '')}</Text>
                                </List.Item>
                              ))}
                          </List>
                        </>
                      )}
                      {opportunity.aiFitReasons
                        .filter(r => r.startsWith('⚠'))
                        .length > 0 && (
                        <>
                          <Text size="xs" fw={500} c="orange" mt="sm">Concerns</Text>
                          <List spacing="xs" size="sm" icon={
                            <ThemeIcon color="orange" size={18} radius="xl" variant="light">
                              <IconAlertCircle size={11} />
                            </ThemeIcon>
                          }>
                            {opportunity.aiFitReasons
                              .filter(r => r.startsWith('⚠'))
                              .map((r, i) => (
                                <List.Item key={i}>
                                  <Text size="sm">{r.replace(/^⚠\s*/, '')}</Text>
                                </List.Item>
                              ))}
                          </List>
                        </>
                      )}
                    </Stack>
                  </Paper>
                )}
                </>
                )}
              </Stack>
            </Tabs.Panel>

          {/* Eligibility Tab */}
          <Tabs.Panel value="eligibility" pt="md">
            <Stack gap="md">

              {/* OI Eligibility Check result */}
              {eligibilityResult && (
                <Alert
                  icon={eligibilityResult.isEligible ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
                  color={eligibilityResult.isEligible ? 'teal' : 'red'}
                  variant="light"
                  withCloseButton
                  onClose={() => setEligibilityResult(null)}
                >
                  <Text size="sm" fw={600} mb={4}>
                    {eligibilityResult.isEligible ? 'OI appears eligible for this opportunity' : 'OI may not be eligible'}
                  </Text>
                  <Stack gap={4}>
                    {eligibilityResult.reasons.map((r, i) => (
                      <Text key={i} size="xs">{r}</Text>
                    ))}
                  </Stack>
                  <Group gap="xl" mt="sm">
                    {[
                      { label: 'Geography', ok: eligibilityResult.details.geographyMatch },
                      { label: 'Applicant type', ok: eligibilityResult.details.applicantTypeMatch },
                      { label: 'Award size', ok: eligibilityResult.details.awardSizeMatch },
                    ].map(({ label, ok }) => (
                      <Group key={label} gap={4}>
                        <ThemeIcon size={16} color={ok ? 'teal' : 'red'} variant="light">
                          {ok ? <IconCheck size={10} /> : <IconX size={10} />}
                        </ThemeIcon>
                        <Text size="xs" c={ok ? 'teal' : 'red'}>{label}</Text>
                      </Group>
                    ))}
                  </Group>
                </Alert>
              )}

              {/* OI Alignment summary - quick glance without switching tab */}
              {hasOverall && (
                <Paper p="md" withBorder>
                  <Group justify="space-between" align="center">
                    <Stack gap={2}>
                      <Text size="sm" fw={500}>OI Alignment Score</Text>
                      <Text size="xs" c="dimmed">How well this grant fits OI's research priorities</Text>
                    </Stack>
                    <Group gap="sm">
                      {recommendation && (
                        <Badge color={getRecommendationColor(recommendation)} variant="filled">
                          {formatRecommendation(recommendation)}
                        </Badge>
                      )}
                      <Badge size="xl" color={getAlignmentColor(overallAlignment!)}>
                        {overallAlignment}%
                      </Badge>
                    </Group>
                  </Group>
                </Paper>
              )}

              {/* Known eligibility from extracted data */}
              {(hasApplicantTypes || (opportunity.geographies && opportunity.geographies.length > 0)) && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="md">Extracted Eligibility Criteria</Text>
                  <Stack gap="sm">
                    {hasApplicantTypes && (
                      <div>
                        <Text size="xs" c="dimmed" mb={6}>Eligible Applicant Types</Text>
                        <Group gap="sm">
                          {opportunity.eligibleApplicantTypes.map((type, i) => (
                            <Badge key={i} size="lg" variant="light" color="indigo">{type}</Badge>
                          ))}
                        </Group>
                      </div>
                    )}
                    {opportunity.geographies && opportunity.geographies.length > 0 && (
                      <div>
                        <Text size="xs" c="dimmed" mb={6}>Geographic Restrictions</Text>
                        <Group gap="sm">
                          {opportunity.geographies.map((geo, i) => (
                            <Badge key={i} size="lg" variant="light" color="cyan">{geo}</Badge>
                          ))}
                        </Group>
                      </div>
                    )}
                  </Stack>
                </Paper>
              )}

              {hasProcessSteps && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="md">Additional Eligibility Details</Text>
                  <List spacing="sm" size="sm" center
                    icon={<ThemeIcon color="teal" size={20} radius="xl"><IconCheck size={12} /></ThemeIcon>}
                  >
                    {opportunity.processSteps.map((step, i) => (
                      <List.Item key={i}><Text size="sm">{step}</Text></List.Item>
                    ))}
                  </List>
                </Paper>
              )}

              {hasEligibility && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="md">Full Eligibility Information</Text>
                  {opportunity.rawDescription ? renderMarkdown(opportunity.rawDescription) : null}
                </Paper>
              )}

              {/* Check Eligibility panel — always shown */}
              <Paper p="md" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Stack gap={2}>
                      <Text size="sm" fw={500}>Check OI Eligibility</Text>
                      <Text size="xs" c="dimmed">
                        Runs a rule-based check against OI's geography, applicant type, and award-size criteria.
                      </Text>
                    </Stack>
                    <Button
                      size="sm"
                      leftSection={<IconShieldCheck size={16} />}
                      loading={checkEligibilityMutation.isPending}
                      onClick={() => checkEligibilityMutation.mutate()}
                    >
                      Check Eligibility
                    </Button>
                  </Group>

                  {/* Extra reference links */}
                  {extraLinks.length > 0 && (
                    <Stack gap="xs">
                      <Text size="xs" fw={500} c="dimmed">Reference Links</Text>
                      {extraLinks.map((link, i) => (
                        <Group key={i} gap="xs">
                          <ThemeIcon size={16} variant="light" color="blue"><IconLink size={10} /></ThemeIcon>
                          <Anchor href={link.url} target="_blank" size="xs" style={{ flex: 1 }}>
                            {link.label || link.url}
                          </Anchor>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => setExtraLinks(extraLinks.filter((_, idx) => idx !== i))}
                          >
                            <IconTrash size={10} />
                          </ActionIcon>
                        </Group>
                      ))}
                    </Stack>
                  )}

                  <Divider label="Add reference link" labelPosition="left" />
                  <Group gap="xs" align="flex-end">
                    <TextInput
                      placeholder="https://..."
                      label="URL"
                      size="xs"
                      style={{ flex: 2 }}
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.currentTarget.value)}
                      leftSection={<IconLink size={12} />}
                    />
                    <TextInput
                      placeholder="Label (optional)"
                      label="Label"
                      size="xs"
                      style={{ flex: 1 }}
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.currentTarget.value)}
                    />
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconPlus size={12} />}
                      disabled={!newLinkUrl}
                      onClick={() => {
                        if (newLinkUrl) {
                          setExtraLinks([...extraLinks, { url: newLinkUrl, label: newLinkLabel }]);
                          setNewLinkUrl('');
                          setNewLinkLabel('');
                        }
                      }}
                    >
                      Add
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* Details Tab */}
          <Tabs.Panel value="details" pt="md">
            <Stack gap="md">
              <Paper p="md" withBorder>
                <Text size="sm" fw={500} mb="xs">Grant Information</Text>
                <Timeline active={-1} bulletSize={24} lineWidth={2}>
                  <Timeline.Item bullet={<IconInfoCircle size={14} />} title="Program">
                    <Text size="sm" c="dimmed" mt={4}>{opportunity.programName}</Text>
                  </Timeline.Item>
                  {awardRange && (
                    <Timeline.Item bullet={<IconCoins size={14} />} title="Funding">
                      <Text size="sm" c="dimmed" mt={4}>{awardRange}</Text>
                    </Timeline.Item>
                  )}
                  {deadlineDate && (
                    <Timeline.Item bullet={<IconCalendar size={14} />} title="Deadline">
                      <Text size="sm" c="dimmed" mt={4}>
                        {deadlineDesc || deadlineDate.toLocaleDateString()}
                      </Text>
                    </Timeline.Item>
                  )}
                  {opportunity.durationMonths && (
                    <Timeline.Item bullet={<IconClock size={14} />} title="Duration">
                      <Text size="sm" c="dimmed" mt={4}>
                        {opportunity.durationMonths} months
                      </Text>
                    </Timeline.Item>
                  )}
                </Timeline>
              </Paper>

              {opportunity.funder?.description && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="xs">About the Funder</Text>
                  <Text size="sm" c="dimmed">{opportunity.funder.description}</Text>
                </Paper>
              )}

              <Paper p="md" withBorder>
                <Text size="sm" fw={500} mb="xs">Metadata</Text>
                <Stack gap="xs">
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">Added:</Text>
                    <Text size="xs">{new Date(opportunity.createdAt).toLocaleString()}</Text>
                  </Group>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">Last updated:</Text>
                    <Text size="xs">{new Date(opportunity.updatedAt).toLocaleString()}</Text>
                  </Group>
                  {opportunity.aiConfidence != null && (
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">Extraction confidence:</Text>
                      <Text size="xs">{Math.round(Number(opportunity.aiConfidence) * 100)}%</Text>
                    </Group>
                  )}
                  {opportunity.tags && opportunity.tags.length > 0 && (
                    <Group gap="xs" wrap="wrap">
                      <Text size="xs" c="dimmed">Tags:</Text>
                      {opportunity.tags
                        .filter(t => !t.startsWith('dim:'))
                        .map((tag) => (
                          <Badge key={tag} size="xs" variant="light">{tag}</Badge>
                        ))}
                    </Group>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Start Application Modal */}
      <Modal
        opened={appModalOpen}
        onClose={() => setAppModalOpen(false)}
        title="Start Application"
        size="lg"
        data-testid="start-application-modal"
      >
        <Stack gap="md">
          <Alert icon={<IconSparkles size={16} />} color="blue" variant="light">
            <Text size="sm">
              Generate a tailored application template from this opportunity. The system will
              analyse the opportunity details and create sections specific to this grant.
            </Text>
          </Alert>

          <Paper p="md" withBorder>
            <Stack gap="xs">
              <Text size="sm" fw={500}>{opportunity.programName}</Text>
              {opportunity.funder && (
                <Text size="xs" c="dimmed">Funder: {opportunity.funder.name}</Text>
              )}
              {awardRange && (
                <Text size="xs" c="dimmed">Award: {awardRange}</Text>
              )}
            </Stack>
          </Paper>

          <Textarea
            data-testid="app-modal-context"
            label="Additional Context (optional)"
            description="Paste any extra application guidelines, funder requirements, or notes to improve the template"
            placeholder="e.g. paste the application form questions, funder priorities, or word limits..."
            value={manualContent}
            onChange={(e) => setManualContent(e.currentTarget.value)}
            minRows={5}
            maxRows={12}
            autosize
          />

          <Group justify="space-between">
            <Button
              data-testid="app-modal-defaults-toggle"
              variant="subtle"
              size="sm"
              color="gray"
              onClick={() => {
                setUseDefaults(!useDefaults);
              }}
            >
              {useDefaults ? '✓ Using standard template' : 'Use standard template instead'}
            </Button>
            <Group gap="xs">
              <Button data-testid="app-modal-cancel" variant="subtle" onClick={() => setAppModalOpen(false)}>
                Cancel
              </Button>
              <Button
                data-testid="app-modal-generate"
                color="green"
                leftSection={<IconFileText size={16} />}
                onClick={() => generateAppMutation.mutate()}
                loading={generateAppMutation.isPending}
              >
                {useDefaults ? 'Create Application' : 'Generate Application'}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
