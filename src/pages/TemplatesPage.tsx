import {
  Container,
  Title,
  Button,
  Group,
  Stack,
  Badge,
  Text,
  Paper,
  TextInput,
  Select,
  Loader,
  Center,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { IconSearch, IconPlus } from '@tabler/icons-react';
import api from '../lib/api';

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'BOILERPLATE_1LINE', label: 'Boilerplate – 1 Line' },
  { value: 'BOILERPLATE_1PARA', label: 'Boilerplate – 1 Paragraph' },
  { value: 'BOILERPLATE_1PAGE', label: 'Boilerplate – 1 Page' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'SECTION', label: 'Section' },
  { value: 'OUTREACH', label: 'Outreach' },
  { value: 'LETTER', label: 'Letter' },
  { value: 'BUDGET', label: 'Budget' },
];

function getTypeColor(type: string): string {
  if (type.startsWith('BOILERPLATE')) return 'violet';
  if (type === 'PROPOSAL' || type === 'SECTION') return 'blue';
  if (type === 'OUTREACH' || type === 'LETTER') return 'teal';
  if (type === 'BUDGET') return 'orange';
  return 'gray';
}

function formatType(type: string): string {
  return TYPE_OPTIONS.find(o => o.value === type)?.label || type.replace(/_/g, ' ');
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await api.get('/templates');
      return response.data;
    },
  });

  const templates: any[] = useMemo(() => {
    const raw = Array.isArray(data) ? data : Array.isArray((data as any)?.data) ? (data as any).data : [];

    return raw.filter((t: any) => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.tags?.some((tag: string) => tag.toLowerCase().includes(q))
      );
    });
  }, [data, searchFilter, typeFilter]);

  // Group templates by category
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const t of templates) {
      const cat = t.category || 'Uncategorised';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [templates]);

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Templates</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/templates/new')}>
            New Template
          </Button>
        </Group>

        <Group grow>
          <TextInput
            placeholder="Search templates..."
            leftSection={<IconSearch size={16} />}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.currentTarget.value)}
          />
          <Select
            placeholder="Filter by type"
            value={typeFilter}
            onChange={setTypeFilter}
            data={TYPE_OPTIONS}
            clearable
            style={{ maxWidth: 250 }}
          />
        </Group>

        {isLoading ? (
          <Center py="xl"><Loader size="lg" /></Center>
        ) : templates.length === 0 ? (
          <Paper p="xl" withBorder>
            <Text ta="center" c="dimmed">
              {searchFilter || typeFilter ? 'No templates match your filters.' : 'No templates yet. Create your first template.'}
            </Text>
          </Paper>
        ) : (
          <Stack gap="xl">
            {grouped.map(([category, items]) => (
              <Stack key={category} gap="sm">
                <Text size="sm" fw={600} c="dimmed" tt="uppercase">{category}</Text>
                {items.map((template: any) => (
                  <Paper
                    key={template.id}
                    p="md"
                    withBorder
                    style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                    onClick={() => navigate(`/templates/${template.id}`)}
                    className="hover-lift"
                  >
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Text fw={600}>{template.name}</Text>
                        {template.description && (
                          <Text size="sm" c="dimmed" lineClamp={1}>{template.description}</Text>
                        )}
                        <Group gap="xs">
                          <Badge size="sm" color={getTypeColor(template.type)}>
                            {formatType(template.type)}
                          </Badge>
                          {template.version > 1 && (
                            <Badge size="sm" variant="light">v{template.version}</Badge>
                          )}
                          {template.wordLimit && (
                            <Badge size="sm" variant="dot">{template.wordLimit} words</Badge>
                          )}
                          {template.tags?.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} size="xs" variant="outline" color="gray">{tag}</Badge>
                          ))}
                        </Group>
                      </Stack>
                      <Stack gap={2} align="flex-end" style={{ minWidth: 80 }}>
                        <Text size="xs" c="dimmed">
                          {template._count?.usages || 0} uses
                        </Text>
                        <Text size="xs" c="dimmed">
                          {template.createdBy?.name}
                        </Text>
                      </Stack>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            ))}
          </Stack>
        )}

        <style>{`
          .hover-lift:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }
        `}</style>
      </Stack>
    </Container>
  );
}
