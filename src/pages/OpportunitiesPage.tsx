import { Container, Title, Button, Group, Stack, Badge, Text, Anchor, Tooltip, Paper, Accordion, ThemeIcon, Loader, Center, TextInput, Select, Modal, Textarea, ActionIcon, Switch, Grid } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IconCalendar, IconCoins, IconBuildingBank, IconSparkles, IconTarget, IconSearch, IconPlus, IconStar, IconStarFilled } from '@tabler/icons-react';
import { useMemo, useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import api from '../lib/api';

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
  status: string;
  deadlines: DeadlineEntry[] | string[];
  geographies: string[];
  eligibleApplicantTypes: string[];
  processSteps: string[];
  minAward: number | null;
  maxAward: number | null;
  currency: string | null;
  aiFitScore: number | null;
  aiFitReasons: string[];
  aiRecommendedAction: string | null;
  tags: string[];
  funder: {
    id: string;
    name: string;
    type: string;
  } | null;
  isFavourite?: boolean;
  isStruckOff?: boolean;
  strikeOffReason?: string | null;
}

const CLOSING_TYPES = new Set(['deadline', 'closing', 'close']);

/** Extract the closing deadline date, ignoring opening/decision entries */
function getDeadlineDate(deadlines: DeadlineEntry[] | string[] | null): Date | null {
  if (!deadlines || !Array.isArray(deadlines) || deadlines.length === 0) return null;
  const typed = (deadlines as DeadlineEntry[]).filter(
    d => typeof d === 'object' && d?.type && CLOSING_TYPES.has(d.type.toLowerCase())
  );
  const candidate = typed.length > 0 ? typed[0] : (
    (deadlines as DeadlineEntry[]).find(d => typeof d === 'object' && !d?.type)
    ?? (typeof deadlines[0] === 'string' ? deadlines[0] : null)
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

interface GroupedOpportunities {
  [funderName: string]: {
    funderId: string | null;
    opportunities: Opportunity[];
  };
}

const STORAGE_KEY = 'opportunities-accordion-state';

interface FunderOption {
  id: string;
  name: string;
}

export default function OpportunitiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Add Opportunity modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newOpp, setNewOpp] = useState({ funderId: '', programName: '', sourceUrl: '', description: '', applicationType: 'OPEN' });

  const { data: funderOptions } = useQuery<{ data: FunderOption[] }>({
    queryKey: ['funders-select'],
    queryFn: async () => {
      const response = await api.get('/funders', { params: { page: 1, limit: 500 } });
      return response.data;
    },
    enabled: addModalOpen,
  });

  const createOppMutation = useMutation({
    mutationFn: async (data: typeof newOpp) => {
      return api.post('/opportunities', data);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setAddModalOpen(false);
      setNewOpp({ funderId: '', programName: '', sourceUrl: '', description: '', applicationType: 'OPEN' });
      navigate(`/opportunities/${res.data.id}`);
    },
  });

  // ── Favourite / Hide ──
  const [showHidden, setShowHidden] = useState<boolean>(() => {
    try { return localStorage.getItem('opportunities-show-hidden') === '1'; } catch { return false; }
  });
  const [hideTarget, setHideTarget] = useState<Opportunity | null>(null);
  const [hideReasonPreset, setHideReasonPreset] = useState<string | null>(null);
  const [hideReasonCustom, setHideReasonCustom] = useState('');

  const favouriteMutation = useMutation({
    mutationFn: async ({ id, isFavourite }: { id: string; isFavourite: boolean }) => {
      return api.patch(`/opportunities/${id}/favourite`, { isFavourite });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
  });

  const hideMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return api.post(`/opportunities/${id}/strike-off`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setHideTarget(null);
      setHideReasonPreset(null);
      setHideReasonCustom('');
      notifications.show({ color: 'gray', title: 'Hidden', message: 'Opportunity hidden from the main list.' });
    },
    onError: (err: any) => {
      notifications.show({ color: 'red', title: 'Failed to hide', message: err?.response?.data?.message || err?.message || 'Unknown error' });
    },
  });

  const unHideMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/opportunities/${id}/unstrike-off`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      notifications.show({ color: 'teal', title: 'Restored', message: 'Opportunity is back on the main list.' });
    },
  });
  const handleShowHiddenChange = useCallback((next: boolean) => {
    setShowHidden(next);
    try { localStorage.setItem('opportunities-show-hidden', next ? '1' : '0'); } catch {}
  }, []);
  // ── Helper functions (must be defined before useMemos that reference them) ──
  const extractAlignmentScore = (tags: string[]): number | null => {
    const alignmentTag = tags.find(t => t.startsWith('alignment:'));
    if (alignmentTag) {
      const match = alignmentTag.match(/alignment:(\d+)%/);
      return match ? parseInt(match[1], 10) : null;
    }
    return null;
  };

  const extractRecommendation = (tags: string[]): string | null => {
    const recTag = tags.find(t => t.startsWith('recommendation:'));
    return recTag ? recTag.replace('recommendation:', '') : null;
  };

  const extractMatchedStrands = (tags: string[]): string[] => {
    return tags
      .filter(t => t.startsWith('strand:'))
      .map(t => t.replace('strand:', '').replace(/_/g, ' '));
  };

  const getAlignmentColor = (score: number): string => {
    if (score >= 70) return 'green';
    if (score >= 50) return 'blue';
    if (score >= 30) return 'yellow';
    return 'gray';
  };

  const getRecommendationColor = (rec: string): string => {
    if (rec === 'highly_relevant') return 'green';
    if (rec === 'relevant') return 'blue';
    if (rec === 'somewhat_relevant') return 'yellow';
    return 'gray';
  };

  const formatRecommendation = (rec: string): string => {
    return rec.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [alignmentFilter, setAlignmentFilter] = useState<string | null>(null);
  const [amountFilter, setAmountFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | null>(() => {
    try { return localStorage.getItem('opportunities-sort-by'); } catch { return null; }
  });
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>(() => {
    try { return (localStorage.getItem('opportunities-view-mode') as 'grouped' | 'flat') || 'grouped'; } catch { return 'grouped'; }
  });
  
  // Load accordion state from localStorage
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save accordion state to localStorage whenever it changes
  const handleAccordionChange = (value: string[]) => {
    setExpandedGroups(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleSortChange = useCallback((value: string | null) => {
    setSortBy(value);
    try { if (value) localStorage.setItem('opportunities-sort-by', value); else localStorage.removeItem('opportunities-sort-by'); } catch {}
  }, []);

  const handleViewModeChange = useCallback((mode: 'grouped' | 'flat') => {
    setViewMode(mode);
    try { localStorage.setItem('opportunities-view-mode', mode); } catch {}
  }, []);

  const { data, isLoading } = useQuery<{ data: Opportunity[] }>({
    queryKey: ['opportunities', { showHidden }],
    queryFn: async () => {
      const response = await api.get('/opportunities', {
        params: {
          page: 1,
          limit: 500,
          ...(showHidden ? { includeStruckOff: true } : {}),
        },
      });
      return response.data;
    },
  });

  // Filter and group opportunities by funder
  const groupedOpportunities = useMemo<GroupedOpportunities>(() => {
    if (!data?.data) return {};

    // Apply search/filters
    const filtered = data.data.filter(opp => {
      // Apply search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!opp.programName.toLowerCase().includes(query) &&
            !opp.description?.toLowerCase().includes(query) &&
            !opp.funder?.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Apply alignment filter — prefer the alignment:XX% tag, fall back to aiFitScore (0-10 → ×10 = percent)
      if (alignmentFilter) {
        const tagScore = extractAlignmentScore(opp.tags || []);
        const fitScore = opp.aiFitScore != null ? Number(opp.aiFitScore) * 10 : null;
        const alignmentScore = tagScore ?? fitScore;
        if (alignmentScore === null) return false;

        if (alignmentFilter === 'high' && alignmentScore < 70) return false;
        if (alignmentFilter === 'medium' && (alignmentScore < 50 || alignmentScore >= 70)) return false;
        if (alignmentFilter === 'low' && alignmentScore >= 50) return false;
      }

      // Apply amount filter
      if (amountFilter) {
        const maxAward = opp.maxAward || 0;
        if (amountFilter === 'large' && maxAward < 1000000) return false;
        if (amountFilter === 'medium' && (maxAward < 100000 || maxAward >= 1000000)) return false;
        if (amountFilter === 'small' && maxAward >= 100000) return false;
      }

      return true;
    });

    return filtered.reduce((acc, opp) => {
      const funderName = opp.funder?.name || 'Unknown Funder';
      if (!acc[funderName]) {
        acc[funderName] = {
          funderId: opp.funder?.id || null,
          opportunities: [],
        };
      }
      acc[funderName].opportunities.push(opp);
      return acc;
    }, {} as GroupedOpportunities);
  }, [data, searchQuery, alignmentFilter, amountFilter]);

  // Sort funders by opportunity count
  const sortedFunders = useMemo(() => {
    return Object.entries(groupedOpportunities).sort(
      ([, a], [, b]) => b.opportunities.length - a.opportunities.length
    );
  }, [groupedOpportunities]);

  // Flat sorted list of all filtered opportunities
  const flatSortedOpportunities = useMemo(() => {
    const allOpps = Object.values(groupedOpportunities).flatMap(g => g.opportunities);
    const getSort = (opp: Opportunity): number => {
      if (sortBy === 'fit-desc' || sortBy === 'fit-asc') {
        const alignment = extractAlignmentScore(opp.tags || []);
        if (alignment !== null) return alignment;
        if (opp.aiFitScore !== null) return Number(opp.aiFitScore) * 10;
        return -1;
      }
      if (sortBy === 'deadline') {
        const d = getDeadlineDate(opp.deadlines);
        return d ? d.getTime() : Infinity;
      }
      if (sortBy === 'amount-desc') return opp.maxAward || 0;
      return 0;
    };
    return [...allOpps].sort((a, b) => {
      // Favourites always pinned to the top regardless of sort mode
      if (!!a.isFavourite !== !!b.isFavourite) return a.isFavourite ? -1 : 1;
      const sa = getSort(a);
      const sb = getSort(b);
      if (sortBy === 'fit-asc') return sa - sb;
      if (sortBy === 'deadline') return sa - sb;
      return sb - sa; // desc by default
    });
  }, [groupedOpportunities, sortBy]);

  const totalOpportunities = data?.data?.length || 0;

  const filteredTotal = Object.values(groupedOpportunities).reduce(
    (sum, group) => sum + group.opportunities.length,
    0
  );

  return (
    <Container size="xl">
      <Stack gap="lg">
        <div>
          <Group justify="space-between" align="flex-end">
            <Title order={1}>Grant Opportunities</Title>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setAddModalOpen(true)}>Add Opportunity</Button>
          </Group>
          <Text size="sm" c="dimmed" mt={4}>
            {filteredTotal} of {totalOpportunities} opportunities from {Object.keys(groupedOpportunities).length} funders
          </Text>
        </div>

        {/* Search and Filter Bar */}
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Group gap="sm" align="center">
              <TextInput
                placeholder="Search opportunities by name, description, or funder..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Tooltip label="Show hidden opportunities">
                <Switch
                  checked={showHidden}
                  onChange={(e) => handleShowHiddenChange(e.currentTarget.checked)}
                />
              </Tooltip>
            </Group>
            <Group gap="md">
              <Select
                label="Sort By"
                placeholder="Default"
                data={[
                  { value: 'fit-desc', label: 'Fit Score (High to Low)' },
                  { value: 'fit-asc', label: 'Fit Score (Low to High)' },
                  { value: 'deadline', label: 'Deadline (Soonest)' },
                  { value: 'amount-desc', label: 'Award Amount (Highest)' },
                ]}
                value={sortBy}
                onChange={handleSortChange}
                clearable
                style={{ flex: 1 }}
              />
              <Select
                label="Alignment Match"
                placeholder="All"
                data={[
                  { value: 'high', label: 'High (70%+)' },
                  { value: 'medium', label: 'Medium (50-69%)' },
                  { value: 'low', label: 'Low (0-49%)' },
                ]}
                value={alignmentFilter}
                onChange={setAlignmentFilter}
                clearable
                searchable
                style={{ flex: 1 }}
              />
              <Select
                label="Award Amount"
                placeholder="All"
                data={[
                  { value: 'large', label: 'Large (£1M+)' },
                  { value: 'medium', label: 'Medium (£100k-£1M)' },
                  { value: 'small', label: 'Small (<£100k)' },
                ]}
                value={amountFilter}
                onChange={setAmountFilter}
                clearable
                searchable
                style={{ flex: 1 }}
              />
              <Select
                label="View"
                placeholder="Grouped"
                data={[
                  { value: 'grouped', label: 'Group by Funder' },
                  { value: 'flat', label: 'Flat List' },
                ]}
                value={viewMode}
                onChange={(v) => handleViewModeChange((v as 'grouped' | 'flat') || 'grouped')}
                style={{ flex: 1 }}
              />
            </Group>
          </Stack>
        </Paper>

        {isLoading ? (
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        ) : totalOpportunities === 0 ? (
          <Paper p="xl" withBorder>
            <Stack align="center" gap="md">
              <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                <IconBuildingBank size={30} />
              </ThemeIcon>
              <Text size="lg" fw={500}>No Opportunities Found</Text>
              <Text size="sm" c="dimmed" ta="center" maw={400}>
                Start by running a harvest on funders or importing from the catalogue discovery.
              </Text>
              <Button onClick={() => navigate('/funders')}>Go to Funders</Button>
            </Stack>
          </Paper>
        ) : viewMode === 'flat' ? (
          <Stack gap="md">
            {flatSortedOpportunities.map((opp) => {
              const rawScore = opp.aiFitScore;
              const scoreNumber = typeof rawScore === 'number' ? rawScore : rawScore != null ? Number(rawScore) : null;
              const hasValidScore = typeof scoreNumber === 'number' && !Number.isNaN(scoreNumber);
              const isHarvest = opp.tags?.some(tag => tag === 'HARVEST');
              const isDiscovery = opp.tags?.some(tag => tag.includes('DISCOVERY'));
              const alignmentScore = extractAlignmentScore(opp.tags || []);
              const recommendation = extractRecommendation(opp.tags || []);
              const matchedStrands = extractMatchedStrands(opp.tags || []);
              const hasAlignment = alignmentScore !== null;
              const awardRange = opp.minAward && opp.maxAward
                ? `${opp.currency || ''}${opp.minAward.toLocaleString()}-${opp.maxAward.toLocaleString()}`
                : opp.maxAward ? `Up to ${opp.currency || ''}${opp.maxAward.toLocaleString()}`
                : opp.minAward ? `${opp.currency || ''}${opp.minAward.toLocaleString()}+` : null;
              const deadlineDate = getDeadlineDate(opp.deadlines);
              const isDeadlineSoon = deadlineDate && deadlineDate.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
              return (
                <Paper
                  key={opp.id}
                  p="md"
                  withBorder
                  data-testid="opportunity-card"
                  style={{
                    transition: 'all 0.2s',
                    opacity: opp.isStruckOff ? 0.55 : 1,
                    backgroundColor: opp.isStruckOff ? 'var(--mantine-color-gray-0)' : undefined,
                  }}
                  className="hover-lift"
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Group gap="xs">
                        <Tooltip label={opp.isFavourite ? 'Unstar' : 'Star to pin to top'}>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color={opp.isFavourite ? 'yellow' : 'gray'}
                            onClick={(e) => { e.stopPropagation(); favouriteMutation.mutate({ id: opp.id, isFavourite: !opp.isFavourite }); }}
                          >
                            {opp.isFavourite ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                          </ActionIcon>
                        </Tooltip>
                        <Text
                          fw={600} size="md"
                          onClick={() => navigate(`/opportunities/${opp.id}`)}
                          style={{ cursor: 'pointer', display: 'inline-block', padding: '2px 8px', marginLeft: -4, borderRadius: 6, backgroundColor: 'var(--mantine-color-blue-0)', transition: 'background-color 150ms', textDecoration: opp.isStruckOff ? 'line-through' : undefined }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--mantine-color-blue-1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--mantine-color-blue-0)'; }}
                        >{opp.programName}</Text>
                        {hasValidScore && scoreNumber >= 7 && (
                          <Tooltip label="High fit score"><ThemeIcon size="sm" color="green" variant="light"><IconSparkles size={12} /></ThemeIcon></Tooltip>
                        )}
                        {opp.isStruckOff && (
                          <Tooltip label={opp.strikeOffReason || 'Hidden'}>
                            <Badge size="xs" color="gray" variant="outline">{opp.strikeOffReason || 'Hidden'}</Badge>
                          </Tooltip>
                        )}
                      </Group>
                      {opp.funder && <Text size="xs" c="dimmed">{opp.funder.name}</Text>}
                      {opp.description && <Text size="sm" c="dimmed" lineClamp={2}>{opp.description}</Text>}
                      <Group gap="lg">
                        {deadlineDate && (
                          <Group gap={6}><ThemeIcon size="sm" variant="light" color={isDeadlineSoon ? 'orange' : 'blue'}><IconCalendar size={14} /></ThemeIcon><Text size="sm" c={isDeadlineSoon ? 'orange' : undefined}>{deadlineDate.toLocaleDateString()}</Text></Group>
                        )}
                        {awardRange && (
                          <Group gap={6}><ThemeIcon size="sm" variant="light" color="teal"><IconCoins size={14} /></ThemeIcon><Text size="sm">{awardRange}</Text></Group>
                        )}
                        {opp.geographies && opp.geographies.length > 0 && (
                          <Badge size="sm" variant="light">{opp.geographies[0]}{opp.geographies.length > 1 && ` +${opp.geographies.length - 1}`}</Badge>
                        )}
                      </Group>
                      <Group gap="xs">
                        <Badge size="xs" variant="light" color="gray">{opp.status}</Badge>
                        {isHarvest && <Badge size="xs" color="violet">Harvest</Badge>}
                        {isDiscovery && <Badge size="xs" color="blue">Discovery</Badge>}
                        {hasAlignment && alignmentScore !== null && (
                          <Tooltip label={`Odyssean Alignment: ${alignmentScore}%`}><Badge size="xs" color={getAlignmentColor(alignmentScore)} variant="filled" leftSection={<IconTarget size={10} />}>{alignmentScore}% Match</Badge></Tooltip>
                        )}
                        {recommendation && <Badge size="xs" color={getRecommendationColor(recommendation)} variant="light">{formatRecommendation(recommendation)}</Badge>}
                        {matchedStrands.length > 0 && (
                          <Tooltip label={`Research Strands: ${matchedStrands.join(', ')}`}><Badge size="xs" variant="dot" color="indigo">{matchedStrands.length} {matchedStrands.length === 1 ? 'Strand' : 'Strands'}</Badge></Tooltip>
                        )}
                        {!hasAlignment && hasValidScore && (
                          <Badge size="xs" color={scoreNumber >= 7 ? 'green' : scoreNumber >= 4 ? 'yellow' : 'gray'}>Fit: {Math.round(scoreNumber * 10) / 10}/10</Badge>
                        )}
                      </Group>
                    </Stack>
                    <Stack gap={4} align="flex-end">
                      <Button size="sm" variant="light" onClick={(e) => { e.stopPropagation(); navigate(`/opportunities/${opp.id}`); }}>Details</Button>
                      {opp.isStruckOff ? (
                        <Button size="xs" variant="subtle" color="teal" onClick={(e) => { e.stopPropagation(); unHideMutation.mutate(opp.id); }}>
                          Show
                        </Button>
                      ) : (
                        <Tooltip label="hide with a reason">
                          <Button size="xs" variant="subtle" color="red" onClick={(e) => { e.stopPropagation(); setHideTarget(opp); setHideReasonPreset(null); setHideReasonCustom(''); }}>
                            Hide
                          </Button>
                        </Tooltip>
                      )}
                    </Stack>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <Accordion multiple variant="separated" value={expandedGroups} onChange={handleAccordionChange}>
            {sortedFunders.map(([funderName, group]) => (
              <Accordion.Item key={funderName} value={funderName}>
                <Accordion.Control>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="md">
                      <ThemeIcon size={40} radius="md" variant="light" color="blue">
                        <IconBuildingBank size={20} />
                      </ThemeIcon>
                      <div>
                        <Text fw={600} size="md">{funderName}</Text>
                        <Text size="xs" c="dimmed">
                          {group.opportunities.length} {group.opportunities.length === 1 ? 'opportunity' : 'opportunities'}
                        </Text>
                      </div>
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    {group.opportunities.map((opp) => {
                      const rawScore = opp.aiFitScore;
                      const scoreNumber =
                        typeof rawScore === 'number'
                          ? rawScore
                          : rawScore != null
                          ? Number(rawScore)
                          : null;

                      const hasValidScore = typeof scoreNumber === 'number' && !Number.isNaN(scoreNumber);
                      const isHarvest = opp.tags?.some(tag => tag === 'HARVEST');
                      const isDiscovery = opp.tags?.some(tag => tag.includes('DISCOVERY'));
                      
                      // Extract alignment data from tags
                      const alignmentScore = extractAlignmentScore(opp.tags || []);
                      const recommendation = extractRecommendation(opp.tags || []);
                      const matchedStrands = extractMatchedStrands(opp.tags || []);
                      const hasAlignment = alignmentScore !== null;

                      const awardRange = opp.minAward && opp.maxAward
                        ? `${opp.currency || ''}${opp.minAward.toLocaleString()}-${opp.maxAward.toLocaleString()}`
                        : opp.maxAward
                        ? `Up to ${opp.currency || ''}${opp.maxAward.toLocaleString()}`
                        : opp.minAward
                        ? `${opp.currency || ''}${opp.minAward.toLocaleString()}+`
                        : null;

                      const deadlineDate = getDeadlineDate(opp.deadlines);
                      const isDeadlineSoon = deadlineDate && deadlineDate.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

                      return (
                        <Paper
                          key={opp.id}
                          p="md"
                          withBorder
                          data-testid="opportunity-card"
                          style={{
                            transition: 'all 0.2s',
                            opacity: opp.isStruckOff ? 0.55 : 1,
                            backgroundColor: opp.isStruckOff ? 'var(--mantine-color-gray-0)' : undefined,
                          }}
                          className="hover-lift"
                        >
                          <Grid gutter="xs">
                            {/* Row 0: Title and status badge */}
                            <Grid.Col span={12}>
                              <Group gap="xs" align="flex-start">
                                <Tooltip label={opp.isFavourite ? 'Unstar' : 'Star to pin to top'}>
                                  <ActionIcon
                                    size="sm"
                                    variant="subtle"
                                    color={opp.isFavourite ? 'yellow' : 'gray'}
                                    onClick={(e) => { e.stopPropagation(); favouriteMutation.mutate({ id: opp.id, isFavourite: !opp.isFavourite }); }}
                                  >
                                    {opp.isFavourite ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                                  </ActionIcon>
                                </Tooltip>
                                <Text
                                  fw={600} size="md"
                                  onClick={() => navigate(`/opportunities/${opp.id}`)}
                                  style={{ cursor: 'pointer', display: 'inline-block', padding: '2px 8px', marginLeft: -4, borderRadius: 6, backgroundColor: 'var(--mantine-color-blue-0)', transition: 'background-color 150ms', textDecoration: opp.isStruckOff ? 'line-through' : undefined }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--mantine-color-blue-1)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--mantine-color-blue-0)'; }}
                                >{opp.programName}</Text>
                                <Badge size="sm" variant="light" color="gray">{opp.status}</Badge>
                                {hasValidScore && scoreNumber >= 7 && (
                                  <Tooltip label="High fit score">
                                    <ThemeIcon size="sm" color="green" variant="light">
                                      <IconSparkles size={12} />
                                    </ThemeIcon>
                                  </Tooltip>
                                )}
                                {opp.isStruckOff && (
                                  <Tooltip label={opp.strikeOffReason || 'Hidden'}>
                                    <Badge size="xs" color="gray" variant="outline">{opp.strikeOffReason || 'Hidden'}</Badge>
                                  </Tooltip>
                                )}
                              </Group>
                            </Grid.Col>

                            {/* Row 1: Description/metadata (left) and buttons (right) */}
                            <Grid.Col span={10}>
                              <Stack gap="xs">
                                {/* Source badges */}
                                <Group gap="xs">
                                  {isHarvest && <Badge size="xs" color="violet">Harvest</Badge>}
                                  {isDiscovery && <Badge size="xs" color="blue">Discovery</Badge>}
                                  {hasAlignment && alignmentScore !== null && (
                                    <Tooltip label={`Odyssean Alignment: ${alignmentScore}%`}><Badge size="xs" color={getAlignmentColor(alignmentScore)} variant="filled" leftSection={<IconTarget size={10} />}>{alignmentScore}% Match</Badge></Tooltip>
                                  )}
                                  {recommendation && <Badge size="xs" color={getRecommendationColor(recommendation)} variant="light">{formatRecommendation(recommendation)}</Badge>}
                                  {matchedStrands.length > 0 && (
                                    <Tooltip label={`Research Strands: ${matchedStrands.join(', ')}`}><Badge size="xs" variant="dot" color="indigo">{matchedStrands.length} {matchedStrands.length === 1 ? 'Strand' : 'Strands'}</Badge></Tooltip>
                                  )}
                                  {!hasAlignment && hasValidScore && (
                                    <Badge size="xs" color={scoreNumber >= 7 ? 'green' : scoreNumber >= 4 ? 'yellow' : 'gray'}>Fit: {Math.round(scoreNumber * 10) / 10}/10</Badge>
                                  )}
                                </Group>

                                {/* Description */}
                                {opp.description && (
                                  <Text size="sm" c="dimmed" lineClamp={2}>
                                    {opp.description}
                                  </Text>
                                )}

                                {/* Metadata */}
                                <Group gap="lg">
                                  {deadlineDate && (
                                    <Group gap={6}>
                                      <ThemeIcon size="sm" variant="light" color={isDeadlineSoon ? 'orange' : 'blue'}>
                                        <IconCalendar size={14} />
                                      </ThemeIcon>
                                      <Text size="sm" c={isDeadlineSoon ? 'orange' : undefined}>
                                        {deadlineDate.toLocaleDateString()}
                                      </Text>
                                    </Group>
                                  )}

                                  {awardRange && (
                                    <Group gap={6}>
                                      <ThemeIcon size="sm" variant="light" color="teal">
                                        <IconCoins size={14} />
                                      </ThemeIcon>
                                      <Text size="sm">{awardRange}</Text>
                                    </Group>
                                  )}

                                  {opp.geographies && opp.geographies.length > 0 && (
                                    <Badge size="sm" variant="light">
                                      {opp.geographies[0]}
                                      {opp.geographies.length > 1 && ` +${opp.geographies.length - 1}`}
                                    </Badge>
                                  )}
                                  {group.funderId && (
                                    <Anchor
                                      size="xs"
                                      c="dimmed"
                                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/funders/${group.funderId}`); }}
                                      style={{ whiteSpace: 'nowrap' }}
                                    >
                                      Funder Page →
                                    </Anchor>
                                  )}
                                </Group>
                              </Stack>
                            </Grid.Col>

                            <Grid.Col span={2}>
                              <Stack gap={4} align="flex-end">
                                <Button size="sm" variant="light" onClick={(e) => { e.stopPropagation(); navigate(`/opportunities/${opp.id}`); }}>Details</Button>
                                {opp.isStruckOff ? (
                                  <Button size="xs" variant="subtle" color="teal" onClick={(e) => { e.stopPropagation(); unHideMutation.mutate(opp.id); }}>
                                    Show
                                  </Button>
                                ) : (
                                  <Tooltip label="hide with a reason">
                                    <Button size="xs" variant="subtle" color="red" onClick={(e) => { e.stopPropagation(); setHideTarget(opp); setHideReasonPreset(null); setHideReasonCustom(''); }}>
                                      Hide
                                    </Button>
                                  </Tooltip>
                                )}
                              </Stack>
                            </Grid.Col>
                          </Grid>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </Stack>

      <style>{`
        .hover-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      {/* Add Opportunity Modal */}
      <Modal opened={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Opportunity Manually" size="lg">
        <Stack gap="md">
          <Select
            label="Funder"
            placeholder="Select a funder (required)"
            required
            searchable
            data={(funderOptions?.data || []).map(f => ({ value: f.id, label: f.name }))}
            value={newOpp.funderId}
            onChange={(v) => setNewOpp({ ...newOpp, funderId: v || '' })}
          />
          <TextInput
            label="Program Name"
            placeholder="e.g. Open Research Fund 2025"
            required
            value={newOpp.programName}
            onChange={(e) => setNewOpp({ ...newOpp, programName: e.currentTarget.value })}
          />
          <TextInput
            label="Source URL"
            placeholder="https://funder.org/grants/programme"
            required
            value={newOpp.sourceUrl}
            onChange={(e) => setNewOpp({ ...newOpp, sourceUrl: e.currentTarget.value })}
          />
          <Textarea
            label="Description (optional)"
            placeholder="Brief description of the opportunity..."
            value={newOpp.description}
            onChange={(e) => setNewOpp({ ...newOpp, description: e.currentTarget.value })}
            minRows={2}
          />
          <Select
            label="Application Type"
            data={[
              { value: 'OPEN', label: 'Open' },
              { value: 'INVITED', label: 'Invited' },
              { value: 'ROLLING', label: 'Rolling' },
            ]}
            value={newOpp.applicationType}
            onChange={(v) => setNewOpp({ ...newOpp, applicationType: v || 'OPEN' })}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createOppMutation.mutate(newOpp)}
              loading={createOppMutation.isPending}
              disabled={!newOpp.funderId || !newOpp.programName || !newOpp.sourceUrl}
            >
              Create Opportunity
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hide Confirmation Modal */}
      <Modal
        opened={!!hideTarget}
        onClose={() => { setHideTarget(null); setHideReasonPreset(null); setHideReasonCustom(''); }}
        title="Hide opportunity"
        size="md"
      >
        {hideTarget && (
          <Stack gap="md">
            <Text size="sm">
              Hide <Text span fw={600}>{hideTarget.programName}</Text> from the main list.
              The record is preserved and can be restored later.
            </Text>
            <Select
              label="Reason"
              placeholder="Select a reason"
              data={[
                { value: 'Closed', label: 'Closed' },
                { value: 'Out of scope', label: 'Out of scope' },
                { value: 'Poor match', label: 'Poor match' },
                { value: 'Duplicate', label: 'Duplicate' },
                { value: 'Other', label: 'Other' },
              ]}
              value={hideReasonPreset}
              onChange={setHideReasonPreset}
              clearable
            />
            {hideReasonPreset === 'Other' && (
              <Textarea
                label="Custom reason"
                placeholder="Describe why you're hiding this opportunity..."
                value={hideReasonCustom}
                onChange={(e) => setHideReasonCustom(e.currentTarget.value)}
                minRows={2}
                autosize
              />
            )}
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => { setHideTarget(null); setHideReasonPreset(null); setHideReasonCustom(''); }}>Cancel</Button>
              <Button
                color="red"
                loading={hideMutation.isPending}
                disabled={!hideReasonPreset || (hideReasonPreset === 'Other' && !hideReasonCustom.trim())}
                onClick={() => {
                  const reason = hideReasonPreset === 'Other' ? hideReasonCustom.trim() : hideReasonPreset;
                  hideMutation.mutate({ id: hideTarget.id, reason: reason || '' });
                }}
              >
                Hide
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
