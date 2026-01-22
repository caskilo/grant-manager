import { Modal, Stack, Paper, Text, Group, Button, TextInput, ActionIcon, Anchor, Divider, Alert, Progress, Badge, Checkbox, Select } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { IconAlertCircle, IconCheck, IconExternalLink, IconSearch, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { harvestApi } from '../../lib/harvest';

interface HarvestManagementModalProps {
  opened: boolean;
  funder: { id: string; name: string; websiteUrl: string | null } | null;
  onClose: () => void;
}

const getPhaseDescription = (phase: string): { emoji: string; description: string } => {
  const phases: Record<string, { emoji: string; description: string }> = {
    'INITIALIZING': { emoji: '🔄', description: 'Initializing discovery...' },
    'SEED_CRAWL': { emoji: '🌱', description: 'Crawling seed URL...' },
    'ANALYZING_LINKS': { emoji: '🔍', description: 'Analyzing links...' },
    'SCORING': { emoji: '📊', description: 'Scoring sources...' },
    'SAVING_RESULTS': { emoji: '💾', description: 'Saving results...' },
    'COMPLETED': { emoji: '✅', description: 'Discovery completed' },
    'FETCH_HTML': { emoji: '📥', description: 'Fetching page content...' },
    'PARSE_GRANTS': { emoji: '🔬', description: 'Extracting grant data...' },
    'SAVE_RESULTS': { emoji: '💾', description: 'Saving opportunities...' },
  };
  return phases[phase] || { emoji: '⚙️', description: phase.replace(/_/g, ' ') };
};

export default function HarvestManagementModal({ opened, funder, onClose }: HarvestManagementModalProps) {
  const queryClient = useQueryClient();
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [manualLinks, setManualLinks] = useState<string[]>([]);
  const [newLinkInput, setNewLinkInput] = useState('');
  const [searchDepth, setSearchDepth] = useState<string>('1');
  const [keywords, setKeywords] = useState('');
  const [discoveryStatus, setDiscoveryStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [discoveryJobId, setDiscoveryJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{ phase: string; percent: number; currentUrl?: string } | null>(null);
  const [harvestStatus, setHarvestStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [harvestJobId, setHarvestJobId] = useState<string | null>(null);
  const [harvestProgress, setHarvestProgress] = useState<{ phase: string; percent: number; currentUrl?: string } | null>(null);

  const funderId = funder?.id;

  const { data: sources, isLoading } = useQuery({
    queryKey: ['harvestSources', funderId],
    queryFn: () => harvestApi.getSources({ funderId: funderId! }),
    enabled: !!funderId && opened,
  });

  const { data: suggestedSources, isLoading: isLoadingSuggested } = useQuery({
    queryKey: ['suggestedSources', funderId],
    queryFn: () => harvestApi.getSuggestedSources(funderId!),
    enabled: !!funderId && opened,
  });

  // Poll job status while discovery is running
  useQuery({
    queryKey: ['jobStatus', discoveryJobId],
    queryFn: async () => {
      if (!discoveryJobId) return null;
      
      const status = await harvestApi.getJobStatus(discoveryJobId);
      
      if (status.progress) {
        setJobProgress(status.progress);
      }
      
      if (status.state === 'completed') {
        setDiscoveryStatus('completed');
        setJobProgress(null);
        queryClient.invalidateQueries({ queryKey: ['suggestedSources', funderId] });
      } else if (status.state === 'failed') {
        setDiscoveryStatus('failed');
        setJobProgress(null);
      }
      
      return status;
    },
    enabled: discoveryStatus === 'running' && !!discoveryJobId,
    refetchInterval: 2000,
  });

  // Poll job status while harvest is running
  useQuery({
    queryKey: ['harvestJobStatus', harvestJobId],
    queryFn: async () => {
      if (!harvestJobId) return null;
      
      const status = await harvestApi.getJobStatus(harvestJobId);
      
      if (status.progress) {
        setHarvestProgress(status.progress);
      }
      
      if (status.state === 'completed') {
        setHarvestStatus('completed');
        setHarvestProgress(null);
        queryClient.invalidateQueries({ queryKey: ['harvestSources', funderId] });
      } else if (status.state === 'failed') {
        setHarvestStatus('failed');
        setHarvestProgress(null);
      }
      
      return status;
    },
    enabled: harvestStatus === 'running' && !!harvestJobId,
    refetchInterval: 2000,
  });

  const discoverMutation = useMutation({
    mutationFn: ({ links, depth }: { links: string[]; depth: number }) => 
      harvestApi.discoverSources(funderId!, links, depth),
    onSuccess: (response) => {
      setDiscoveryJobId(response.jobId);
      setDiscoveryStatus('running');
      setManualLinks([]);
    },
    onError: () => {
      setDiscoveryStatus('failed');
      setJobProgress(null);
    },
  });

  const triggerMutation = useMutation({
    mutationFn: (sourceId: string) => harvestApi.triggerHarvest(sourceId),
    onSuccess: (response) => {
      setHarvestJobId(response.jobId);
      setHarvestStatus('running');
      queryClient.invalidateQueries({ queryKey: ['harvestSources', funderId] });
    },
    onError: () => {
      setHarvestStatus('failed');
      setHarvestProgress(null);
    },
  });

  const createSourceMutation = useMutation({
    mutationFn: (data: { name: string; baseUrl: string; funderId: string }) =>
      harvestApi.createSource(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['harvestSources', funderId] });
      setSelectedSuggestions(new Set());
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (sourceId: string) => harvestApi.deleteSource(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['harvestSources', funderId] });
    },
  });

  const confirmDeleteSource = (sourceId: string, sourceName: string) => {
    modals.openConfirmModal({
      title: 'Delete Harvest Source',
      children: (
        <Text size="sm">
          Are you sure you want to delete "{sourceName}"? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteSourceMutation.mutate(sourceId),
    });
  };

  const toggleSuggestion = (url: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedSuggestions(newSelected);
  };

  const addManualLink = () => {
    if (!newLinkInput.trim()) return;
    
    try {
      new URL(newLinkInput);
      if (!manualLinks.includes(newLinkInput)) {
        setManualLinks([...manualLinks, newLinkInput]);
        setNewLinkInput('');
      }
    } catch {
      // Invalid URL, ignore
    }
  };

  const removeManualLink = (url: string) => {
    setManualLinks(manualLinks.filter(link => link !== url));
  };

  const createSourcesFromSelected = () => {
    if (!suggestedSources?.sources) return;

    const selectedSources = suggestedSources.sources.filter((s) =>
      selectedSuggestions.has(s.url)
    );

    selectedSources.forEach((source) => {
      const name = source.anchorText || source.title || new URL(source.url).pathname.split('/').filter(Boolean).join(' ') || 'Harvest Source';
      
      createSourceMutation.mutate({
        name,
        baseUrl: source.url,
        funderId: funderId!,
      });
    });
  };

  if (!funderId || !funder) return null;

  return (
    <Modal opened={opened} onClose={onClose} title={`Harvest: ${funder.name}`} size="xl">
      <Stack gap="lg">
        {/* Section A: Source Discovery */}
        <Paper withBorder p="md">
          <Stack gap="md">
            <div>
              <Text fw={600} size="lg">Source Discovery</Text>
              <Text size="sm" c="dimmed">
                Find potential sources that may contain grant opportunities
              </Text>
            </div>

            {/* Manual Link Input */}
            <Stack gap="xs">
              <Text fw={500} size="sm">Add Links Manually</Text>
              <Group align="flex-start">
                <TextInput
                  placeholder="https://example.com/grants"
                  value={newLinkInput}
                  onChange={(e) => setNewLinkInput(e.currentTarget.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addManualLink()}
                  style={{ flex: 1 }}
                />
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={addManualLink}
                  disabled={!newLinkInput.trim()}
                >
                  Add Link
                </Button>
              </Group>
              {manualLinks.length > 0 && (
                <Stack gap="xs">
                  {manualLinks.map((link) => (
                    <Paper key={link} p="xs" withBorder>
                      <Group justify="space-between">
                        <Anchor href={link} target="_blank" rel="noopener noreferrer" size="sm">
                          <Group gap={4}>
                            <Text size="sm">{link}</Text>
                            <IconExternalLink size={12} />
                          </Group>
                        </Anchor>
                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="subtle"
                          onClick={() => removeManualLink(link)}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>

            <Divider />

            {/* Discovery Options */}
            <Stack gap="xs">
              <Text fw={500} size="sm">Discovery Options</Text>
              <Group grow>
                <Select
                  label="Search Depth"
                  description="How many link levels to crawl"
                  data={[
                    { value: '1', label: '1 level (fast)' },
                    { value: '2', label: '2 levels (recommended)' },
                    { value: '3', label: '3 levels (thorough)' },
                  ]}
                  value={searchDepth}
                  onChange={(value) => setSearchDepth(value || '1')}
                />
                <TextInput
                  label="Focus Keywords (optional)"
                  description="Comma-separated keywords to prioritize"
                  placeholder="e.g., research, innovation, grants"
                  value={keywords}
                  onChange={(e) => setKeywords(e.currentTarget.value)}
                />
              </Group>
            </Stack>

            <Divider />

            {/* Discover Button */}
            <Group justify="flex-end">
              <Button
                leftSection={<IconSearch size={16} />}
                size="md"
                loading={discoverMutation.isPending || discoveryStatus === 'running'}
                onClick={() => discoverMutation.mutate({ links: manualLinks, depth: parseInt(searchDepth) })}
              >
                Discover Opportunities
                {manualLinks.length > 0 && ` (+ ${manualLinks.length} manual)`}
              </Button>
            </Group>

            {/* Single Progress Bar for Discovery */}
            {discoveryStatus === 'running' && jobProgress && (
              <Paper p="md" withBorder bg="blue.0">
                <Stack gap="sm">
                  <Group gap="xs">
                    <Text fw={500} size="sm">
                      {getPhaseDescription(jobProgress.phase).emoji} {getPhaseDescription(jobProgress.phase).description}
                    </Text>
                  </Group>
                  <Progress value={jobProgress.percent} color="blue" size="md" />
                  <Text size="xs" c="dimmed">
                    {jobProgress.percent}% complete
                    {jobProgress.currentUrl && ` • ${new URL(jobProgress.currentUrl).hostname}`}
                  </Text>
                </Stack>
              </Paper>
            )}

            {/* Discovery Results */}
            {isLoadingSuggested ? (
              <Text size="sm" c="dimmed">Loading discovered sources...</Text>
            ) : suggestedSources?.sources && suggestedSources.sources.length > 0 ? (
              <Stack gap="md">
                <Divider label={`Discovered Sources (${suggestedSources.sources.length})`} labelPosition="center" />
                
                {/* Discovery metadata */}
                {suggestedSources.lastDiscoveryAt && (
                  <Group gap="md" justify="space-between">
                    <Text size="xs" c="dimmed">
                      Last discovered: {new Date(suggestedSources.lastDiscoveryAt).toLocaleString()}
                    </Text>
                    {suggestedSources.stats && (
                      <Group gap="xs">
                        {suggestedSources.stats.seedUrlProcessed && (
                          <Badge size="xs" variant="light" color="blue">Seed URL analyzed</Badge>
                        )}
                        {suggestedSources.stats.manualLinksProcessed != null && suggestedSources.stats.manualLinksProcessed > 0 && (
                          <Badge size="xs" variant="light" color="violet">
                            {suggestedSources.stats.manualLinksProcessed} manual link{suggestedSources.stats.manualLinksProcessed > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </Group>
                    )}
                  </Group>
                )}
                
                {/* Warnings */}
                {suggestedSources.warnings && suggestedSources.warnings.length > 0 && (
                  <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
                    <Stack gap={4}>
                      <Text size="sm" fw={500}>Discovery issues:</Text>
                      {suggestedSources.warnings.map((warning, i) => (
                        <Text key={i} size="xs">{warning}</Text>
                      ))}
                    </Stack>
                  </Alert>
                )}
                
                {/* Source cards */}
                <Stack gap="sm">
                  {suggestedSources.sources.map((source, index) => (
                    <Paper key={source.url} p="md" withBorder shadow="xs" style={{ 
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      ':hover': { boxShadow: 'md' }
                    }}>
                      <Group align="flex-start" gap="md" wrap="nowrap">
                        <Checkbox
                          checked={selectedSuggestions.has(source.url)}
                          onChange={() => toggleSuggestion(source.url)}
                          size="md"
                          mt={2}
                        />
                        <Stack gap="sm" style={{ flex: 1 }}>
                          {/* Title and link */}
                          <Group gap="xs" wrap="nowrap">
                            <Badge size="sm" variant="light" color="gray">#{index + 1}</Badge>
                            <Anchor 
                              href={source.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              size="sm"
                              style={{ flex: 1 }}
                            >
                              <Group gap={6} wrap="nowrap">
                                <Text size="sm" fw={600} lineClamp={1}>
                                  {source.pageTitle || source.grantData?.programName || source.anchorText || 'Discovered Page'}
                                </Text>
                                <IconExternalLink size={14} />
                              </Group>
                            </Anchor>
                          </Group>
                          
                          {/* Grant data badges */}
                          {source.keywords && source.keywords.length > 0 && (
                            <Group gap="xs">
                              {source.keywords.slice(0, 4).map((keyword, i) => (
                                <Badge key={i} size="xs" variant="dot" color="gray">
                                  {keyword}
                                </Badge>
                              ))}
                              {source.keywords.length > 4 && (
                                <Text size="xs" c="dimmed">+{source.keywords.length - 4} more</Text>
                              )}
                            </Group>
                          )}
                          
                          {/* URL */}
                          <Text size="xs" c="dimmed" lineClamp={1} style={{ fontFamily: 'monospace' }}>
                            {source.url}
                          </Text>
                          
                          {/* Metadata footer */}
                          <Group gap="xs" justify="space-between">
                            <Group gap="xs">
                              <Badge 
                                size="xs" 
                                variant="light" 
                                color={source.title === 'manual' ? 'violet' : source.score >= 0.8 ? 'green' : source.score >= 0.5 ? 'blue' : 'gray'}
                              >
                                {source.title === 'manual' ? 'Manual Link' : `Relevance: ${Math.round(source.score * 100)}%`}
                              </Badge>
                              {source.title && source.title !== 'manual' && (
                                <Badge size="xs" variant="outline">
                                  {source.title}
                                </Badge>
                              )}
                            </Group>
                          </Group>
                        </Stack>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
                {selectedSuggestions.size > 0 && (
                  <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={createSourcesFromSelected}
                    loading={createSourceMutation.isPending}
                  >
                    Create {selectedSuggestions.size} Harvest Source{selectedSuggestions.size > 1 ? 's' : ''}
                  </Button>
                )}
              </Stack>
            ) : discoveryStatus === 'completed' ? (
              <Alert color="gray">
                <Text size="sm">
                  No sources discovered. Try adding manual links or adjusting discovery options.
                </Text>
              </Alert>
            ) : null}

            {/* Discovery Status Messages */}
            {discoveryStatus === 'completed' && (
              <Alert icon={<IconCheck size={16} />} color="green">
                Discovery completed! {suggestedSources?.sources?.length || 0} sources found.
              </Alert>
            )}
            
            {discoveryStatus === 'failed' && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                Discovery failed. Please try again or check the manual links.
              </Alert>
            )}

            {discoverMutation.isError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                {(discoverMutation.error as Error)?.message || 'Failed to start discovery'}
              </Alert>
            )}
          </Stack>
        </Paper>

        <Divider />

        {/* Section B: Configured Harvest Sources */}
        <Paper withBorder p="md">
          <Stack gap="md">
            <div>
              <Text fw={600} size="lg">Configured Harvest Sources</Text>
              <Text size="sm" c="dimmed">
                Active harvest sources for this funder
              </Text>
            </div>

            {/* Harvest Progress */}
            {harvestStatus === 'running' && harvestProgress && (
              <Paper p="md" withBorder bg="amber.0">
                <Stack gap="sm">
                  <Group gap="xs">
                    <Text fw={500} size="sm">
                      {getPhaseDescription(harvestProgress.phase).emoji} {getPhaseDescription(harvestProgress.phase).description}
                    </Text>
                  </Group>
                  <Progress value={harvestProgress.percent} color="amber" size="md" />
                  <Text size="xs" c="dimmed">
                    {harvestProgress.percent}% complete
                    {harvestProgress.currentUrl && ` • ${new URL(harvestProgress.currentUrl).hostname}`}
                  </Text>
                </Stack>
              </Paper>
            )}

            {harvestStatus === 'completed' && (
              <Alert icon={<IconCheck size={16} />} color="green">
                Harvest completed successfully!
              </Alert>
            )}

            {harvestStatus === 'failed' && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                Harvest failed. Please check the logs and try again.
              </Alert>
            )}

            {isLoading ? (
              <Text size="sm" c="dimmed">Loading harvest sources...</Text>
            ) : sources?.data?.length ? (
              <Stack gap="xs">
                {sources.data.map((source) => (
                  <Paper key={source.id} p="sm" withBorder>
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={4}>
                        <Text fw={500} size="sm">{source.name}</Text>
                        <Anchor href={source.baseUrl} target="_blank" rel="noopener noreferrer" size="xs" c="dimmed">
                          <Group gap={4}>
                            <Text size="xs">{source.baseUrl}</Text>
                            <IconExternalLink size={10} />
                          </Group>
                        </Anchor>
                        {source.lastSuccessAt && (
                          <Text size="xs" c="dimmed">
                            Last success: {new Date(source.lastSuccessAt).toLocaleDateString()}
                          </Text>
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
                          disabled={!source.enabled}
                          onClick={() => triggerMutation.mutate(source.id)}
                        >
                          Run Harvest
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
              <Alert color="gray">
                <Text size="sm">
                  No harvest sources configured yet. Create sources from discoveries above.
                </Text>
              </Alert>
            )}

            {triggerMutation.isSuccess && (
              <Alert icon={<IconCheck size={16} />} color="green">
                Harvest job started successfully! Job ID: {triggerMutation.data.jobId}
              </Alert>
            )}

            {triggerMutation.isError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                {(triggerMutation.error as Error)?.message || 'Failed to start harvest'}
              </Alert>
            )}

            {createSourceMutation.isSuccess && (
              <Alert icon={<IconCheck size={16} />} color="green">
                Harvest source(s) created successfully!
              </Alert>
            )}
          </Stack>
        </Paper>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
