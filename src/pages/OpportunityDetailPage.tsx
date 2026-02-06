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
} from '@mantine/core';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from '@tabler/icons-react';
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
  createdAt: string;
  updatedAt: string;
}

/** Extract the earliest deadline date from the deadlines JSON array */
function getDeadlineDate(deadlines: DeadlineEntry[] | string[] | null): Date | null {
  if (!deadlines || !Array.isArray(deadlines) || deadlines.length === 0) return null;
  const first = deadlines[0];
  if (typeof first === 'string') {
    const d = new Date(first);
    return isNaN(d.getTime()) ? null : d;
  }
  if (first?.date) {
    const d = new Date(first.date);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function getDeadlineDescription(deadlines: DeadlineEntry[] | string[] | null): string | null {
  if (!deadlines || !Array.isArray(deadlines) || deadlines.length === 0) return null;
  const first = deadlines[0];
  if (typeof first === 'object' && first?.description) return first.description;
  return null;
}

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

  const { data: opportunity, isLoading, error } = useQuery<Opportunity>({
    queryKey: ['opportunity', id],
    queryFn: async () => {
      const response = await api.get(`/opportunities/${id}`);
      return response.data;
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

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Button variant="subtle" onClick={() => navigate('/opportunities')}>
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
                <Title order={2} mb="xs">{opportunity.programName}</Title>
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

              {hasValidScore && (
                <Paper p="md" withBorder style={{ textAlign: 'center', minWidth: 120 }}>
                  <Text size="xs" c="dimmed" mb={4}>OI Alignment</Text>
                  <Badge
                    size="xl"
                    color={scoreNumber >= 7 ? 'green' : scoreNumber >= 4 ? 'yellow' : 'red'}
                  >
                    {Math.round(scoreNumber * 10) / 10}/10
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
                    <Text size="xs" c="dimmed">Deadline</Text>
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

            <Group gap="xs" mt="md">
              <Button
                component="a"
                href={opportunity.opportunityUrl || opportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<IconExternalLink size={16} />}
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
            </Group>
          </Stack>
        </Paper>

        {/* Tabs */}
        <Tabs defaultValue={hasDimensions ? 'alignment' : 'eligibility'}>
          <Tabs.List>
            {hasDimensions && (
              <Tabs.Tab value="alignment" leftSection={<IconTarget size={16} />}>
                OI Alignment
              </Tabs.Tab>
            )}
            <Tabs.Tab value="eligibility" leftSection={<IconCheck size={16} />}>
              Eligibility
            </Tabs.Tab>
            <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
              Details
            </Tabs.Tab>
          </Tabs.List>

          {/* Alignment Tab - driven by real data from tags */}
          {hasDimensions && (
            <Tabs.Panel value="alignment" pt="md">
              <Stack gap="md">
                <Paper p="md" withBorder>
                  <Group justify="space-between" align="flex-start" mb="md">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>Odyssean Institute Alignment</Text>
                      <Text size="xs" c="dimmed">
                        Automated analysis of how well this opportunity aligns with OI research strands and methodology.
                      </Text>
                    </Stack>
                    <Group gap="md" align="flex-start">
                      {hasValidScore && (
                        <RingProgress
                          sections={[{ value: scoreNumber * 10, color: getAlignmentColor(scoreNumber * 10) }]}
                          label={
                            <div style={{ textAlign: 'center' }}>
                              <Text fw={700} size="lg">{Math.round(scoreNumber * 10)}%</Text>
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
                    </Group>
                  </Group>
                </Paper>

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
              </Stack>
            </Tabs.Panel>
          )}

          {/* Eligibility Tab - uses rawDescription (eligibility markdown) + eligibleApplicantTypes + processSteps */}
          <Tabs.Panel value="eligibility" pt="md">
            <Stack gap="md">
              {hasApplicantTypes && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="md">Eligible Applicant Types</Text>
                  <Group gap="sm">
                    {opportunity.eligibleApplicantTypes.map((type, i) => (
                      <Badge key={i} size="lg" variant="light" color="indigo">
                        {type}
                      </Badge>
                    ))}
                  </Group>
                </Paper>
              )}

              {opportunity.geographies && opportunity.geographies.length > 0 && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="md">Geographic Restrictions</Text>
                  <Group gap="sm">
                    {opportunity.geographies.map((geo, i) => (
                      <Badge key={i} size="lg" variant="light" color="cyan">
                        {geo}
                      </Badge>
                    ))}
                  </Group>
                </Paper>
              )}

              {hasProcessSteps && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="md">Additional Eligibility Details</Text>
                  <List
                    spacing="sm"
                    size="sm"
                    center
                    icon={
                      <ThemeIcon color="teal" size={20} radius="xl">
                        <IconCheck size={12} />
                      </ThemeIcon>
                    }
                  >
                    {opportunity.processSteps.map((step, i) => (
                      <List.Item key={i}>
                        <Text size="sm">{step}</Text>
                      </List.Item>
                    ))}
                  </List>
                </Paper>
              )}

              {hasEligibility && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="md">Full Eligibility Information</Text>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {opportunity.rawDescription}
                  </Text>
                </Paper>
              )}

              {!hasEligibility && !hasApplicantTypes && !hasProcessSteps && (
                <Paper p="md" withBorder>
                  <Text size="sm" c="dimmed">
                    No detailed eligibility information available. Please check the official page.
                  </Text>
                </Paper>
              )}
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
    </Container>
  );
}
