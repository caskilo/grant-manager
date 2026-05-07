import {
  Container,
  Title,
  Text,
  Paper,
  Stack,
  Group,
  Badge,
  Button,
  Textarea,
  TextInput,
  Select,
  Divider,
  Progress,
  ThemeIcon,
  Loader,
  Center,
  Alert,
  Accordion,
  ActionIcon,
  Tooltip,
  Modal,
  Menu,
  Tabs,
  ScrollArea,
  NumberInput,
  SegmentedControl,
} from '@mantine/core';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconAlertCircle,
  IconFileText,
  IconBuildingBank,
  IconExternalLink,
  IconTrash,
  IconPlus,
  IconSparkles,
  IconClipboard,
  IconArrowRight,
  IconEdit,
  IconChevronDown,
  IconTarget,
  IconInfoCircle,
  IconPencil,
  IconWorld,
  IconDeviceFloppy,
  IconX,
} from '@tabler/icons-react';
import { applicationsApi, Application, ApplicationSection } from '../lib/applications';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

const STAGE_CONFIG: Record<string, { color: string; label: string; order: number }> = {
  TRIAGE: { color: 'gray', label: 'Triage', order: 0 },
  PREP: { color: 'blue', label: 'Preparation', order: 1 },
  DRAFTING: { color: 'indigo', label: 'Drafting', order: 2 },
  REVIEW: { color: 'orange', label: 'Review', order: 3 },
  SUBMIT: { color: 'teal', label: 'Submit', order: 4 },
  AWARDED: { color: 'green', label: 'Awarded', order: 5 },
  REJECTED: { color: 'red', label: 'Rejected', order: 6 },
};

const SECTION_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  NOT_STARTED: { color: 'gray', label: 'Not Started' },
  IN_PROGRESS: { color: 'blue', label: 'In Progress' },
  DRAFT: { color: 'orange', label: 'Draft' },
  FINAL: { color: 'green', label: 'Final' },
};

const STAGE_TRANSITIONS: Record<string, string[]> = {
  TRIAGE: ['PREP', 'REJECTED'],
  PREP: ['DRAFTING', 'TRIAGE', 'REJECTED'],
  DRAFTING: ['REVIEW', 'PREP', 'REJECTED'],
  REVIEW: ['SUBMIT', 'DRAFTING', 'REJECTED'],
  SUBMIT: ['AWARDED', 'REJECTED'],
  AWARDED: [],
  REJECTED: ['TRIAGE'],
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

type LlmProvider = 'gemini' | 'anthropic';

/**
 * Derive the LLM provider from an application's `generatedFrom` field. Recognises
 * the explicit provider tokens (`llm_gemini`, `llm_anthropic`) as well as legacy
 * model strings that embed a model name (e.g. `llm_claude-haiku-4-...`,
 * `llm_gemini-flash`). Returns `null` if no provider can be inferred.
 */
function getProviderFromGeneratedFrom(
  generatedFrom: string | null | undefined,
): LlmProvider | null {
  if (!generatedFrom) return null;
  const lower = generatedFrom.toLowerCase();
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('anthropic') || lower.includes('claude') ||
      lower.includes('haiku') || lower.includes('sonnet') || lower.includes('opus')) {
    return 'anthropic';
  }
  return null;
}

