import { TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useState, useEffect } from 'react';

interface GuideSearchProps {
  onSearch: (query: string) => void;
}

export default function GuideSearch({ onSearch }: GuideSearchProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <TextInput
      placeholder="Search guide..."
      leftSection={<IconSearch size={16} />}
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      size="sm"
    />
  );
}
