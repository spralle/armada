import { z } from 'zod';
import { EntityList } from '@ghost-shell/entity-table';
import { DemoShell } from '../components/DemoShell';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import type { EntityOperation } from '@ghost-shell/entity-table';

const UserSchema = z.object({
  id: z.string(),
  avatar: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer', 'guest']),
  department: z.enum(['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance']),
  salary: z.number(),
  joinDate: z.coerce.date(),
  lastLogin: z.coerce.date(),
  active: z.boolean(),
  skills: z.array(z.string()),
  bio: z.string(),
});

type User = z.infer<typeof UserSchema>;

const schemaSource = `z.object({
  id: z.string(),
  avatar: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer', 'guest']),
  department: z.enum([
    'Engineering', 'Design', 'Marketing',
    'Sales', 'HR', 'Finance',
  ]),
  salary: z.number(),
  joinDate: z.coerce.date(),
  lastLogin: z.coerce.date(),
  active: z.boolean(),
  skills: z.array(z.string()),
  bio: z.string(),
})`;

const overridesSource = `overrides={{
  avatar: { format: 'avatar' },
  email:  { format: 'link' },
  salary: { format: 'currency' },
  skills: { format: 'tags' },
  bio:    { hidden: true },
}}`;

const firstNames = ['Alice', 'Bob', 'Carol', 'David', 'Eva', 'Frank', 'Grace', 'Hiro', 'Isla', 'James', 'Keiko', 'Liam', 'Mia', 'Noah', 'Olivia', 'Priya', 'Quinn', 'Raj', 'Sofia', 'Tomas', 'Uma', 'Victor', 'Wendy', 'Xander', 'Yuki', 'Zara'];
const lastNames = ['Johnson', 'Martinez', 'Chen', 'Kim', 'Rossi', 'Okafor', 'Liu', 'Tanaka', 'Patel', 'Wright', 'Sato', "O'Brien", 'Fernandez', 'Andersen', 'Brown', 'Singh', 'Murphy', 'Gupta', 'Garcia', 'Müller'];
const roles = ['admin', 'editor', 'viewer', 'guest'] as const;
const departments = ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance'] as const;
const allSkills = ['React', 'TypeScript', 'Python', 'Go', 'Rust', 'Figma', 'SQL', 'AWS', 'Docker', 'GraphQL', 'Node.js', 'CSS', 'ML', 'DevOps', 'Testing'];

function generateUsers(count: number): User[] {
  const users: User[] = [];
  for (let i = 0; i < count; i++) {
    const first = firstNames[i % firstNames.length];
    const last = lastNames[i % lastNames.length];
    const name = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase().replace(/'/g, '')}@company.com`;
    const role = roles[i % roles.length];
    const dept = departments[i % departments.length];
    const skillCount = 2 + (i % 4);
    const skillStart = i % allSkills.length;
    const skills: string[] = [];
    for (let s = 0; s < skillCount; s++) {
      skills.push(allSkills[(skillStart + s) % allSkills.length]);
    }
    users.push({
      id: `usr-${String(i + 1).padStart(3, '0')}`,
      avatar: name,
      name,
      email,
      role,
      department: dept,
      salary: 80000 + (i * 3500) % 120000,
      joinDate: new Date(2018 + (i % 7), i % 12, 1 + (i % 28)),
      lastLogin: new Date(2024, 8, 1 + (i % 28), 8 + (i % 12), i % 60),
      active: i % 7 !== 0,
      skills,
      bio: `${name} is a ${role} in ${dept}. Experienced professional with a focus on ${skills[0]}.`,
    });
  }
  return users;
}

const users = generateUsers(55);

const rowOps: EntityOperation<User>[] = [
  { id: 'view', label: 'View Profile', icon: <Eye className="h-4 w-4" />, handler: ({ entity }) => alert(`View ${entity?.name}`) },
  { id: 'edit', label: 'Edit', icon: <Pencil className="h-4 w-4" />, handler: ({ entity }) => alert(`Edit ${entity?.name}`) },
  { id: 'delete', label: 'Delete', icon: <Trash2 className="h-4 w-4" />, variant: 'destructive', handler: ({ entity }) => alert(`Delete ${entity?.name}`), when: ({ entity }) => entity?.role !== 'admin' },
];

export function KitchenSinkDemo() {
  return (
    <DemoShell
      title="Kitchen Sink"
      description="Everything combined: all renderers, operations, overrides, sorting, selection, and pagination with 55 rows."
      features={['All Renderers', 'Operations', 'Overrides', 'Sorting', 'Selection', 'Pagination']}
      schema={schemaSource}
      codeBlocks={[{ title: 'Overrides', code: overridesSource, defaultOpen: true }]}
    >
      <EntityList
        entityType="user"
        schema={UserSchema}
        data={users}
        exclude={['id']}
        defaultVisible={['avatar', 'name', 'email', 'role', 'department', 'salary', 'active', 'skills']}
        overrides={{
          avatar: { format: 'avatar' },
          email: { format: 'link' },
          salary: { format: 'currency' },
          skills: { format: 'tags' },
          bio: { hidden: true },
        }}
        rowOperations={rowOps}
        enableRowSelection
        pageSizeOptions={[10, 25, 50]}
        getRowId={(row) => row.id}
      />
    </DemoShell>
  );
}
