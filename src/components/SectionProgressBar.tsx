import { Group, Text, Tooltip, Box } from '@mantine/core';

interface Section {
  status: string;
}

const STATUS_COLOR: Record<string, string> = {
  NOT_STARTED: 'var(--mantine-color-gray-3)',
  IN_PROGRESS: 'var(--mantine-color-blue-5)',
  DRAFT:       'var(--mantine-color-orange-4)',
  FINAL:       'var(--mantine-color-green-6)',
};

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  DRAFT:       'Draft',
  FINAL:       'Final',
};

interface Props {
  sections: Section[];
  /** Height of the bar in px. Default 8. */
  height?: number;
  /** Show the "X/Y (Z%)" text label. Default true. */
  showLabel?: boolean;
  /** Extra style applied to the outer wrapper div. */
  style?: React.CSSProperties;
}

export function SectionProgressBar({ sections, height = 8, showLabel = true, style }: Props) {
  if (!sections || sections.length === 0) return null;

  const total = sections.length;
  const finalCount = sections.filter(s => s.status === 'FINAL').length;
  const percent = Math.round((finalCount / total) * 100);

  return (
    <div style={style}>
      {showLabel && (
        <Group justify="space-between" mb={4}>
          <Text size="xs" c="dimmed">
            {finalCount}/{total} sections
          </Text>
          <Text size="xs" c="dimmed">{percent}%</Text>
        </Group>
      )}
      <Box
        style={{
          display: 'flex',
          height,
          borderRadius: height / 2,
          overflow: 'hidden',
          gap: 1,
          backgroundColor: 'var(--mantine-color-gray-2)',
        }}
      >
        {sections.map((section, i) => {
          const status = section.status || 'NOT_STARTED';
          const color = STATUS_COLOR[status] ?? STATUS_COLOR.NOT_STARTED;
          const label = STATUS_LABEL[status] ?? status;
          return (
            <Tooltip key={i} label={`Section ${i + 1}: ${label}`} withArrow>
              <Box
                style={{
                  flex: 1,
                  backgroundColor: color,
                  transition: 'background-color 200ms',
                  minWidth: 2,
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    </div>
  );
}
