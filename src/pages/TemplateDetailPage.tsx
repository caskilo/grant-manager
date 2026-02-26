import {
  Container,
  Title,
  Text,
  Paper,
  Stack,
  Group,
  Badge,
  Button,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Divider,
  Alert,
  Table,
  Loader,
  Center,
  Switch,
  Tabs,
} from '@mantine/core';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconTrash,
  IconCopy,
  IconFileText,
  IconAlertCircle,
  IconHistory,
  IconSettings,
} from '@tabler/icons-react';
import api from '../lib/api';

const TEMPLATE_TYPE_OPTIONS = [
  { value: 'BOILERPLATE_1LINE', label: 'Boilerplate – 1 Line' },
  { value: 'BOILERPLATE_1PARA', label: 'Boilerplate – 1 Paragraph' },
  { value: 'BOILERPLATE_1PAGE', label: 'Boilerplate – 1 Page' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'SECTION', label: 'Section' },
  { value: 'OUTREACH', label: 'Outreach' },
  { value: 'LETTER', label: 'Letter' },
  { value: 'BUDGET', label: 'Budget' },
];

const CATEGORY_OPTIONS = [
  { value: 'core', label: 'Core' },
  { value: 'application-section', label: 'Application Section' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'organisational', label: 'Organisational' },
  { value: 'financial', label: 'Financial' },
  { value: 'reporting', label: 'Reporting' },
];

function getTypeColor(type: string): string {
  if (type.startsWith('BOILERPLATE')) return 'violet';
  if (type === 'PROPOSAL' || type === 'SECTION') return 'blue';
  if (type === 'OUTREACH' || type === 'LETTER') return 'teal';
  if (type === 'BUDGET') return 'orange';
  return 'gray';
}

