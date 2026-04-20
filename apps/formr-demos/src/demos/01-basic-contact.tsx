import { DemoShell } from '../renderers/DemoShell';
import { DemoFormRoot } from '../renderers/DemoFormRoot';

const schema = {
  type: 'object',
  required: ['name', 'email'],
  properties: {
    name: { type: 'string', title: 'Full Name', description: 'Your full legal name' },
    email: { type: 'string', title: 'Email', format: 'email', description: 'We will never share your email' },
    phone: { type: 'string', title: 'Phone Number' },
    message: { type: 'string', title: 'Message', maxLength: 500, 'x-formr': { widget: 'textarea' } },
  },
};

export function BasicContactDemo() {
  return (
    <DemoShell
      title="Basic Contact Form"
      description="Simple contact form with text, email, and textarea fields. Auto-generated layout from JSON Schema."
      features={['Auto Layout', 'Email Format', 'Textarea Widget', 'Required Fields']}
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
