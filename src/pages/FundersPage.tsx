import { Container, Title, Button, Group, Stack, Table, Badge } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function FundersPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['funders'],
    queryFn: async () => {
      const response = await api.get('/funders', {
              params: {
                page: 1,
                limit: 100,
              },
            });
      return response.data;
    },
  });

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Funders</Title>
          <Button onClick={() => navigate('/funders/new')}>Add Funder</Button>
        </Group>

        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Opportunities</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data?.data?.map((funder: any) => (
                <Table.Tr key={funder.id}>
                  <Table.Td>{funder.name}</Table.Td>
                  <Table.Td>
                    <Badge>{funder.type}</Badge>
                  </Table.Td>
                  <Table.Td>{funder._count?.opportunities || 0}</Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => navigate(`/funders/${funder.id}`)}
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
