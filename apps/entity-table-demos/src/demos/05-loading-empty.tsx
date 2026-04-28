import { useState } from 'react';
import { z } from 'zod';
import { EntityList } from '@ghost-shell/entity-table';
import { DemoShell } from '../components/DemoShell';
import { Button } from '@ghost-shell/ui';

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  assignee: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  done: z.boolean(),
});

const schemaSource = `z.object({
  id: z.string(),
  title: z.string(),
  assignee: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  done: z.boolean(),
})`;

const sampleTasks = [
  { id: '1', title: 'Set up CI pipeline', assignee: 'Alice', priority: 'high' as const, done: true },
  { id: '2', title: 'Write unit tests', assignee: 'Bob', priority: 'medium' as const, done: false },
  { id: '3', title: 'Update documentation', assignee: 'Carol', priority: 'low' as const, done: false },
  { id: '4', title: 'Fix login bug', assignee: 'David', priority: 'critical' as const, done: false },
  { id: '5', title: 'Design review', assignee: 'Eva', priority: 'medium' as const, done: true },
];

type ViewState = 'data' | 'loading' | 'empty';

export function LoadingEmptyDemo() {
  const [viewState, setViewState] = useState<ViewState>('data');

  const data = viewState === 'empty' ? [] : sampleTasks;
  const loading = viewState === 'loading';

  return (
    <DemoShell
      title="Loading & Empty States"
      description="Toggle between data, loading skeleton, and empty state to see how EntityList handles each case."
      features={['Skeleton Loading', 'Empty Message', 'Dynamic Data']}
      schema={schemaSource}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={viewState === 'data' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewState('data')}
          >
            With Data
          </Button>
          <Button
            variant={viewState === 'loading' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewState('loading')}
          >
            Loading
          </Button>
          <Button
            variant={viewState === 'empty' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewState('empty')}
          >
            Empty
          </Button>
        </div>
        <EntityList
          entityType="task"
          schema={TaskSchema}
          data={data}
          loading={loading}
          exclude={['id']}
          emptyMessage="No tasks found. Create one to get started!"
          getRowId={(row) => row.id}
        />
      </div>
    </DemoShell>
  );
}
