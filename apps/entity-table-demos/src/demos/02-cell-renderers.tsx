import { EntityList } from "@ghost-shell/entity-table";
import { z } from "zod";
import { DemoShell } from "../components/DemoShell";

const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  department: z.enum(["Engineering", "Design", "Marketing", "Sales", "HR"]),
  salary: z.number(),
  startDate: z.coerce.date(),
  active: z.boolean(),
  skills: z.array(z.string()),
});

const schemaSource = `z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  department: z.enum([
    'Engineering', 'Design',
    'Marketing', 'Sales', 'HR',
  ]),
  salary: z.number(),
  startDate: z.coerce.date(),
  active: z.boolean(),
  skills: z.array(z.string()),
})`;

const overridesSource = `overrides={{
  name:   { format: 'avatar' },
  email:  { format: 'link' },
  salary: { format: 'currency' },
  skills: { format: 'tags' },
}}`;

const usageSource = `<EntityList
  entityType="employee"
  schema={EmployeeSchema}
  data={employees}
  exclude={['id']}
  overrides={overrides}
  enableColumnFilters
  getRowId={(row) => row.id}
/>`;

const employees = [
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@company.com",
    department: "Engineering" as const,
    salary: 145000,
    startDate: new Date("2021-03-15"),
    active: true,
    skills: ["React", "TypeScript", "Node.js"],
  },
  {
    id: "2",
    name: "Bob Martinez",
    email: "bob@company.com",
    department: "Design" as const,
    salary: 125000,
    startDate: new Date("2020-07-01"),
    active: true,
    skills: ["Figma", "CSS", "Illustration"],
  },
  {
    id: "3",
    name: "Carol Chen",
    email: "carol@company.com",
    department: "Engineering" as const,
    salary: 160000,
    startDate: new Date("2019-11-20"),
    active: true,
    skills: ["Go", "Kubernetes", "AWS"],
  },
  {
    id: "4",
    name: "David Kim",
    email: "david@company.com",
    department: "Marketing" as const,
    salary: 110000,
    startDate: new Date("2022-01-10"),
    active: true,
    skills: ["SEO", "Analytics", "Content"],
  },
  {
    id: "5",
    name: "Eva Rossi",
    email: "eva@company.com",
    department: "Sales" as const,
    salary: 130000,
    startDate: new Date("2021-09-05"),
    active: false,
    skills: ["Negotiation", "CRM", "Presentations"],
  },
  {
    id: "6",
    name: "Frank Okafor",
    email: "frank@company.com",
    department: "Engineering" as const,
    salary: 155000,
    startDate: new Date("2020-02-14"),
    active: true,
    skills: ["Python", "ML", "TensorFlow"],
  },
  {
    id: "7",
    name: "Grace Liu",
    email: "grace@company.com",
    department: "HR" as const,
    salary: 105000,
    startDate: new Date("2022-06-01"),
    active: true,
    skills: ["Recruiting", "Onboarding", "Policy"],
  },
  {
    id: "8",
    name: "Hiro Tanaka",
    email: "hiro@company.com",
    department: "Design" as const,
    salary: 135000,
    startDate: new Date("2021-04-22"),
    active: true,
    skills: ["UX Research", "Prototyping", "Accessibility"],
  },
  {
    id: "9",
    name: "Isla Patel",
    email: "isla@company.com",
    department: "Engineering" as const,
    salary: 150000,
    startDate: new Date("2020-10-30"),
    active: true,
    skills: ["Rust", "WebAssembly", "Systems"],
  },
  {
    id: "10",
    name: "James Wright",
    email: "james@company.com",
    department: "Sales" as const,
    salary: 120000,
    startDate: new Date("2023-01-15"),
    active: true,
    skills: ["Enterprise", "Demos", "Closing"],
  },
  {
    id: "11",
    name: "Keiko Sato",
    email: "keiko@company.com",
    department: "Marketing" as const,
    salary: 115000,
    startDate: new Date("2022-08-20"),
    active: false,
    skills: ["Social Media", "Branding", "Events"],
  },
  {
    id: "12",
    name: "Liam O'Brien",
    email: "liam@company.com",
    department: "Engineering" as const,
    salary: 170000,
    startDate: new Date("2018-05-10"),
    active: true,
    skills: ["Architecture", "Mentoring", "DevOps"],
  },
];

export function CellRenderersDemo() {
  return (
    <DemoShell
      title="Cell Renderers Showcase"
      description="All built-in cell renderers: avatar, link, currency, date, boolean, badge (enum), and tags — configured via the overrides prop."
      features={["Date", "Currency", "Badge", "Boolean", "Link", "Avatar", "Tags", "Column Filters"]}
      schema={schemaSource}
      codeBlocks={[
        { title: "Overrides", code: overridesSource, defaultOpen: true },
        { title: "Usage", code: usageSource, defaultOpen: true },
      ]}
    >
      <EntityList
        entityType="employee"
        schema={EmployeeSchema}
        data={employees}
        exclude={["id"]}
        overrides={{
          name: { format: "avatar" },
          email: { format: "link" },
          salary: { format: "currency" },
          skills: { format: "tags" },
        }}
        enableColumnFilters
        getRowId={(row) => row.id}
      />
    </DemoShell>
  );
}