function getModelDisplayName(generatedFrom: string | null | undefined): string | null {
  if (!generatedFrom) return null;
  if (generatedFrom === 'DEFAULT_TEMPLATE') return 'Default';

  // Explicit provider tokens (set when admin chooses provider in the edit header).
  if (generatedFrom === 'llm_gemini') return 'Gemini';
  if (generatedFrom === 'llm_anthropic') return 'Claude';

  // Legacy model strings: try to map to a friendly name.
  const model = generatedFrom.replace(/^llm_/, '').toLowerCase();
  if (model.includes('gemini')) return 'Gemini';
  if (model.includes('haiku')) return 'Claude Haiku';
  if (model.includes('sonnet')) return 'Claude Sonnet';
  if (model.includes('opus')) return 'Claude Opus';
  if (model.includes('claude')) return 'Claude';
  if (model.includes('gpt-4o-mini')) return 'GPT-4o mini';
  if (model.includes('gpt-4o')) return 'GPT-4o';
  if (model.includes('gpt-4')) return 'GPT-4';
  // fallback: take last segment after last '-', capitalised
  const parts = model.split('-');
  return parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
}

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  // Quick Info editing state
  const [editingQuickInfo, setEditingQuickInfo] = useState(false);
  const [editAwardAmount, setEditAwardAmount] = useState<number | string>('');
  const [editCurrency, setEditCurrency] = useState('GBP');
  const [editProvider, setEditProvider] = useState<LlmProvider>('gemini');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionContent, setSectionContent] = useState<Record<string, string>>({});
  // Local draft of section status while editing — committed atomically with content
  // on Save so changing the dropdown doesn't close edit mode and discard text.
  const [sectionStatusDraft, setSectionStatusDraft] = useState<Record<string, string>>({});
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionGuidance, setNewSectionGuidance] = useState('');
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedContent, setPastedContent] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [templateModalSection, setTemplateModalSection] = useState<string | null>(null);
  const [suggestingSection, setSuggestingSection] = useState<string | null>(null);
  const [editingGuidanceSection, setEditingGuidanceSection] = useState<string | null>(null);
  const [guidanceDraft, setGuidanceDraft] = useState<Record<string, string>>({});

  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await api.get('/templates');
      return res.data;
    },
  });

  const availableTemplates: any[] = Array.isArray(templatesData)
    ? templatesData
    : Array.isArray((templatesData as any)?.data)
    ? (templatesData as any).data
    : [];

  // Persist expanded accordion items in sessionStorage
  const storageKey = `app-accordion-${id}`;
  const [openSections, setOpenSections] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const { data: application, isLoading, error } = useQuery<Application>({
    queryKey: ['application', id],
    queryFn: async () => {
      const res = await applicationsApi.get(id!);
      return res.data;
    },
    enabled: !!id,
  });

  // Once application loads, default to first section if nothing stored
  useEffect(() => {
    if (application?.sections && application.sections.length > 0) {
      setOpenSections(prev => {
        if (prev.length > 0) return prev;
        const firstId = [application.sections[0].id];
        sessionStorage.setItem(storageKey, JSON.stringify(firstId));
        return firstId;
      });
    }
  }, [application?.sections?.length]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => applicationsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] });
      notifications.show({ title: 'Updated', message: 'Application updated', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err?.response?.data?.message || 'Failed to update',
        color: 'red',
      });
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: any }) =>
      applicationsApi.updateSection(sectionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] });
      setEditingSection(null);
    },
  });

  const addSectionMutation = useMutation({
    mutationFn: (data: any) => applicationsApi.addSection(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] });
      setAddSectionOpen(false);
      setNewSectionTitle('');
      setNewSectionGuidance('');
      notifications.show({ title: 'Added', message: 'Section added', color: 'green' });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => applicationsApi.deleteSection(sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] });
      notifications.show({ title: 'Deleted', message: 'Section removed', color: 'orange' });
    },
  });

  const suggestSectionMutation = useMutation({
    mutationFn: (sectionId: string) =>
      applicationsApi.suggestSection(sectionId, {
        llmProvider: getProviderFromGeneratedFrom(application?.generatedFrom) || undefined,
      }),
    onSuccess: (res, sectionId) => {
      const suggestion = res.data.suggestion;
      setSectionContent(prev => {
        const existing = prev[sectionId] ?? '';
        const sep = existing.trim() ? '\n\n' : '';
        return { ...prev, [sectionId]: existing + sep + suggestion };
      });
      setSuggestingSection(null);
    },
    onError: (err: any) => {
      setSuggestingSection(null);
      notifications.show({
        title: 'AI Suggestion Failed',
        message: err?.response?.data?.message || 'Could not generate suggestion',
        color: 'red',
      });
    },
  });

  const updateGuidanceMutation = useMutation({
    mutationFn: ({ sectionId, guidance }: { sectionId: string; guidance: string }) =>
      applicationsApi.updateSection(sectionId, { guidance }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] });
      setEditingGuidanceSection(null);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (options: { manualContent?: string; pageContent?: string } | undefined) =>
      applicationsApi.regenerateSections(id!, {
        ...(options || {}),
        llmProvider: getProviderFromGeneratedFrom(application?.generatedFrom) || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] });
      setPasteModalOpen(false);
      setPastedContent('');
      notifications.show({ title: 'Regenerated', message: 'Sections updated with AI suggestions', color: 'blue' });
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err?.response?.data?.message || 'Failed to regenerate',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => applicationsApi.delete(id!),
    onSuccess: () => {
      notifications.show({ title: 'Deleted', message: 'Application has been deleted.', color: 'orange' });
      navigate('/applications');
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err?.response?.data?.message || 'Failed to delete application',
        color: 'red',
      });
    },
  });

  const opportunityUrl = application?.opportunity?.opportunityUrl || application?.opportunity?.sourceUrl || null;
  const opportunityDomain = opportunityUrl ? (() => { try { return new URL(opportunityUrl).hostname; } catch { return null; } })() : null;
  const faviconUrl = opportunityDomain ? `https://www.google.com/s2/favicons?domain=${opportunityDomain}&sz=32` : null;

  const progress = useMemo(() => {
    if (!application?.sections) return { total: 0, completed: 0, percent: 0 };
    const total = application.sections.length;
    const completed = application.sections.filter(s => s.status === 'FINAL').length;
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [application]);

  if (isLoading) {
    return (
      <Container size="lg">
        <Center py="xl"><Loader size="lg" /></Center>
      </Container>
    );
  }

  if (error || !application) {
    return (
      <Container size="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" mt="xl">
          Application not found or error loading data.
        </Alert>
        <Button mt="md" onClick={() => navigate('/applications')}>Back to Applications</Button>
      </Container>
    );
  }

  const stageInfo = STAGE_CONFIG[application.stage] || STAGE_CONFIG.TRIAGE;
  const allowedTransitions = STAGE_TRANSITIONS[application.stage] || [];

  const handleSaveSection = (section: ApplicationSection) => {
    const content = sectionContent[section.id] ?? section.content;
    // Prefer the user's draft status (from the in-editor dropdown); only auto-promote
    // NOT_STARTED → IN_PROGRESS when the user hasn't manually changed status.
    const userChangedStatus = sectionStatusDraft[section.id] !== undefined;
    let status = sectionStatusDraft[section.id] ?? section.status;
    if (!userChangedStatus && content && content.trim() && status === 'NOT_STARTED') {
      status = 'IN_PROGRESS';
    }
    updateSectionMutation.mutate(
      {
        sectionId: section.id,
        data: { content, status },
      },
      {
        onSuccess: () => {
          // Drop the draft once persisted; canonical value comes from the refetch.
          setSectionStatusDraft(prev => {
            const next = { ...prev };
            delete next[section.id];
            return next;
          });
        },
      },
    );
  };

  return (
    <Container size="lg">
      <Stack gap="lg">
        {/* Navigation */}
        <Group justify="space-between">
          <Button data-testid="back-to-applications" variant="subtle" onClick={() => navigate('/applications')}>
            ← Back to Applications
          </Button>
          <Group gap="xs">
            <Badge data-testid="application-stage-badge" size="lg" color={stageInfo.color} variant="filled">
              {stageInfo.label}
            </Badge>
            {application.outcome !== 'UNKNOWN' && (
              <Badge size="lg" color={application.outcome === 'AWARDED' ? 'green' : 'red'}>
                {application.outcome}
              </Badge>
            )}
          </Group>
        </Group>

        {/* Header Card */}
        <Paper p="xl" withBorder>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Title order={2} data-testid="application-title">{application.title}</Title>
                {application.opportunity && (
                  <Group gap={6} mt="xs">
                    <ThemeIcon size="sm" variant="light" color="blue">
                      <IconBuildingBank size={14} />
                    </ThemeIcon>
                    <Text
                      size="sm"
                      c="blue"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/opportunities/${application.opportunity.id}`)}
                    >
                      {application.opportunity.programName}
                      {application.opportunity.funder && ` — ${application.opportunity.funder.name}`}
                    </Text>
                  </Group>
                )}
              </div>

              {application.aiFitScoreSnapshot != null && (
                <Paper p="sm" withBorder style={{ textAlign: 'center', minWidth: 80 }}>
                  <Text size="xs" c="dimmed">Fit Score</Text>
                  <Text fw={700} size="lg">
                    {Math.round(Number(application.aiFitScoreSnapshot) * 10) / 10}/10
                  </Text>
                </Paper>
              )}
            </Group>

            <Divider />

            {/* Progress Bar */}
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500}>Section Progress</Text>
                <Text size="sm" c="dimmed" data-testid="application-progress-text">
                  {progress.completed}/{progress.total} complete ({progress.percent}%)
                </Text>
              </Group>
              <Progress
                data-testid="application-progress-bar"
                value={progress.percent}
                color={progress.percent === 100 ? 'green' : progress.percent > 50 ? 'blue' : 'gray'}
                size="md"
              />
            </div>

            {/* Stage Transitions */}
            {allowedTransitions.length > 0 && (
              <Group gap="xs">
                <Text size="sm" c="dimmed">Move to:</Text>
                {allowedTransitions.map((nextStage) => {
                  const nextInfo = STAGE_CONFIG[nextStage];
                  return (
                    <Button
                      key={nextStage}
                      size="xs"
                      variant="light"
                      color={nextInfo?.color || 'gray'}
                      leftSection={<IconArrowRight size={14} />}
                      onClick={() => updateMutation.mutate({ stage: nextStage })}
                      loading={updateMutation.isPending}
                    >
                      {nextInfo?.label || nextStage}
                    </Button>
                  );
                })}
              </Group>
            )}

            {/* Quick Info */}
            {editingQuickInfo ? (
              <Paper p="sm" withBorder bg="gray.0">
                <Stack gap="sm">
                  <Group gap="md" grow align="flex-end">
                    <NumberInput
                      label="Expected Award"
                      value={editAwardAmount}
                      onChange={setEditAwardAmount}
                      min={0}
                      thousandSeparator=","
                      size="sm"
                    />
                    <Select
                      label="Currency"
                      data={['GBP', 'USD', 'EUR', 'CHF']}
                      value={editCurrency}
                      onChange={(v) => setEditCurrency(v || 'GBP')}
                      size="sm"
                      style={{ maxWidth: 120 }}
                    />
                    <div>
                      <Text size="sm" fw={500} mb={4}>LLM Provider</Text>
                      <SegmentedControl
                        size="sm"
                        value={editProvider}
                        onChange={(v) => setEditProvider(v as LlmProvider)}
                        data={[
                          { value: 'gemini', label: 'Gemini' },
                          { value: 'anthropic', label: 'Claude' },
                        ]}
                      />
                      <Text size="xs" c="dimmed" mt={2}>
                        Used for AI Suggestion and Regenerate. Specific model is set per provider via Heroku env vars.
                      </Text>
                    </div>
                  </Group>
                  <Group justify="flex-end" gap="xs">
                    <Button size="xs" variant="subtle" leftSection={<IconX size={14} />} onClick={() => setEditingQuickInfo(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      leftSection={<IconDeviceFloppy size={14} />}
                      loading={updateMutation.isPending}
                      onClick={() => {
                        const data: Record<string, any> = {};
                        const amt = typeof editAwardAmount === 'number' ? editAwardAmount : parseFloat(String(editAwardAmount));
                        if (!isNaN(amt) && amt > 0) data.expectedAwardAmount = amt;
                        if (editCurrency) data.expectedCurrency = editCurrency;
                        const newGeneratedFrom = editProvider === 'gemini' ? 'llm_gemini' : 'llm_anthropic';
                        if (newGeneratedFrom !== (application.generatedFrom || '')) {
                          data.generatedFrom = newGeneratedFrom;
                        }
                        updateMutation.mutate(data);
                        setEditingQuickInfo(false);
                      }}
                    >
                      Save
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            ) : (
              <Group gap="xl" wrap="wrap" align="flex-end">
                <div>
                  <Text size="xs" c="dimmed">Expected Award</Text>
                  <Text size="sm" fw={500}>
                    {application.expectedAwardAmount
                      ? `${application.expectedCurrency || '£'}${Number(application.expectedAwardAmount).toLocaleString()}`
                      : '—'}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">LLM Provider</Text>
                  {application.generatedFrom ? (
                    <Badge
                      size="sm"
                      variant="light"
                      color={
                        getProviderFromGeneratedFrom(application.generatedFrom) === 'gemini'
                          ? 'blue'
                          : getProviderFromGeneratedFrom(application.generatedFrom) === 'anthropic'
                          ? 'orange'
                          : 'gray'
                      }
                    >
                      {getModelDisplayName(application.generatedFrom)}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">—</Text>
                  )}
                </div>
                <div>
                  <Text size="xs" c="dimmed">Owner</Text>
                  <Text size="sm">{application.leadOwner?.name || '—'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Last Updated</Text>
                  <Text size="sm">{new Date(application.updatedAt).toLocaleDateString()}</Text>
                </div>
                <Tooltip label="Edit details">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => {
                      setEditAwardAmount(application.expectedAwardAmount ? Number(application.expectedAwardAmount) : '');
                      setEditCurrency(application.expectedCurrency || 'GBP');
                      setEditProvider(getProviderFromGeneratedFrom(application.generatedFrom) || 'gemini');
                      setEditingQuickInfo(true);
                    }}
                  >
                    <IconPencil size={14} />
                  </ActionIcon>
                </Tooltip>
                {(currentUser?.id === application.leadOwnerId || currentUser?.role === 'ADMIN') && (
                  <Tooltip label="Delete application">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            )}

            {/* Links */}
            {opportunityUrl && (
              <div style={{ display: 'inline-block' }}>
                <Paper
                  component="a"
                  href={opportunityUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  withBorder
                  p={0}
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    width: 120,
                    textDecoration: 'none',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    borderRadius: 8,
                  }}
                >
                  <div style={{
                    height: 72,
                    background: 'var(--mantine-color-gray-1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    {faviconUrl ? (
                      <img
                        src={faviconUrl}
                        alt=""
                        style={{ width: 32, height: 32, objectFit: 'contain' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <IconWorld size={28} color="var(--mantine-color-gray-5)" />
                    )}
                  </div>
                  <Stack gap={2} p="xs" style={{ flex: 1 }}>
                    <Text size="xs" fw={500} lineClamp={1}>{opportunityDomain}</Text>
                    <Group gap={4}>
                      <IconExternalLink size={10} color="var(--mantine-color-gray-6)" />
                      <Text size="xs" c="dimmed">Visit page</Text>
                    </Group>
                  </Stack>
                </Paper>
              </div>
            )}
          </Stack>
        </Paper>

        {/* Tabs: Sections / Notes */}
        <Tabs defaultValue="sections">
          <Tabs.List>
            <Tabs.Tab data-testid="tab-sections" value="sections" leftSection={<IconFileText size={16} />}>
              Sections ({application.sections?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab data-testid="tab-overview" value="overview" leftSection={<IconInfoCircle size={16} />}>
              Notes & Overview
            </Tabs.Tab>
          </Tabs.List>

          {/* Sections Tab */}
          <Tabs.Panel value="sections" pt="md">
            <Stack gap="md">
              {/* Action Bar */}
              <Group justify="space-between">
                <Group gap="xs">
                  <Button
                    data-testid="add-section-btn"
                    size="sm"
                    variant="light"
                    leftSection={<IconPlus size={16} />}
                    onClick={() => setAddSectionOpen(true)}
                  >
                    Add Section
                  </Button>
                  <Menu shadow="md" width={220}>
                    <Menu.Target>
                      <Button size="sm" variant="light" color="violet" leftSection={<IconSparkles size={16} />} rightSection={<IconChevronDown size={14} />}>
                        AI Assist
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconSparkles size={16} />}
                        onClick={() => regenerateMutation.mutate(undefined)}
                      >
                        Regenerate suggestions
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconClipboard size={16} />}
                        onClick={() => setPasteModalOpen(true)}
                      >
                        Paste content & analyse
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Group>

              {/* Sections List */}
              {application.sections && application.sections.length > 0 ? (
                <Accordion
                  variant="separated"
                  multiple
                  value={openSections}
                  onChange={(vals) => {
                    setOpenSections(vals);
                    sessionStorage.setItem(storageKey, JSON.stringify(vals));
                  }}
                >
                  {application.sections.map((section) => {
                    const statusInfo = SECTION_STATUS_CONFIG[section.status] || SECTION_STATUS_CONFIG.NOT_STARTED;
                    const isEditing = editingSection === section.id;
                    const currentContent = sectionContent[section.id] ?? section.content;
                    const wc = wordCount(currentContent);
                    const overLimit = section.wordLimit && wc > section.wordLimit;

                    return (
                      <Accordion.Item key={section.id} value={section.id} data-testid="section-card">
                        <Accordion.Control>
                          <Group justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
                            <Group gap="sm">
                              <Text fw={500} size="sm" data-testid="section-title">{section.title}</Text>
                              <Badge size="xs" color={statusInfo.color} variant="light">
                                {statusInfo.label}
                              </Badge>
                            </Group>
                            <Group gap="xs">
                              {section.wordLimit && (
                                <Text size="xs" c={overLimit ? 'red' : 'dimmed'}>
                                  {wc}/{section.wordLimit} words
                                </Text>
                              )}
                              {!section.wordLimit && wc > 0 && (
                                <Text size="xs" c="dimmed">{wc} words</Text>
                              )}
                            </Group>
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap="sm">
                            {/* Guidance */}
                            {(section.guidance || editingGuidanceSection === section.id) && (
                              <div>
                                {editingGuidanceSection === section.id ? (
                                  <Stack gap="xs">
                                    <Textarea
                                      size="xs"
                                      value={guidanceDraft[section.id] ?? section.guidance ?? ''}
                                      onChange={(e) => {
                                        const value = e.currentTarget.value;
                                        setGuidanceDraft(prev => ({ ...prev, [section.id]: value }));
                                      }}
                                      minRows={2}
                                      autosize
                                      autoFocus
                                    />
                                    <Group gap="xs" justify="flex-end">
                                      <Button size="xs" variant="subtle" onClick={() => setEditingGuidanceSection(null)}>Cancel</Button>
                                      <Button
                                        size="xs"
                                        loading={updateGuidanceMutation.isPending}
                                        onClick={() => updateGuidanceMutation.mutate({ sectionId: section.id, guidance: guidanceDraft[section.id] ?? section.guidance ?? '' })}
                                      >Save</Button>
                                    </Group>
                                  </Stack>
                                ) : (
                                  <Alert
                                    icon={<IconTarget size={16} />}
                                    color="blue"
                                    variant="light"
                                    title="Guidance"
                                    styles={{ root: { cursor: 'pointer' } }}
                                    onClick={() => {
                                      setGuidanceDraft(prev => ({ ...prev, [section.id]: section.guidance ?? '' }));
                                      setEditingGuidanceSection(section.id);
                                    }}
                                  >
                                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                                      <Text size="sm">{section.guidance}</Text>
                                      <ActionIcon size="xs" variant="subtle" color="blue">
                                        <IconPencil size={11} />
                                      </ActionIcon>
                                    </Group>
                                  </Alert>
                                )}
                              </div>
                            )}

                            {/* Content Editor */}
                            {isEditing ? (
                              <>
                                <Textarea
                                  data-testid="section-editor"
                                  value={currentContent}
                                  onChange={(e) =>
                                    setSectionContent(prev => ({
                                      ...prev,
                                      [section.id]: e.currentTarget.value,
                                    }))
                                  }
                                  minRows={6}
                                  maxRows={20}
                                  autosize
                                  placeholder="Write your content here..."
                                />
                                <Group justify="space-between">
                                  <Group gap="xs">
                                    <Text size="xs" c={overLimit ? 'red' : 'dimmed'}>
                                      {wc} words{section.wordLimit ? ` / ${section.wordLimit} limit` : ''}
                                    </Text>
                                    <Button
                                      size="xs"
                                      variant="subtle"
                                      color="violet"
                                      leftSection={<IconSparkles size={13} />}
                                      loading={suggestingSection === section.id && suggestSectionMutation.isPending}
                                      onClick={() => {
                                        setSuggestingSection(section.id);
                                        suggestSectionMutation.mutate(section.id);
                                      }}
                                    >
                                      AI Suggestion
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="subtle"
                                      color="grape"
                                      leftSection={<IconFileText size={13} />}
                                      onClick={() => setTemplateModalSection(section.id)}
                                    >
                                      Use Template
                                    </Button>
                                  </Group>
                                  <Group gap="xs">
                                    <Select
                                      size="xs"
                                      value={sectionStatusDraft[section.id] ?? section.status}
                                      data={Object.entries(SECTION_STATUS_CONFIG).map(([val, cfg]) => ({
                                        value: val,
                                        label: cfg.label,
                                      }))}
                                      onChange={(val) => {
                                        if (val) {
                                          // Stage status locally; persisted with content on Save.
                                          setSectionStatusDraft(prev => ({
                                            ...prev,
                                            [section.id]: val,
                                          }));
                                        }
                                      }}
                                      style={{ width: 140 }}
                                    />
                                    <Button
                                      size="xs"
                                      variant="subtle"
                                      onClick={() => {
                                        // Drop any in-flight content + status edits for this section.
                                        setSectionContent(prev => {
                                          const next = { ...prev };
                                          delete next[section.id];
                                          return next;
                                        });
                                        setSectionStatusDraft(prev => {
                                          const next = { ...prev };
                                          delete next[section.id];
                                          return next;
                                        });
                                        setEditingSection(null);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      data-testid="section-save-btn"
                                      size="xs"
                                      onClick={() => handleSaveSection(section)}
                                      loading={updateSectionMutation.isPending}
                                    >
                                      Save
                                    </Button>
                                  </Group>
                                </Group>
                              </>
                            ) : (
                              <>
                                {section.content ? (
                                  <Paper p="sm" withBorder bg="gray.0" style={{ minHeight: 60 }}>
                                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                                      {section.content}
                                    </Text>
                                  </Paper>
                                ) : (
                                  <Paper p="sm" withBorder bg="gray.0" style={{ minHeight: 60 }}>
                                    <Text size="sm" c="dimmed" fs="italic">
                                      No content yet. Click Edit to start writing.
                                    </Text>
                                  </Paper>
                                )}
                                <Group justify="space-between">
                                  <Group gap="xs">
                                    <Button
                                      data-testid="section-edit-btn"
                                      size="xs"
                                      variant="light"
                                      leftSection={<IconEdit size={14} />}
                                      onClick={() => {
                                        setSectionContent(prev => ({
                                          ...prev,
                                          [section.id]: section.content,
                                        }));
                                        setEditingSection(section.id);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                  </Group>
                                  <Tooltip label="Delete section">
                                    <ActionIcon
                                      variant="subtle"
                                      color="red"
                                      size="sm"
                                      onClick={() => {
                                        if (confirm('Delete this section?')) {
                                          deleteSectionMutation.mutate(section.id);
                                        }
                                      }}
                                    >
                                      <IconTrash size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </>
                            )}
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              ) : (
                <Paper p="xl" withBorder>
                  <Stack align="center" gap="md">
                    <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                      <IconFileText size={24} />
                    </ThemeIcon>
                    <Text fw={500}>No sections yet</Text>
                    <Text size="sm" c="dimmed" ta="center" maw={300}>
                      Add sections manually or use AI Assist to generate a tailored structure.
                    </Text>
                    <Group gap="sm">
                      <Button
                        variant="light"
                        leftSection={<IconPlus size={16} />}
                        onClick={() => setAddSectionOpen(true)}
                      >
                        Add Section
                      </Button>
                      <Button
                        variant="light"
                        color="violet"
                        leftSection={<IconSparkles size={16} />}
                        onClick={() => regenerateMutation.mutate(undefined)}
                        loading={regenerateMutation.isPending}
                      >
                        Generate with AI
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Notes & Overview Tab */}
          <Tabs.Panel value="overview" pt="md">
            <Stack gap="md">
              <Paper p="md" withBorder>
                <Group justify="space-between" mb="sm">
                  <Text size="sm" fw={500}>Notes</Text>
                  {!editingNotes && (
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => {
                        setNotesValue(application.notes || '');
                        setEditingNotes(true);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </Group>
                {editingNotes ? (
                  <Stack gap="sm">
                    <Textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.currentTarget.value)}
                      minRows={4}
                      autosize
                    />
                    <Group justify="flex-end" gap="xs">
                      <Button size="xs" variant="subtle" onClick={() => setEditingNotes(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="xs"
                        onClick={() => {
                          updateMutation.mutate({ notes: notesValue });
                          setEditingNotes(false);
                        }}
                      >
                        Save
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Text size="sm" c={application.notes ? undefined : 'dimmed'} style={{ whiteSpace: 'pre-wrap' }}>
                    {application.notes || 'No notes yet.'}
                  </Text>
                )}
              </Paper>

              {application.aiFitReasonsSnapshot && application.aiFitReasonsSnapshot.length > 0 && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="sm">Fit Analysis Snapshot</Text>
                  <Stack gap="xs">
                    {application.aiFitReasonsSnapshot.map((reason, i) => (
                      <Group key={i} gap="xs" align="flex-start">
                        <ThemeIcon
                          size={18}
                          radius="xl"
                          variant="light"
                          color={reason.startsWith('✓') ? 'teal' : reason.startsWith('⚠') ? 'orange' : 'gray'}
                        >
                          {reason.startsWith('✓') ? <IconCheck size={10} /> : <IconAlertCircle size={10} />}
                        </ThemeIcon>
                        <Text size="sm">{reason.replace(/^[✓⚠]\s*/, '')}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              )}

              <Paper p="md" withBorder>
                <Text size="sm" fw={500} mb="sm">Metadata</Text>
                <Stack gap="xs">
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">Created:</Text>
                    <Text size="xs">{new Date(application.createdAt).toLocaleString()}</Text>
                  </Group>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">Updated:</Text>
                    <Text size="xs">{new Date(application.updatedAt).toLocaleString()}</Text>
                  </Group>
                  {application.generatedFrom && (
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">Generation method:</Text>
                      <Badge size="xs" variant="light">{application.generatedFrom}</Badge>
                    </Group>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Add Section Modal */}
      <Modal
        opened={addSectionOpen}
        onClose={() => setAddSectionOpen(false)}
        title="Add New Section"
      >
        <Stack gap="md">
          <TextInput
            label="Section Title"
            placeholder="e.g. Executive Summary"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Guidance (optional)"
            placeholder="What should this section contain?"
            value={newSectionGuidance}
            onChange={(e) => setNewSectionGuidance(e.currentTarget.value)}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setAddSectionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                addSectionMutation.mutate({
                  title: newSectionTitle,
                  guidance: newSectionGuidance || undefined,
                })
              }
              disabled={!newSectionTitle.trim()}
              loading={addSectionMutation.isPending}
            >
              Add Section
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Paste Content Modal */}
      <Modal
        opened={pasteModalOpen}
        onClose={() => setPasteModalOpen(false)}
        title="Paste Content for Analysis"
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Paste application guidelines, funder requirements, or any relevant content.
            The AI will analyze it and update section guidance and suggestions accordingly.
          </Text>
          <Textarea
            placeholder="Paste guidelines, application form text, or funder requirements here..."
            value={pastedContent}
            onChange={(e) => setPastedContent(e.currentTarget.value)}
            minRows={10}
            maxRows={20}
            autosize
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setPasteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="violet"
              leftSection={<IconSparkles size={16} />}
              onClick={() =>
                regenerateMutation.mutate({ manualContent: pastedContent })
              }
              disabled={!pastedContent.trim()}
              loading={regenerateMutation.isPending}
            >
              Analyse & Update Sections
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Use Template Modal */}
      <Modal
        opened={templateModalSection !== null}
        onClose={() => setTemplateModalSection(null)}
        title="Use Template"
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Select a template to append its content to this section.
          </Text>
          <ScrollArea h={400}>
            <Stack gap="sm">
              {availableTemplates.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="xl">No templates available.</Text>
              ) : (
                availableTemplates.map((tmpl: any) => (
                  <Paper
                    key={tmpl.id}
                    p="sm"
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (!templateModalSection) return;
                      setSectionContent(prev => {
                        const existing = prev[templateModalSection] ?? '';
                        const separator = existing.trim() ? '\n\n' : '';
                        return {
                          ...prev,
                          [templateModalSection]: existing + separator + tmpl.content,
                        };
                      });
                      setTemplateModalSection(null);
                      notifications.show({
                        title: 'Template Applied',
                        message: `"${tmpl.name}" appended to section`,
                        color: 'grape',
                      });
                    }}
                  >
                    <Stack gap={4}>
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>{tmpl.name}</Text>
                        <Badge size="xs" color="gray" variant="light">
                          {tmpl.type?.replace(/_/g, ' ')}
                        </Badge>
                      </Group>
                      {tmpl.description && (
                        <Text size="xs" c="dimmed">{tmpl.description}</Text>
                      )}
                      <Text size="xs" c="dimmed" lineClamp={2} style={{ whiteSpace: 'pre-wrap' }}>
                        {tmpl.content}
                      </Text>
                    </Stack>
                  </Paper>
                ))
              )}
            </Stack>
          </ScrollArea>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setTemplateModalSection(null)}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Application"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete this application? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                deleteMutation.mutate();
                setDeleteConfirmOpen(false);
              }}
              loading={deleteMutation.isPending}
            >
              Delete Application
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
