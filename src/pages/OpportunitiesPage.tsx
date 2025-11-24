import { Container, Title, Button, Group, Stack, Table, Badge } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function OpportunitiesPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const response = await api.get('/opportunities', {
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
          <Title order={1}>Opportunities</Title>
          <Button onClick={() => navigate('/opportunities/new')}>Add Opportunity</Button>
        </Group>

        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Program</Table.Th>
                <Table.Th>Funder</Table.Th>
                <Table.Th style={{ width: '8%' }}>Fit Score</Table.Th>
                <Table.Th style={{ width: '8%' }}>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data?.data?.map((opp: any) => {
                const rawScore = opp.aiFitScore;
                const scoreNumber =
                  typeof rawScore === 'number'
                    ? rawScore
                    : rawScore != null
                    ? Number(rawScore)
                    : null;

                const hasValidScore = typeof scoreNumber === 'number' && !Number.isNaN(scoreNumber);

                return (
                  <Table.Tr key={opp.id}>
                    <Table.Td>{opp.programName}</Table.Td>
                    <Table.Td>{opp.funder?.name}</Table.Td>
                    <Table.Td style={{ width: '10%' }}>
                      {hasValidScore ? (
                        <Badge
                          color={scoreNumber >= 7 ? 'green' : scoreNumber >= 4 ? 'yellow' : 'red'}
                        >
                          {scoreNumber.toFixed(1)}
                        </Badge>
                      ) : (
                        <Badge color="gray">N/A</Badge>
                      )}
                    </Table.Td>
                    <Table.Td style={{ width: '10%' }}>
                      <Badge>{opp.status}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => navigate(`/opportunities/${opp.id}`)}
                      >
                        View
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Container>
  );
}
