import { Container, Title, Text } from '@mantine/core';
import { useParams } from 'react-router-dom';

export default function OpportunityDetailPage() {
  const { id } = useParams();

  return (
    <Container size="xl">
      <Title order={1}>Opportunity Detail</Title>
      <Text c="dimmed">Opportunity ID: {id}</Text>
      <Text c="dimmed" mt="md">
        Full opportunity detail view to be implemented
      </Text>
    </Container>
  );
}
