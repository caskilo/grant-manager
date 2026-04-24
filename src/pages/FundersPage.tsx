import { Container, Title, Button, Group, Stack, Badge, Text, Tooltip, Modal, Alert, TextInput, Paper, Anchor } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { IconAlertCircle, IconCheck, IconSearch, IconExternalLink } from '@tabler/icons-react';
import api from '../lib/api';
import { discoveryApi } from '../lib/discovery';

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

interface CatalogueDiff {
  newFunders: Array<{ name: string; type: string; website?: string }>;
  deletedFunders: Array<{ id: string; name: string; type: string; tags: string[] }>;
  updatedFunders: Array<{ 
    id: string; 
    name: string; 
    currentTags: string[];
    changes: { field: string; oldValue: any; newValue: any }[] 
  }>;
}

interface ApplyResult {
  created: number;
  updated: number;
  marked: number;
  warnings: string[];
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
  const user = useAuthStore((state) => state.user);
  const [integrationModalOpen, setIntegrationModalOpen] = useState(false);

  // Restore scroll position when returning from funder detail
  useEffect(() => {
    const saved = sessionStorage.getItem('funders-scroll-y');
    if (saved) {
      window.scrollTo(0, parseInt(saved, 10));
      sessionStorage.removeItem('funders-scroll-y');
    }
  }, []);
  const [integrationResult, setIntegrationResult] = useState<ApplyResult | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [catalogueDiff, setCatalogueDiff] = useState<CatalogueDiff | null>(null);

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
    // Catalogue is source of truth - removed items are already deleted
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

  // First fetch catalogue and calculate diff
  const calculateDiffMutation = useMutation({
    mutationFn: async () => {
      // Get catalogue entries
      const catalogueResponse = await discoveryApi.getCatalogue();
      const catalogueEntries = catalogueResponse.data;
      
      // Get current funders
      const fundersResponse = await api.get('/funders', { params: { limit: 1000 } });
      const currentFunders = fundersResponse.data.data as Funder[];
      
      // Calculate diff
      const diff: CatalogueDiff = {
        newFunders: [],
        deletedFunders: [],
        updatedFunders: []
      };
      
      // Find new and updated funders
      for (const entry of catalogueEntries) {
        const existing = currentFunders.find(f => 
          f.name.toLowerCase() === entry.name.toLowerCase() ||
          (entry.websiteUrl && f.websiteUrl === entry.websiteUrl)
        );
        
        if (!existing) {
          diff.newFunders.push({
            name: entry.name,
            type: entry.type || 'Unknown',
            website: entry.websiteUrl
          });
        } else {
          // Check for updates
          const changes: { field: string; oldValue: any; newValue: any }[] = [];
          
          if (entry.type && getCatalogueType(existing.tags) !== entry.type) {
            changes.push({ 
              field: 'type', 
              oldValue: getCatalogueType(existing.tags) || existing.type, 
              newValue: entry.type 
            });
          }
          
          if (entry.websiteUrl && existing.websiteUrl !== entry.websiteUrl) {
            changes.push({ 
              field: 'website', 
              oldValue: existing.websiteUrl, 
              newValue: entry.websiteUrl 
            });
          }
          
          if (changes.length > 0) {
            diff.updatedFunders.push({
              id: existing.id,
              name: existing.name,
              currentTags: existing.tags,
              changes
            });
          }
        }
      }
      
      // Find deleted funders (catalogue funders not in the new catalogue)
      const catalogueFunders = currentFunders.filter(f => isCatalogueFunder(f.tags));
      for (const funder of catalogueFunders) {
        const stillExists = catalogueEntries.some(e => 
          e.name.toLowerCase() === funder.name.toLowerCase() ||
          (e.websiteUrl && funder.websiteUrl === e.websiteUrl)
        );
        
        if (!stillExists) {
          diff.deletedFunders.push({
            id: funder.id,
            name: funder.name,
            type: getCatalogueType(funder.tags) || funder.type,
            tags: funder.tags,
          });
        }
      }
      
      return diff;
    },
    onSuccess: (diff) => {
      setCatalogueDiff(diff);
      setDiffModalOpen(true);
    }
  });
  
