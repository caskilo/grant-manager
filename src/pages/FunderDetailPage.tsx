import { Container, Title, Text, Paper, Stack, Group, Badge, Button, Textarea, Anchor, Divider, Grid, Card, Tabs, Progress, ThemeIcon, TextInput, ActionIcon, Alert, Checkbox, Select } from '@mantine/core';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { IconArrowLeft, IconExternalLink, IconDeviceFloppy, IconInfoCircle, IconSparkles, IconChartBar, IconTarget, IconSearch, IconPlus, IconTrash, IconX, IconAlertCircle, IconWorldWww } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import api from '../lib/api';
import { harvestApi } from '../lib/harvest';

const getCatalogueType = (tags: string[]): string | null => {
  const catalogueTypeTag = tags.find(tag => tag.startsWith('CATALOGUE_TYPE:'));
  return catalogueTypeTag ? catalogueTypeTag.replace('CATALOGUE_TYPE:', '') : null;
};

const getPhaseDescription = (phase: string): { emoji: string; description: string } => {
  const phases: Record<string, { emoji: string; description: string }> = {
    'INITIALIZING': { emoji: '🔄', description: 'Initializing...' },
    'SEED_CRAWL': { emoji: '🌱', description: 'Crawling seed URL...' },
    'ANALYZING_LINKS': { emoji: '🔍', description: 'Analyzing links...' },
    'SCORING': { emoji: '📊', description: 'Scoring sources...' },
    'SAVING_RESULTS': { emoji: '💾', description: 'Saving results...' },
    'COMPLETED': { emoji: '✅', description: 'Completed' },
    'FETCH_HTML': { emoji: '📥', description: 'Fetching page content...' },
    'PARSE_GRANTS': { emoji: '🔬', description: 'Extracting grant data...' },
    'SAVE_RESULTS': { emoji: '💾', description: 'Saving opportunities...' },
  };
  return phases[phase] || { emoji: '⚙️', description: phase.replace(/_/g, ' ') };
};

interface FunderDetail {
  id: string;
  name: string;
  type: string;
  websiteUrl: string | null;
  description: string | null;
  geographies: string[];
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  opportunities: Array<{
    id: string;
    programName: string;
    status: string;
    aiFitScore: number | null;
    tags: string[];
    createdAt: string;
  }>;
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
  }>;
  harvestSources: Array<{
    id: string;
    name: string;
    baseUrl: string;
    enabled: boolean;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
  }>;
  _count: {
    opportunities: number;
    contacts: number;
    attachments: number;
  };
}

