import {
  Container,
  Title,
  Button,
  Group,
  Stack,
  TextInput,
  Select,
  Checkbox,
  Paper,
  Text,
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';

export default function ContactDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const isNew = id === 'new';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    roleTitle: '',
    funderId: '',
    opportunityId: '',
    isPrimary: false,
  });

  const [funders, setFunders] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);

  // Fetch contact if editing
  const { data: contact, isLoading: contactLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const response = await api.get(`/contacts/${id}`);
      return response.data;
    },
    enabled: !isNew,
  });

  // Fetch funders
  useQuery({
    queryKey: ['funders-list'],
    queryFn: async () => {
      const response = await api.get('/funders', { params: { limit: 1000 } });
      const funderList = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
      setFunders(funderList);
      return funderList;
    },
  });

  // Fetch opportunities
  useQuery({
    queryKey: ['opportunities-list'],
    queryFn: async () => {
      const response = await api.get('/opportunities', { params: { limit: 1000 } });
      const oppList = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
      setOpportunities(oppList);
      return oppList;
    },
  });

  // Populate form when contact loads
  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        roleTitle: contact.roleTitle || '',
        funderId: contact.funderId || '',
        opportunityId: contact.opportunityId || '',
        isPrimary: contact.isPrimary || false,
      });
    }
  }, [contact]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/contacts', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate('/contacts');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/contacts/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate('/contacts');
    },
  });

  const handleSubmit = () => {
    const submitData = {
      ...formData,
      funderId: formData.funderId || null,
      opportunityId: formData.opportunityId || null,
    };

    if (isNew) {
      createMutation.mutate(submitData);
    } else {
      updateMutation.mutate(submitData);
    }
  };

  if (!isNew && contactLoading) {
    return <Container>Loading...</Container>;
  }

  return (
    <Container size="md">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>{isNew ? 'Add Contact' : 'Edit Contact'}</Title>
          <Button variant="subtle" onClick={() => navigate('/contacts')}>
            Back
          </Button>
        </Group>

        <Paper p="md" withBorder>
          <Stack gap="md">
            <TextInput
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
              required
            />

            <TextInput
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.currentTarget.value })}
            />

            <TextInput
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.currentTarget.value })}
            />

            <TextInput
              label="Role/Title"
              value={formData.roleTitle}
              onChange={(e) => setFormData({ ...formData, roleTitle: e.currentTarget.value })}
            />

            <Select
              label="Funder"
              placeholder="Select a funder"
              value={formData.funderId}
              onChange={(value) => setFormData({ ...formData, funderId: value || '' })}
              data={funders.map((f) => ({ value: f.id, label: f.name }))}
              clearable
            />

            <Select
              label="Opportunity"
              placeholder="Select an opportunity"
              value={formData.opportunityId}
              onChange={(value) => setFormData({ ...formData, opportunityId: value || '' })}
              data={opportunities.map((o) => ({ value: o.id, label: o.programName }))}
              clearable
            />

            <Checkbox
              label="Primary Contact"
              checked={formData.isPrimary}
              onChange={(e) => setFormData({ ...formData, isPrimary: e.currentTarget.checked })}
            />

            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => navigate('/contacts')}>
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