  // Apply the confirmed changes, honouring all three diff types
  const applyChangesMutation = useMutation({
    mutationFn: async (diff: CatalogueDiff): Promise<ApplyResult> => {
      const result: ApplyResult = { created: 0, updated: 0, marked: 0, warnings: [] };

      // 1. Apply field updates via PATCH
      for (const funder of diff.updatedFunders) {
        const patch: Record<string, any> = {};
        let tags = [...funder.currentTags];
        for (const change of funder.changes) {
          if (change.field === 'website') {
            patch.websiteUrl = change.newValue;
          } else if (change.field === 'type') {
            tags = tags.filter(t => !t.startsWith('CATALOGUE_TYPE:'));
            tags.push(`CATALOGUE_TYPE:${change.newValue}`);
            patch.tags = tags;
          }
        }
        if (Object.keys(patch).length > 0) {
          await api.patch(`/funders/${funder.id}`, patch);
          result.updated++;
        }
      }

      // 2. Permanently delete funders removed from the catalogue
      for (const funder of diff.deletedFunders) {
        await api.delete(`/funders/${funder.id}`);
        result.marked++;
      }

      // 3. Create genuinely new funders via the catalogue run
      if (diff.newFunders.length > 0) {
        const catalogueResult = await discoveryApi.runCatalogue();
        result.created = catalogueResult.fundersCreated;
        if (catalogueResult.warnings?.length) result.warnings.push(...catalogueResult.warnings);
      }

      return result;
    },
    onSuccess: (result) => {
      setIntegrationResult(result);
      setDiffModalOpen(false);
      setIntegrationModalOpen(true);
      queryClient.invalidateQueries({ queryKey: ['funders'] });
    },
  });

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Funders</Title>
          {user?.role === 'ADMIN' && (
            <Group>
              <Button
                loading={calculateDiffMutation.isPending}
                onClick={() => calculateDiffMutation.mutate()}
              >
                Update from Catalogue
              </Button>
              <Button onClick={() => navigate('/catalogue')}>Edit Catalogue</Button>
            </Group>
          )}
        </Group>

