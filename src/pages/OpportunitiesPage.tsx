import { Container, Title, Button, Group, Stack, Badge, Text, Anchor, Tooltip, Paper, Accordion, ThemeIcon, Loader, Center, TextInput, Select } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IconExternalLink, IconCalendar, IconCoins, IconBuildingBank, IconSparkles, IconTarget, IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import api from '../lib/api';

interface Opportunity {
  id: string;
  programName: string;
  description: string | null;
  sourceUrl: string;
  status: string;
  deadline: string | null;
  geographies: string[];
  minAward: number | null;
  maxAward: number | null;
  currency: string | null;
  aiFitScore: number | null;
  aiFitReasons: string[];
  tags: string[];
  funder: {
    id: string;
    name: string;
    websiteUrl: string | null;
  } | null;
}

interface GroupedOpportunities {
  [funderName: string]: {
    funderId: string | null;
    funderUrl: string | null;
    opportunities: Opportunity[];
  };
}

export default function OpportunitiesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [alignmentFilter, setAlignmentFilter] = useState<string | null>(null);
  const [amountFilter, setAmountFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: Opportunity[] }>({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const response = await api.get('/opportunities', {
        params: {
          page: 1,
          limit: 500,
        },
      });
      return response.data;
    },
  });

  // Filter and group opportunities by funder
  const groupedOpportunities = useMemo<GroupedOpportunities>(() => {
    if (!data?.data) return {};

    // Helper function to extract alignment score
    const extractAlignmentScore = (tags: string[]): number | null => {
      const alignmentTag = tags.find(t => t.startsWith('alignment:'));
      if (alignmentTag) {
        const match = alignmentTag.match(/alignment:(\d+)%/);
        return match ? parseInt(match[1], 10) : null;
      }
      return null;
    };

    // Filter out 'general' placeholder opportunities and apply search/filters
    const filtered = data.data.filter(opp => {
      // Remove 'general' placeholder opportunities
      if (opp.programName.toLowerCase().includes('general funding')) {
        return false;
      }

      // Apply search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!opp.programName.toLowerCase().includes(query) &&
            !opp.description?.toLowerCase().includes(query) &&
            !opp.funder?.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Apply alignment filter
      if (alignmentFilter) {
        const alignmentScore = extractAlignmentScore(opp.tags || []);
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
          funderUrl: opp.funder?.websiteUrl || null,
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

  const totalOpportunities = data?.data?.length || 0;

  // Helper functions for alignment scores
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

  const filteredTotal = Object.values(groupedOpportunities).reduce(
    (sum, group) => sum + group.opportunities.length,
    0
  );

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1}>Grant Opportunities</Title>
            <Text size="sm" c="dimmed" mt={4}>
              {filteredTotal} of {totalOpportunities} opportunities from {Object.keys(groupedOpportunities).length} funders
            </Text>
          </div>
          <Button onClick={() => navigate('/opportunities/new')}>Add Opportunity</Button>
        </Group>

        {/* Search and Filter Bar */}
        <Paper p="md" withBorder>
          <Stack gap="md">
            <TextInput
              placeholder="Search opportunities by name, description, or funder..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />
            <Group gap="md">
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
        ) : (
          <Accordion multiple variant="separated" defaultValue={sortedFunders.slice(0, 3).map(([name]) => name)}>
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
                    {group.funderId && (
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/funders/${group.funderId}`);
                        }}
                      >
                        View Funder
                      </Button>
                    )}
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

                      const deadlineDate = opp.deadline ? new Date(opp.deadline) : null;
                      const isDeadlineSoon = deadlineDate && deadlineDate.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

                      return (
                        <Paper
                          key={opp.id}
                          p="md"
                          withBorder
                          style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                          onClick={() => navigate(`/opportunities/${opp.id}`)}
                          className="hover-lift"
                        >
                          <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <Stack gap="xs" style={{ flex: 1 }}>
                              <Group gap="xs">
                                <Text fw={600} size="md">{opp.programName}</Text>
                                {hasValidScore && scoreNumber >= 7 && (
                                  <Tooltip label="High fit score">
                                    <ThemeIcon size="sm" color="green" variant="light">
                                      <IconSparkles size={12} />
                                    </ThemeIcon>
                                  </Tooltip>
                                )}
                              </Group>

                              {opp.description && (
                                <Text size="sm" c="dimmed" lineClamp={2}>
                                  {opp.description}
                                </Text>
                              )}

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
                              </Group>

                              <Group gap="xs">
                                <Badge size="xs" variant="light" color="gray">
                                  {opp.status}
                                </Badge>
                                {isHarvest && <Badge size="xs" color="violet">Harvest</Badge>}
                                {isDiscovery && <Badge size="xs" color="blue">Discovery</Badge>}
                                
                                {/* Show alignment score if available (from LLM harvest) */}
                                {hasAlignment && alignmentScore !== null && (
                                  <Tooltip label={`Odyssean Alignment: ${alignmentScore}%`}>
                                    <Badge
                                      size="xs"
                                      color={getAlignmentColor(alignmentScore)}
                                      variant="filled"
                                      leftSection={<IconTarget size={10} />}
                                    >
                                      {alignmentScore}% Match
                                    </Badge>
                                  </Tooltip>
                                )}
                                
                                {/* Show recommendation badge */}
                                {recommendation && (
                                  <Badge
                                    size="xs"
                                    color={getRecommendationColor(recommendation)}
                                    variant="light"
                                  >
                                    {formatRecommendation(recommendation)}
                                  </Badge>
                                )}
                                
                                {/* Show matched strands */}
                                {matchedStrands.length > 0 && (
                                  <Tooltip label={`Research Strands: ${matchedStrands.join(', ')}`}>
                                    <Badge size="xs" variant="dot" color="indigo">
                                      {matchedStrands.length} {matchedStrands.length === 1 ? 'Strand' : 'Strands'}
                                    </Badge>
                                  </Tooltip>
                                )}
                                
                                {/* Fallback to old fit score if no alignment data */}
                                {!hasAlignment && hasValidScore && (
                                  <Badge
                                    size="xs"
                                    color={scoreNumber >= 7 ? 'green' : scoreNumber >= 4 ? 'yellow' : 'gray'}
                                  >
                                    Fit: {Math.round(scoreNumber * 10) / 10}/10
                                  </Badge>
                                )}
                              </Group>

                              <Anchor
                                href={opp.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Group gap={4}>
                                  <Text size="xs">View Source</Text>
                                  <IconExternalLink size={10} />
                                </Group>
                              </Anchor>
                            </Stack>

                            <Button
                              size="sm"
                              variant="light"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/opportunities/${opp.id}`);
                              }}
                            >
                              Details
                            </Button>
                          </Group>
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
    </Container>
  );
}
