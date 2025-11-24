import { Container, Title, Button, Group, Stack, Table, Badge } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function ApplicationsPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const response = await api.get('/applications');
      return response.data;
    },
  });

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Applications</Title>
          <Button onClick={() => navigate('/applications/new')}>Create Application</Button>
        </Group>

        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Opportunity</Table.Th>
                <Table.Th>Stage</Table.Th>
                <Table.Th>Owner</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data?.map((app: any) => (
                <Table.Tr key={app.id}>
                  <Table.Td>{app.title}</Table.Td>
                  <Table.Td>{app.opportunity?.programName}</Table.Td>
                  <Table.Td>
                    <Badge>{app.stage}</Badge>
                  </Table.Td>
                  <Table.Td>{app.leadOwner?.name}</Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => navigate(`/applications/${app.id}`)}
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
