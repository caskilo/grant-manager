import { Drawer, Stack, Text, Accordion, Divider, Group, ThemeIcon, ScrollArea } from '@mantine/core';
import {
  IconLayoutDashboard, IconBook2, IconBuildingBank, IconSparkles,
  IconBuildingCommunity, IconFileText, IconUsers, IconUpload, IconShield,
  IconWand, IconTransform, IconWorldSearch, IconSearch,
  IconTarget, IconRocket, IconShieldCheck, IconChartBar,
  IconListCheck, IconBulb, IconBrain
} from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { GUIDE_MODULES, GUIDE_GROUPS, type GuideModule } from './GuideContent';
import GuideModuleCard from './GuideModuleCard';
import GuideSearch from './GuideSearch';

// Map icon string names to actual components
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  IconLayoutDashboard,
  IconBook2,
  IconBuildingBank,
  IconBuildingCommunity,
  IconSparkles,
  IconFileText,
  IconUsers,
  IconUpload,
  IconShield,
  IconWand,
  IconTransform,
  IconWorldSearch,
  IconSearch,
  IconTarget,
  IconRocket,
  IconShieldCheck,
  IconChartBar,
  IconListCheck,
  IconBulb,
  IconBrain,
};

interface GuideOverlayProps {
  opened: boolean;
  onClose: () => void;
}

export default function GuideOverlay({ opened, onClose }: GuideOverlayProps) {
  const location = useLocation();
  const GUIDE_STATE_KEY = 'guide-expanded-items';
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(GUIDE_STATE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  // On first open only: if no saved state, auto-expand the current page's module
  useEffect(() => {
    if (opened) {
      setSearchQuery('');
      if (!hasBeenOpened) {
        setHasBeenOpened(true);
        // Only auto-expand if there's no saved state
        try {
          const stored = localStorage.getItem(GUIDE_STATE_KEY);
          if (stored && JSON.parse(stored).length > 0) return;
        } catch { /* ignore */ }

        const path = location.pathname;
        const match = GUIDE_MODULES.find((m) =>
          m.relatedRoutes.some((route) => {
            if (route.endsWith('/')) {
              return path.startsWith(route) || path === route.slice(0, -1);
            }
            return path === route || path.startsWith(route + '/');
          }),
        );
        if (match) {
          setExpandedItems([match.id]);
        }
      }
    }
  }, [opened]);

  // Filter modules by search query
  const filteredModules = useMemo(() => {
    if (!searchQuery) return GUIDE_MODULES;
    return GUIDE_MODULES.filter((m) => {
      const haystack = [
        m.title,
        m.summary,
        ...m.sections.map((s) => s.heading),
        ...m.sections.map((s) => s.content),
        ...m.sections.flatMap((s) => s.tips || []),
        ...m.sections.flatMap((s) => s.steps || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchQuery);
    });
  }, [searchQuery]);

  // When searching, expand all matching modules
  useEffect(() => {
    if (searchQuery) {
      setExpandedItems(filteredModules.map((m) => m.id));
    }
  }, [searchQuery, filteredModules]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        <Group gap="xs">
          <Text fw={700} size="lg">User Guide</Text>
        </Group>
      }
      styles={{
        body: { padding: 0, height: 'calc(100vh - 60px)' },
        header: { borderBottom: '1px solid var(--mantine-color-gray-3)' },
      }}
      overlayProps={{ backgroundOpacity: 0.15, blur: 2 }}
    >
      <Stack gap={0} h="100%">
        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <GuideSearch onSearch={handleSearch} />
        </div>

        {/* Scrollable content */}
        <ScrollArea flex={1} px="md" py="sm">
          {filteredModules.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No guide sections match your search.
            </Text>
          ) : (
            <Stack gap="sm">
              {GUIDE_GROUPS.map((group) => {
                const groupModules = filteredModules.filter(
                  (m) => m.group === group.key,
                );
                if (groupModules.length === 0) return null;

                return (
                  <div key={group.key}>
                    <Divider
                      label={
                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                          {group.label}
                        </Text>
                      }
                      labelPosition="left"
                      mb="xs"
                      mt="sm"
                    />

                    <Accordion
                      multiple
                      value={expandedItems}
                      onChange={(val) => {
                        setExpandedItems(val);
                        try { localStorage.setItem(GUIDE_STATE_KEY, JSON.stringify(val)); } catch { /* ignore */ }
                      }}
                      variant="separated"
                      styles={{
                        item: {
                          borderColor: 'var(--mantine-color-gray-2)',
                          '&[data-active]': {
                            borderColor: 'var(--mantine-color-blue-3)',
                          },
                        },
                        control: { padding: '8px 12px' },
                        panel: { padding: '0 12px 12px' },
                      }}
                    >
                      {groupModules.map((mod) => (
                        <ModuleAccordionItem key={mod.id} module={mod} />
                      ))}
                    </Accordion>
                  </div>
                );
              })}
            </Stack>
          )}
        </ScrollArea>
      </Stack>
    </Drawer>
  );
}

function ModuleAccordionItem({ module }: { module: GuideModule }) {
  const IconComponent = ICON_MAP[module.icon];

  return (
    <Accordion.Item value={module.id}>
      <Accordion.Control>
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon
            size={28}
            radius="md"
            variant="light"
            color={
              module.group === 'artefact'
                ? 'blue'
                : module.group === 'workflow'
                ? 'teal'
                : 'grape'
            }
          >
            {IconComponent ? <IconComponent size={16} /> : null}
          </ThemeIcon>
          <div style={{ minWidth: 0 }}>
            <Text size="sm" fw={600} truncate>
              {module.title}
            </Text>
          </div>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <GuideModuleCard module={module} />
      </Accordion.Panel>
    </Accordion.Item>
  );
}
