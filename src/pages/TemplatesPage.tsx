import {
  Container,
  Title,
  Button,
  Group,
  Stack,
  Table,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Select,
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../lib/api';

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'PROPOSAL',
    content: '',
    tags: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await api.get('/templates');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/templates', {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [],
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setOpened(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/templates/${id}`, {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [],
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setOpened(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/templates/${id}/duplicate`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', type: 'PROPOSAL', content: '', tags: '' });
    setEditingTemplate(null);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      content: template.content,
      tags: template.tags?.join(', ') || '',
    });
    setOpened(true);
  };

  const handleSubmit = () => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const templates: any[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
    ? (data as any).data
    : [];

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Templates</Title>
          <Button onClick={() => { resetForm(); setOpened(true); }}>
            Add Template
          </Button>
        </Group>

        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Usage Count</Table.Th>
                <Table.Th>Created By</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {templates.map((template: any) => (
                <Table.Tr key={template.id}>
                  <Table.Td>{template.name}</Table.Td>
                  <Table.Td>
                    <Badge>{template.type}</Badge>
                  </Table.Td>
                  <Table.Td>{template._count?.usages || 0}</Table.Td>
                  <Table.Td>{template.createdBy?.name || '—'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" variant="subtle" onClick={() => handleEdit(template)}>
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="blue"
                        onClick={() => duplicateMutation.mutate(template.id)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={() => {
                          if (confirm('Delete this template?')) {
                            deleteMutation.mutate(template.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        <Modal
          opened={opened}
          onClose={() => { setOpened(false); resetForm(); }}
          title={editingTemplate ? 'Edit Template' : 'Create Template'}
          size="lg"
        >
          <Stack gap="md">
            <TextInput
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
              required
            />

            <Select
              label="Type"
              value={formData.type}
              onChange={(value) => setFormData({ ...formData, type: value || 'PROPOSAL' })}
              data={[
                { value: 'PROPOSAL', label: 'Proposal' },
                { value: 'BUDGET', label: 'Budget' },
                { value: 'REPORT', label: 'Report' },
                { value: 'LETTER', label: 'Letter' },
              ]}
              required
            />

            <Textarea
              label="Content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.currentTarget.value })}
              minRows={10}
              required
            />

            <TextInput
              label="Tags (comma-separated)"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.currentTarget.value })}
            />

            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => { setOpened(false); resetForm(); }}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingTemplate ? 'Update' : 'Create'}
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
