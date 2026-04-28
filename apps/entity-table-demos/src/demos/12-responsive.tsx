import { useState, useRef } from 'react';
import { z } from 'zod';
import { EntityList, createPretextMeasurer } from '@ghost-shell/entity-table';
import type { ResponsiveConfig, BudgetDebugInfo } from '@ghost-shell/entity-table';
import { cn } from '@ghost-shell/ui';
import { DemoShell } from '../components/DemoShell';

const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['Engineer', 'Designer', 'Manager', 'Director', 'VP', 'Analyst', 'Intern']),
  department: z.string(),
  location: z.string(),
  salary: z.number(),
  startDate: z.coerce.date(),
  active: z.boolean(),
  phone: z.string(),
  bio: z.string(),
  notes: z.string(),
});

type Employee = z.infer<typeof EmployeeSchema>;

const NAMES = [
  'Alice Chen', 'Bob Martinez', 'Carol Kim', 'David Okafor', 'Eva Rossi',
  'Frank Liu', 'Grace Tanaka', 'Hiro Patel', 'Isla Wright', 'James Brown',
  'Keiko Sato', 'Liam Fernandez', 'Mia Andersen', 'Noah Singh', 'Olivia Park',
  'Pablo Reyes', 'Quinn Murphy', 'Rosa Bianchi', 'Sam Johansson', 'Tara Gupta',
  'Uma Nakamura', 'Victor Alves', 'Wendy Zhao', 'Xavier Dubois', 'Yuki Ito',
  'Zara Khan', 'Aaron Lee', 'Beth Cooper', 'Carlos Ruiz', 'Diana Novak',
  'Ethan Wolfe', 'Fiona Grant',
];

const ROLES = ['Engineer', 'Designer', 'Manager', 'Director', 'VP', 'Analyst', 'Intern'] as const;
const DEPARTMENTS = ['Engineering', 'Design', 'Product', 'Marketing', 'Sales', 'HR', 'Finance', 'Legal'];
const LOCATIONS = ['San Francisco', 'New York', 'London', 'Tokyo', 'Berlin', 'Sydney', 'Toronto', 'Singapore'];
const BIOS = [
  'Passionate about building scalable distributed systems and mentoring junior engineers.',
  'Full-stack developer with a focus on accessibility and inclusive design patterns.',
  'Data-driven leader who thrives on cross-functional collaboration and strategic planning.',
  'Creative problem solver with expertise in user research and design thinking methodologies.',
  'Experienced in agile transformation and organizational change management.',
  'Specializes in cloud-native architectures and DevOps best practices.',
];
const NOTES_POOL = [
  'Promoted Q3 2024. Eligible for stock refresh.',
  'Remote worker — timezone GMT+9.',
  'On parental leave until March.',
  'Leading the platform migration initiative.',
  'Mentoring two interns this quarter.',
  'Transferred from London office.',
];

function generateEmployees(count: number): Employee[] {
  const employees: Employee[] = [];
  for (let i = 0; i < count; i++) {
    const name = NAMES[i % NAMES.length];
    const first = name.split(' ')[0].toLowerCase();
    const last = name.split(' ')[1].toLowerCase();
    employees.push({
      id: `emp-${String(i + 1).padStart(3, '0')}`,
      name: i >= NAMES.length ? `${name} Jr.` : name,
      email: `${first}.${last}@example.com`,
      role: ROLES[i % ROLES.length],
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      location: LOCATIONS[i % LOCATIONS.length],
      salary: 55000 + (i * 7777) % 145000,
      startDate: new Date(2019 + Math.floor(i / 12), i % 12, 1 + (i % 28)),
      active: i % 7 !== 0,
      phone: `+1 (${500 + (i % 400)}) ${100 + (i * 37) % 900}-${1000 + (i * 13) % 9000}`,
      bio: BIOS[i % BIOS.length],
      notes: NOTES_POOL[i % NOTES_POOL.length],
    });
  }
  return employees;
}

const employees = generateEmployees(35);

const schemaSource = `z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum([...7 roles]),
  department: z.string(),
  location: z.string(),
  salary: z.number(),
  startDate: z.coerce.date(),
  active: z.boolean(),
  phone: z.string(),
  bio: z.string(),
  notes: z.string(),
})`;

const configSource = `<EntityList
  schema={EmployeeSchema}
  data={employees}
  overrides={{
    name: { format: 'avatar', priority: 'essential' },
    email: { priority: 'default' },
    role: { format: 'badge', priority: 'default' },
    phone: { priority: 'optional' },
    bio: { priority: 'optional' },
    notes: { priority: 'optional' },
  }}
  responsive={{
    enabled: true,
    measurer: createPretextMeasurer('14px Inter, sans-serif'),
  }}
/>`;

