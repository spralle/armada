import { DemoShell } from '../renderers/DemoShell';
import { DemoFormRoot } from '../renderers/DemoFormRoot';

const schema = {
  type: 'object',
  required: ['projectName'],
  properties: {
    projectName: { type: 'string', title: 'Project Name' },
    description: { type: 'string', title: 'Description', 'x-formr': { widget: 'textarea' } },
    priority: { type: 'string', title: 'Priority', enum: ['Low', 'Medium', 'High', 'Critical'] },
    tags: {
      type: 'array',
      title: 'Tags',
      items: { type: 'string' },
    },
    teamMembers: {
      type: 'array',
      title: 'Team Members',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Name' },
          role: { type: 'string', title: 'Role', enum: ['Lead', 'Developer', 'Designer', 'QA'] },
        },
      },
    },
    milestones: {
      type: 'array',
      title: 'Milestones',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', title: 'Milestone' },
          completed: { type: 'boolean', title: 'Completed' },
        },
      },
    },
    isPublic: { type: 'boolean', title: 'Public Project', description: 'Visible to all organization members' },
  },
};

export function ArrayItemsDemo() {
  return (
    <DemoShell
      title="Array/Repeatable Items"
      description="Shows how formr handles array fields in JSON Schema. Simple arrays, object arrays, and nested structures are all supported. Array items render with a placeholder — the extension point for custom array renderers."
      features={['Array Fields', 'Nested Arrays', 'Object Array Items', 'Auto Layout', 'Mixed Types']}
      schema={schema}
    >
      <DemoFormRoot
        schema={schema}
        data={{}}
        onChange={(path, value) => console.log('change', path, value)}
        responsive
      />
    </DemoShell>
  );
}
