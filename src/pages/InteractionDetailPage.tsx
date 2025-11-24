import {
  Container,
  Title,
  Button,
  Group,
  Stack,
  TextInput,
  Select,
  Textarea,
  Paper,
  Text,
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';

export default function InteractionDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const isNew = id === 'new';

  const [formData, setFormData] = useState({
    interactionType: 'EMAIL',
    summary: '',
    contactId: '',
    applicationId: '',
    occurredAt: new Date().toISOString().split('T')[0],
  });

  const [contacts, setContacts] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);

  // Fetch interaction if editing
  const { data: interaction, isLoading: interactionLoading } = useQuery({
    queryKey: ['interaction', id],
    queryFn: async () => {
      const response = await api.get(`/interactions/${id}`);
      return response.data;
    },
    enabled: !isNew,
  });

  // Fetch contacts
  useQuery({
    queryKey: ['contacts-list'],
    queryFn: async () => {
      const response = await api.get('/contacts', { params: { limit: 1000 } });
      const contactList = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
      setContacts(contactList);
      return contactList;
    },
  });

  // Fetch applications
  useQuery({
    queryKey: ['applications-list'],
    queryFn: async () => {
      const response = await api.get('/applications', { params: { limit: 1000 } });
      const appList = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
      setApplications(appList);
      return appList;
    },
  });

  // Populate form when interaction loads
  useEffect(() => {
    if (interaction) {
      setFormData({
        interactionType: interaction.interactionType || 'EMAIL',
        summary: interaction.summary || '',
        contactId: interaction.contactId || '',
        applicationId: interaction.applicationId || '',
        occurredAt: interaction.occurredAt
          ? new Date(interaction.occurredAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
      });
    }
  }, [interaction]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/interactions', {
        ...data,
        occurredAt: new Date(data.occurredAt).toISOString(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      navigate('/interactions');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/interactions/${id}`, {
        ...data,
        occurredAt: new Date(data.occurredAt).toISOString(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      navigate('/interactions');
    },
  });

  const handleSubmit = () => {
    const submitData = {
      ...formData,
      contactId: formData.contactId || null,
      applicationId: formData.applicationId || null,
    };

    if (isNew) {
      createMutation.mutate(submitData);
    } else {
      updateMutation.mutate(submitData);
    }
  };

  if (!isNew && interactionLoading) {
    return <Container>Loading...</Container>;
  }

  return (
    <Container size="md">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>{isNew ? 'Log Interaction' : 'Edit Interaction'}</Title>
          <Button variant="subtle" onClick={() => navigate('/interactions')}>
            Back
          </Button>
        </Group>

        <Paper p="md" withBorder>
          <Stack gap="md">
            <Select
              label="Type"
              value={formData.interactionType}
              onChange={(value) =>
                setFormData({ ...formData, interactionType: value || 'EMAIL' })
              }
              data={[
                { value: 'EMAIL', label: 'Email' },
                { value: 'PHONE', label: 'Phone' },
                { value: 'MEETING', label: 'Meeting' },
                { value: 'NOTE', label: 'Note' },
              ]}
              required
            />

            <TextInput
              label="Date"
              type="date"
              value={formData.occurredAt}
              onChange={(e) =>
                setFormData({ ...formData, occurredAt: e.currentTarget.value })
              }
              required
            />

            <Textarea
              label="Summary"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.currentTarget.value })}
              minRows={4}
              required
            />

            <Select
              label="Contact"
              placeholder="Select a contact"
              value={formData.contactId}
              onChange={(value) => setFormData({ ...formData, contactId: value || '' })}
              data={contacts.map((c) => ({ value: c.id, label: c.name }))}
              clearable
            />

            <Select
              label="Application"
              placeholder="Select an application"
              value={formData.applicationId}
              onChange={(value) => setFormData({ ...formData, applicationId: value || '' })}
              data={applications.map((a) => ({ value: a.id, label: a.title }))}
              clearable
            />

            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => navigate('/interactions')}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {isNew ? 'Create' : 'Update'}
              </Button>
            </Group>

            {createMutation.isError && (
              <Text c="red">Error: {(createMutation.error as Error).message}</Text>
            )}
            {updateMutation.isError && (
              <Text c="red">Error: {(updateMutation.error as Error).message}</Text>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
