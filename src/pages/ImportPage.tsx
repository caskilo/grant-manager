import {
  Container,
  Title,
  Button,
  Group,
  Stack,
  Table,
  Badge,
  FileInput,
  Select,
  Paper,
  Text,
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { IconUpload } from '@tabler/icons-react';
import api from '../lib/api';

export default function ImportPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [jobType, setJobType] = useState<string>('FUNDER_CSV');

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['import-jobs'],
    queryFn: async () => {
      const response = await api.get('/import/jobs', {
        params: {
          page: 1,
          limit: 50,
        },
      });
      return response.data;
    },
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');

      // First upload the file as an attachment
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'IMPORT_DATA');

      const uploadResponse = await api.post('/attachments/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const attachmentId = uploadResponse.data.id;

      // Then create import job
      const jobResponse = await api.post('/import/jobs', {
        jobType,
        fileAttachmentId: attachmentId,
      });

      return jobResponse.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
      setFile(null);
    },
  });

  const importJobs: any[] = Array.isArray(jobs)
    ? jobs
    : Array.isArray((jobs as any)?.data)
    ? (jobs as any).data
    : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'green';
      case 'RUNNING':
        return 'blue';
      case 'FAILED':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Title order={1}>CSV Import</Title>

        <Paper p="md" withBorder>
          <Stack gap="md">
            <Title order={3}>Upload CSV File</Title>
            
            <Select
              label="Import Type"
              value={jobType}
              onChange={(value) => setJobType(value || 'FUNDER_CSV')}
              data={[
                { value: 'FUNDER_CSV', label: 'Funders' },
                { value: 'OPPORTUNITY_CSV', label: 'Opportunities' },
              ]}
            />

            <FileInput
              label="CSV File"
              placeholder="Select file"
              accept=".csv"
              value={file}
              onChange={setFile}
              leftSection={<IconUpload size={16} />}
            />

            <Group>
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={!file || uploadMutation.isPending}
                loading={uploadMutation.isPending}
              >
                Upload and Process
              </Button>
            </Group>

            {uploadMutation.isError && (
              <Text c="red">Error: {(uploadMutation.error as Error).message}</Text>
            )}
            {uploadMutation.isSuccess && (
              <Text c="green">Import job created successfully!</Text>
            )}
          </Stack>
        </Paper>

        <Title order={3}>Import History</Title>

        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Type</Table.Th>
                <Table.Th>File</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Started</Table.Th>
                <Table.Th>Completed</Table.Th>
                <Table.Th>Summary</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {importJobs.map((job: any) => (
                <Table.Tr key={job.id}>
                  <Table.Td>
                    <Badge>{job.jobType}</Badge>
                  </Table.Td>
                  <Table.Td>{job.fileAttachment?.fileName || '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={getStatusColor(job.status)}>{job.status}</Badge>
                  </Table.Td>
                  <Table.Td>
                    {new Date(job.createdAt).toLocaleString()}
                  </Table.Td>
                  <Table.Td>
                    {job.startedAt ? new Date(job.startedAt).toLocaleString() : '—'}
                  </Table.Td>
                  <Table.Td>
                    {job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'}
                  </Table.Td>
                  <Table.Td>
                    {job.summary ? (
                      <Text size="sm">
                        Created: {job.summary.created}, Updated: {job.summary.updated}
                        {job.summary.errors > 0 && `, Errors: ${job.summary.errors}`}
                      </Text>
                    ) : job.errorMessage ? (
                      <Text size="sm" c="red">
                        {job.errorMessage}
                      </Text>
                    ) : (
                      '—'
                    )}
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