const priorityColor: Record<string, string> = {
  essential: 'oklch(0.72 0.15 155)',
  default: 'oklch(0.75 0 0)',
  optional: 'oklch(0.65 0.03 250)',
};

const priorityIcon: Record<string, string> = {
  essential: '★',
  default: '●',
  optional: '○',
};

function formatReason(reason: string): string {
  switch (reason) {
    case 'essential-always': return 'Essential — always shown'
    case 'fits-budget': return 'Fits within remaining budget'
    case 'exceeds-budget': return 'Not enough space'
    case 'card-view-active': return 'Card view active'
    default: return reason
  }
}

function ResponsiveDebugPanel({ debug }: { debug: BudgetDebugInfo | null }) {
  if (!debug) return <div className="text-muted-foreground text-sm">Waiting for measurement...</div>

  return (
    <div className="rounded-lg border bg-card p-4 text-sm space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-4 font-mono text-xs">
        <span>Container: <strong>{debug.containerWidth}px</strong></span>
        <span>Used: <strong>{Math.round(debug.totalBudgetUsed)}px</strong></span>
        <span>Remaining: <strong>{Math.round(debug.remainingBudget)}px</strong></span>
        <span>Mode: <strong>{debug.shouldUseCardView ? '📱 Card' : '📊 Table'}</strong></span>
      </div>

      {/* Budget bar visualization */}
      <div className="h-3 rounded-full bg-muted overflow-hidden flex">
        {debug.columns
          .filter(c => c.visible)
          .map(col => (
            <div
              key={col.id}
              style={{
                width: `${(col.measuredWidth / debug.containerWidth) * 100}%`,
                backgroundColor: priorityColor[col.priority],
              }}
              className="h-full border-r border-background"
              title={`${col.id}: ${Math.round(col.measuredWidth)}px`}
            />
          ))}
      </div>

      {/* Column detail table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b">
            <th className="text-left py-1 pr-4">Column</th>
            <th className="text-left py-1 pr-4">Priority</th>
            <th className="text-right py-1 pr-4">Measured</th>
            <th className="text-center py-1 pr-4">Visible</th>
            <th className="text-left py-1">Reason</th>
          </tr>
        </thead>
        <tbody>
          {debug.columns.map(col => (
            <tr key={col.id} className={cn("border-b border-border/50", !col.visible && "opacity-40")}>
              <td className="py-1 pr-4 font-medium">{col.id}</td>
              <td className="py-1 pr-4">
                <span style={{ color: priorityColor[col.priority] }}>
                  {priorityIcon[col.priority]} {col.priority}
                </span>
              </td>
              <td className="py-1 pr-4 text-right font-mono">{Math.round(col.measuredWidth)}px</td>
              <td className="py-1 pr-4 text-center">{col.visible ? '✓' : '✗'}</td>
              <td className="py-1 text-muted-foreground">{formatReason(col.reason)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResizableContainer({ children, containerRef }: { children: React.ReactNode; containerRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={containerRef}
      className="resize-x overflow-auto border-2 border-dashed border-muted-foreground/25 rounded-lg p-2"
      style={{ minWidth: 300, maxWidth: '100%', width: '100%' }}
    >
      {children}
    </div>
  );
}

export function ResponsiveDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [debugInfo, setDebugInfo] = useState<BudgetDebugInfo | null>(null);

  const responsiveWithRef: ResponsiveConfig = {
    enabled: true,
    measurer: createPretextMeasurer('14px Inter, sans-serif'),
    containerRef,
    onBudgetChange: setDebugInfo,
  };

  return (
    <DemoShell
      title="Responsive Columns"
      description="Columns automatically show/hide based on container width using a priority-based budget algorithm. Essential columns always stay visible, default columns fill remaining space narrowest-first, and optional columns appear only when there's room. Drag the bottom-right resize handle to see it in action."
      features={['Priority Budget', 'Pretext Measurement', 'Resize Handle', 'Card View Fallback']}
      schema={schemaSource}
      codeBlocks={[{ title: 'Usage', code: configSource, defaultOpen: true }]}
    >
      <ResizableContainer containerRef={containerRef}>
        <EntityList
          entityType="employee"
          schema={EmployeeSchema}
          data={employees}
          overrides={{
            name: { format: 'avatar', priority: 'essential' },
            email: { priority: 'default' },
            role: { format: 'badge', priority: 'default' },
            phone: { priority: 'optional' },
            bio: { priority: 'optional' },
            notes: { priority: 'optional' },
          }}
          responsive={responsiveWithRef}
          exclude={['id']}
          pageSizeOptions={[10, 25]}
          getRowId={(row) => row.id}
        />
      </ResizableContainer>
      <ResponsiveDebugPanel debug={debugInfo} />
    </DemoShell>
  );
}
