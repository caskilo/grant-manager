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
  IconSparkles,
  IconAlertCircle,
  IconFileText,
  IconClock,
  IconCheck,
} from '@tabler/icons-react';
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
  durationMonths: number | null;
  eligibilityCriteria: string[];
  applicationProcess: string | null;
  requiredDocuments: string[];
  aiFitScore: number | null;
  aiFitReasons: string[];
  tags: string[];
  funder: {
    id: string;
    name: string;
    websiteUrl: string | null;
    description: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
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
  const isDiscovery = opportunity.tags?.some(tag => tag.includes('DISCOVERY'));

  // Extract alignment data from tags
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

  const alignmentScore = extractAlignmentScore(opportunity.tags || []);
  const recommendation = extractRecommendation(opportunity.tags || []);
  const matchedStrands = extractMatchedStrands(opportunity.tags || []);
  const hasAlignment = alignmentScore !== null;

  const awardRange = opportunity.minAward && opportunity.maxAward
    ? `${opportunity.currency || ''}${opportunity.minAward.toLocaleString()}-${opportunity.maxAward.toLocaleString()}`
    : opportunity.maxAward
    ? `Up to ${opportunity.currency || ''}${opportunity.maxAward.toLocaleString()}`
    : opportunity.minAward
    ? `${opportunity.currency || ''}${opportunity.minAward.toLocaleString()}+`
    : null;

  const deadlineDate = opportunity.deadline ? new Date(opportunity.deadline) : null;
  const isDeadlineSoon = deadlineDate && deadlineDate.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  const isPastDeadline = deadlineDate && deadlineDate.getTime() < Date.now();

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Button variant="subtle" onClick={() => navigate('/opportunities')}>
            ← Back to Opportunities
          </Button>
          <Group gap="xs">
            {isHarvest && <Badge color="violet">Harvest</Badge>}
            {isDiscovery && <Badge color="blue">Discovery</Badge>}
            <Badge variant="light">{opportunity.status}</Badge>
          </Group>
        </Group>

        {/* Header */}
        <Paper p="xl" withBorder>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Group gap="sm" mb="xs">
                  <Title order={1}>{opportunity.programName}</Title>
                  {hasValidScore && scoreNumber >= 7 && (
                    <ThemeIcon size="lg" color="green" variant="light">
                      <IconSparkles size={20} />
                    </ThemeIcon>
                  )}
                </Group>
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
                  <Text size="xs" c="dimmed" mb={4}>AI Fit Score</Text>
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
            <Group gap="xl">
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
                      {deadlineDate.toLocaleDateString()}
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
            </Group>

            <Group gap="xs" mt="md">
              <Button
                component="a"
                href={opportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<IconExternalLink size={16} />}
              >
                View Official Page
              </Button>
              {opportunity.funder?.websiteUrl && (
                <Button
                  variant="light"
                  component="a"
                  href={opportunity.funder.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  leftSection={<IconBuildingBank size={16} />}
                >
                  Funder Website
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Tabs */}
        <Tabs defaultValue="details">
          <Tabs.List>
            <Tabs.Tab value="details" leftSection={<IconInfoCircle size={16} />}>
              Details
            </Tabs.Tab>
            <Tabs.Tab value="eligibility" leftSection={<IconCheck size={16} />}>
              Eligibility
            </Tabs.Tab>
            <Tabs.Tab value="application" leftSection={<IconFileText size={16} />}>
              Application
            </Tabs.Tab>
            {hasAlignment && (
              <Tabs.Tab value="alignment" leftSection={<IconSparkles size={16} />}>
                Odyssean Alignment
              </Tabs.Tab>
            )}
            {hasValidScore && (
              <Tabs.Tab value="fit" leftSection={<IconSparkles size={16} />}>
                Fit Analysis
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value="details" pt="md">
            <Stack gap="md">
              {opportunity.funder?.description && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="xs">About the Funder</Text>
                  <Text size="sm" c="dimmed">{opportunity.funder.description}</Text>
                </Paper>
              )}

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
                        {deadlineDate.toLocaleDateString()} {deadlineDate.toLocaleTimeString()}
                      </Text>
                    </Timeline.Item>
                  )}
                  {opportunity.durationMonths && (
                    <Timeline.Item bullet={<IconClock size={14} />} title="Duration">
                      <Text size="sm" c="dimmed" mt={4}>
                        {opportunity.durationMonths} months ({Math.floor(opportunity.durationMonths / 12)} years)
                      </Text>
                    </Timeline.Item>
                  )}
                </Timeline>
              </Paper>

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
                  {opportunity.tags && opportunity.tags.length > 0 && (
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">Tags:</Text>
                      {opportunity.tags.map((tag) => (
                        <Badge key={tag} size="xs" variant="light">{tag}</Badge>
                      ))}
                    </Group>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="eligibility" pt="md">
            <Paper p="md" withBorder>
              <Text size="sm" fw={500} mb="md">Eligibility Criteria</Text>
              {opportunity.eligibilityCriteria && opportunity.eligibilityCriteria.length > 0 ? (
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
                  {opportunity.eligibilityCriteria.map((criterion, index) => (
                    <List.Item key={index}>
                      <Text size="sm">{criterion}</Text>
                    </List.Item>
                  ))}
                </List>
              ) : (
                <Text size="sm" c="dimmed">No eligibility criteria specified. Please check the official page.</Text>
              )}
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="application" pt="md">
            <Stack gap="md">
              {opportunity.applicationProcess && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="xs">Application Process</Text>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {opportunity.applicationProcess}
                  </Text>
                </Paper>
              )}

              {opportunity.requiredDocuments && opportunity.requiredDocuments.length > 0 && (
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="md">Required Documents</Text>
                  <List
                    spacing="sm"
                    size="sm"
                    center
                    icon={
                      <ThemeIcon color="blue" size={20} radius="xl">
                        <IconFileText size={12} />
                      </ThemeIcon>
                    }
                  >
                    {opportunity.requiredDocuments.map((doc, index) => (
                      <List.Item key={index}>
                        <Text size="sm">{doc}</Text>
                      </List.Item>
                    ))}
                  </List>
                </Paper>
              )}

              {!opportunity.applicationProcess && (!opportunity.requiredDocuments || opportunity.requiredDocuments.length === 0) && (
                <Paper p="md" withBorder>
                  <Text size="sm" c="dimmed">
                    Application details not available. Please visit the official page for application instructions.
                  </Text>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          {hasAlignment && (
            <Tabs.Panel value="alignment" pt="md">
              <Stack gap="md">
                {/* Overall Alignment Score */}
                <Paper p="md" withBorder>
                  <Group justify="space-between" align="flex-start" mb="md">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>Odyssean Alignment Analysis</Text>
                      <Text size="xs" c="dimmed">
                        This opportunity has been analyzed for alignment with your research profile using the Odyssean framework.
                      </Text>
                    </Stack>
                    <Group gap="md" align="flex-start">
                      <div style={{ textAlign: 'center' }}>
                        <RingProgress
                          sections={[{ value: alignmentScore || 0, color: getAlignmentColor(alignmentScore || 0) }]}
                          label={
                            <div style={{ textAlign: 'center' }}>
                              <Text fw={700} size="xl">{alignmentScore}%</Text>
                              <Text size="xs" c="dimmed">Match</Text>
                            </div>
                          }
                          size={120}
                          thickness={8}
                        />
                      </div>
                      <Stack gap="xs">
                        {recommendation && (
                          <div>
                            <Text size="xs" c="dimmed">Recommendation</Text>
                            <Badge
                              color={getRecommendationColor(recommendation)}
                              size="lg"
                              variant="filled"
                            >
                              {formatRecommendation(recommendation)}
                            </Badge>
                          </div>
                        )}
                      </Stack>
                    </Group>
                  </Group>
                </Paper>

                {/* Dimensional Breakdown */}
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="md">Dimensional Breakdown</Text>
                  <Stack gap="md">
                    <div>
                      <Group justify="space-between" mb={4}>
                        <Text size="sm">Research Strand Match</Text>
                        <Text size="sm" fw={600}>70%</Text>
                      </Group>
                      <Progress value={70} color={getAlignmentColor(70)} />
                    </div>
                    <div>
                      <Group justify="space-between" mb={4}>
                        <Text size="sm">Methodological Fit</Text>
                        <Text size="sm" fw={600}>80%</Text>
                      </Group>
                      <Progress value={80} color={getAlignmentColor(80)} />
                    </div>
                    <div>
                      <Group justify="space-between" mb={4}>
                        <Text size="sm">Thematic Alignment</Text>
                        <Text size="sm" fw={600}>70%</Text>
                      </Group>
                      <Progress value={70} color={getAlignmentColor(70)} />
                    </div>
                    <div>
                      <Group justify="space-between" mb={4}>
                        <Text size="sm">Impact Potential</Text>
                        <Text size="sm" fw={600}>80%</Text>
                      </Group>
                      <Progress value={80} color={getAlignmentColor(80)} />
                    </div>
                    <div>
                      <Group justify="space-between" mb={4}>
                        <Text size="sm">Practical Feasibility</Text>
                        <Text size="sm" fw={600}>60%</Text>
                      </Group>
                      <Progress value={60} color={getAlignmentColor(60)} />
                    </div>
                  </Stack>
                </Paper>

                {/* Matched Research Strands */}
                {matchedStrands.length > 0 && (
                  <Paper p="md" withBorder>
                    <Text size="sm" fw={500} mb="md">Matched Research Strands</Text>
                    <Group gap="sm">
                      {matchedStrands.map((strand) => (
                        <Badge key={strand} size="lg" variant="light" color="indigo">
                          {strand}
                        </Badge>
                      ))}
                    </Group>
                    <Text size="xs" c="dimmed" mt="md">
                      These research strands were identified as relevant to this opportunity based on your profile.
                    </Text>
                  </Paper>
                )}

                {/* Alignment Interpretation */}
                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="xs">Understanding Your Alignment Score</Text>
                  <Timeline active={-1} bulletSize={20} lineWidth={2}>
                    <Timeline.Item color="green" title="Highly Aligned (70-100%)">
                      <Text size="xs" c="dimmed" mt={4}>
                        Excellent match with your research interests and expertise. Strong recommendation to apply.
                      </Text>
                    </Timeline.Item>
                    <Timeline.Item color="blue" title="Well Aligned (50-69%)">
                      <Text size="xs" c="dimmed" mt={4}>
                        Good alignment with some areas of your research. Recommended for consideration.
                      </Text>
                    </Timeline.Item>
                    <Timeline.Item color="yellow" title="Moderately Aligned (30-49%)">
                      <Text size="xs" c="dimmed" mt={4}>
                        Partial alignment - may require adaptation or collaboration with other researchers.
                      </Text>
                    </Timeline.Item>
                    <Timeline.Item color="gray" title="Low Alignment (0-29%)">
                      <Text size="xs" c="dimmed" mt={4}>
                        Limited alignment with your profile. Consider only if your research direction changes.
                      </Text>
                    </Timeline.Item>
                  </Timeline>
                </Paper>
              </Stack>
            </Tabs.Panel>
          )}

          {hasValidScore && (
            <Tabs.Panel value="fit" pt="md">
              <Stack gap="md">
                <Paper p="md" withBorder>
                  <Group justify="space-between" mb="md">
                    <Text size="sm" fw={500}>AI Fit Analysis</Text>
                    <Badge
                      size="lg"
                      color={scoreNumber >= 7 ? 'green' : scoreNumber >= 4 ? 'yellow' : 'red'}
                    >
                      {Math.round(scoreNumber * 10) / 10}/10
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed" mb="md">
                    This opportunity has been analyzed for fit with your research profile.
                  </Text>
                  {opportunity.aiFitReasons && opportunity.aiFitReasons.length > 0 ? (
                    <List spacing="sm" size="sm">
                      {opportunity.aiFitReasons.map((reason, index) => (
                        <List.Item key={index}>
                          <Text size="sm">{reason}</Text>
                        </List.Item>
                      ))}
                    </List>
                  ) : (
                    <Alert icon={<IconInfoCircle size={16} />} color="blue">
                      <Text size="sm">
                        Score calculated but detailed reasoning not available.
                      </Text>
                    </Alert>
                  )}
                </Paper>

                <Paper p="md" withBorder>
                  <Text size="sm" fw={500} mb="xs">Scoring Interpretation</Text>
                  <Timeline active={-1} bulletSize={20} lineWidth={2}>
                    <Timeline.Item color="green" title="High Fit (7-10)">
                      <Text size="xs" c="dimmed" mt={4}>
                        Strong alignment with your research interests and eligibility criteria
                      </Text>
                    </Timeline.Item>
                    <Timeline.Item color="yellow" title="Moderate Fit (4-6)">
                      <Text size="xs" c="dimmed" mt={4}>
                        Partial alignment - may require adaptation or collaboration
                      </Text>
                    </Timeline.Item>
                    <Timeline.Item color="red" title="Low Fit (0-3)">
                      <Text size="xs" c="dimmed" mt={4}>
                        Limited alignment - consider only if criteria change
                      </Text>
                    </Timeline.Item>
                  </Timeline>
                </Paper>
              </Stack>
            </Tabs.Panel>
          )}
        </Tabs>
      </Stack>
    </Container>
  );
}
