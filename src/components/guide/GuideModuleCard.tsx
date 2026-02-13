import { Text, Stack, List, Alert } from '@mantine/core';
import { IconBulb } from '@tabler/icons-react';
import type { GuideModule } from './GuideContent';

interface GuideModuleCardProps {
  module: GuideModule;
}

export default function GuideModuleCard({ module }: GuideModuleCardProps) {
  return (
    <Stack gap="lg" py="xs">
      <Text size="sm" c="dimmed">
        {module.summary}
      </Text>

      {module.sections.map((section, idx) => (
        <Stack key={idx} gap="xs">
          <Text size="sm" fw={600}>
            {section.heading}
          </Text>

          {section.content && (
            <RichContent text={section.content} />
          )}

          {section.steps && section.steps.length > 0 && (
            <List type="ordered" spacing="xs" size="sm">
              {section.steps.map((step, i) => (
                <List.Item key={i}>{step}</List.Item>
              ))}
            </List>
          )}

          {section.tips && section.tips.length > 0 && (
            <Stack gap="xs">
              {section.tips.map((tip, i) => (
                <Alert
                  key={i}
                  icon={<IconBulb size={16} />}
                  color="blue"
                  variant="light"
                  py="xs"
                  px="sm"
                >
                  <Text size="xs">{tip}</Text>
                </Alert>
              ))}
            </Stack>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

/**
 * Renders content text with basic inline formatting:
 * - Lines starting with • become list items
 * - **bold** markers rendered as <strong>
 * - Lines starting with 1. 2. etc become ordered items
 * - Table-like lines (|) rendered as-is in monospace
 * - Everything else is a paragraph
 */
function RichContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let orderedBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length > 0) {
      elements.push(
        <List key={`bl-${elements.length}`} spacing={4} size="sm" withPadding>
          {bulletBuffer.map((item, i) => (
            <List.Item key={i}>
              <FormattedText text={item} />
            </List.Item>
          ))}
        </List>,
      );
      bulletBuffer = [];
    }
  };

  const flushOrdered = () => {
    if (orderedBuffer.length > 0) {
      elements.push(
        <List
          key={`ol-${elements.length}`}
          type="ordered"
          spacing={4}
          size="sm"
          withPadding
        >
          {orderedBuffer.map((item, i) => (
            <List.Item key={i}>
              <FormattedText text={item} />
            </List.Item>
          ))}
        </List>,
      );
      orderedBuffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushBullets();
      flushOrdered();
      continue;
    }

    // Bullet lines
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
      flushOrdered();
      bulletBuffer.push(trimmed.replace(/^[•\-]\s*/, ''));
      continue;
    }

    // Ordered lines
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (orderedMatch) {
      flushBullets();
      orderedBuffer.push(orderedMatch[2]);
      continue;
    }

    // Table lines — render as code-like text
    if (trimmed.startsWith('|')) {
      flushBullets();
      flushOrdered();
      elements.push(
        <Text
          key={`tbl-${elements.length}`}
          size="xs"
          ff="monospace"
          style={{ whiteSpace: 'pre' }}
        >
          {trimmed}
        </Text>,
      );
      continue;
    }

    // Regular paragraph
    flushBullets();
    flushOrdered();
    elements.push(
      <Text key={`p-${elements.length}`} size="sm">
        <FormattedText text={trimmed} />
      </Text>,
    );
  }

  flushBullets();
  flushOrdered();

  return <>{elements}</>;
}

/**
 * Renders inline **bold** markers as <strong> elements.
 */
function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} span fw={600}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
