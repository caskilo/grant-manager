import {
  Container, Text, SimpleGrid, Paper, Stack, Group, Badge, ThemeIcon,
  RingProgress, Progress, Anchor, Center, Loader, Grid, Box, Tooltip,
} from '@mantine/core';
import {
  IconBuildingBank, IconSparkles,
  IconArrowRight, IconRocket, IconCoins,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../lib/api';
import { harvestApi } from '../lib/harvest';
import { applicationsApi } from '../lib/applications';
import { SectionProgressBar } from '../components/SectionProgressBar';

// ── Wave background ───────────────────────────────────────────────────────────

// Lightweight value-noise helper (no external dependency)
function vnoise(x: number, y: number, t: number): number {
  // Hash-based smooth noise in 3D using sine products
  const ix = Math.floor(x), iy = Math.floor(y), it = Math.floor(t);
  const fx = x - ix, fy = y - iy, ft = t - it;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const ut = ft * ft * (3 - 2 * ft);
  const h = (a: number, b: number, c: number) =>
    Math.sin(a * 127.1 + b * 311.7 + c * 74.3) * 0.5 + 0.5;
  return (
    h(ix, iy, it) * (1 - ux) * (1 - uy) * (1 - ut) +
    h(ix + 1, iy, it) * ux * (1 - uy) * (1 - ut) +
    h(ix, iy + 1, it) * (1 - ux) * uy * (1 - ut) +
    h(ix + 1, iy + 1, it) * ux * uy * (1 - ut) +
    h(ix, iy, it + 1) * (1 - ux) * (1 - uy) * ut +
    h(ix + 1, iy, it + 1) * ux * (1 - uy) * ut +
    h(ix, iy + 1, it + 1) * (1 - ux) * uy * ut +
    h(ix + 1, iy + 1, it + 1) * ux * uy * ut
  );
}

// Each line has gradient stops: [position 0‥1, r, g, b, alpha]
const WAVE_LINES = [
  { yf: 0.10, amp: 36, freq: 0.0026, speed: 0.00016, nx: 3.1, ny: 7.4, lw: 2.5,
    stops: [[0,'rgba(99,179,237,0.04)'],[0.25,'rgba(99,179,237,0.32)'],[0.55,'rgba(129,140,248,0.28)'],[0.8,'rgba(167,139,250,0.22)'],[1,'rgba(99,179,237,0.04)']] },
  { yf: 0.26, amp: 28, freq: 0.0033, speed: 0.00011, nx: 5.7, ny: 2.1, lw: 2.0,
    stops: [[0,'rgba(129,140,248,0.04)'],[0.3,'rgba(167,139,250,0.26)'],[0.6,'rgba(99,179,237,0.24)'],[0.85,'rgba(129,140,248,0.20)'],[1,'rgba(129,140,248,0.04)']] },
  { yf: 0.60, amp: 42, freq: 0.0020, speed: 0.00019, nx: 1.3, ny: 9.8, lw: 3.0,
    stops: [[0,'rgba(99,179,237,0.04)'],[0.2,'rgba(129,140,248,0.22)'],[0.5,'rgba(99,179,237,0.30)'],[0.75,'rgba(167,139,250,0.18)'],[1,'rgba(99,179,237,0.04)']] },
  { yf: 0.70, amp: 30, freq: 0.0029, speed: 0.00014, nx: 8.2, ny: 4.5, lw: 2.0,
    stops: [[0,'rgba(167,139,250,0.04)'],[0.35,'rgba(99,179,237,0.22)'],[0.65,'rgba(167,139,250,0.24)'],[0.9,'rgba(129,140,248,0.16)'],[1,'rgba(167,139,250,0.04)']] },
  { yf: 0.88, amp: 22, freq: 0.0038, speed: 0.00009, nx: 2.9, ny: 6.3, lw: 1.5,
    stops: [[0,'rgba(129,140,248,0.04)'],[0.4,'rgba(167,139,250,0.20)'],[0.7,'rgba(99,179,237,0.18)'],[1,'rgba(129,140,248,0.04)']] },
] as const;

function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0;
    const sync = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    sync();
    window.addEventListener('resize', sync);

    // Throttle to ~24 fps — plenty smooth for ambient animation
    const INTERVAL = 1000 / 24;
    let lastTs = 0;

    const draw = (ts: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (ts - lastTs < INTERVAL) return;
      lastTs = ts;

      const t = ts * 0.001; // seconds
      ctx.clearRect(0, 0, W, H);

      for (const line of WAVE_LINES) {
        const baseY = line.yf * H;
        const STEPS = Math.ceil(W / 6);

        // Build horizontal gradient spanning the canvas width
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        for (const [pos, color] of line.stops) grad.addColorStop(pos as number, color as string);

        ctx.beginPath();
        for (let i = 0; i <= STEPS; i++) {
          const x = (i / STEPS) * W;
          const noiseAmp = 0.55 + 0.45 * vnoise(x * 0.0025 + line.nx, t * 0.18 + line.ny, 0);
          const noiseSpd = 0.65 + 0.55 * vnoise(x * 0.0018 + line.ny, line.nx, t * 0.12);
          const y = baseY + Math.sin(x * line.freq + t * line.speed * 400 * noiseSpd) * line.amp * noiseAmp;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = line.lw;
        ctx.stroke();
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

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

interface ApplicationSummary {
  id: string;
  title: string;
  stage: 'TRIAGE' | 'PREP' | 'DRAFTING' | 'REVIEW' | 'SUBMIT' | 'AWARDED' | 'REJECTED';
  expectedAwardAmount: number | null;
  expectedCurrency: string | null;
  awardAmount?: number | null;
  awardCurrency?: string | null;
  sections?: Array<{ status: string }> | null;
  opportunity?: {
    maxAward?: number | null;
    minAward?: number | null;
    currency?: string | null;
  } | null;
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

/** Normalise an award amount that may have been entered in different scales.
 *  - Values < 100 are likely in millions (e.g. 0.5 = £0.5M) → multiply by 1M
 *  - Values > 100M are likely erroneous → cap at 10M as a safety valve
 *  - null/undefined/NaN → 0 */
function normaliseAward(amount: number | null | undefined): number {
  if (amount == null || isNaN(Number(amount))) return 0;
  let v = Number(amount);
  if (v <= 0) return 0;
  if (v < 100) v *= 1_000_000;         // likely entered in millions
  if (v > 100_000_000) return 10_000_000; // cap implausible values at £10M
  return v;
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

  const { data: applicationsData, isLoading: applicationsLoading } = useQuery<{ data: ApplicationSummary[] }>({
    queryKey: ['applications', 'dashboard'],
    queryFn: async () => (await applicationsApi.list({ limit: 500 })).data,
  });

  const isLoading = fundersLoading || oppsLoading || sourcesLoading || applicationsLoading;

  // ── Computed metrics ───────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const funders = fundersData?.data || [];
    const opps = oppsData?.data || [];
    const sources = sourcesData?.data || [];
    const applications = applicationsData?.data || [];

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
    const noRecommendation = opps.filter(o => !o.aiRecommendedAction).length;
    const unscored = opps.filter(o => o.aiFitScore === null || o.aiFitScore === 0).length;

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
    const activeApplications = applications.filter(app => !['AWARDED', 'REJECTED'].includes(app.stage));
    const pipelineCurrency = activeApplications.find(app => app.expectedCurrency)?.expectedCurrency
      || activeApplications.find(app => app.opportunity?.currency)?.opportunity?.currency
      || 'GBP';
    const pursuePipelineValue = activeApplications.reduce((sum, app) => {
      const raw = app.expectedAwardAmount ?? app.opportunity?.maxAward ?? 0;
      return sum + normaliseAward(raw);
    }, 0);

    return {
      totalFunders, totalOpps, totalSources,
      fundersWithSources, fundersWithOpps,
      pursue, monitor, noGo, unscored, noRecommendation,
      highAlignment, avgFitScore,
      topOpps, funderTypeData,
      sourceCoverage, oppCoverage,
      pursuePipelineValue,
      pursuePipelineCurrency: pipelineCurrency,
      activeApplicationsCount: activeApplications.length,
    };
  }, [fundersData, oppsData, sourcesData, applicationsData]);

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
    <>
      <WaveBackground />
      <Container size="xl" py="md" style={{ position: 'relative', zIndex: 1 }}>
      <Stack gap="xl">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        {/* <div>
          <Title order={1}>Discovery Dashboard</Title>
          <Text c="dimmed" mt={4}>
            Opportunity discovery pipeline at a glance
          </Text>
        </div> */}

        {/* ── Top-level stat cards ────────────────────────────────────────── */}
        <SimpleGrid cols={{ base: 1, sm: 3, lg: 3 }}>
          <StatCard
            icon={IconBuildingBank}
            label="Funders Tracked"
            value={metrics.totalFunders}
            color="blue"
            subtitle={`${metrics.fundersWithSources} with sources configured`}
            onClick={() => navigate('/funders')}
          />
          {/* <StatCard
            icon={IconWorldSearch}
            label="Sources Inspected"
            value={metrics.totalSources}
            color="teal"
            subtitle="Configured for automated discovery"
          /> */}
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
            value={metrics.pursuePipelineValue > 0 ? formatCurrency(metrics.pursuePipelineValue, metrics.pursuePipelineCurrency) : '—'}
            color="green"
            subtitle={metrics.activeApplicationsCount > 0
              ? `${metrics.activeApplicationsCount} active application${metrics.activeApplicationsCount === 1 ? '' : 's'} in flight`
              : 'No active applications yet'}
            onClick={() => navigate('/applications')}
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
                  sublabel={`${metrics.sourceCoverage}% of funders have sources`}
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
                    { value: metrics.totalOpps > 0 ? (metrics.noRecommendation / metrics.totalOpps) * 100 : 0, color: 'gray', tooltip: `No recommendation: ${metrics.noRecommendation}` },
                  ]}
                />
              </Center>

              <Group justify="center" mt="lg" gap="lg">
                <LegendItem color="green" label="Pursue" count={metrics.pursue} />
                <LegendItem color="yellow" label="Monitor" count={metrics.monitor} />
                <LegendItem color="red" label="No-Go" count={metrics.noGo} />
                <LegendItem color="gray" label="No rec." count={metrics.noRecommendation} />
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

        {/* ── Application Tracker ───────────────────────────────────────── */}
        <ApplicationTracker
          applications={applicationsData?.data || []}
          navigate={navigate}
        />

      </Stack>

      <style>{`
        .hover-lift:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </Container>
    </>
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

// ── Application Tracker ─────────────────────────────────────────────────────

const STAGE_ORDER = ['TRIAGE', 'PREP', 'DRAFTING', 'REVIEW', 'SUBMIT', 'AWARDED', 'REJECTED'] as const;
const STAGE_META: Record<string, { color: string; label: string }> = {
  TRIAGE: { color: 'gray', label: 'Triage' },
  PREP: { color: 'blue', label: 'Prep' },
  DRAFTING: { color: 'indigo', label: 'Drafting' },
  REVIEW: { color: 'orange', label: 'Review' },
  SUBMIT: { color: 'teal', label: 'Submit' },
  AWARDED: { color: 'green', label: 'Awarded' },
  REJECTED: { color: 'red', label: 'Rejected' },
};

function ApplicationTracker({
  applications,
  navigate,
}: {
  applications: ApplicationSummary[];
  navigate: (path: string) => void;
}) {
  if (applications.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md" style={{ borderStyle: 'dashed' }}>
        <Group justify="space-between" align="center">
          <Group gap="lg">
            <ThemeIcon size={56} radius="xl" variant="light" color="violet">
              <IconRocket size={28} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="lg">Application Tracker</Text>
              <Text size="sm" c="dimmed" mt={4} maw={500}>
                No applications yet. Start by pursuing an opportunity — the tracker will show your
                pipeline from triage through to submission and outcome.
              </Text>
            </div>
          </Group>
        </Group>
      </Paper>
    );
  }

  const stageCounts = STAGE_ORDER.reduce((acc, s) => {
    acc[s] = applications.filter(a => a.stage === s).length;
    return acc;
  }, {} as Record<string, number>);

  const active = applications.filter(a => !['AWARDED', 'REJECTED'].includes(a.stage));
  const awarded = stageCounts['AWARDED'] || 0;
  const rejected = stageCounts['REJECTED'] || 0;
  const total = applications.length;

  const pipelineValue = active.reduce((sum, app) => {
    return sum + normaliseAward(app.expectedAwardAmount ?? app.opportunity?.maxAward ?? null);
  }, 0);
  const pipelineCurrency = active.find(a => a.expectedCurrency)?.expectedCurrency
    || active.find(a => a.opportunity?.currency)?.opportunity?.currency || 'GBP';

  // Most recent 5 active applications
  const recentActive = active.slice(0, 5);

  return (
    <Paper withBorder p="lg" radius="md">
      <Group justify="space-between" mb="md">
        <div>
          <Text fw={700} size="lg">Application Tracker</Text>
          <Text size="sm" c="dimmed">
            {active.length} active · {awarded} awarded · {rejected} rejected
          </Text>
        </div>
        <Anchor size="sm" onClick={() => navigate('/applications')} style={{ cursor: 'pointer' }}>
          View all <IconArrowRight size={14} style={{ verticalAlign: 'middle' }} />
        </Anchor>
      </Group>

      {/* Stage pipeline bar */}
      <Stack gap="xs" mb="lg">
        <Group gap={4} style={{ height: 32 }}>
          {STAGE_ORDER.filter(s => stageCounts[s] > 0).map(stage => {
            const meta = STAGE_META[stage];
            const pct = Math.max((stageCounts[stage] / total) * 100, 8); // min width for visibility
            return (
              <Tooltip key={stage} label={`${meta.label}: ${stageCounts[stage]}`}>
                <Box
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    backgroundColor: `var(--mantine-color-${meta.color}-5)`,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'opacity 150ms',
                  }}
                  onClick={() => navigate('/applications')}
                >
                  {stageCounts[stage] > 0 && (
                    <Text size="xs" fw={700} c="white">{stageCounts[stage]}</Text>
                  )}
                </Box>
              </Tooltip>
            );
          })}
        </Group>
        <Group gap="md" justify="center">
          {STAGE_ORDER.filter(s => stageCounts[s] > 0).map(stage => (
            <Group key={stage} gap={4}>
              <Box w={8} h={8} style={{ borderRadius: 2, backgroundColor: `var(--mantine-color-${STAGE_META[stage].color}-5)` }} />
              <Text size="xs" c="dimmed">{STAGE_META[stage].label}</Text>
            </Group>
          ))}
        </Group>
      </Stack>

      {/* Key metrics row */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <Paper withBorder p="sm" radius="sm" style={{ textAlign: 'center' }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>In Flight</Text>
          <Text size="xl" fw={700} c="blue">{active.length}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="sm" style={{ textAlign: 'center' }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pipeline Value</Text>
          <Text size="xl" fw={700} c="green">
            {pipelineValue > 0 ? formatCurrency(pipelineValue, pipelineCurrency) : '—'}
          </Text>
        </Paper>
        <Paper withBorder p="sm" radius="sm" style={{ textAlign: 'center' }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Awarded</Text>
          <Text size="xl" fw={700} c="teal">{awarded}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="sm" style={{ textAlign: 'center' }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Success Rate</Text>
          <Text size="xl" fw={700} c={awarded > 0 ? 'teal' : 'dimmed'}>
            {awarded + rejected > 0 ? `${Math.round((awarded / (awarded + rejected)) * 100)}%` : '—'}
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Recent active applications */}
      {recentActive.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={600} c="dimmed">Recent Active</Text>
          {recentActive.map(app => {
            const meta = STAGE_META[app.stage] || STAGE_META.TRIAGE;
            return (
              <Paper
                key={app.id}
                withBorder p="sm" radius="sm"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/applications/${app.id}`)}
              >
                <Group justify="space-between" wrap="nowrap" mb={app.sections?.length ? 6 : 0}>
                  <Text size="sm" fw={500} truncate style={{ flex: 1 }}>{app.title}</Text>
                  <Group gap={6} wrap="nowrap">
                    {app.expectedAwardAmount && (
                      <Text size="xs" c="dimmed">
                        {formatCurrency(normaliseAward(app.expectedAwardAmount), app.expectedCurrency || 'GBP')}
                      </Text>
                    )}
                    <Badge size="sm" color={meta.color} variant="light">{meta.label}</Badge>
                  </Group>
                </Group>
                {app.sections && app.sections.length > 0 && (
                  <SectionProgressBar sections={app.sections} height={6} showLabel={false} />
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}
