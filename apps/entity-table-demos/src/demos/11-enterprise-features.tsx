import type { EntityOperation } from "@ghost-shell/entity-table";
import { EntityList } from "@ghost-shell/entity-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import { DemoShell } from "../components/DemoShell";

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  lead: z.string(),
  email: z.string().email(),
  department: z.enum(["Engineering", "Design", "Marketing", "Sales", "HR", "Finance", "Legal", "Operations"]),
  status: z.enum(["active", "on_hold", "completed", "cancelled"]),
  budget: z.number(),
  spent: z.number(),
  headcount: z.number(),
  startDate: z.coerce.date(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  tags: z.array(z.string()),
});

type Project = z.infer<typeof ProjectSchema>;

const DEPARTMENTS = ["Engineering", "Design", "Marketing", "Sales", "HR", "Finance", "Legal", "Operations"] as const;
const STATUSES = ["active", "on_hold", "completed", "cancelled"] as const;
const PRIORITIES = ["critical", "high", "medium", "low"] as const;
const LEADS = [
  "Alice Johnson",
  "Bob Martinez",
  "Carol Chen",
  "David Kim",
  "Eva Rossi",
  "Frank Okafor",
  "Grace Liu",
  "Hiro Tanaka",
  "Isla Patel",
  "James Wright",
  "Keiko Sato",
  "Liam Brown",
  "Mia Fernandez",
  "Noah Andersen",
  "Olivia Singh",
];
const PROJECT_NAMES = [
  "Platform Migration",
  "Mobile Redesign",
  "API Gateway",
  "Data Pipeline",
  "Auth Service",
  "Search Engine",
  "Analytics Dashboard",
  "CI/CD Overhaul",
  "Design System",
  "Billing Module",
  "Notification Hub",
  "Compliance Audit",
  "Performance Tuning",
  "Onboarding Flow",
  "Partner Portal",
  "Inventory Sync",
  "Chat Integration",
  "Report Builder",
  "SSO Federation",
  "Edge Caching",
];
const TAG_POOL = [
  "frontend",
  "backend",
  "infra",
  "security",
  "ux",
  "data",
  "mobile",
  "devops",
  "compliance",
  "performance",
  "api",
  "testing",
  "docs",
];

function generateProjects(count: number): Project[] {
  const projects: Project[] = [];
  for (let i = 0; i < count; i++) {
    const lead = LEADS[i % LEADS.length];
    const tagCount = 2 + (i % 3);
    const tags: string[] = [];
    for (let t = 0; t < tagCount; t++) {
      tags.push(TAG_POOL[(i + t) % TAG_POOL.length]);
    }
    const budget = 50000 + ((i * 12345) % 450000);
    projects.push({
      id: `proj-${String(i + 1).padStart(3, "0")}`,
      name:
        PROJECT_NAMES[i % PROJECT_NAMES.length] +
        (i >= PROJECT_NAMES.length ? ` v${Math.floor(i / PROJECT_NAMES.length) + 1}` : ""),
      lead,
      email: `${lead.split(" ")[0].toLowerCase()}.${lead.split(" ")[1].toLowerCase()}@company.com`,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      status: STATUSES[i % STATUSES.length],
      budget,
      spent: Math.floor(budget * (0.2 + (i % 8) * 0.1)),
      headcount: 3 + (i % 15),
      startDate: new Date(2023 + Math.floor(i / 12), i % 12, 1 + (i % 28)),
      priority: PRIORITIES[i % PRIORITIES.length],
      tags,
    });
  }
  return projects;
}

const projects = generateProjects(35);

const schemaSource = `z.object({
  id: z.string(),
  name: z.string(),
  lead: z.string(),
  email: z.string().email(),
  department: z.enum([...8 departments]),
  status: z.enum(['active', 'on_hold', 'completed', 'cancelled']),
  budget: z.number(),
  spent: z.number(),
  headcount: z.number(),
  startDate: z.coerce.date(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  tags: z.array(z.string()),
})`;

const configSource = `<EntityList
  entityType="project"
  schema={ProjectSchema}
  data={projects}
  exclude={['id']}
  defaultVisible={[
    'name', 'lead', 'department', 'status',
    'budget', 'headcount', 'priority', 'tags',
  ]}
  overrides={{
    budget: { format: 'currency', label: 'Budget' },
    status: {
      format: 'badge',
      formatOptions: {
        colorMap: {
          active: 'green',
          completed: 'blue',
          on_hold: 'amber',
          cancelled: 'red',
        },
      },
    },
    priority: {
      format: 'badge',
      formatOptions: {
        colorMap: {
          critical: 'red',
          high: 'orange',
          medium: 'amber',
          low: 'green',
        },
      },
    },
  }}
  rowOperations={rowOps}
  enableRowSelection
  enableColumnFilters
  enableColumnResizing
  enableStickyHeader
  enableDensityToggle
  pageSizeOptions={[10, 25, 50]}
  getRowId={(row) => row.id}
/>`;

const rowOps: EntityOperation<Project>[] = [
  {
    id: "view",
    label: "View Details",
    icon: <Eye className="h-4 w-4" />,
    handler: ({ entity }) => alert(`View: ${entity?.name}`),
  },
  {
    id: "edit",
    label: "Edit Project",
    icon: <Pencil className="h-4 w-4" />,
    handler: ({ entity }) => alert(`Edit: ${entity?.name}`),
  },
  {
    id: "delete",
    label: "Archive",
    icon: <Trash2 className="h-4 w-4" />,
    variant: "destructive",
    handler: ({ entity }) => alert(`Archive: ${entity?.name}`),
    when: ({ entity }) => entity?.status !== "completed",
  },
];

export function EnterpriseFeaturesDemo() {
  return (
    <DemoShell
      title="Enterprise Features"
      description="All enterprise-grade features enabled: per-column filters (text, select, range), draggable column resize, sticky header, density toggle, Shift+click multi-sort, row selection, and row operations. CSV export is available via the ExportButton component when using the lower-level useGhostTable + GhostDataTable API (see demo 10)."
      features={[
        "Column Filters",
        "Column Resize",
        "Sticky Header",
        "Density Toggle",
        "Multi-Sort",
        "Row Selection",
        "Row Actions",
      ]}
      schema={schemaSource}
      codeBlocks={[{ title: "Usage", code: configSource, defaultOpen: true }]}
    >
      <EntityList
        entityType="project"
        schema={ProjectSchema}
        data={projects}
        exclude={["id"]}
        defaultVisible={["name", "lead", "department", "status", "budget", "headcount", "priority", "tags"]}
        overrides={{
          budget: { format: "currency", label: "Budget" },
          spent: { format: "currency", label: "Spent" },
          email: { format: "link" },
          tags: { format: "tags" },
          lead: { format: "avatar" },
          status: {
            format: "badge",
            formatOptions: {
              colorMap: { active: "green", completed: "blue", on_hold: "amber", cancelled: "red" },
            },
          },
          priority: {
            format: "badge",
            formatOptions: {
              colorMap: { critical: "red", high: "orange", medium: "amber", low: "green" },
            },
          },
        }}
        rowOperations={rowOps}
        enableRowSelection
        enableColumnFilters
        enableColumnResizing
        enableStickyHeader
        enableDensityToggle
        pageSizeOptions={[10, 25, 50]}
        getRowId={(row) => row.id}
      />
    </DemoShell>
  );
}
