import { Container, Title, Button, Group, Stack, Badge, Text, Tooltip, Modal, Alert, TextInput, Paper, Anchor } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { IconAlertCircle, IconCheck, IconSparkles, IconSearch, IconExternalLink } from '@tabler/icons-react';
import api from '../lib/api';
import { discoveryApi } from '../lib/discovery';
import HarvestManagementModal from '../components/harvest/HarvestManagementModal';

interface Funder {
  id: string;
  name: string;
  type: string;
  description: string | null;
  notes: string | null;
  tags: string[];
  geographies: string[];
  websiteUrl: string | null;
  _count: {
    opportunities: number;
    contacts: number;
  };
  stats?: {
    avgFitScore: number | null;
    highFitCount: number;
    avgAlignment: number | null;
    highAlignmentCount: number;
  };
}

interface FundersResponse {
  data: Funder[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const isCatalogueFunder = (tags: string[]): boolean => {
  return tags.some(tag => tag.includes('DISCOVERY') || tag.includes('CATALOGUE'));
};

const getCatalogueType = (tags: string[]): string | null => {
  const catalogueTypeTag = tags.find(tag => tag.startsWith('CATALOGUE_TYPE:'));
  return catalogueTypeTag ? catalogueTypeTag.replace('CATALOGUE_TYPE:', '') : null;
};

export default function FundersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false);
  const [integrationModalOpen, setIntegrationModalOpen] = useState(false);
  const [lastRunDate, setLastRunDate] = useState<string | null>(null);
  const [selectedFunder, setSelectedFunder] = useState<Funder | null>(null);
  const [harvestModalOpen, setHarvestModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const { data, isLoading } = useQuery<FundersResponse>({
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

  const filteredFunders = data?.data?.filter((funder) => {
    if (!searchFilter.trim()) return true;
    const searchLower = searchFilter.toLowerCase();
    return (
      funder.name.toLowerCase().includes(searchLower) ||
      funder.type.toLowerCase().includes(searchLower) ||
      funder.description?.toLowerCase().includes(searchLower) ||
      funder.geographies?.some(geo => geo.toLowerCase().includes(searchLower)) ||
      funder.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }) || [];

  const runDiscoveryMutation = useMutation({
    mutationFn: () => discoveryApi.runCatalogue(),
    onSuccess: (result) => {
      setLastRunDate(result.runDate);
      setDiscoveryModalOpen(true);
    },
  });

  const integrateMutation = useMutation({
    mutationFn: (runDate: string) => discoveryApi.integrateRun(runDate, false),
    onSuccess: () => {
      setIntegrationModalOpen(true);
      queryClient.invalidateQueries({ queryKey: ['funders'] });
      setLastRunDate(null);
    },
  });

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Funders</Title>
          <Group>
            <Button
              loading={runDiscoveryMutation.isPending}
              onClick={() => runDiscoveryMutation.mutate()}
            >
              Update from Catalogue
            </Button>
            <Button onClick={() => navigate('/catalogue')}>Edit Catalogue</Button>
          </Group>
        </Group>

        {lastRunDate && (
          <Alert color="green">
            <Text size="sm">
              Discovery run completed! Integration ready for: {new Date(lastRunDate).toLocaleString()}
            </Text>
            <Button
              size="xs"
              mt="xs"
              loading={integrateMutation.isPending}
              onClick={() => integrateMutation.mutate(lastRunDate)}
            >
              Integrate Now
            </Button>
          </Alert>
        )}

        {/* Search Bar */}
        <TextInput
          placeholder="Search funders by name, type, description, or location..."
          leftSection={<IconSearch size={16} />}
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.currentTarget.value)}
          size="md"
        />

        {/* Funders Grid */}
        {isLoading ? (
          <Text ta="center" c="dimmed" py="xl">Loading funders...</Text>
        ) : filteredFunders.length === 0 ? (
          <Paper p="xl" withBorder>
            <Text ta="center" c="dimmed">No funders found</Text>
          </Paper>
        ) : (
          <Stack gap="md">
            {filteredFunders.map((funder) => (
              <Paper
                key={funder.id}
                p="lg"
                withBorder
                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => navigate(`/funders/${funder.id}`)}
                className="hover-lift"
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    {/* Funder Name and Website */}
                    <div>
                      <Text fw={600} size="lg">{funder.name}</Text>
                      {funder.websiteUrl && (
                        <Anchor
                          href={funder.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          c="dimmed"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Group gap={4}>
                            <Text size="sm">{new URL(funder.websiteUrl).hostname}</Text>
                            <IconExternalLink size={12} />
                          </Group>
                        </Anchor>
                      )}
                    </div>

                    {/* Description */}
                    {funder.description && (
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {funder.description}
                      </Text>
                    )}

                    {/* Metadata Row */}
                    <Group gap="lg" wrap="wrap">
                      {/* Type */}
                      <Group gap={6}>
                        <Text size="sm" fw={500}>Type:</Text>
                        <Badge size="sm" variant="light">{getCatalogueType(funder.tags) || funder.type}</Badge>
                      </Group>

                      {/* Location */}
                      {funder.geographies && funder.geographies.length > 0 && (
                        <Group gap={6}>
                          <Text size="sm" fw={500}>Location:</Text>
                          <Text size="sm">{funder.geographies.join(', ')}</Text>
                        </Group>
                      )}

                      {/* Opportunities Count */}
                      <Group gap={6}>
                        <Text size="sm" fw={500}>Opportunities:</Text>
                        <Badge size="sm" color="blue">{funder._count?.opportunities || 0}</Badge>
                      </Group>

                      {/* Average Fit Score */}
                      {funder.stats?.avgFitScore !== null && funder.stats?.avgFitScore !== undefined && (
                        <Tooltip label={`${funder.stats.highFitCount} high-fit opportunities (7+)`}>
                          <Badge 
                            size="sm" 
                            color={funder.stats.avgFitScore >= 7 ? 'green' : funder.stats.avgFitScore >= 5 ? 'yellow' : 'gray'}
                            variant="filled"
                          >
                            Avg Fit: {funder.stats.avgFitScore.toFixed(1)}/10
                          </Badge>
                        </Tooltip>
                      )}

                      {/* Alignment Score */}
                      {funder.stats?.avgAlignment !== null && funder.stats?.avgAlignment !== undefined && (
                        <Tooltip label={`${funder.stats.highAlignmentCount} highly aligned opportunities (70%+)`}>
                          <Badge 
                            size="sm" 
                            color={funder.stats.avgAlignment >= 70 ? 'green' : funder.stats.avgAlignment >= 50 ? 'blue' : 'gray'}
                            variant="dot"
                          >
                            {Math.round(funder.stats.avgAlignment)}% Match
                          </Badge>
                        </Tooltip>
                      )}

                      {/* Source */}
                      {isCatalogueFunder(funder.tags) && (
                        <Badge size="sm" variant="dot" color="blue">
                          Catalogue
                        </Badge>
                      )}
                    </Group>
                  </Stack>

                  {/* Actions */}
                  <Button
                    size="sm"
                    variant="light"
                    color="violet"
                    leftSection={<IconSparkles size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFunder(funder);
                      setHarvestModalOpen(true);
                    }}
                  >
                    Harvest
                  </Button>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}

        <style>{`
          .hover-lift:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
        `}</style>
      </Stack>

      {discoveryModalOpen && (
        <Modal
          opened={discoveryModalOpen}
          onClose={() => setDiscoveryModalOpen(false)}
          title="Discovery Run Complete"
        >
          <Alert icon={<IconCheck size={16} />} color="green">
            Discovery run completed successfully! Check the results and integrate when ready.
          </Alert>
        </Modal>
      )}

      {integrationModalOpen && (
        <Modal
          opened={integrationModalOpen}
          onClose={() => setIntegrationModalOpen(false)}
          title="Integration Complete"
        >
          <Alert icon={<IconCheck size={16} />} color="green">
            Funders have been successfully integrated!
          </Alert>
        </Modal>
      )}

      {runDiscoveryMutation.isError && (
        <Modal
          opened={runDiscoveryMutation.isError}
          onClose={() => runDiscoveryMutation.reset()}
          title="Discovery Failed"
        >
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {(runDiscoveryMutation.error as Error)?.message || 'An error occurred'}
          </Alert>
        </Modal>
      )}

      {integrateMutation.isError && (
        <Modal
          opened={integrateMutation.isError}
          onClose={() => integrateMutation.reset()}
          title="Integration Failed"
        >
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {(integrateMutation.error as Error)?.message || 'An error occurred'}
          </Alert>
        </Modal>
      )}

      <HarvestManagementModal
        opened={harvestModalOpen}
        funder={selectedFunder ? {
          id: selectedFunder.id,
          name: selectedFunder.name,
          websiteUrl: selectedFunder.websiteUrl
        } : null}
        onClose={() => {
          setHarvestModalOpen(false);
          setSelectedFunder(null);
        }}
      />
    </Container>
  );
}
