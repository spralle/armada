import { z } from 'zod';
import { EntityList } from '@ghost-shell/entity-table';
import { DemoShell } from '../components/DemoShell';

const ContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  company: z.string(),
});

const schemaSource = `z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  company: z.string(),
})`;

const contacts = [
  { id: '1', name: 'Alice Johnson', email: 'alice@acmecorp.com', phone: '(555) 123-4567', company: 'Acme Corp' },
  { id: '2', name: 'Bob Martinez', email: 'bob@globex.io', phone: '(555) 234-5678', company: 'Globex Inc' },
  { id: '3', name: 'Carol Chen', email: 'carol@initech.com', phone: '(555) 345-6789', company: 'Initech' },
  { id: '4', name: 'David Kim', email: 'david@umbrella.co', phone: '(555) 456-7890', company: 'Umbrella Corp' },
  { id: '5', name: 'Eva Rossi', email: 'eva@wayneent.com', phone: '(555) 567-8901', company: 'Wayne Enterprises' },
  { id: '6', name: 'Frank Okafor', email: 'frank@starkindustries.com', phone: '(555) 678-9012', company: 'Stark Industries' },
  { id: '7', name: 'Grace Liu', email: 'grace@oscorp.net', phone: '(555) 789-0123', company: 'Oscorp' },
  { id: '8', name: 'Hiro Tanaka', email: 'hiro@lexcorp.com', phone: '(555) 890-1234', company: 'LexCorp' },
  { id: '9', name: 'Isla Patel', email: 'isla@capsuletech.io', phone: '(555) 901-2345', company: 'Capsule Tech' },
  { id: '10', name: 'James Wright', email: 'james@cyberdyne.com', phone: '(555) 012-3456', company: 'Cyberdyne Systems' },
  { id: '11', name: 'Keiko Sato', email: 'keiko@weyland.co', phone: '(555) 111-2222', company: 'Weyland-Yutani' },
  { id: '12', name: 'Liam O\'Brien', email: 'liam@tyrell.com', phone: '(555) 222-3333', company: 'Tyrell Corp' },
  { id: '13', name: 'Mia Fernandez', email: 'mia@soylent.io', phone: '(555) 333-4444', company: 'Soylent Corp' },
  { id: '14', name: 'Noah Andersen', email: 'noah@massive.dk', phone: '(555) 444-5555', company: 'Massive Dynamic' },
  { id: '15', name: 'Olivia Brown', email: 'olivia@hooli.com', phone: '(555) 555-6666', company: 'Hooli' },
];

export function BasicContactsDemo() {
  return (
    <DemoShell
      title="Basic Contacts Table"
      description="The simplest usage: define a Zod schema, provide data, get a fully-featured table with sorting and pagination."
      features={['Zero Config', 'Auto Columns', 'Sorting', 'Pagination']}
      schema={schemaSource}
    >
      <EntityList
        entityType="contact"
        schema={ContactSchema}
        data={contacts}
        exclude={['id']}
        getRowId={(row) => row.id}
      />
    </DemoShell>
  );
}
