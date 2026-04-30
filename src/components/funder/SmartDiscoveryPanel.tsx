import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { harvestApi, DiscoveryRun } from '../../lib/harvest';
import {
  Button, Group, Stack, Badge, Text, Paper, Progress, 
  TextInput, ActionIcon, Alert, SegmentedControl, Card,
  ThemeIcon, Collapse, ScrollArea
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlayerPlay, IconPlus, IconX, IconBrain, IconWorld,
  IconCheck, IconAlertCircle, IconClock, IconCoins, IconSettings,
  IconChevronDown, IconChevronRight, IconRefresh,
  IconFileText, IconSparkles, IconInfoCircle, IconHistory
} from '@tabler/icons-react';
import api from '../../lib/api';

interface SmartDiscoveryPanelProps {
  funderId: string;
  funderName: string;
  funderWebsiteUrl: string | null;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error' | 'progress';
  message: string;
  details?: any;
}

interface DiscoveryProgress {
  phase: string;
  percent: number;
  currentUrl?: string;
  pagesFound?: number;
  opportunitiesExtracted?: number;
  tokensUsed?: number;
  error?: string;
  warning?: string;
  relevanceScore?: number;
  relevanceReason?: string;
  isManualLink?: boolean;
}

const PHASE_DESCRIPTIONS: Record<string, { icon: string; description: string }> = {
  'INITIALIZING': { icon: '🚀', description: 'Initializing discovery session' },
  'BROWSER_SETUP': { icon: '🌐', description: 'Launching browser context' },
  'NAVIGATING': { icon: '🧭', description: 'Navigating to seed page' },
  'ANALYZING_STRUCTURE': { icon: '🔍', description: 'Analyzing page structure' },
  'FINDING_LINKS': { icon: '🔗', description: 'Finding relevant grant links' },
  'EXPLORING': { icon: '🗺️', description: 'Exploring discovered pages' },
  'EXTRACTING': { icon: '🤖', description: 'Extracting grant opportunities with LLM' },
  'SCORING': { icon: '📊', description: 'Scoring opportunities for relevance' },
  'SAVING': { icon: '💾', description: 'Saving to database' },
  'COMPLETED': { icon: '✅', description: 'Discovery completed' },
  'FAILED': { icon: '❌', description: 'Discovery failed' },
};

