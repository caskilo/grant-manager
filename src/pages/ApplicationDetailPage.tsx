import { Container, Title, Text } from '@mantine/core';
import { useParams } from 'react-router-dom';

export default function ApplicationDetailPage() {
  const { id } = useParams();

  return (
    <Container size="xl">
      <Title order={1}>Application Detail</Title>
      <Text c="dimmed">Application ID: {id}</Text>
      <Text c="dimmed" mt="md">
        Full application detail view to be implemented
      </Text>
    </Container>
  );
}
