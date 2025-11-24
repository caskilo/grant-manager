import { Container, Title, Button, Group, Stack, Table, Badge, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function ContactsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: async () => {
      const response = await api.get('/contacts', {
        params: {
          page: 1,
          limit: 100,
        },
      });
      return response.data;
    },
  });

  const contacts: any[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
    ? (data as any).data
    : [];

  const filteredContacts = search
    ? contacts.filter(
        (c) =>
          c.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.email?.toLowerCase().includes(search.toLowerCase()) ||
          c.roleTitle?.toLowerCase().includes(search.toLowerCase())
      )
    : contacts;

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Contacts</Title>
          <Button onClick={() => navigate('/contacts/new')}>Add Contact</Button>
        </Group>

        <TextInput
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />

        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Phone</Table.Th>
                <Table.Th>Organization</Table.Th>
                <Table.Th>Primary</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredContacts.map((contact: any) => (
                <Table.Tr key={contact.id}>
                  <Table.Td>{contact.name}</Table.Td>
                  <Table.Td>{contact.roleTitle || '—'}</Table.Td>
                  <Table.Td>{contact.email || '—'}</Table.Td>
                  <Table.Td>{contact.phone || '—'}</Table.Td>
                  <Table.Td>
                    {contact.funder?.name || contact.opportunity?.programName || '—'}
                  </Table.Td>
                  <Table.Td>
                    {contact.isPrimary && <Badge color="blue">Primary</Badge>}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
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
