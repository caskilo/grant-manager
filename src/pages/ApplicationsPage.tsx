import {
  Container,
  Title,
  Button,
  Group,
  Stack,
  Badge,
  Text,
  Paper,
  Select,
  TextInput,
  ThemeIcon,
  Loader,
  Center,
} from '@mantine/core';
import { SectionProgressBar } from '../components/SectionProgressBar';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import {
  IconSearch,
  IconFileText,
  IconBuildingBank,
  IconArrowRight,
} from '@tabler/icons-react';
import { applicationsApi } from '../lib/applications';

const STAGE_CONFIG: Record<string, { color: string; label: string; order: number }> = {
  TRIAGE: { color: 'gray', label: 'Triage', order: 0 },
  PREP: { color: 'blue', label: 'Preparation', order: 1 },
  DRAFTING: { color: 'indigo', label: 'Drafting', order: 2 },
  REVIEW: { color: 'orange', label: 'Review', order: 3 },
  SUBMIT: { color: 'teal', label: 'Submit', order: 4 },
  AWARDED: { color: 'green', label: 'Awarded', order: 5 },
  REJECTED: { color: 'red', label: 'Rejected', order: 6 },
};

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['applications', stageFilter],
    queryFn: async () => {
      const res = await applicationsApi.list({
        stage: stageFilter || undefined,
        limit: 100,
      });
      return res.data;
    },
  });

  const applications = useMemo(() => {
    const items = data?.data || [];
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (app: any) =>
        app.title?.toLowerCase().includes(q) ||
        app.opportunity?.programName?.toLowerCase().includes(q) ||
        app.opportunity?.funder?.name?.toLowerCase().includes(q),
    );
  }, [data, searchQuery]);

  const stageCounts = useMemo(() => {
    const all = data?.data || [];
    const counts: Record<string, number> = {};
    all.forEach((app: any) => {
      counts[app.stage] = (counts[app.stage] || 0) + 1;
    });
    return counts;
  }, [data]);

  return (
    <Container size="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Applications</Title>
          <Text size="sm" c="dimmed" mt={4}>
            {applications.length} application{applications.length !== 1 ? 's' : ''}
            {stageFilter ? ` in ${STAGE_CONFIG[stageFilter]?.label || stageFilter}` : ''}
          </Text>
        </div>

        {/* Filter Bar */}
        <Paper p="md" withBorder>
          <Group gap="md" align="center">
            <TextInput
              data-testid="applications-search"
              placeholder="Search applications..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              data-testid="applications-stage-filter"
              placeholder="All stages"
              data={Object.entries(STAGE_CONFIG).map(([val, cfg]) => ({
                value: val,
                label: `${cfg.label} (${stageCounts[val] || 0})`,
              }))}
              value={stageFilter}
              onChange={setStageFilter}
              clearable
              style={{ width: 200 }}
            />
          </Group>
        </Paper>

        {/* Stage Pipeline Summary */}
        <Group gap="xs" wrap="wrap">
          {Object.entries(STAGE_CONFIG)
            .filter(([stage]) => (stageCounts[stage] || 0) > 0)
            .map(([stage, cfg]) => (
              <Badge
                key={stage}
                size="lg"
                color={cfg.color}
                variant={stageFilter === stage ? 'filled' : 'light'}
                style={{ cursor: 'pointer' }}
                onClick={() => setStageFilter(stageFilter === stage ? null : stage)}
              >
                {cfg.label}: {stageCounts[stage] || 0}
              </Badge>
            ))}
        </Group>

        {isLoading ? (
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        ) : applications.length === 0 ? (
          <Paper p="xl" withBorder>
            <Stack align="center" gap="md">
              <ThemeIcon size={60} radius="xl" variant="light" color="gray">
                <IconFileText size={30} />
              </ThemeIcon>
              <Text data-testid="applications-empty" size="lg" fw={500}>No Applications</Text>
              <Text size="sm" c="dimmed" ta="center" maw={400}>
                Applications are created from opportunities. Browse opportunities and click
                "Start Application" to begin.
              </Text>
              <Button onClick={() => navigate('/opportunities')}>
                Browse Opportunities
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Stack gap="sm">
            {applications.map((app: any) => {
              const stageInfo = STAGE_CONFIG[app.stage] || STAGE_CONFIG.TRIAGE;
              const sections = app.sections || [];

              return (
                <Paper
                  key={app.id}
                  p="md"
                  withBorder
                  data-testid="application-card"
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => navigate(`/applications/${app.id}`)}
                  className="hover-lift"
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Group gap="sm">
                        <Text fw={600} size="md">{app.title}</Text>
                        <Badge size="sm" color={stageInfo.color} variant="filled">
                          {stageInfo.label}
                        </Badge>
                        {app.outcome && app.outcome !== 'UNKNOWN' && (
                          <Badge
                            size="sm"
                            color={app.outcome === 'AWARDED' ? 'green' : 'red'}
                          >
                            {app.outcome}
                          </Badge>
                        )}
                      </Group>

                      {app.opportunity && (
                        <Group gap={6}>
                          <ThemeIcon size="xs" variant="light" color="blue">
                            <IconBuildingBank size={10} />
                          </ThemeIcon>
                          <Text size="sm" c="dimmed">
                            {app.opportunity.programName}
                            {app.opportunity.funder && ` — ${app.opportunity.funder.name}`}
                          </Text>
                        </Group>
                      )}

                      {sections.length > 0 && (
                        <SectionProgressBar
                          sections={sections}
                          height={10}
                          style={{ maxWidth: 360 }}
                        />
                      )}
                    </Stack>

                    <Stack gap={6} align="flex-end">
                      <Button
                        size="sm"
                        variant="light"
                        rightSection={<IconArrowRight size={14} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/applications/${app.id}`);
                        }}
                      >
                        Open
                      </Button>
                      <Text size="xs" c="dimmed" ta="right">
                        Owner: {app.leadOwner?.name || 'Unassigned'}
                      </Text>
                      <Text size="xs" c="dimmed" ta="right">
                        Updated: {new Date(app.updatedAt).toLocaleDateString()}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
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