        {/* Search Bar */}
        <TextInput
          placeholder="Search funders by name, type, description, or location..."
          leftSection={<IconSearch size={16} />}
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.currentTarget.value)}
          size="md"
          data-testid="funders-search"
        />

        {/* Funders Grid */}
        {isLoading ? (
          <Text ta="center" c="dimmed" py="xl">Loading funders...</Text>
        ) : filteredFunders.length === 0 ? (
          <Paper p="xl" withBorder>
            <Text ta="center" c="dimmed" data-testid="funders-empty">No funders found</Text>
          </Paper>
        ) : (
          <Stack gap="md">
            {filteredFunders.map((funder) => (
              <Paper
                key={funder.id}
                p="lg"
                withBorder
                style={{ transition: 'all 0.2s' }}
                className="hover-lift"
                data-testid="funder-card"
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    {/* Funder Name and Website */}
                    <div>
                      <Text
                        fw={600}
                        size="lg"
                        onClick={() => {
                          sessionStorage.setItem('funders-scroll-y', String(window.scrollY));
                          navigate(`/funders/${funder.id}`);
                        }}
                        className="funder-title-link"
                      >
                        {funder.name}
                      </Text>
                      {funder.websiteUrl && (
                        <Anchor
                          href={funder.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          c="dimmed"
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'flex', width: 'fit-content' }}
                        >
                          <Group gap={4} wrap="nowrap">
                            <Text size="sm">{new URL(funder.websiteUrl).hostname}</Text>
                            <IconExternalLink size={12} />
                          </Group>
                        </Anchor>
                      )}
                    </div>
                  </Stack>

                  {/* Description — top right, inline with title */}
                  {funder.description && (
                    <Text size="sm" c="dimmed" lineClamp={2} style={{ maxWidth: 280, textAlign: 'right' }}>
                      {funder.description}
                    </Text>
                  )}
                </Group>

                {/* Metadata Row */}
                <Group justify="space-between" align="center" wrap="nowrap" mt="xs">
                  {/* Left: Type + Location */}
                  <Group gap="lg" wrap="wrap">
                    <Group gap={6}>
                      <Text size="sm" fw={500}>Type:</Text>
                      <Badge size="sm" variant="light">{getCatalogueType(funder.tags) || funder.type}</Badge>
                    </Group>
                    {funder.geographies && funder.geographies.length > 0 && (
                      <Group gap={6}>
                        <Text size="sm" fw={500}>Location:</Text>
                        <Text size="sm">{funder.geographies.join(', ')}</Text>
                      </Group>
                    )}
                  </Group>

                  {/* Middle: Avg Fit, Alignment, Removed indicator */}
                  <Group gap="sm" wrap="wrap" justify="flex-end">
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
                  </Group>

                  {/* Right: Opportunities */}
                  <Group gap={6} justify="flex-end">
                    <Text size="sm" fw={500}>Opportunities:</Text>
                    <Badge size="sm" color="blue">{funder._count?.opportunities || 0}</Badge>
                  </Group>
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
          .funder-title-link {
            cursor: pointer;
            display: inline-block;
            padding: 2px 8px;
            margin-left: -8px;
            border-radius: 6px;
            transition: background-color 150ms ease;
          }
          .funder-title-link:hover {
            background-color: var(--mantine-color-blue-1);
          }
        `}</style>
      </Stack>

      {/* Diff Modal - shows changes before applying */}
      <Modal
        opened={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        title="Catalogue Update Preview"
        size="lg"
      >
        <Stack gap="md">
          {catalogueDiff && (
            <>
              {/* Summary */}
              <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                <Text size="sm">
                  Found {catalogueDiff.newFunders.length} new, {catalogueDiff.updatedFunders.length} updated, 
                  and {catalogueDiff.deletedFunders.length} deleted funders.
                </Text>
              </Alert>

              {/* New Funders */}
              {catalogueDiff.newFunders.length > 0 && (
                <div>
                  <Text fw={600} size="sm" mb="xs">New Funders to Create:</Text>
                  <Stack gap="xs">
                    {catalogueDiff.newFunders.map((funder, idx) => (
                      <Paper key={idx} p="xs" withBorder>
                        <Group justify="space-between">
                          <Text size="sm">{funder.name}</Text>
                          <Badge size="sm" color="green">NEW</Badge>
                        </Group>
                        <Text size="xs" c="dimmed">Type: {funder.type}</Text>
                        {funder.website && <Text size="xs" c="dimmed">Website: {funder.website}</Text>}
                      </Paper>
                    ))}
                  </Stack>
                </div>
              )}

              {/* Updated Funders */}
              {catalogueDiff.updatedFunders.length > 0 && (
                <div>
                  <Text fw={600} size="sm" mb="xs">Funders to Update:</Text>
                  <Stack gap="xs">
                    {catalogueDiff.updatedFunders.map((funder) => (
                      <Paper key={funder.id} p="xs" withBorder>
                        <Text size="sm" fw={500}>{funder.name}</Text>
                        {funder.changes.map((change, idx) => (
                          <Text key={idx} size="xs" c="dimmed">
                            {change.field}: {change.oldValue || 'none'} → {change.newValue}
                          </Text>
                        ))}
                      </Paper>
                    ))}
                  </Stack>
                </div>
              )}

              {/* Deleted Funders */}
              {catalogueDiff.deletedFunders.length > 0 && (
                <div>
                  <Text fw={600} size="sm" mb="xs">Funders No Longer in Catalogue:</Text>
                  <Alert color="orange" icon={<IconAlertCircle size={16} />} mb="xs">
                    <Text size="xs" c="dimmed">
                      These funders will be permanently deleted from the system.
                    </Text>
                  </Alert>
                  <Stack gap="xs">
                    {catalogueDiff.deletedFunders.map((funder) => (
                      <Paper key={funder.id} p="xs" withBorder>
                        <Group justify="space-between">
                          <Text size="sm">{funder.name}</Text>
                          <Badge size="sm" color="red">REMOVED</Badge>
                        </Group>
                        <Text size="xs" c="dimmed">Type: {funder.type}</Text>
                      </Paper>
                    ))}
                  </Stack>
                </div>
              )}

              {/* No changes */}
              {catalogueDiff.newFunders.length === 0 && 
               catalogueDiff.updatedFunders.length === 0 && 
               catalogueDiff.deletedFunders.length === 0 && (
                <Alert color="gray">
                  <Text size="sm">The catalogue is already up to date. No changes needed.</Text>
                </Alert>
              )}
            </>
          )}

          {/* Actions */}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDiffModalOpen(false)}>
              Cancel
            </Button>
            {catalogueDiff && (catalogueDiff.newFunders.length > 0 || catalogueDiff.updatedFunders.length > 0 || catalogueDiff.deletedFunders.length > 0) && (
              <Button 
                onClick={() => applyChangesMutation.mutate(catalogueDiff)}
                loading={applyChangesMutation.isPending}
              >
                Apply Changes
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>

      {/* Integration Complete Modal */}
      {integrationModalOpen && (
        <Modal
          opened={integrationModalOpen}
          onClose={() => setIntegrationModalOpen(false)}
          title="Catalogue Integration Complete"
        >
          <Stack gap="sm">
            <Alert icon={<IconCheck size={16} />} color="green">
              {integrationResult ? (
                [integrationResult.created > 0 && `${integrationResult.created} funder${integrationResult.created !== 1 ? 's' : ''} created`,
                 integrationResult.updated > 0 && `${integrationResult.updated} updated`,
                 integrationResult.marked > 0 && `${integrationResult.marked} deleted`]
                  .filter(Boolean).join(', ') || 'No changes were needed.'
              ) : 'Done.'}
            </Alert>
            {integrationResult?.warnings && integrationResult.warnings.length > 0 && (
              <Alert icon={<IconAlertCircle size={16} />} color="yellow">
                {integrationResult.warnings[0]}{integrationResult.warnings.length > 1 && ` (+${integrationResult.warnings.length - 1} more)`}
              </Alert>
            )}
          </Stack>
        </Modal>
      )}

      {applyChangesMutation.isError && (
        <Modal
          opened={applyChangesMutation.isError}
          onClose={() => applyChangesMutation.reset()}
          title="Integration Failed"
        >
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {(applyChangesMutation.error as Error)?.message || 'An error occurred'}
          </Alert>
        </Modal>
      )}

    </Container>
  );
}
