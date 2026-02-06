import {
  Container, Title, Text, SimpleGrid, Paper, Stack, Group, Badge, ThemeIcon,
  RingProgress, Progress, Anchor, Center, Loader, Grid, Box, Tooltip,
} from '@mantine/core';
import {
  IconBuildingBank, IconSparkles, IconWorldSearch,
  IconFileText, IconCalendar, IconArrowRight,
  IconRocket, IconLock, IconCoins, IconChartBar,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../lib/api';
import { harvestApi } from '../lib/harvest';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Opportunity {
  id: string;
  programName: string;
  description: string | null;
  sourceUrl: string;
  status: string;
  deadlines: any[];
  minAward: number | null;
  maxAward: number | null;
  currency: string | null;
  aiFitScore: number | null;
  aiRecommendedAction: string | null;
  tags: string[];
  funder: { id: string; name: string; type: string } | null;
}

interface Funder {
  id: string;
  name: string;
  type: string;
  tags: string[];
  websiteUrl: string | null;
  _count: { opportunities: number; contacts: number };
}

interface HarvestSource {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  funderId: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractAlignmentScore(tags: string[]): number | null {
  const tag = tags.find(t => t.startsWith('alignment:'));
  if (tag) {
    const match = tag.match(/alignment:(\d+)%/);
    return match ? parseInt(match[1], 10) : null;
  }
  return null;
}

function formatCurrency(amount: number, currency: string = 'GBP'): string {
  const sym = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${sym}${(amount / 1_000).toFixed(0)}k`;
  return `${sym}${amount.toLocaleString()}`;
}

const ACTION_COLORS: Record<string, string> = {
  PURSUE: 'green',
  MONITOR: 'yellow',
  NO_GO: 'red',
};

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, subtitle, onClick }: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <Paper
      withBorder p="md" radius="md"
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 150ms ease' }}
      onClick={onClick}
      className={onClick ? 'hover-lift' : ''}
    >
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
          <Text size="2rem" fw={700} mt={4} lh={1}>{value}</Text>
          {subtitle && <Text size="xs" c="dimmed" mt={4}>{subtitle}</Text>}
        </div>
        <ThemeIcon size={48} radius="md" variant="light" color={color}>
          <Icon size={24} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();

  // Fetch all data in parallel
  const { data: fundersData, isLoading: fundersLoading } = useQuery<{ data: Funder[] }>({
    queryKey: ['funders'],
    queryFn: async () => (await api.get('/funders', { params: { page: 1, limit: 200 } })).data,
  });

  const { data: oppsData, isLoading: oppsLoading } = useQuery<{ data: Opportunity[] }>({
    queryKey: ['opportunities'],
    queryFn: async () => (await api.get('/opportunities', { params: { page: 1, limit: 500 } })).data,
  });

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery<{ data: HarvestSource[] }>({
    queryKey: ['harvest-sources-all'],
    queryFn: async () => harvestApi.getSources(),
  });

  const isLoading = fundersLoading || oppsLoading || sourcesLoading;

  // ── Computed metrics ───────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const funders = fundersData?.data || [];
    const opps = oppsData?.data || [];
    const sources = sourcesData?.data || [];

    const totalFunders = funders.length;
    const totalOpps = opps.length;
    const totalSources = sources.length;

    // Funders with at least one source configured
    const fundersWithSources = new Set(sources.filter(s => s.funderId).map(s => s.funderId)).size;
    // Funders with at least one opportunity
    const fundersWithOpps = new Set(opps.filter(o => o.funder).map(o => o.funder!.id)).size;

    // AI recommendation breakdown
    const pursue = opps.filter(o => o.aiRecommendedAction === 'PURSUE').length;
    const monitor = opps.filter(o => o.aiRecommendedAction === 'MONITOR').length;
    const noGo = opps.filter(o => o.aiRecommendedAction === 'NO_GO').length;
    const unscored = opps.filter(o => !o.aiRecommendedAction).length;

    // Alignment scores
    const withAlignment = opps.map(o => ({ ...o, alignment: extractAlignmentScore(o.tags || []) })).filter(o => o.alignment !== null);
    const highAlignment = withAlignment.filter(o => o.alignment! >= 70).length;

    // Fit scores
    const withFitScore = opps.filter(o => o.aiFitScore !== null && o.aiFitScore > 0);
    const avgFitScore = withFitScore.length > 0
      ? Math.round(withFitScore.reduce((sum, o) => sum + o.aiFitScore!, 0) / withFitScore.length)
      : 0;

    // Top opportunities by fit score
    const topOpps = [...opps]
      .filter(o => o.aiFitScore !== null)
      .sort((a, b) => (b.aiFitScore || 0) - (a.aiFitScore || 0))
      .slice(0, 5);

    // Funder type breakdown for chart
    const typeMap = new Map<string, number>();
    funders.forEach(f => {
      const type = f.type || 'Unknown';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    const funderTypeData = Array.from(typeMap.entries())
      .map(([name, count]) => ({ name: name.replace('_', ' '), count }))
      .sort((a, b) => b.count - a.count);

    // Pipeline coverage percentages
    const sourceCoverage = totalFunders > 0 ? Math.round((fundersWithSources / totalFunders) * 100) : 0;
    const oppCoverage = totalFunders > 0 ? Math.round((fundersWithOpps / totalFunders) * 100) : 0;

    // Total potential funding
    const totalMaxFunding = opps
      .filter(o => o.maxAward && o.aiRecommendedAction === 'PURSUE')
      .reduce((sum, o) => sum + (o.maxAward || 0), 0);

    return {
      totalFunders, totalOpps, totalSources,
      fundersWithSources, fundersWithOpps,
      pursue, monitor, noGo, unscored,
      highAlignment, avgFitScore,
      topOpps, funderTypeData,
      sourceCoverage, oppCoverage,
      totalMaxFunding,
    };
  }, [fundersData, oppsData, sourcesData]);

  if (isLoading) {
    return (
      <Center h={400}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading dashboard...</Text>
        </Stack>
      </Center>
    );
  }

  const CHART_COLORS = ['#228be6', '#40c057', '#fab005', '#fa5252', '#7950f2', '#15aabf', '#e64980'];

  return (
    <Container size="xl" py="md">
      <Stack gap="xl">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div>
          <Title order={1}>Discovery Dashboard</Title>
          <Text c="dimmed" mt={4}>
            Opportunity discovery pipeline at a glance
          </Text>
        </div>

        {/* ── Top-level stat cards ────────────────────────────────────────── */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <StatCard
            icon={IconBuildingBank}
            label="Funders Tracked"
            value={metrics.totalFunders}
            color="blue"
            subtitle={`${metrics.fundersWithSources} with sources configured`}
            onClick={() => navigate('/funders')}
          />
          <StatCard
            icon={IconWorldSearch}
            label="Harvest Sources"
            value={metrics.totalSources}
            color="teal"
            subtitle="Configured for automated discovery"
          />
          <StatCard
            icon={IconSparkles}
            label="Opportunities Found"
            value={metrics.totalOpps}
            color="violet"
            subtitle={`${metrics.pursue} recommended to pursue`}
            onClick={() => navigate('/opportunities')}
          />
          <StatCard
            icon={IconCoins}
            label="Pursue Pipeline"
            value={metrics.totalMaxFunding > 0 ? formatCurrency(metrics.totalMaxFunding) : '—'}
            color="green"
            subtitle={`Max funding across ${metrics.pursue} PURSUE opps`}
          />
        </SimpleGrid>

        {/* ── Pipeline Progress + Recommendation Ring ─────────────────────── */}
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Paper withBorder p="lg" radius="md" h="100%">
              <Text fw={700} size="lg" mb="md">Discovery Pipeline</Text>
              <Text size="sm" c="dimmed" mb="lg">
                Progress from funder catalogue through to scored opportunities
              </Text>

              {/* Pipeline steps */}
              <Stack gap="lg">
                <PipelineStep
                  step={1}
                  label="Funders in Catalogue"
                  value={metrics.totalFunders}
                  total={metrics.totalFunders}
                  color="blue"
                />
                <PipelineStep
                  step={2}
                  label="Sources Configured"
                  value={metrics.fundersWithSources}
                  total={metrics.totalFunders}
                  color="teal"
                  sublabel={`${metrics.sourceCoverage}% of funders have harvest sources`}
                />
                <PipelineStep
                  step={3}
                  label="Opportunities Discovered"
                  value={metrics.fundersWithOpps}
                  total={metrics.totalFunders}
                  color="violet"
                  sublabel={`${metrics.oppCoverage}% of funders have opportunities`}
                />
                <PipelineStep
                  step={4}
                  label="AI-Scored & Aligned"
                  value={metrics.totalOpps - metrics.unscored}
                  total={metrics.totalOpps}
                  color="orange"
                  sublabel={`${metrics.unscored} still awaiting scoring`}
                />
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }}>
            <Paper withBorder p="lg" radius="md" h="100%">
              <Text fw={700} size="lg" mb="md">AI Recommendations</Text>
              <Text size="sm" c="dimmed" mb="lg">
                Breakdown of AI-assessed opportunities
              </Text>

              <Center>
                <RingProgress
                  size={200}
                  thickness={24}
                  roundCaps
                  label={
                    <Center>
                      <Stack gap={0} align="center">
                        <Text fw={700} size="xl">{metrics.totalOpps}</Text>
                        <Text size="xs" c="dimmed">total</Text>
                      </Stack>
                    </Center>
                  }
                  sections={[
                    { value: metrics.totalOpps > 0 ? (metrics.pursue / metrics.totalOpps) * 100 : 0, color: 'green', tooltip: `Pursue: ${metrics.pursue}` },
                    { value: metrics.totalOpps > 0 ? (metrics.monitor / metrics.totalOpps) * 100 : 0, color: 'yellow', tooltip: `Monitor: ${metrics.monitor}` },
                    { value: metrics.totalOpps > 0 ? (metrics.noGo / metrics.totalOpps) * 100 : 0, color: 'red', tooltip: `No-Go: ${metrics.noGo}` },
                    { value: metrics.totalOpps > 0 ? (metrics.unscored / metrics.totalOpps) * 100 : 0, color: 'gray', tooltip: `Unscored: ${metrics.unscored}` },
                  ]}
                />
              </Center>

              <Group justify="center" mt="lg" gap="lg">
                <LegendItem color="green" label="Pursue" count={metrics.pursue} />
                <LegendItem color="yellow" label="Monitor" count={metrics.monitor} />
                <LegendItem color="red" label="No-Go" count={metrics.noGo} />
                <LegendItem color="gray" label="Unscored" count={metrics.unscored} />
              </Group>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* ── Funder Types Chart + Top Opportunities ──────────────────────── */}
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper withBorder p="lg" radius="md" h="100%">
              <Text fw={700} size="lg" mb="md">Funder Landscape</Text>
              <Text size="sm" c="dimmed" mb="lg">
                Distribution of tracked funders by type
              </Text>

              {metrics.funderTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={metrics.funderTypeData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                    <RechartsTooltip
                      formatter={(value: number) => [`${value} funders`, 'Count']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e0e0e0' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {metrics.funderTypeData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Center h={200}><Text c="dimmed">No funders yet</Text></Center>
              )}
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper withBorder p="lg" radius="md" h="100%">
              <Group justify="space-between" mb="md">
                <Text fw={700} size="lg">Top Opportunities</Text>
                <Anchor size="sm" onClick={() => navigate('/opportunities')} style={{ cursor: 'pointer' }}>
                  View all <IconArrowRight size={14} style={{ verticalAlign: 'middle' }} />
                </Anchor>
              </Group>
              <Text size="sm" c="dimmed" mb="lg">
                Highest AI fit scores across all funders
              </Text>

              {metrics.topOpps.length > 0 ? (
                <Stack gap="sm">
                  {metrics.topOpps.map((opp) => (
                    <Paper
                      key={opp.id}
                      withBorder p="sm" radius="sm"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/opportunities/${opp.id}`)}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <Group gap={6} wrap="nowrap">
                            <Text fw={600} size="sm" truncate>{opp.programName}</Text>
                          </Group>
                          <Text size="xs" c="dimmed" truncate>
                            {opp.funder?.name || 'Unknown funder'}
                            {opp.maxAward ? ` · Up to ${formatCurrency(opp.maxAward, opp.currency || 'GBP')}` : ''}
                          </Text>
                        </div>
                        <Group gap={8} wrap="nowrap">
                          {opp.aiRecommendedAction && (
                            <Badge
                              size="sm"
                              variant="light"
                              color={ACTION_COLORS[opp.aiRecommendedAction] || 'gray'}
                            >
                              {opp.aiRecommendedAction}
                            </Badge>
                          )}
                          <Tooltip label="AI Fit Score">
                            <Badge size="lg" variant="filled" color="violet" circle>
                              {opp.aiFitScore}
                            </Badge>
                          </Tooltip>
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Center h={200}><Text c="dimmed">No scored opportunities yet</Text></Center>
              )}
            </Paper>
          </Grid.Col>
        </Grid>

        {/* ── Coming Soon: Applications ───────────────────────────────────── */}
        <Paper
          withBorder p="xl" radius="md"
          style={{
            background: 'linear-gradient(135deg, rgba(121, 80, 242, 0.04) 0%, rgba(34, 139, 230, 0.04) 100%)',
            borderStyle: 'dashed',
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="lg">
              <ThemeIcon size={56} radius="xl" variant="light" color="violet">
                <IconRocket size={28} />
              </ThemeIcon>
              <div>
                <Group gap={8}>
                  <Text fw={700} size="lg">Application Tracker</Text>
                  <Badge variant="light" color="violet" size="sm" leftSection={<IconLock size={10} />}>
                    Coming Soon
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" mt={4} maw={500}>
                  Track applications from draft to submission, manage deadlines, collaborate with team members,
                  and monitor outcomes — all connected to your discovered opportunities.
                </Text>
              </div>
            </Group>
            <Stack gap={4} align="flex-end">
              <Group gap="xs">
                <IconFileText size={16} color="var(--mantine-color-dimmed)" />
                <Text size="sm" c="dimmed">Draft & submit applications</Text>
              </Group>
              <Group gap="xs">
                <IconCalendar size={16} color="var(--mantine-color-dimmed)" />
                <Text size="sm" c="dimmed">Deadline management</Text>
              </Group>
              <Group gap="xs">
                <IconChartBar size={16} color="var(--mantine-color-dimmed)" />
                <Text size="sm" c="dimmed">Success rate analytics</Text>
              </Group>
            </Stack>
          </Group>
        </Paper>

      </Stack>

      <style>{`
        .hover-lift:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </Container>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PipelineStep({ step, label, value, total, color, sublabel }: {
  step: number;
  label: string;
  value: number;
  total: number;
  color: string;
  sublabel?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <Group justify="space-between" mb={4}>
        <Group gap={8}>
          <Badge size="sm" variant="filled" color={color} circle>{step}</Badge>
          <Text size="sm" fw={600}>{label}</Text>
        </Group>
        <Text size="sm" fw={700} c={color}>
          {value} <Text span size="xs" c="dimmed" fw={400}>/ {total}</Text>
        </Text>
      </Group>
      <Progress value={pct} color={color} size="md" radius="xl" />
      {sublabel && <Text size="xs" c="dimmed" mt={2}>{sublabel}</Text>}
    </div>
  );
}

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <Group gap={6}>
      <Box w={10} h={10} style={{ borderRadius: '50%', backgroundColor: `var(--mantine-color-${color}-6)` }} />
      <Text size="sm">{label}</Text>
      <Text size="sm" fw={700}>{count}</Text>
    </Group>
  );
}
