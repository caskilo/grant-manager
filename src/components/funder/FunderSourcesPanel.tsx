import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button, Group, Stack, Badge, Text, Paper, Anchor, ActionIcon, Select,
  TextInput, Checkbox, Divider, Progress, Alert, Loader, ThemeIcon
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconExternalLink, IconInfoCircle, IconSearch, IconPlus,
  IconTrash, IconX, IconAlertCircle
} from '@tabler/icons-react';
import api from '../../lib/api';
import { harvestApi } from '../../lib/harvest';

interface FunderSourcesPanelProps {
  funderId: string;
}

interface DiscoveryRun {
  runId: string;
  timestamp: string;
  status: 'completed' | 'failed' | 'running';
  result?: {
    stats?: { newSourcesDiscovered?: number };
    sources?: any[];
  };
  error?: { message: string };
  seedUrl?: string;
}

interface HarvestRun {
  runId: string;
  timestamp: string;
  sourceName: string;
  stats?: {
    opportunitiesFound?: number;
    newOpportunities?: number;
    updatedOpportunities?: number;
  };
}

interface SuggestedSource {
  url: string;
  title?: string;
  pageTitle?: string;
  anchorText?: string;
  score: number;
  grantData?: { programName?: string };
}

interface HarvestSource {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
}

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