export default function FunderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Discovery state
  const [manualLinks, setManualLinks] = useState<string[]>([]);
  const [newLinkInput, setNewLinkInput] = useState('');
  const [searchDepth, setSearchDepth] = useState<string>('1');
  const [discoveryStatus, setDiscoveryStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [discoveryJobId, setDiscoveryJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{ phase: string; percent: number; currentUrl?: string } | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  // Inspection state
  const [harvestStatus, setHarvestStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [harvestJobId, setHarvestJobId] = useState<string | null>(null);
  const [harvestProgress, setHarvestProgress] = useState<{ phase: string; percent: number; currentUrl?: string } | null>(null);

  const { data: funder, isLoading } = useQuery<FunderDetail>({
    queryKey: ['funder', id],
    queryFn: async () => {
      const response = await api.get(`/funders/${id}`);
      return response.data;
    },
  });

  // Harvest sources for this funder
  const { data: sources, isLoading: isLoadingSources } = useQuery({
    queryKey: ['harvestSources', id],
    queryFn: () => harvestApi.getSources({ funderId: id! }),
    enabled: !!id,
  });

  // Suggested/discovered pages
  const { data: suggestedSources, isLoading: isLoadingSuggested } = useQuery({
    queryKey: ['suggestedSources', id],
    queryFn: () => harvestApi.getSuggestedSources(id!),
    enabled: !!id,
  });

  // Poll discovery job
  useQuery({
    queryKey: ['jobStatus', discoveryJobId],
    queryFn: async () => {
      if (!discoveryJobId) return null;
      const status = await harvestApi.getJobStatus(discoveryJobId);
      if (status.progress) setJobProgress(status.progress);
      if (status.state === 'completed') {
        setDiscoveryStatus('completed');
        setJobProgress(null);
        queryClient.invalidateQueries({ queryKey: ['suggestedSources', id] });
        notifications.show({ title: 'Discovery Complete', message: 'Pages discovered successfully.', color: 'green', autoClose: 4000 });
      } else if (status.state === 'failed') {
        setDiscoveryStatus('failed');
        setJobProgress(null);
        notifications.show({ title: 'Discovery Failed', message: 'Please try again.', color: 'red', autoClose: 5000 });
      }
      return status;
    },
    enabled: discoveryStatus === 'running' && !!discoveryJobId,
    refetchInterval: 2000,
  });

  // Poll inspection job
  useQuery({
    queryKey: ['harvestJobStatus', harvestJobId],
    queryFn: async () => {
      if (!harvestJobId) return null;
      const status = await harvestApi.getJobStatus(harvestJobId);
      if (status.progress) setHarvestProgress(status.progress);
      if (status.state === 'completed') {
        setHarvestStatus('completed');
        setHarvestProgress(null);
        queryClient.invalidateQueries({ queryKey: ['harvestSources', id] });
        queryClient.invalidateQueries({ queryKey: ['funder', id] });
        notifications.show({ title: 'Inspection Complete', message: 'Opportunities extracted successfully.', color: 'green', autoClose: 4000 });
      } else if (status.state === 'failed') {
        setHarvestStatus('failed');
        setHarvestProgress(null);
        notifications.show({ title: 'Inspection Failed', message: 'Please check the logs.', color: 'red', autoClose: 5000 });
      }
      return status;
    },
    enabled: harvestStatus === 'running' && !!harvestJobId,
    refetchInterval: 2000,
  });

  // Mutations
  const discoverMutation = useMutation({
    mutationFn: ({ links, depth }: { links: string[]; depth: number }) =>
      harvestApi.discoverSources(id!, links, depth),
    onSuccess: (response) => {
      setDiscoveryJobId(response.jobId);
      setDiscoveryStatus('running');
      setManualLinks([]);
    },
    onError: () => { setDiscoveryStatus('failed'); setJobProgress(null); },
  });

  const triggerMutation = useMutation({
    mutationFn: (sourceId: string) => harvestApi.triggerHarvest(sourceId),
    onSuccess: (response) => {
      setHarvestJobId(response.jobId);
      setHarvestStatus('running');
      queryClient.invalidateQueries({ queryKey: ['harvestSources', id] });
    },
    onError: () => { setHarvestStatus('failed'); setHarvestProgress(null); },
  });

  const createSourceMutation = useMutation({
    mutationFn: (data: { name: string; baseUrl: string; funderId: string }) =>
      harvestApi.createSource(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['harvestSources', id] });
      setSelectedSuggestions(new Set());
      notifications.show({ title: 'Source Created', message: 'Source added successfully.', color: 'green', autoClose: 3000 });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (sourceId: string) => harvestApi.deleteSource(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['harvestSources', id] });
      notifications.show({ title: 'Source Deleted', message: 'Source removed.', color: 'gray', autoClose: 3000 });
    },
  });

  useEffect(() => {
    if (funder?.notes) setNotes(funder.notes);
  }, [funder?.notes]);

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      await api.patch(`/funders/${id}`, { notes: newNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funder', id] });
      setHasChanges(false);
    },
  });

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasChanges(value !== (funder?.notes || ''));
  };

  // Helpers
  const confirmDeleteSource = (sourceId: string, sourceName: string) => {
    modals.openConfirmModal({
      title: 'Delete Source',
      children: <Text size="sm">Are you sure you want to delete "{sourceName}"? This action cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteSourceMutation.mutate(sourceId),
    });
  };

  const toggleSuggestion = (url: string) => {
    const next = new Set(selectedSuggestions);
    next.has(url) ? next.delete(url) : next.add(url);
    setSelectedSuggestions(next);
  };

  const addManualLink = () => {
    if (!newLinkInput.trim()) return;
    try {
      new URL(newLinkInput);
      if (!manualLinks.includes(newLinkInput)) {
        setManualLinks([...manualLinks, newLinkInput]);
        setNewLinkInput('');
      }
    } catch { /* invalid URL */ }
  };

  const createSourcesFromSelected = () => {
    if (!suggestedSources?.sources) return;
    suggestedSources.sources
      .filter(s => selectedSuggestions.has(s.url))
      .forEach(source => {
        const name = source.anchorText || source.title || new URL(source.url).pathname.split('/').filter(Boolean).join(' ') || 'Source';
        createSourceMutation.mutate({ name, baseUrl: source.url, funderId: id! });
      });
  };

  if (isLoading) {
    return <Container size="xl"><Text>Loading...</Text></Container>;
  }

  if (!funder) {
    return <Container size="xl"><Text>Funder not found</Text></Container>;
  }

  const sourceCount = sources?.data?.length ?? funder.harvestSources.length;

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/funders')}>
            Back to Funders
          </Button>
        </Group>

        {/* Header Card */}
        <Paper p="lg" withBorder>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2}>{funder.name}</Title>
                {funder.websiteUrl && (
                  <Anchor href={funder.websiteUrl} target="_blank" rel="noopener noreferrer" size="sm" mt="xs">
                    <Group gap={4}>
                      <Text size="sm">{funder.websiteUrl}</Text>
                      <IconExternalLink size={14} />
                    </Group>
                  </Anchor>
                )}
              </div>
              <Badge size="lg" variant="light">{getCatalogueType(funder.tags) || funder.type}</Badge>
            </Group>

            <Divider />

            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" fw={500} c="dimmed">Focus Areas</Text>
                <Text size="sm" mt="xs">{funder.description || '—'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" fw={500} c="dimmed">Geography</Text>
                <Text size="sm" mt="xs">{funder.geographies.length > 0 ? funder.geographies.join(', ') : '—'}</Text>
              </Grid.Col>
            </Grid>

            {funder.tags.length > 0 && (
              <div>
                <Text size="sm" fw={500} c="dimmed" mb="xs">Tags</Text>
                <Group gap="xs">
                  {funder.tags.map((tag, i) => <Badge key={i} size="sm" variant="dot">{tag}</Badge>)}
                </Group>
              </div>
            )}
          </Stack>
        </Paper>

        {/* Notes */}
        <Paper p="lg" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Notes</Title>
              {hasChanges && (
                <Button size="xs" leftSection={<IconDeviceFloppy size={14} />} onClick={() => updateNotesMutation.mutate(notes)} loading={updateNotesMutation.isPending}>
                  Save Changes
                </Button>
              )}
            </Group>
            <Textarea
              placeholder="Add notes, observations, or annotations about this funder..."
              value={notes}
              onChange={(e) => handleNotesChange(e.currentTarget.value)}
              minRows={4}
              autosize
            />
          </Stack>
        </Paper>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>Overview</Tabs.Tab>
            <Tabs.Tab value="sources" leftSection={<IconWorldWww size={16} />}>Sources ({sourceCount})</Tabs.Tab>
            <Tabs.Tab value="opportunities" leftSection={<IconSparkles size={16} />}>Opportunities ({funder._count.opportunities})</Tabs.Tab>
            <Tabs.Tab value="statistics" leftSection={<IconChartBar size={16} />}>Statistics</Tabs.Tab>
          </Tabs.List>

          {/* ── Overview Tab ── */}
          <Tabs.Panel value="overview" pt="md">
            <Grid>
              <Grid.Col span={4}>
                <Card withBorder p="lg" style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Opportunities</Text>
                  <Title order={2} mt="xs">{funder._count.opportunities}</Title>
                  {funder._count.opportunities > 0 && (
                    <Button variant="subtle" size="xs" mt="sm" onClick={() => navigate(`/opportunities?funder=${id}`)}>
                      View all →
                    </Button>
                  )}
                </Card>
              </Grid.Col>
              <Grid.Col span={4}>
                <Card withBorder p="lg" style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Sources</Text>
                  <Title order={2} mt="xs">{sourceCount}</Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={4}>
                <Card withBorder p="lg" style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Contacts</Text>
                  <Title order={2} mt="xs">{funder._count.contacts}</Title>
                </Card>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          {/* ── Sources Tab ── */}
          <Tabs.Panel value="sources" pt="md">
            <Stack gap="lg">
              {/* Discovery Section */}
              <Paper withBorder p="md">
                <Stack gap="md">
                  <div>
                    <Text fw={600} size="lg">Discover Pages</Text>
                    <Text size="sm" c="dimmed">Find pages that may contain grant opportunities for this funder</Text>
                  </div>

                  {/* Manual Link Input */}
                  <Group align="flex-start">
                    <TextInput
                      placeholder="https://example.com/grants"
                      value={newLinkInput}
                      onChange={(e) => setNewLinkInput(e.currentTarget.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addManualLink()}
                      style={{ flex: 1 }}
                    />
                    <Button leftSection={<IconPlus size={16} />} onClick={addManualLink} disabled={!newLinkInput.trim()}>Add Link</Button>
                  </Group>
                  {manualLinks.length > 0 && (
                    <Stack gap="xs">
                      {manualLinks.map(link => (
                        <Paper key={link} p="xs" withBorder>
                          <Group justify="space-between">
                            <Anchor href={link} target="_blank" rel="noopener noreferrer" size="sm">
                              <Group gap={4}><Text size="sm">{link}</Text><IconExternalLink size={12} /></Group>
                            </Anchor>
                            <ActionIcon size="sm" color="red" variant="subtle" onClick={() => setManualLinks(manualLinks.filter(l => l !== link))}>
                              <IconX size={16} />
                            </ActionIcon>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  )}

                  <Group grow>
                    <Select
                      label="Search Depth"
                      data={[
                        { value: '1', label: '1 level (fast)' },
                        { value: '2', label: '2 levels (recommended)' },
                        { value: '3', label: '3 levels (thorough)' },
                      ]}
                      value={searchDepth}
                      onChange={(v) => setSearchDepth(v || '1')}
                      size="sm"
                    />
                  </Group>

                  <Group justify="flex-end">
                    <Button
                      leftSection={<IconSearch size={16} />}
                      loading={discoverMutation.isPending || discoveryStatus === 'running'}
                      onClick={() => discoverMutation.mutate({ links: manualLinks, depth: parseInt(searchDepth) })}
                    >
                      Discover Pages{manualLinks.length > 0 && ` (+ ${manualLinks.length} manual)`}
                    </Button>
                  </Group>

                  {/* Discovery Progress */}
                  {discoveryStatus === 'running' && jobProgress && (
                    <Paper p="md" withBorder bg="blue.0">
                      <Stack gap="sm">
                        <Text fw={500} size="sm">{getPhaseDescription(jobProgress.phase).emoji} {getPhaseDescription(jobProgress.phase).description}</Text>
                        <Progress value={jobProgress.percent} color="blue" size="md" />
                        <Text size="xs" c="dimmed">{jobProgress.percent}% complete</Text>
                      </Stack>
                    </Paper>
                  )}

                  {/* Discovered Pages */}
                  {isLoadingSuggested ? (
                    <Text size="sm" c="dimmed">Loading discovered pages...</Text>
                  ) : suggestedSources?.sources && suggestedSources.sources.length > 0 ? (
                    <Stack gap="md">
                      <Divider label={`Discovered Pages (${suggestedSources.sources.length})`} labelPosition="center" />
                      <Stack gap="sm">
                        {suggestedSources.sources.map((source, index) => (
                          <Paper key={source.url} p="sm" withBorder>
                            <Group align="flex-start" gap="md" wrap="nowrap">
                              <Checkbox
                                checked={selectedSuggestions.has(source.url)}
                                onChange={() => toggleSuggestion(source.url)}
                                mt={2}
                              />
                              <Stack gap={4} style={{ flex: 1 }}>
                                <Group gap="xs" wrap="nowrap">
                                  <Badge size="xs" variant="light" color="gray">#{index + 1}</Badge>
                                  <Anchor href={source.url} target="_blank" rel="noopener noreferrer" size="sm" style={{ flex: 1 }}>
                                    <Group gap={4} wrap="nowrap">
                                      <Text size="sm" fw={600} lineClamp={1}>
                                        {source.pageTitle || source.grantData?.programName || source.anchorText || 'Discovered Page'}
                                      </Text>
                                      <IconExternalLink size={12} />
                                    </Group>
                                  </Anchor>
                                </Group>
                                <Text size="xs" c="dimmed" lineClamp={1} style={{ fontFamily: 'monospace' }}>{source.url}</Text>
                                <Badge size="xs" variant="light" color={source.title === 'manual' ? 'violet' : source.score >= 0.8 ? 'green' : source.score >= 0.5 ? 'blue' : 'gray'}>
                                  {source.title === 'manual' ? 'Manual Link' : `Relevance: ${Math.round(source.score * 100)}%`}
                                </Badge>
                              </Stack>
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                      {selectedSuggestions.size > 0 && (
                        <Button leftSection={<IconPlus size={16} />} onClick={createSourcesFromSelected} loading={createSourceMutation.isPending}>
                          Create {selectedSuggestions.size} Source{selectedSuggestions.size > 1 ? 's' : ''}
                        </Button>
                      )}
                    </Stack>
                  ) : discoveryStatus === 'completed' ? (
                    <Alert color="gray"><Text size="sm">No pages discovered. Try adding manual links.</Text></Alert>
                  ) : null}

                  {discoverMutation.isError && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red">
                      {(discoverMutation.error as Error)?.message || 'Failed to start discovery'}
                    </Alert>
                  )}
                </Stack>
              </Paper>

              {/* Configured Sources Section */}
              <Paper withBorder p="md">
                <Stack gap="md">
                  <div>
                    <Text fw={600} size="lg">Configured Sources</Text>
                    <Text size="sm" c="dimmed">Inspect a source to extract grant opportunities from it</Text>
                  </div>

                  {/* Inspection Progress */}
                  {harvestStatus === 'running' && harvestProgress && (
                    <Paper p="md" withBorder bg="orange.0">
                      <Stack gap="sm">
                        <Text fw={500} size="sm">{getPhaseDescription(harvestProgress.phase).emoji} {getPhaseDescription(harvestProgress.phase).description}</Text>
                        <Progress value={harvestProgress.percent} color="orange" size="md" />
                        <Text size="xs" c="dimmed">{harvestProgress.percent}% complete</Text>
                      </Stack>
                    </Paper>
                  )}

                  {isLoadingSources ? (
                    <Text size="sm" c="dimmed">Loading sources...</Text>
                  ) : sources?.data?.length ? (
                    <Stack gap="xs">
                      {sources.data.map((source) => (
                        <Paper key={source.id} p="sm" withBorder>
                          <Group justify="space-between" align="flex-start">
                            <Stack gap={4}>
                              <Text fw={500} size="sm">{source.name}</Text>
                              <Anchor href={source.baseUrl} target="_blank" rel="noopener noreferrer" size="xs" c="dimmed">
                                <Group gap={4}><Text size="xs">{source.baseUrl}</Text><IconExternalLink size={10} /></Group>
                              </Anchor>
                              {source.lastSuccessAt && (
                                <Text size="xs" c="dimmed">Last inspected: {new Date(source.lastSuccessAt).toLocaleDateString()}</Text>
                              )}
                            </Stack>
                            <Group gap="xs">
                              <Badge color={source.enabled ? 'green' : 'gray'} size="sm">
                                {source.enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                              <Button
                                size="xs"
                                variant="light"
                                loading={triggerMutation.isPending}
                                disabled={!source.enabled || harvestStatus === 'running'}
                                onClick={() => triggerMutation.mutate(source.id)}
                              >
                                Inspect
                              </Button>
                              <ActionIcon
                                size="sm"
                                color="red"
                                variant="subtle"
                                loading={deleteSourceMutation.isPending}
                                onClick={() => confirmDeleteSource(source.id, source.name)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Group>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">No sources configured yet. Discover and create sources above.</Text>
                  )}

                  {triggerMutation.isError && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red">
                      {(triggerMutation.error as Error)?.message || 'Failed to start inspection'}
                    </Alert>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* ── Opportunities Tab ── */}
          <Tabs.Panel value="opportunities" pt="md">
            <Stack gap="md">
              {funder.opportunities.length > 0 ? (
                funder.opportunities.map((opp) => {
                  const recommendation = opp.tags?.find(t => t.startsWith('recommendation:'))?.replace('recommendation:', '');
                  return (
                    <Paper key={opp.id} p="md" withBorder style={{ cursor: 'pointer' }} onClick={() => navigate(`/opportunities/${opp.id}`)}>
                      <Group justify="space-between" align="flex-start">
                        <Stack gap="xs" style={{ flex: 1 }}>
                          <Text fw={600}>{opp.programName}</Text>
                          <Group gap="xs">
                            <Badge size="sm" variant="dot">{opp.status}</Badge>
                            {typeof opp.aiFitScore === 'number' && (
                              <Badge size="sm" color={opp.aiFitScore >= 7 ? 'green' : opp.aiFitScore >= 4 ? 'yellow' : 'gray'}>
                                Fit: {Number(opp.aiFitScore).toFixed(1)}/10
                              </Badge>
                            )}
                            {recommendation && (
                              <Badge size="sm" variant="light">
                                {recommendation.replace(/_/g, ' ')}
                              </Badge>
                            )}
                          </Group>
                        </Stack>
                      </Group>
                    </Paper>
                  );
                })
              ) : (
                <Paper p="xl" withBorder>
                  <Text ta="center" c="dimmed">No opportunities found. Inspect a source to extract opportunities.</Text>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          {/* ── Statistics Tab ── */}
          <Tabs.Panel value="statistics" pt="md">
            <Grid>
              <Grid.Col span={6}>
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={4}>Fit Score Distribution</Title>
                      <ThemeIcon size="lg" variant="light" color="blue"><IconTarget size={20} /></ThemeIcon>
                    </Group>
                    {(() => {
                      const scores = funder.opportunities
                        .map(opp => Number(opp.aiFitScore))
                        .filter(s => !isNaN(s));
                      if (scores.length === 0) return <Text size="sm" c="dimmed">No scored opportunities yet</Text>;
                      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                      const high = scores.filter(s => s >= 7).length;
                      const med = scores.filter(s => s >= 4 && s < 7).length;
                      const low = scores.filter(s => s < 4).length;
                      return (
                        <Stack gap="md">
                          <div>
                            <Group justify="space-between" mb="xs">
                              <Text size="sm" fw={500}>Average Fit Score</Text>
                              <Text size="sm" fw={600} c={avg >= 7 ? 'green' : avg >= 4 ? 'yellow' : 'gray'}>{avg.toFixed(1)}/10</Text>
                            </Group>
                            <Progress value={avg * 10} color={avg >= 7 ? 'green' : avg >= 4 ? 'yellow' : 'gray'} />
                          </div>
                          <Stack gap="xs">
                            <Group justify="space-between"><Text size="sm">High Fit (7-10)</Text><Badge color="green">{high}</Badge></Group>
                            <Group justify="space-between"><Text size="sm">Medium Fit (4-6)</Text><Badge color="yellow">{med}</Badge></Group>
                            <Group justify="space-between"><Text size="sm">Low Fit (0-3)</Text><Badge color="gray">{low}</Badge></Group>
                          </Stack>
                        </Stack>
                      );
                    })()}
                  </Stack>
                </Paper>
              </Grid.Col>

              <Grid.Col span={6}>
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={4}>Odyssean Alignment</Title>
                      <ThemeIcon size="lg" variant="light" color="violet"><IconSparkles size={20} /></ThemeIcon>
                    </Group>
                    {(() => {
                      const scores = funder.opportunities
                        .map(opp => Number(opp.aiFitScore))
                        .filter(s => !isNaN(s))
                        .map(s => s * 10); // convert 0-10 to 0-100%
                      if (scores.length === 0) return <Text size="sm" c="dimmed">No alignment data available</Text>;
                      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                      const high = scores.filter(s => s >= 70).length;
                      const med = scores.filter(s => s >= 50 && s < 70).length;
                      const low = scores.filter(s => s < 50).length;
                      return (
                        <Stack gap="md">
                          <div>
                            <Group justify="space-between" mb="xs">
                              <Text size="sm" fw={500}>Average Alignment</Text>
                              <Text size="sm" fw={600} c={avg >= 70 ? 'green' : avg >= 50 ? 'blue' : 'gray'}>{Math.round(avg)}%</Text>
                            </Group>
                            <Progress value={avg} color={avg >= 70 ? 'green' : avg >= 50 ? 'blue' : 'gray'} />
                          </div>
                          <Stack gap="xs">
                            <Group justify="space-between"><Text size="sm">High (70%+)</Text><Badge color="green">{high}</Badge></Group>
                            <Group justify="space-between"><Text size="sm">Medium (50-69%)</Text><Badge color="blue">{med}</Badge></Group>
                            <Group justify="space-between"><Text size="sm">Low (0-49%)</Text><Badge color="gray">{low}</Badge></Group>
                          </Stack>
                        </Stack>
                      );
                    })()}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
