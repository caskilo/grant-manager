import { ActionIcon, Tooltip } from '@mantine/core';
import { IconBook } from '@tabler/icons-react';

interface GuideLauncherProps {
  onClick: () => void;
}

export default function GuideLauncher({ onClick }: GuideLauncherProps) {
  return (
    <Tooltip label="User Guide" position="left" withArrow>
      <ActionIcon
        onClick={onClick}
        size={48}
        radius="xl"
        variant="filled"
        color="blue"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 200,
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
          transition: 'transform 150ms ease, box-shadow 150ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.15)';
        }}
      >
        <IconBook size={24} />
      </ActionIcon>
    </Tooltip>
  );
}
