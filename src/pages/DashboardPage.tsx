import { Container, Title, Text, SimpleGrid, Paper, Stack } from '@mantine/core';

export default function DashboardPage() {
  return (
    <Container size="xl">
      <Stack gap="lg">
        <Title order={1}>Dashboard</Title>
        
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <Paper withBorder p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Total Opportunities
            </Text>
            <Text size="xl" fw={700}>
              0
            </Text>
          </Paper>
          
          <Paper withBorder p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Active Applications
            </Text>
            <Text size="xl" fw={700}>
              0
            </Text>
          </Paper>
          
          <Paper withBorder p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              High-Score Opportunities
            </Text>
            <Text size="xl" fw={700}>
              0
            </Text>
          </Paper>
          
          <Paper withBorder p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Upcoming Deadlines
            </Text>
            <Text size="xl" fw={700}>
              0
            </Text>
          </Paper>
        </SimpleGrid>

        <Text c="dimmed">
          Dashboard KPIs will be implemented in Sprint 4
        </Text>
      </Stack>
    </Container>
  );
}
