import { Container, Title, Text, Paper, Stack, Group, Badge, Button, Textarea, Anchor, Divider, Grid, Card, Tabs, ThemeIcon, Progress, Tooltip } from '@mantine/core';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { IconArrowLeft, IconExternalLink, IconDeviceFloppy, IconInfoCircle, IconSparkles, IconChartBar, IconTarget, IconWorldWww, IconFileText, IconTrash } from '@tabler/icons-react';
import api from '../lib/api';
import { harvestApi } from '../lib/harvest';
import SmartDiscoveryPanel from '../components/funder/SmartDiscoveryPanel';

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
    sourceUrl: string;
    applications?: Array<{
      id: string;
      title: string;
      stage: string;
      outcome: string;
      createdAt: string;
      updatedAt: string;
      leadOwner?: { id: string; name: string };
      _count?: { sections: number };
    }>;
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
  const [confirmingPurge, setConfirmingPurge] = useState(false);

  const purgeOpportunitiesMutation = useMutation({
    mutationFn: () => harvestApi.purgeOpportunities(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funder', id] });
      setConfirmingPurge(false);
    },
  });

  const { data: funder, isLoading } = useQuery<FunderDetail>({
    queryKey: ['funder', id],
    queryFn: async () => {
      const response = await api.get(`/funders/${id}`);
      return response.data;
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

  if (isLoading) {
    return <Container size="xl"><Text>Loading...</Text></Container>;
  }

  if (!funder) {
    return <Container size="xl"><Text>Funder not found</Text></Container>;
  }

  // Collect all applications across this funder's opportunities
  const funderApplications = funder.opportunities
    .filter(opp => opp.applications && opp.applications.length > 0)
    .map(opp => ({
      ...opp.applications![0],
      opportunityName: opp.programName,
      opportunityId: opp.id,
    }));

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/funders')} data-testid="back-to-funders">
            Back to Funders
          </Button>
        </Group>

        {/* Header Card */}
        <Paper p="lg" withBorder shadow="sm" style={{ background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.02) 0%, rgba(40, 116, 166, 0.03) 100%)' }}>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2} data-testid="funder-name" c="#1e3a5f">{funder.name}</Title>
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
        <Paper p="lg" withBorder shadow="sm" style={{ background: 'linear-gradient(135deg, rgba(44, 62, 80, 0.02) 0%, rgba(52, 73, 94, 0.03) 100%)' }}>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4} c="#2C3E50">Notes</Title>
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
            <Tabs.Tab value="sources" leftSection={<IconWorldWww size={16} />} data-testid="tab-sources">Discovery</Tabs.Tab>
            <Tabs.Tab value="opportunities" leftSection={<IconSparkles size={16} />} data-testid="tab-opportunities">Opportunities ({funder._count.opportunities})</Tabs.Tab>
            {funderApplications.length > 0 && (
              <Tabs.Tab value="applications" leftSection={<IconFileText size={16} />} data-testid="tab-applications">Applications ({funderApplications.length})</Tabs.Tab>
            )}
            <Tabs.Tab value="statistics" leftSection={<IconChartBar size={16} />}>Statistics</Tabs.Tab>
          </Tabs.List>

          {/* ── Overview Tab ── */}
          <Tabs.Panel value="overview" pt="md">
            <Grid>
              <Grid.Col span={4}>
                <Card withBorder p="lg" shadow="sm" style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.03) 0%, rgba(40, 116, 166, 0.05) 100%)' }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Opportunities</Text>
                  <Title order={2} mt="xs" c="#1e3a5f">{funder._count.opportunities}</Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={4}>
                <Card withBorder p="lg" shadow="sm" style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(12, 58, 41, 0.03) 0%, rgba(39, 174, 96, 0.05) 100%)' }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Sources</Text>
                  <Title order={2} mt="xs" c="#0c3a29">{funder.harvestSources.length}</Title>
                </Card>
              </Grid.Col>
              <Grid.Col span={4}>
                <Card withBorder p="lg" shadow="sm" style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(44, 62, 80, 0.03) 0%, rgba(52, 73, 94, 0.05) 100%)' }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Contacts</Text>
                  <Title order={2} mt="xs" c="#2C3E50">{funder._count.contacts}</Title>
                </Card>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          {/* ── Sources Tab ── */}
          <Tabs.Panel value="sources" pt="md">
            <SmartDiscoveryPanel
              funderId={funder.id}
              funderName={funder.name}
              funderWebsiteUrl={funder.websiteUrl}
            />
          </Tabs.Panel>

          {/* ── Opportunities Tab ── */}
          <Tabs.Panel value="opportunities" pt="md">
            <Stack gap="md">
              {funder.opportunities.length > 0 && (
                <Group justify="flex-end">
                  {confirmingPurge ? (
                    <Group gap="xs">
                      <Text size="sm" c="red">Delete all {funder._count.opportunities} opportunities?</Text>
                      <Button
                        size="xs"
                        color="red"
                        loading={purgeOpportunitiesMutation.isPending}
                        onClick={() => purgeOpportunitiesMutation.mutate()}
                      >
                        Confirm Delete
                      </Button>
                      <Button size="xs" variant="subtle" onClick={() => setConfirmingPurge(false)}>Cancel</Button>
                    </Group>
                  ) : (
                    <Tooltip label="Delete all discovered opportunities for this funder">
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => setConfirmingPurge(true)}
                      >
                        Clear All
                      </Button>
                    </Tooltip>
                  )}
                </Group>
              )}
              {funder.opportunities.length > 0 ? (
                (() => {
                  // Deduplicate opportunities by programName + sourceUrl
                  const uniqueOpps = new Map();
                  funder.opportunities.forEach(opp => {
                    const key = `${opp.programName}-${opp.sourceUrl}`;
                    if (!uniqueOpps.has(key) || new Date(opp.createdAt) > new Date(uniqueOpps.get(key).createdAt)) {
                      uniqueOpps.set(key, opp);
                    }
                  });
                  
                  // Sort by creation date (newest first)
                  const sortedOpps = Array.from(uniqueOpps.values()).sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  );
                  
                  return sortedOpps.map((opp) => {
                    const recommendation = opp.tags?.find((t: string) => t.startsWith('recommendation:'))?.replace('recommendation:', '');
                    const createdDate = new Date(opp.createdAt);
                    const daysSinceCreated = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                    const isNew = daysSinceCreated <= 7;
                    
                    return (
                      <Paper key={opp.id} p="md" withBorder style={{ cursor: 'pointer' }} onClick={() => navigate(`/opportunities/${opp.id}`)} data-testid="funder-opportunity-card">
                        <Group justify="space-between" align="flex-start">
                          <Stack gap="xs" style={{ flex: 1 }}>
                            <Group gap="xs">
                              <Text fw={600}>{opp.programName}</Text>
                              {isNew && (
                                <Badge size="sm" color="teal" variant="filled">NEW</Badge>
                              )}
                            </Group>
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
                              <Text size="xs" c="dimmed">
                                Added {daysSinceCreated === 0 ? 'today' : daysSinceCreated === 1 ? 'yesterday' : `${daysSinceCreated} days ago`}
                              </Text>
                            </Group>
                          </Stack>
                        </Group>
                      </Paper>
                    );
                  });
                })()
              ) : (
                <Paper p="xl" withBorder>
                  <Text ta="center" c="dimmed">No opportunities found. Inspect a source to extract opportunities.</Text>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          {/* ── Applications Tab ── */}
          {funderApplications.length > 0 && (
            <Tabs.Panel value="applications" pt="md">
              <Stack gap="md">
                {funderApplications.map((app) => (
                  <Paper key={app.id} p="md" withBorder style={{ cursor: 'pointer' }} onClick={() => navigate(`/applications/${app.id}`)} data-testid="funder-application-card">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Text fw={600}>{app.title}</Text>
                        <Group gap="xs">
                          <Badge size="sm" color={{
                            TRIAGE: 'gray', PREP: 'blue', DRAFTING: 'indigo',
                            REVIEW: 'orange', SUBMIT: 'teal', AWARDED: 'green', REJECTED: 'red',
                          }[app.stage] || 'gray'}>
                            {app.stage}
                          </Badge>
                          {app.outcome !== 'UNKNOWN' && (
                            <Badge size="sm" variant="outline">{app.outcome}</Badge>
                          )}
                          <Badge size="sm" variant="light" color="blue">{app._count?.sections ?? 0} sections</Badge>
                        </Group>
                        <Text size="sm" c="dimmed">
                          Opportunity: {app.opportunityName}
                        </Text>
                        {app.leadOwner && (
                          <Text size="xs" c="dimmed">Lead: {app.leadOwner.name}</Text>
                        )}
                        <Text size="xs" c="dimmed">
                          Created {new Date(app.createdAt).toLocaleDateString()}
                        </Text>
                      </Stack>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Tabs.Panel>
          )}

          {/* ── Statistics Tab ── */}
          <Tabs.Panel value="statistics" pt="md">
            <Grid>
              <Grid.Col span={6}>
                <Paper p="md" withBorder shadow="sm" style={{ background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.02) 0%, rgba(40, 116, 166, 0.03) 100%)' }}>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={4} c="#1e3a5f">Fit Score Distribution</Title>
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
                <Paper p="md" withBorder shadow="sm" style={{ background: 'linear-gradient(135deg, rgba(12, 58, 41, 0.02) 0%, rgba(39, 174, 96, 0.03) 100%)' }}>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={4} c="#0c3a29">Odyssean Alignment</Title>
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
