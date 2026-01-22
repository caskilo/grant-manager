import { Container, Title, Text, Paper, Stack, Group, Badge, Button, Textarea, Anchor, Divider, Grid, Card, Tabs, Progress, ThemeIcon } from '@mantine/core';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { IconArrowLeft, IconExternalLink, IconDeviceFloppy, IconInfoCircle, IconSparkles, IconChartBar, IconTarget } from '@tabler/icons-react';
import api from '../lib/api';

const getCatalogueType = (tags: string[]): string | null => {
  const catalogueTypeTag = tags.find(tag => tag.startsWith('CATALOGUE_TYPE:'));
  return catalogueTypeTag ? catalogueTypeTag.replace('CATALOGUE_TYPE:', '') : null;
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

  const { data: funder, isLoading } = useQuery<FunderDetail>({
    queryKey: ['funder', id],
    queryFn: async () => {
      const response = await api.get(`/funders/${id}`);
      return response.data;
    },
  });

  useEffect(() => {
    if (funder?.notes) {
      setNotes(funder.notes);
    }
  }, [funder?.notes]);

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      await api.patch(`/funders/${id}`, { notes: newNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funder', id] });
      queryClient.invalidateQueries({ queryKey: ['funders'] });
      setHasChanges(false);
    },
  });

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasChanges(value !== (funder?.notes || ''));
  };

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notes);
  };

  if (isLoading) {
    return (
      <Container size="xl">
        <Text>Loading...</Text>
      </Container>
    );
  }

  if (!funder) {
    return (
      <Container size="xl">
        <Text>Funder not found</Text>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/funders')}
            >
              Back to Funders
            </Button>
          </Group>
        </Group>

        <Paper p="lg" withBorder>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2}>{funder.name}</Title>
                {funder.websiteUrl && (
                  <Anchor 
                    href={funder.websiteUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    size="sm"
                    mt="xs"
                  >
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
                <Text size="sm" mt="xs">
                  {funder.geographies.length > 0 ? funder.geographies.join(', ') : '—'}
                </Text>
              </Grid.Col>
            </Grid>

            <div>
              <Text size="sm" fw={500} c="dimmed" mb="xs">Tags</Text>
              <Group gap="xs">
                {funder.tags.length > 0 ? (
                  funder.tags.map((tag, i) => (
                    <Badge key={i} size="sm" variant="dot">{tag}</Badge>
                  ))
                ) : (
                  <Text size="sm" c="dimmed">No tags</Text>
                )}
              </Group>
            </div>
          </Stack>
        </Paper>

        <Paper p="lg" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Notes</Title>
              {hasChanges && (
                <Button
                  size="xs"
                  leftSection={<IconDeviceFloppy size={14} />}
                  onClick={handleSaveNotes}
                  loading={updateNotesMutation.isPending}
                >
                  Save Changes
                </Button>
              )}
            </Group>
            <Textarea
              placeholder="Add notes, observations, or annotations about this funder..."
              value={notes}
              onChange={(e) => handleNotesChange(e.currentTarget.value)}
              minRows={6}
              autosize
            />
          </Stack>
        </Paper>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="opportunities" leftSection={<IconSparkles size={16} />}>
              Opportunities ({funder._count.opportunities})
            </Tabs.Tab>
            <Tabs.Tab value="statistics" leftSection={<IconChartBar size={16} />}>
              Statistics
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <Grid>
              <Grid.Col span={6}>
                <Card withBorder>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Title order={4}>Opportunities</Title>
                      <Badge>{funder._count.opportunities}</Badge>
                    </Group>
                    {funder.opportunities.length > 0 ? (
                      <Stack gap="xs">
                        {funder.opportunities.slice(0, 5).map((opp) => (
                          <Paper key={opp.id} p="xs" withBorder style={{ cursor: 'pointer' }} onClick={() => navigate(`/opportunities/${opp.id}`)}>
                            <Text size="sm" fw={500}>{opp.programName}</Text>
                            <Group gap="xs" mt={4}>
                              <Badge size="xs" variant="dot">{opp.status}</Badge>
                              {opp.aiFitScore !== null && (
                                <Badge size="xs" color="blue">{Math.round(opp.aiFitScore * 100)}% fit</Badge>
                              )}
                            </Group>
                          </Paper>
                        ))}
                        {funder.opportunities.length > 5 && (
                          <Text size="xs" c="dimmed">+ {funder.opportunities.length - 5} more</Text>
                        )}
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">No opportunities yet</Text>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={6}>
                <Card withBorder>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Title order={4}>Harvest Sources</Title>
                      <Badge>{funder.harvestSources.length}</Badge>
                    </Group>
                    {funder.harvestSources.length > 0 ? (
                      <Stack gap="xs">
                        {funder.harvestSources.map((source) => (
                          <Paper key={source.id} p="xs" withBorder>
                            <Text size="sm" fw={500}>{source.name}</Text>
                            <Text size="xs" c="dimmed">{source.baseUrl}</Text>
                            <Group gap="xs" mt={4}>
                              <Badge size="xs" color={source.enabled ? 'green' : 'gray'}>
                                {source.enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                              {source.lastSuccessAt && (
                                <Text size="xs" c="dimmed">
                                  Last: {new Date(source.lastSuccessAt).toLocaleDateString()}
                                </Text>
                              )}
                            </Group>
                          </Paper>
                        ))}
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">No harvest sources configured</Text>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="opportunities" pt="md">
            <Stack gap="md">
              {funder.opportunities.length > 0 ? (
                funder.opportunities.map((opp) => {
                  const alignmentScore = opp.tags?.find(t => t.startsWith('alignment:'))?.match(/alignment:(\d+)%/)?.[1];
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
                                Fit: {opp.aiFitScore.toFixed(1)}/10
                              </Badge>
                            )}
                            {alignmentScore && (
                              <Badge size="sm" color={parseInt(alignmentScore) >= 70 ? 'green' : parseInt(alignmentScore) >= 50 ? 'blue' : 'gray'}>
                                {alignmentScore}% Match
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
                  <Text ta="center" c="dimmed">No opportunities found for this funder</Text>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="statistics" pt="md">
            <Grid>
              <Grid.Col span={6}>
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={4}>Fit Score Distribution</Title>
                      <ThemeIcon size="lg" variant="light" color="blue">
                        <IconTarget size={20} />
                      </ThemeIcon>
                    </Group>
                    {(() => {
                      const scores = funder.opportunities
                        .map(opp => opp.aiFitScore)
                        .filter((score): score is number => score !== null);
                      
                      if (scores.length === 0) {
                        return <Text size="sm" c="dimmed">No scored opportunities yet</Text>;
                      }
                      
                      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
                      const highFit = scores.filter(s => s >= 7).length;
                      const mediumFit = scores.filter(s => s >= 4 && s < 7).length;
                      const lowFit = scores.filter(s => s < 4).length;
                      
                      return (
                        <Stack gap="md">
                          <div>
                            <Group justify="space-between" mb="xs">
                              <Text size="sm" fw={500}>Average Fit Score</Text>
                              <Text size="sm" fw={600} c={avgScore >= 7 ? 'green' : avgScore >= 4 ? 'yellow' : 'gray'}>
                                {avgScore.toFixed(1)}/10
                              </Text>
                            </Group>
                            <Progress value={avgScore * 10} color={avgScore >= 7 ? 'green' : avgScore >= 4 ? 'yellow' : 'gray'} />
                          </div>
                          
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Text size="sm">High Fit (7-10)</Text>
                              <Badge color="green">{highFit}</Badge>
                            </Group>
                            <Group justify="space-between">
                              <Text size="sm">Medium Fit (4-6)</Text>
                              <Badge color="yellow">{mediumFit}</Badge>
                            </Group>
                            <Group justify="space-between">
                              <Text size="sm">Low Fit (0-3)</Text>
                              <Badge color="gray">{lowFit}</Badge>
                            </Group>
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
                      <ThemeIcon size="lg" variant="light" color="violet">
                        <IconSparkles size={20} />
                      </ThemeIcon>
                    </Group>
                    {(() => {
                      const alignmentScores = funder.opportunities
                        .flatMap(opp => opp.tags || [])
                        .filter(tag => tag.startsWith('alignment:'))
                        .map(tag => {
                          const match = tag.match(/alignment:(\d+)%/);
                          return match ? parseInt(match[1], 10) : null;
                        })
                        .filter((score): score is number => score !== null);
                      
                      if (alignmentScores.length === 0) {
                        return <Text size="sm" c="dimmed">No alignment data available</Text>;
                      }
                      
                      const avgAlignment = alignmentScores.reduce((sum, s) => sum + s, 0) / alignmentScores.length;
                      const highAlignment = alignmentScores.filter(s => s >= 70).length;
                      const mediumAlignment = alignmentScores.filter(s => s >= 50 && s < 70).length;
                      const lowAlignment = alignmentScores.filter(s => s < 50).length;
                      
                      return (
                        <Stack gap="md">
                          <div>
                            <Group justify="space-between" mb="xs">
                              <Text size="sm" fw={500}>Average Alignment</Text>
                              <Text size="sm" fw={600} c={avgAlignment >= 70 ? 'green' : avgAlignment >= 50 ? 'blue' : 'gray'}>
                                {Math.round(avgAlignment)}%
                              </Text>
                            </Group>
                            <Progress value={avgAlignment} color={avgAlignment >= 70 ? 'green' : avgAlignment >= 50 ? 'blue' : 'gray'} />
                          </div>
                          
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Text size="sm">High Alignment (70%+)</Text>
                              <Badge color="green">{highAlignment}</Badge>
                            </Group>
                            <Group justify="space-between">
                              <Text size="sm">Medium Alignment (50-69%)</Text>
                              <Badge color="blue">{mediumAlignment}</Badge>
                            </Group>
                            <Group justify="space-between">
                              <Text size="sm">Low Alignment (0-49%)</Text>
                              <Badge color="gray">{lowAlignment}</Badge>
                            </Group>
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