export default function SmartDiscoveryPanel({
  funderId,
  funderWebsiteUrl,
}: SmartDiscoveryPanelProps) {
  const queryClient = useQueryClient();
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Persist per-funder config to localStorage
  const storageKey = `smart-discovery-config-${funderId}`;
  const loadPersistedConfig = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  };
  const persistConfig = useCallback((patch: Record<string, any>) => {
    try {
      const current = loadPersistedConfig();
      localStorage.setItem(storageKey, JSON.stringify({ ...current, ...patch }));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Configuration state — initialise from localStorage where available
  const [seedUrl, setSeedUrl] = useState(funderWebsiteUrl || '');
  const [manualLinks, setManualLinks] = useState<string[]>(() => loadPersistedConfig().manualLinks ?? []);
  const [newLinkInput, setNewLinkInput] = useState('');
  const [searchDepth, setSearchDepth] = useState<'shallow' | 'standard' | 'deep'>(
    () => loadPersistedConfig().searchDepth ?? 'standard'
  );
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'anthropic'>(
    () => loadPersistedConfig().llmProvider ?? 'gemini'
  );
  const [showConfig, { toggle: toggleConfig }] = useDisclosure(
    loadPersistedConfig().showConfig ?? true
  );

  // Runtime state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(
    () => loadPersistedConfig().showHistory ?? true
  );
  const lastLoggedProgress = useRef<string>(''); // Track last logged progress to avoid duplicates

  // Discovery runs history query — staleTime:0 ensures invalidation always triggers a refetch
  const { data: discoveryRuns, isLoading: isLoadingRuns } = useQuery<DiscoveryRun[]>({
    queryKey: ['discoveryRuns', funderId],
    queryFn: () => harvestApi.listDiscoveryRuns(funderId),
    enabled: showHistory,
    staleTime: 0,
  });

  // Add log entry
  const addLog = useCallback((level: LogEntry['level'], message: string, details?: any) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      level,
      message,
      details,
    };
    setLogs(prev => [...prev, entry]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Discovery mutation
  const discoverMutation = useMutation({
    mutationFn: async (params: {
      seedUrl: string;
      manualLinks: string[];
      depth: string;
      llmProvider: string;
    }) => {
      const response = await api.post(`/harvest/funders/${funderId}/smart-discover-v2`, params);
      return response.data;
    },
    onSuccess: (data) => {
      addLog('success', `Discovery job started: ${data.jobId}`);
      // Start polling for progress
      pollJobProgress(data.jobId);
    },
    onError: (error: any) => {
      addLog('error', `Failed to start discovery: ${error?.response?.data?.message || error.message}`);
    },
  });

  // Poll job progress - quiet mode: only logs phase transitions, warnings, errors, completion
  const pollJobProgress = useCallback(async (jobId: string) => {
    addLog('info', `Discovery job ${jobId} started`);
    let lastPhase: string | null = null;
    let lastPercent: number = 0;
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/harvest/jobs/${jobId}/status`);
        const job = response.data;

        // Update progress UI (always)
        if (job.progress) {
          setProgress(job.progress);
          
          // Only log on phase transitions or significant changes (>10% jumps) or warnings/errors
          const phase = job.progress.phase;
          const percent = job.progress.percent;
          const hasWarning = !!job.progress.warning;
          const hasError = !!job.progress.error;
          const isPhaseChange = phase !== lastPhase;
          const isSignificantProgress = phase === lastPhase && (percent - lastPercent) >= 10;
          
          if (isPhaseChange || isSignificantProgress || hasWarning || hasError) {
            const phaseDesc = PHASE_DESCRIPTIONS[phase]?.description || phase;
            let msg = `${phaseDesc} (${percent}%)`;
            if (job.progress.currentUrl) {
              const isManual = job.progress.isManualLink ? '[MANUAL] ' : '';
              msg += ` - ${isManual}${job.progress.currentUrl}`;
            }
            if (job.progress.relevanceScore !== undefined) {
              msg += ` [Relevance: ${(job.progress.relevanceScore * 100).toFixed(0)}%]`;
            }
            
            if (hasWarning) {
              addLog('warning', `${msg} [Warning: ${job.progress.warning}]`, job.progress);
            } else if (hasError) {
              addLog('error', `${msg} [Error: ${job.progress.error}]`, job.progress);
            } else if (isPhaseChange) {
              // Phase transition - always log
              addLog('progress', msg, job.progress);
            }
            // Note: Significant progress jumps (>10%) are logged silently in backend, not here
            
            lastPhase = phase;
            lastPercent = percent;
          }
        }

        // Handle completion
        if (job.state === 'completed') {
          clearInterval(pollInterval);
          setProgress(null);
          addLog('success', `Discovery completed! Found ${job.result?.opportunities?.length || 0} opportunities`);
          queryClient.invalidateQueries({ queryKey: ['funder', funderId] });
          // Delay history invalidation slightly so the backend has time to finish writing the run JSON file
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['discoveryRuns', funderId] });
          }, 2000);
        }

        // Handle failure
        if (job.state === 'failed') {
          clearInterval(pollInterval);
          setProgress(null);
          addLog('error', `Discovery failed: ${job.failedReason || 'Unknown error'}`);
        }
      } catch (error: any) {
        // Suppress routine poll errors (404 when job completes is normal)
        if (error?.response?.status !== 404) {
          addLog('warning', `Poll error: ${error.message}`);
        }
      }
    }, 2000);

    // Cleanup after 10 minutes max
    setTimeout(() => clearInterval(pollInterval), 10 * 60 * 1000);
  }, [addLog, funderId, queryClient]);

  // Add manual link
  const addManualLink = () => {
    if (!newLinkInput.trim()) return;
    try {
      new URL(newLinkInput);
      if (!manualLinks.includes(newLinkInput) && newLinkInput !== seedUrl) {
        const next = [...manualLinks, newLinkInput];
        setManualLinks(next);
        persistConfig({ manualLinks: next });
        setNewLinkInput('');
        addLog('info', `Added manual link: ${newLinkInput}`);
      }
    } catch {
      addLog('error', `Invalid URL: ${newLinkInput}`);
    }
  };

  // Remove manual link
  const removeManualLink = (link: string) => {
    const next = manualLinks.filter(l => l !== link);
    setManualLinks(next);
    persistConfig({ manualLinks: next });
  };

  // Start discovery
  const startDiscovery = () => {
    if (!seedUrl && manualLinks.length === 0) {
      addLog('error', 'Please provide at least one starting URL');
      return;
    }

    // Guard against concurrent discoveries
    if (discoverMutation.isPending || (progress && progress.percent < 100 && progress.phase !== 'COMPLETED' && progress.phase !== 'FAILED')) {
      addLog('warning', 'Discovery already in progress, please wait');
      return;
    }

    // Clear previous results
    setLogs([]);
    setProgress(null);
    lastLoggedProgress.current = ''; // Reset progress tracking

    discoverMutation.mutate({
      seedUrl: seedUrl || manualLinks[0],
      manualLinks: seedUrl ? manualLinks : manualLinks.slice(1),
      depth: searchDepth,
      llmProvider,
    });
  };

  return (
    <Stack gap="lg">
      {/* Header */}
      <Paper withBorder p="md" bg="gray.0">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon size="lg" variant="light" color="blue">
                <IconBrain size={24} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="lg">Smart Grant Discovery</Text>
                <Text size="sm" c="dimmed">AI-powered extraction from funder websites</Text>
              </div>
            </Group>
            <Badge size="lg" variant="light" color={llmProvider === 'gemini' ? 'blue' : 'orange'}>
              {llmProvider === 'gemini' ? '🧠 Gemini' : '🧠 Anthropic'}
            </Badge>
          </Group>
        </Stack>
      </Paper>

      {/* Configuration Panel */}
      <Card withBorder>
        <Stack gap="md">
          <Group justify="space-between" onClick={() => { toggleConfig(); persistConfig({ showConfig: !showConfig }); }} style={{ cursor: 'pointer' }}>
            <Group gap="xs">
              <IconSettings size={18} />
              <Text fw={500}>Configuration</Text>
            </Group>
            {showConfig ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
          </Group>

          <Collapse in={showConfig}>
            <Stack gap="md">
              {/* LLM Provider Selection */}
              <div>
                <Text size="sm" fw={500} mb="xs">LLM Provider</Text>
                <SegmentedControl
                  value={llmProvider}
                  onChange={(v) => { setLlmProvider(v as 'gemini' | 'anthropic'); persistConfig({ llmProvider: v }); }}
                  data={[
                    { value: 'gemini', label: 'Gemini (Fast & Cheap)' },
                    { value: 'anthropic', label: 'Claude (High Quality)' },
                  ]}
                  fullWidth
                />
              </div>

              {/* Search Depth */}
              <div>
                <Text size="sm" fw={500} mb="xs">Search Depth</Text>
                <SegmentedControl
                  value={searchDepth}
                  onChange={(v) => { setSearchDepth(v as 'shallow' | 'standard' | 'deep'); persistConfig({ searchDepth: v }); }}
                  data={[
                    { value: 'shallow', label: 'Shallow (5 pages)' },
                    { value: 'standard', label: 'Standard (15 pages)' },
                    { value: 'deep', label: 'Deep (40 pages)' },
                  ]}
                  fullWidth
                />
              </div>

              {/* Seed URL */}
              <div>
                <Text size="sm" fw={500} mb="xs">Starting URL</Text>
                <TextInput
                  placeholder="https://funder-website.com/grants"
                  value={seedUrl}
                  onChange={(e) => setSeedUrl(e.currentTarget.value)}
                  leftSection={<IconWorld size={16} />}
                  description={funderWebsiteUrl ? `Default: ${funderWebsiteUrl}` : 'Enter the main grants page URL'}
                />
              </div>

              {/* Manual Links */}
              <div>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500}>Additional URLs to Explore</Text>
                  <Text size="xs" c="dimmed">{manualLinks.length} added</Text>
                </Group>
                <Group gap="xs">
                  <TextInput
                    placeholder="https://example.com/specific-grant"
                    value={newLinkInput}
                    onChange={(e) => setNewLinkInput(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addManualLink()}
                    style={{ flex: 1 }}
                    size="sm"
                  />
                  <ActionIcon size="input-sm" variant="light" onClick={addManualLink} disabled={!newLinkInput.trim()}>
                    <IconPlus size={16} />
                  </ActionIcon>
                </Group>
                {manualLinks.length > 0 && (
                  <Stack gap="xs" mt="xs">
                    {manualLinks.map(link => (
                      <Paper key={link} p="xs" withBorder>
                        <Group justify="space-between" gap="xs">
                          <Text size="xs" lineClamp={1} style={{ flex: 1 }}>{link}</Text>
                          <ActionIcon size="xs" color="red" variant="subtle" onClick={() => removeManualLink(link)}>
                            <IconX size={14} />
                          </ActionIcon>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </div>
            </Stack>
          </Collapse>
        </Stack>
      </Card>

      {/* Start Button */}
      <Button
        size="lg"
        leftSection={<IconPlayerPlay size={20} />}
        onClick={startDiscovery}
        loading={!!(discoverMutation.isPending || (progress && progress.percent < 100 && progress.phase !== 'COMPLETED' && progress.phase !== 'FAILED'))}
        disabled={(!seedUrl && manualLinks.length === 0) || discoverMutation.isPending || !!(progress && progress.percent < 100 && progress.phase !== 'COMPLETED' && progress.phase !== 'FAILED')}
        gradient={{ from: 'blue', to: 'cyan' }}
        variant="gradient"
      >
        {discoverMutation.isPending ? 'Starting...' : progress ? 'Discovery in Progress...' : 'Start Smart Discovery'}
      </Button>

      {/* Discovery History Toggle */}
      <Group justify="center">
        <Button
          variant="subtle"
          size="sm"
          leftSection={<IconHistory size={16} />}
          onClick={() => { const next = !showHistory; setShowHistory(next); persistConfig({ showHistory: next }); }}
        >
          {showHistory ? 'Hide' : 'Show'} Discovery History
        </Button>
      </Group>

      {/* Discovery History */}
      {showHistory && (
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500}>Discovery Run History</Text>
              {isLoadingRuns && <Text size="sm" c="dimmed">Loading...</Text>}
            </Group>
            
            {!isLoadingRuns && (!discoveryRuns || discoveryRuns.length === 0) && (
              <Text size="sm" c="dimmed">No discovery runs yet. Start your first discovery above.</Text>
            )}
            
            {!isLoadingRuns && discoveryRuns && discoveryRuns.length > 0 && (
              <Stack gap="sm">
                {discoveryRuns.map((run) => (
                  <Paper key={run.runId} p="sm" withBorder>
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>{new Date(run.timestamp).toLocaleString()}</Text>
                        <Group gap="xs">
                          <Badge size="xs" variant="light" color="blue">{run.pagesExplored} pages</Badge>
                          <Badge size="xs" variant="light" color="green">{run.opportunitiesExtracted} opps</Badge>
                          {run.saveStats && (
                            <>
                              <Badge size="xs" variant="light" color="teal">{run.saveStats.created} saved</Badge>
                              {run.saveStats.failed > 0 && (
                                <Badge size="xs" color="red">{run.saveStats.failed} failed</Badge>
                              )}
                            </>
                          )}
                        </Group>
                      </Group>
                      {run.errors.length > 0 && (
                        <Text size="xs" c="red" lineClamp={1}>
                          {run.errors.length} error(s): {run.errors[0]}
                        </Text>
                      )}
                      {run.opportunities.length > 0 && (
                        <Stack gap="xs" mt="xs">
                          {run.opportunities.slice(0, 3).map((opp, idx) => (
                            <Group key={idx} gap="xs">
                              <Text size="xs" lineClamp={1} style={{ flex: 1 }}>{opp.programName}</Text>
                              <Badge size="xs" variant="light" color={opp.status === 'OPEN' ? 'green' : opp.status === 'CLOSED' ? 'red' : 'gray'}>
                                {opp.status}
                              </Badge>
                            </Group>
                          ))}
                          {run.opportunities.length > 3 && (
                            <Text size="xs" c="dimmed">+{run.opportunities.length - 3} more opportunities</Text>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      )}

      {/* Progress Display */}
      {progress && progress.phase !== 'COMPLETED' && progress.phase !== 'FAILED' && (
        <Paper withBorder p="md" bg="blue.0">
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="sm">
                <Text size="xl">{PHASE_DESCRIPTIONS[progress.phase]?.icon || '⏳'}</Text>
                <div>
                  <Text fw={500}>{PHASE_DESCRIPTIONS[progress.phase]?.description || progress.phase}</Text>
                  {progress.currentUrl && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      <IconWorld size={10} style={{ display: 'inline', marginRight: 4 }} />
                      {progress.currentUrl}
                    </Text>
                  )}
                </div>
              </Group>
              <Text fw={600} size="xl">{progress.percent}%</Text>
            </Group>
            <Progress value={progress.percent} size="md" color="blue" striped animated />
            <Group gap="md" justify="center">
              {progress.pagesFound !== undefined && (
                <Badge variant="light" leftSection={<IconFileText size={12} />}>
                  {progress.pagesFound} pages explored
                </Badge>
              )}
              {progress.opportunitiesExtracted !== undefined && (
                <Badge variant="light" color="green" leftSection={<IconSparkles size={12} />}>
                  {progress.opportunitiesExtracted} opportunities found
                </Badge>
              )}
              {progress.tokensUsed !== undefined && (
                <Badge variant="light" color="orange" leftSection={<IconCoins size={12} />}>
                  {progress.tokensUsed.toLocaleString()} tokens
                </Badge>
              )}
            </Group>
          </Stack>
        </Paper>
      )}

      {/* Activity Log */}
      <Card withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <IconClock size={18} />
              <Text fw={500}>Activity Log</Text>
            </Group>
            {logs.length > 0 && (
              <ActionIcon size="sm" variant="subtle" onClick={() => setLogs([])}>
                <IconRefresh size={16} />
              </ActionIcon>
            )}
          </Group>

          <ScrollArea h={250} type="auto">
            <Stack gap="xs">
              {logs.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  Click "Start Smart Discovery" to begin
                </Text>
              ) : (
                logs.map((log) => (
                  <Paper
                    key={log.id}
                    p="xs"
                    withBorder
                    bg={
                      log.level === 'error' ? 'red.0' :
                      log.level === 'success' ? 'green.0' :
                      log.level === 'warning' ? 'yellow.0' :
                      'gray.0'
                    }
                  >
                    <Group gap="xs" align="flex-start">
                      <Text size="xs" c="dimmed" style={{ minWidth: 50 }}>
                        {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </Text>
                      <Text size="sm" style={{ flex: 1 }}>
                        {log.message}
                      </Text>
                      {log.level === 'error' && <IconAlertCircle size={16} color="red" />}
                      {log.level === 'success' && <IconCheck size={16} color="green" />}
                    </Group>
                  </Paper>
                ))
              )}
              <div ref={logsEndRef} />
            </Stack>
          </ScrollArea>
        </Stack>
      </Card>

      {/* Info Alert */}
      <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />}>
        <Text size="sm">
          <strong>How it works:</strong> The Smart Discovery uses an AI agent to browse the funder's website like a human researcher would. 
          It identifies grant opportunities, extracts structured data (deadlines, amounts, eligibility), and scores them for relevance to the Odyssean Institute.
          Opportunities appear directly in the Opportunities tab after extraction.
        </Text>
      </Alert>
    </Stack>
  );
}