export default function FunderSourcesPanel({ funderId }: FunderSourcesPanelProps) {
  const queryClient = useQueryClient();

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
  const [inspectInProgress, setInspectInProgress] = useState(false);

  // Diagnostics: LLM provider/model + run history for visibility
  const { data: diagnostics } = useQuery<{
    llm: { provider: string; model: string; available: boolean; primary?: any; fallback?: any };
    env: { provider: string; geminiKeyConfigured: boolean; anthropicKeyConfigured: boolean };
  }>({
    queryKey: ['harvest-diagnostics'],
    queryFn: async () => (await api.get('/harvest/diagnostics')).data,
    staleTime: 60_000,
  });

  const { data: discoveryRuns } = useQuery<DiscoveryRun[]>({
    queryKey: ['discovery-runs', funderId],
    queryFn: async () => (await api.get(`/harvest/funders/${funderId}/discovery-runs`)).data,
    enabled: !!funderId,
    refetchInterval: discoveryStatus === 'running' ? 4000 : false,
  });

  // Sources for this funder
  const { data: sources, isLoading: isLoadingSources } = useQuery<{ data: HarvestSource[] }>({
    queryKey: ['harvestSources', funderId],
    queryFn: () => harvestApi.getSources({ funderId }),
    enabled: !!funderId,
  });

  // Suggested/discovered pages
  const { data: suggestedSources, isLoading: isLoadingSuggested } = useQuery<{
    sources: SuggestedSource[];
  }>({
    queryKey: ['suggestedSources', funderId],
    queryFn: () => harvestApi.getSuggestedSources(funderId),
    enabled: !!funderId,
  });

  // Activity log: past harvest/inspection runs for this funder
  const { data: harvestRuns, isLoading: isLoadingRuns } = useQuery<HarvestRun[]>({
    queryKey: ['harvestRuns', funderId],
    queryFn: () => harvestApi.listRuns(funderId),
    enabled: !!funderId,
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
        queryClient.invalidateQueries({ queryKey: ['suggestedSources', funderId] });
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
        queryClient.invalidateQueries({ queryKey: ['harvestSources', funderId] });
        queryClient.invalidateQueries({ queryKey: ['funder', funderId] });
        notifications.show({ title: 'Inspection Complete', message: 'Opportunities extracted successfully.', color: 'green', autoClose: 4000 });
      } else if (status.state === 'failed') {
        setHarvestStatus('failed');
        setHarvestProgress(null);
        notifications.show({ title: 'Inspection Failed', message: status.failedReason || 'The page could not be inspected. This may be due to anti-bot protection, a timeout, or the page structure not containing recognisable grant information. Try a different source URL.', color: 'red', autoClose: 8000 });
      }
      return status;
    },
    enabled: harvestStatus === 'running' && !!harvestJobId,
    refetchInterval: 2000,
  });

  // Mutations
  const discoverMutation = useMutation({
    mutationFn: ({ links, depth }: { links: string[]; depth: number }) =>
      harvestApi.discoverSources(funderId, links, depth),
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
      queryClient.invalidateQueries({ queryKey: ['harvestSources', funderId] });
    },
    onError: () => { setHarvestStatus('failed'); setHarvestProgress(null); },
  });

  const createSourceMutation = useMutation({
    mutationFn: (data: { name: string; baseUrl: string; funderId: string }) =>
      harvestApi.createSource(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['harvestSources', funderId] });
      setSelectedSuggestions(new Set());
      notifications.show({ title: 'Source Created', message: 'Source added successfully.', color: 'green', autoClose: 3000 });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (sourceId: string) => harvestApi.deleteSource(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['harvestSources', funderId] });
      notifications.show({ title: 'Source Deleted', message: 'Source removed.', color: 'gray', autoClose: 3000 });
    },
  });

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
        createSourceMutation.mutate({ name, baseUrl: source.url, funderId });
      });
  };

  // One-shot: create sources AND immediately trigger inspection on each
  const createAndInspect = async () => {
    if (!suggestedSources?.sources) return;
    const selected = suggestedSources.sources.filter(s => selectedSuggestions.has(s.url));
    if (selected.length === 0) return;
    setInspectInProgress(true);
    try {
      for (const source of selected) {
        const name = source.anchorText || source.title || new URL(source.url).pathname.split('/').filter(Boolean).join(' ') || 'Source';
        const created = await harvestApi.createSource({ name, baseUrl: source.url, funderId });
        const harvestResp = await harvestApi.triggerHarvest(created.id);
        setHarvestJobId(harvestResp.jobId);
        setHarvestStatus('running');
      }
      queryClient.invalidateQueries({ queryKey: ['harvestSources', funderId] });
      setSelectedSuggestions(new Set());
      notifications.show({ title: 'Inspect started', message: `${selected.length} source${selected.length > 1 ? 's' : ''} created and inspection queued.`, color: 'teal', autoClose: 4000 });
    } catch (err: any) {
      notifications.show({ color: 'red', title: 'Failed', message: err?.response?.data?.message || err?.message || 'Unknown error' });
    } finally {
      setInspectInProgress(false);
    }
  };

  return (
    <Stack gap="lg">
      {/* LLM Diagnostics Banner */}
      {diagnostics && (
        <Paper withBorder p="sm" bg={diagnostics.llm.available ? 'gray.0' : 'red.0'}>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs">
              <ThemeIcon size="sm" variant="light" color={diagnostics.llm.available ? 'teal' : 'red'}>
                <IconInfoCircle size={14} />
              </ThemeIcon>
              <Text size="sm">
                <Text span fw={600}>LLM:</Text>{' '}
                {diagnostics.llm.available ? (
                  <>
                    {diagnostics.llm.provider}
                    {' · '}
                    <Text span style={{ fontFamily: 'monospace' }}>{diagnostics.llm.model}</Text>
                  </>
                ) : (
                  <Text span c="red" fw={500}>Not configured — grant analysis will use heuristic fallback</Text>
                )}
              </Text>
            </Group>
            <Group gap={4}>
              {diagnostics.env.geminiKeyConfigured && <Badge size="xs" color="blue" variant="light">Gemini key</Badge>}
              {diagnostics.env.anthropicKeyConfigured && <Badge size="xs" color="orange" variant="light">Anthropic key</Badge>}
              {!diagnostics.env.geminiKeyConfigured && !diagnostics.env.anthropicKeyConfigured && (
                <Badge size="xs" color="red" variant="light">No API keys</Badge>
              )}
            </Group>
          </Group>
        </Paper>
      )}

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
                <Paper key={link} p="xs" withBorder data-testid="manual-link-item">
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
              data-testid="discover-pages-btn"
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
              <Group justify="flex-end">
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => {
                    const allUrls = suggestedSources.sources.map((s: any) => s.url);
                    const allSelected = allUrls.every((u: string) => selectedSuggestions.has(u));
                    setSelectedSuggestions(allSelected ? new Set() : new Set(allUrls));
                  }}
                >
                  {suggestedSources.sources.every((s: any) => selectedSuggestions.has(s.url)) ? 'Deselect All' : 'Select All'}
                </Button>
              </Group>
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
                <Group gap="sm">
                  <Button
                    variant="light"
                    leftSection={<IconPlus size={16} />}
                    onClick={createSourcesFromSelected}
                    loading={createSourceMutation.isPending}
                    data-testid="create-sources-btn"
                  >
                    Add as Source{selectedSuggestions.size > 1 ? 's' : ''}
                  </Button>
                  <Button
                    leftSection={inspectInProgress ? <Loader size={14} color="white" /> : <IconSearch size={16} />}
                    onClick={createAndInspect}
                    loading={inspectInProgress}
                    disabled={inspectInProgress || createSourceMutation.isPending}
                    data-testid="create-and-inspect-btn"
                  >
                    Create & Inspect {selectedSuggestions.size > 1 ? `All ${selectedSuggestions.size}` : 'Now'}
                  </Button>
                </Group>
              )}
            </Stack>
          ) : discoveryStatus === 'completed' ? (
            <Alert color="gray"><Text size="sm">No pages discovered. Try adding manual links.</Text></Alert>
          ) : null}

          {discoverMutation.isError && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title="Failed to start discovery">
              <Text size="sm">
                {((discoverMutation.error as any)?.response?.data?.message) ||
                  (discoverMutation.error as Error)?.message ||
                  'Unknown error'}
              </Text>
            </Alert>
          )}

          {/* Most recent failed run (if any) */}
          {(() => {
            const latestFailed = (discoveryRuns || []).find(r => r.status === 'failed');
            if (!latestFailed) return null;
            return (
              <Alert icon={<IconAlertCircle size={16} />} color="orange" title={`Last run failed at ${new Date(latestFailed.timestamp).toLocaleString()}`}>
                <Stack gap={4}>
                  <Text size="sm" fw={500}>{latestFailed.error?.message || 'Unknown error'}</Text>
                  {latestFailed.seedUrl && (
                    <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>Seed: {latestFailed.seedUrl}</Text>
                  )}
                </Stack>
              </Alert>
            );
          })()}

          {/* Compact recent runs history for visibility */}
          {discoveryRuns && discoveryRuns.length > 0 && (
            <Paper p="xs" withBorder bg="gray.0">
              <Stack gap={4}>
                <Text size="xs" fw={600} c="dimmed">Recent discovery runs</Text>
                {discoveryRuns.slice(0, 5).map((run: DiscoveryRun) => (
                  <Group key={run.runId} justify="space-between" gap="xs">
                    <Group gap="xs">
                      <Badge size="xs" color={run.status === 'completed' ? 'green' : 'red'} variant="light">
                        {run.status}
                      </Badge>
                      <Text size="xs" c="dimmed">{new Date(run.timestamp).toLocaleString()}</Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {run.status === 'completed'
                        ? `${run.result?.stats?.newSourcesDiscovered ?? run.result?.sources?.length ?? 0} sources`
                        : (run.error?.message ? run.error.message.slice(0, 60) : 'failed')}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
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
                <Paper key={source.id} p="sm" withBorder data-testid="harvest-source-card">
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

      {/* Activity Log */}
      <Paper withBorder p="md">
        <Stack gap="md">
          <div>
            <Text fw={600} size="lg">Activity Log</Text>
            <Text size="sm" c="dimmed">History of discovery and inspection runs for this funder</Text>
          </div>

          {isLoadingRuns ? (
            <Text size="sm" c="dimmed">Loading activity log...</Text>
          ) : harvestRuns && harvestRuns.length > 0 ? (
            <Stack gap="xs">
              {harvestRuns.map((run) => (
                <Paper key={run.runId} p="sm" withBorder>
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      <Group gap="xs">
                        <Text fw={500} size="sm">{run.sourceName}</Text>
                        <Badge size="xs" color={run.stats?.newOpportunities ? 'green' : 'gray'}>
                          {run.stats?.opportunitiesFound ?? 0} found
                        </Badge>
                        {run.stats?.newOpportunities && run.stats.newOpportunities > 0 && (
                          <Badge size="xs" color="teal">{run.stats.newOpportunities} new</Badge>
                        )}
                        {run.stats?.updatedOpportunities && run.stats.updatedOpportunities > 0 && (
                          <Badge size="xs" color="blue">{run.stats.updatedOpportunities} updated</Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        {new Date(run.timestamp).toLocaleString()}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">No inspection runs yet. Configure sources above and run an inspection.</Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