function formatType(type: string): string {
  return TEMPLATE_TYPE_OPTIONS.find(o => o.value === type)?.label || type.replace(/_/g, ' ');
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

interface TemplateDetail {
  id: string;
  name: string;
  type: string;
  content: string;
  description: string | null;
  category: string | null;
  version: number;
  wordLimit: number | null;
  guidance: string | null;
  tags: string[];
  usageCount: number;
  isActive: boolean;
  createdBy: { id: string; name: string; email: string };
  usages: Array<{
    id: string;
    application: { id: string; title: string; stage: string };
    usedAt: string;
  }>;
  _count: { usages: number };
  createdAt: string;
  updatedAt: string;
}

export default function TemplateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [type, setType] = useState('SECTION');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [wordLimit, setWordLimit] = useState<number | string>('');
  const [guidance, setGuidance] = useState('');
  const [tags, setTags] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: template, isLoading, error } = useQuery<TemplateDetail>({
    queryKey: ['template', id],
    queryFn: async () => {
      const res = await api.get(`/templates/${id}`);
      return res.data;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (template) {
      setName(template.name);
      setType(template.type);
      setContent(template.content);
      setDescription(template.description || '');
      setCategory(template.category);
      setWordLimit(template.wordLimit ?? '');
      setGuidance(template.guidance || '');
      setTags(template.tags?.join(', ') || '');
      setIsActive(template.isActive);
      setHasChanges(false);
    }
  }, [template]);

  const markChanged = () => setHasChanges(true);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        type,
        content,
        description: description || undefined,
        category: category || undefined,
        wordLimit: wordLimit ? Number(wordLimit) : undefined,
        guidance: guidance || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        isActive,
      };
      if (isNew) {
        return api.post('/templates', payload);
      } else {
        return api.put(`/templates/${id}`, payload);
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['template', id] });
      setHasChanges(false);
      notifications.show({
        title: isNew ? 'Template Created' : 'Template Saved',
        message: `"${name}" has been ${isNew ? 'created' : 'saved'} successfully`,
        color: 'green',
      });
      if (isNew) {
        navigate(`/templates/${res.data.id}`, { replace: true });
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      notifications.show({
        title: 'Error',
        message: Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to save template',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      notifications.show({ title: 'Deleted', message: 'Template deactivated', color: 'orange' });
      navigate('/templates');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => api.post(`/templates/${id}/duplicate`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      notifications.show({ title: 'Duplicated', message: 'Template duplicated', color: 'blue' });
      navigate(`/templates/${res.data.id}`);
    },
  });

  if (!isNew && isLoading) {
    return (
      <Container size="lg">
        <Center py="xl"><Loader size="lg" /></Center>
      </Container>
    );
  }

  if (!isNew && (error || !template)) {
    return (
      <Container size="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" mt="xl">
          Template not found or error loading data.
        </Alert>
        <Button mt="md" onClick={() => navigate('/templates')}>Back to Templates</Button>
      </Container>
    );
  }

  const currentWordCount = wordCount(content);
  const isOverLimit = wordLimit && typeof wordLimit === 'number' && currentWordCount > wordLimit;

  return (
    <Container size="lg">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/templates')}>
            Back to Templates
          </Button>
          <Group gap="xs">
            {!isNew && (
              <>
                <Button
                  variant="subtle"
                  color="blue"
                  leftSection={<IconCopy size={16} />}
                  onClick={() => duplicateMutation.mutate()}
                  loading={duplicateMutation.isPending}
                >
                  Duplicate
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => {
                    if (confirm('Deactivate this template?')) {
                      deleteMutation.mutate();
                    }
                  }}
                >
                  Delete
                </Button>
              </>
            )}
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!name || !content || !hasChanges}
              color={hasChanges ? 'green' : 'gray'}
            >
              {isNew ? 'Create Template' : 'Save Changes'}
            </Button>
          </Group>
        </Group>

        {/* Title + Meta */}
        <Paper p="lg" withBorder>
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Title order={2}>{isNew ? 'New Template' : name || 'Untitled'}</Title>
                {!isNew && template && (
                  <Group gap="xs" mt="xs">
                    <Badge color={getTypeColor(template.type)} size="sm">
                      {formatType(template.type)}
                    </Badge>
                    {template.category && (
                      <Badge variant="dot" size="sm">{template.category}</Badge>
                    )}
                    <Badge variant="light" size="sm">v{template.version}</Badge>
                    <Text size="xs" c="dimmed">
                      Used {template._count?.usages ?? 0} times
                    </Text>
                    {!template.isActive && (
                      <Badge color="red" size="sm">Inactive</Badge>
                    )}
                  </Group>
                )}
              </div>
              {!isNew && template && (
                <Text size="xs" c="dimmed" ta="right">
                  Created by {template.createdBy?.name}<br />
                  {new Date(template.createdAt).toLocaleDateString()}
                </Text>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Tabs */}
        <Tabs defaultValue="content">
          <Tabs.List>
            <Tabs.Tab value="content" leftSection={<IconFileText size={16} />}>Content</Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>Settings</Tabs.Tab>
            {!isNew && (
              <Tabs.Tab value="usage" leftSection={<IconHistory size={16} />}>
                Usage History ({template?._count?.usages ?? 0})
              </Tabs.Tab>
            )}
          </Tabs.List>

          {/* Content Tab */}
          <Tabs.Panel value="content" pt="md">
            <Stack gap="md">
              <TextInput
                label="Name"
                description="A clear, descriptive name for this template"
                value={name}
                onChange={(e) => { setName(e.currentTarget.value); markChanged(); }}
                required
                placeholder="e.g. Executive Summary – Standard"
              />

              <Textarea
                label="Description"
                description="Brief explanation of when and how to use this template"
                value={description}
                onChange={(e) => { setDescription(e.currentTarget.value); markChanged(); }}
                placeholder="Describe the purpose and best use case for this template..."
                minRows={2}
                autosize
              />

              <Textarea
                label="Guidance"
                description="Editorial notes to help the writer when using this template"
                value={guidance}
                onChange={(e) => { setGuidance(e.currentTarget.value); markChanged(); }}
                placeholder="e.g. Focus on outcomes and impact metrics. Avoid jargon..."
                minRows={2}
                autosize
              />

              <div>
                <Group justify="space-between" mb={4}>
                  <Text size="sm" fw={500}>
                    Content <Text span c="red">*</Text>
                  </Text>
                  <Group gap="xs">
                    <Text size="xs" c={isOverLimit ? 'red' : 'dimmed'}>
                      {currentWordCount} words
                      {wordLimit && typeof wordLimit === 'number' ? ` / ${wordLimit} limit` : ''}
                    </Text>
                  </Group>
                </Group>
                <Textarea
                  value={content}
                  onChange={(e) => { setContent(e.currentTarget.value); markChanged(); }}
                  placeholder="Write the template content here..."
                  minRows={12}
                  maxRows={30}
                  autosize
                  required
                  styles={isOverLimit ? {
                    input: { borderColor: 'var(--mantine-color-red-6)' },
                  } : undefined}
                />
                {isOverLimit && (
                  <Text size="xs" c="red" mt={4}>
                    Content exceeds the word limit by {currentWordCount - Number(wordLimit)} words
                  </Text>
                )}
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Settings Tab */}
          <Tabs.Panel value="settings" pt="md">
            <Stack gap="md">
              <Group grow align="flex-start">
                <Select
                  label="Type"
                  description="The kind of template content"
                  value={type}
                  onChange={(v) => { setType(v || 'SECTION'); markChanged(); }}
                  data={TEMPLATE_TYPE_OPTIONS}
                  required
                />

                <Select
                  label="Category"
                  description="Organisational grouping"
                  value={category}
                  onChange={(v) => { setCategory(v); markChanged(); }}
                  data={CATEGORY_OPTIONS}
                  clearable
                  placeholder="Select category..."
                />
              </Group>

              <Group grow align="flex-start">
                <NumberInput
                  label="Word Limit"
                  description="Maximum word count guidance (optional)"
                  value={wordLimit}
                  onChange={(v) => { setWordLimit(v); markChanged(); }}
                  min={1}
                  placeholder="No limit"
                />

                <TextInput
                  label="Tags"
                  description="Comma-separated tags for search and filtering"
                  value={tags}
                  onChange={(e) => { setTags(e.currentTarget.value); markChanged(); }}
                  placeholder="e.g. core, odyssean-process, governance"
                />
              </Group>

              <Divider />

              <Switch
                label="Active"
                description="Inactive templates are hidden from selection lists"
                checked={isActive}
                onChange={(e) => { setIsActive(e.currentTarget.checked); markChanged(); }}
              />
            </Stack>
          </Tabs.Panel>

          {/* Usage History Tab */}
          {!isNew && (
            <Tabs.Panel value="usage" pt="md">
              {template?.usages && template.usages.length > 0 ? (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Application</Table.Th>
                      <Table.Th>Stage</Table.Th>
                      <Table.Th>Used At</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {template.usages.map((usage) => (
                      <Table.Tr
                        key={usage.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/applications/${usage.application.id}`)}
                      >
                        <Table.Td>{usage.application.title}</Table.Td>
                        <Table.Td>
                          <Badge size="sm">{usage.application.stage}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{new Date(usage.usedAt).toLocaleDateString()}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Paper p="xl" withBorder>
                  <Text ta="center" c="dimmed">This template has not been used in any applications yet.</Text>
                </Paper>
              )}
            </Tabs.Panel>
          )}
        </Tabs>
      </Stack>
    </Container>
  );
}
