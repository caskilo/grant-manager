import { Container, Title, Button, Group, Stack, Table, Badge, Text, Modal, TextInput, Select, MultiSelect, NumberInput, Textarea, Alert, ActionIcon, Anchor, Loader, Paper } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { IconPlus, IconEdit, IconTrash, IconAlertCircle, IconExternalLink, IconWand } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { catalogueApi, CatalogueEntry, CreateCatalogueEntryDto, CatalogueEnums } from '../lib/catalogue';
import api from '../lib/api';

export default function CatalogueEditorPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CatalogueEntry | null>(null);
  const [scrapingUrl, setScrapingUrl] = useState('');
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [scrapedData, setScrapedData] = useState<Partial<CreateCatalogueEntryDto> | null>(null);

  const { data: catalogueData, isLoading } = useQuery({
    queryKey: ['catalogue'],
    queryFn: catalogueApi.getAll,
  });

  const { data: enums } = useQuery<CatalogueEnums>({
    queryKey: ['catalogue-enums'],
    queryFn: catalogueApi.getEnums,
  });

  const deleteMutation = useMutation({
    mutationFn: catalogueApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogue'] });
    },
  });

  const handleScrapeUrl = async () => {
    if (!scrapingUrl.trim()) return;

    setIsScrapingUrl(true);
    try {
      const response = await api.post<Partial<CreateCatalogueEntryDto>>('/catalogue/scrape', { url: scrapingUrl });
      setScrapedData(response.data);
      setEditingEntry(null);
      setModalOpen(true);
    } catch (error: any) {
      modals.open({
        title: 'Scraping Failed',
        children: (
          <Stack gap="md">
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {error.response?.data?.message || 'Failed to extract funder information from the URL. Please try manual entry.'}
            </Alert>
            <Button onClick={() => modals.closeAll()}>Close</Button>
          </Stack>
        ),
      });
    } finally {
      setIsScrapingUrl(false);
    }
  };

  const handleAdd = () => {
    setEditingEntry(null);
    setScrapedData(null);
    setModalOpen(true);
  };

  const handleEdit = (entry: CatalogueEntry) => {
    setEditingEntry(entry);
    setScrapedData(null);
    setModalOpen(true);
  };

  const handleDelete = (entry: CatalogueEntry) => {
    modals.openConfirmModal({
      title: 'Delete Catalogue Entry',
      children: (
        <Text size="sm">
          Are you sure you want to delete "{entry.name}"? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(entry.id),
    });
  };

  const formatAwardRange = (entry: CatalogueEntry) => {
    if (!entry.typicalAwardMin && !entry.typicalAwardMax) return '—';
    
    const formatAmount = (amount: number) => {
      if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}m`;
      if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
      return amount.toString();
    };

    const min = entry.typicalAwardMin ? formatAmount(entry.typicalAwardMin) : '';
    const max = entry.typicalAwardMax ? formatAmount(entry.typicalAwardMax) : '';
    const symbol = entry.currency === 'GBP' ? '£' : entry.currency === 'USD' ? '$' : '€';

    if (min && max) return `${symbol}${min} - ${symbol}${max}`;
    if (max) return `Up to ${symbol}${max}`;
    if (min) return `From ${symbol}${min}`;
    return '—';
  };

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Funder Catalogue Editor</Title>
        </Group>

        <Paper p="md" withBorder>
          <Stack gap="md">
            <Text fw={500}>Add New Funder</Text>
            <Group align="flex-end">
              <TextInput
                style={{ flex: 1 }}
                placeholder="Enter funder website URL (e.g., https://wellcome.org)"
                value={scrapingUrl}
                onChange={(e) => setScrapingUrl(e.currentTarget.value)}
                label="Funder URL"
              />
              <Button
                leftSection={<IconWand size={16} />}
                onClick={handleScrapeUrl}
                loading={isScrapingUrl}
                disabled={!scrapingUrl.trim()}
              >
                Auto-Fill
              </Button>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleAdd}
                variant="light"
              >
                Manual Entry
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              Enter a funder's website URL to automatically extract information, or use manual entry for full control.
            </Text>
          </Stack>
        </Paper>

        {isLoading ? (
          <Group justify="center" p="xl">
            <Loader size="lg" />
          </Group>
        ) : catalogueData?.data.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} color="blue">
            No funders in catalogue yet. Click "Add Funder" to create your first entry.
          </Alert>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th w={150}>Type</Table.Th>
                <Table.Th>Focus Areas</Table.Th>
                <Table.Th w={150}>Geography</Table.Th>
                <Table.Th w={120}>Award Range</Table.Th>
                <Table.Th w={100}>Open Data</Table.Th>
                <Table.Th w={100}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {catalogueData?.data.map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>
                    <Stack gap={4}>
                      <Text fw={500}>{entry.name}</Text>
                      {entry.websiteUrl && (
                        <Anchor href={entry.websiteUrl} target="_blank" rel="noopener noreferrer" size="xs" c="dimmed">
                          <Group gap={4}>
                            <Text size="xs">{new URL(entry.websiteUrl).hostname}</Text>
                            <IconExternalLink size={10} />
                          </Group>
                        </Anchor>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">{entry.type}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {entry.focus.slice(0, 2).map((f, i) => (
                        <Badge key={i} variant="dot" size="xs">{f}</Badge>
                      ))}
                      {entry.focus.length > 2 && (
                        <Badge variant="dot" size="xs" c="dimmed">+{entry.focus.length - 2}</Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{entry.geographies.slice(0, 2).join(', ')}{entry.geographies.length > 2 ? '...' : ''}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatAwardRange(entry)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={entry.openData === 'Yes' ? 'green' : entry.openData === 'Partial' ? 'yellow' : 'gray'}>
                      {entry.openData}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => handleEdit(entry)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(entry)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>

      <CatalogueEntryModal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setScrapedData(null);
        }}
        entry={editingEntry}
        enums={enums}
        scrapedData={scrapedData}
      />
    </Container>
  );
}

interface CatalogueEntryModalProps {
  opened: boolean;
  onClose: () => void;
  entry: CatalogueEntry | null;
  enums?: CatalogueEnums;
  scrapedData?: Partial<CreateCatalogueEntryDto> | null;
}

function CatalogueEntryModal({ opened, onClose, entry, enums, scrapedData }: CatalogueEntryModalProps) {
  const queryClient = useQueryClient();
  
  const getInitialFormData = (): CreateCatalogueEntryDto => ({
    name: scrapedData?.name || entry?.name || '',
    description: scrapedData?.description || entry?.description || '',
    type: scrapedData?.type || entry?.type || 'Foundation',
    focus: scrapedData?.focus || entry?.focus || [],
    geographies: scrapedData?.geographies || entry?.geographies || [],
    websiteUrl: scrapedData?.websiteUrl || entry?.websiteUrl || '',
    typicalAwardMin: scrapedData?.typicalAwardMin || entry?.typicalAwardMin,
    typicalAwardMax: scrapedData?.typicalAwardMax || entry?.typicalAwardMax,
    currency: scrapedData?.currency || entry?.currency || 'GBP',
    openData: scrapedData?.openData || entry?.openData || 'No',
    notes: scrapedData?.notes || entry?.notes || '',
  });
  
  const [formData, setFormData] = useState<CreateCatalogueEntryDto>(getInitialFormData());
  
  // Update form data when entry or scrapedData changes
  useEffect(() => {
    if (opened) {
      setFormData(getInitialFormData());
    }
  }, [opened, entry, scrapedData]);

  const createMutation = useMutation({
    mutationFn: catalogueApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogue'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; entry: Partial<CreateCatalogueEntryDto> }) =>
      catalogueApi.update(data.id, data.entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogue'] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (entry) {
      updateMutation.mutate({ id: entry.id, entry: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isValid = formData.name && formData.websiteUrl && formData.type;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={entry ? 'Edit Funder' : 'Add New Funder'}
      size="lg"
    >
      <Stack gap="md">
        <TextInput
          label="Name"
          placeholder="e.g., Wellcome Trust"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
        />

        <Textarea
          label="Description"
          placeholder="Brief description of the funder (auto-extracted from website)"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
          minRows={2}
        />

        <Select
          label="Funder Type"
          placeholder="Select type"
          required
          data={enums?.funderTypes || ['Foundation', 'Trust', 'Public Research Funder']}
          value={formData.type}
          onChange={(value) => setFormData({ ...formData, type: value || 'Foundation' })}
          searchable
        />

        <MultiSelect
          label="Focus Areas"
          placeholder="Select or type focus areas"
          data={enums?.commonFocusAreas || []}
          value={formData.focus}
          onChange={(value) => setFormData({ ...formData, focus: value })}
          searchable
        />

        <MultiSelect
          label="Geographies"
          placeholder="Select or type geographies"
          data={enums?.commonGeographies || []}
          value={formData.geographies}
          onChange={(value) => setFormData({ ...formData, geographies: value })}
          searchable
        />

        <TextInput
          label="Website URL"
          placeholder="https://example.org/"
          required
          value={formData.websiteUrl}
          onChange={(e) => setFormData({ ...formData, websiteUrl: e.currentTarget.value })}
        />

        <Group grow>
          <NumberInput
            label="Typical Award Min"
            placeholder="10000"
            value={formData.typicalAwardMin}
            onChange={(value) => setFormData({ ...formData, typicalAwardMin: value as number })}
            min={0}
            allowNegative={false}
          />

          <NumberInput
            label="Typical Award Max"
            placeholder="1000000"
            value={formData.typicalAwardMax}
            onChange={(value) => setFormData({ ...formData, typicalAwardMax: value as number })}
            min={0}
            allowNegative={false}
          />

          <Select
            label="Currency"
            data={enums?.currencies || ['GBP', 'USD', 'EUR']}
            value={formData.currency}
            onChange={(value) => setFormData({ ...formData, currency: value || 'GBP' })}
          />
        </Group>

        <Select
          label="Open Data Availability"
          data={enums?.openDataOptions || ['Yes', 'Partial', 'No']}
          value={formData.openData}
          onChange={(value) => setFormData({ ...formData, openData: value || 'No' })}
        />

        <Textarea
          label="Notes"
          placeholder="Additional information about this funder..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.currentTarget.value })}
          minRows={3}
        />

        {(createMutation.isError || updateMutation.isError) && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {(createMutation.error as Error)?.message || (updateMutation.error as Error)?.message || 'An error occurred'}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!isValid}
          >
            {entry ? 'Update' : 'Create'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

