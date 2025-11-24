import { Container, Title, Text } from '@mantine/core';
import { useParams } from 'react-router-dom';

export default function FunderDetailPage() {
  const { id } = useParams();

  return (
    <Container size="xl">
      <Title order={1}>Funder Detail</Title>
      <Text c="dimmed">Funder ID: {id}</Text>
      <Text c="dimmed" mt="md">
        Full funder detail view to be implemented
      </Text>
    </Container>
  );
}
