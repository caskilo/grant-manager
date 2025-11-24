import { Container, Title, Button, Group, Stack, Table, Badge, Select } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function InteractionsPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['interactions', typeFilter],
    queryFn: async () => {
      const response = await api.get('/interactions', {
        params: {
          interactionType: typeFilter || undefined,
          page: 1,
          limit: 100,
        },
      });
      return response.data;
    },
  });

  const interactions: any[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
    ? (data as any).data
    : [];

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Interactions</Title>
          <Button onClick={() => navigate('/interactions/new')}>Log Interaction</Button>
        </Group>

        <Select
          placeholder="Filter by type"
          clearable
          value={typeFilter}
          onChange={setTypeFilter}
          data={[
            { value: 'EMAIL', label: 'Email' },
            { value: 'PHONE', label: 'Phone' },
            { value: 'MEETING', label: 'Meeting' },
            { value: 'NOTE', label: 'Note' },
          ]}
        />

        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Summary</Table.Th>
                <Table.Th>Contact</Table.Th>
                <Table.Th>Application</Table.Th>
                <Table.Th>Recorded By</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {interactions.map((interaction: any) => (
                <Table.Tr key={interaction.id}>
                  <Table.Td>
                    {new Date(interaction.occurredAt).toLocaleDateString()}
                  </Table.Td>
                  <Table.Td>
                    <Badge>{interaction.interactionType}</Badge>
                  </Table.Td>
                  <Table.Td>{interaction.summary}</Table.Td>
                  <Table.Td>{interaction.contact?.name || '—'}</Table.Td>
                  <Table.Td>{interaction.application?.title || '—'}</Table.Td>
                  <Table.Td>{interaction.createdBy?.name || '—'}</Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => navigate(`/interactions/${interaction.id}`)}
                    >
                      View
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Container>
  );
}
