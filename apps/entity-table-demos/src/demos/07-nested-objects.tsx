import { EntityList } from "@ghost-shell/entity-table";
import { z } from "zod";
import { DemoShell } from "../components/DemoShell";

const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["active", "inactive", "prospect"]),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
  }),
  contact: z.object({
    email: z.string().email(),
    phone: z.string(),
    preferredChannel: z.enum(["email", "phone", "sms"]),
  }),
  billing: z.object({
    creditLimit: z.number(),
    currency: z.enum(["USD", "EUR", "GBP", "SEK"]),
    paymentTerms: z.enum(["net30", "net60", "net90", "prepaid"]),
  }),
  createdAt: z.coerce.date(),
});

const schemaSource = `z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'inactive', 'prospect']),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
  }),
  contact: z.object({
    email: z.string().email(),
    phone: z.string(),
    preferredChannel: z.enum(['email', 'phone', 'sms']),
  }),
  billing: z.object({
    creditLimit: z.number(),
    currency: z.enum(['USD', 'EUR', 'GBP', 'SEK']),
    paymentTerms: z.enum(['net30', 'net60', 'net90', 'prepaid']),
  }),
  createdAt: z.coerce.date(),
})`;

const overridesSource = `overrides={{
  'contact.email': { format: 'link', label: 'Email' },
  'billing.creditLimit': { format: 'currency', label: 'Credit Limit' },
}}`;

const usageSource = `<EntityList
  entityType="customer"
  schema={CustomerSchema}
  data={customers}
  exclude={['id']}
  defaultVisible={[
    'name', 'status',
    'address.city', 'address.country',
    'contact.email', 'contact.preferredChannel',
    'billing.creditLimit', 'billing.currency',
    'createdAt',
  ]}
  overrides={overrides}
  getRowId={(row) => row.id}
/>`;

type Customer = z.infer<typeof CustomerSchema>;

const customers: Customer[] = [
  {
    id: "cust-001",
    name: "Nordström Shipping AB",
    status: "active",
    address: { street: "Strandvägen 12", city: "Stockholm", state: "Stockholm", zip: "114 56", country: "Sweden" },
    contact: { email: "info@nordstrom-shipping.se", phone: "+46 8 555 1234", preferredChannel: "email" },
    billing: { creditLimit: 500000, currency: "SEK", paymentTerms: "net60" },
    createdAt: new Date("2021-03-15"),
  },
  {
    id: "cust-002",
    name: "Rotterdam Port Services",
    status: "active",
    address: {
      street: "Europaweg 200",
      city: "Rotterdam",
      state: "South Holland",
      zip: "3199 LC",
      country: "Netherlands",
    },
    contact: { email: "ops@rps.nl", phone: "+31 10 252 1000", preferredChannel: "phone" },
    billing: { creditLimit: 250000, currency: "EUR", paymentTerms: "net30" },
    createdAt: new Date("2020-07-22"),
  },
  {
    id: "cust-003",
    name: "Gulf Maritime LLC",
    status: "active",
    address: { street: "1200 Navigation Blvd", city: "Houston", state: "TX", zip: "77003", country: "USA" },
    contact: { email: "charter@gulfmaritime.com", phone: "+1 713 555 8900", preferredChannel: "email" },
    billing: { creditLimit: 750000, currency: "USD", paymentTerms: "net30" },
    createdAt: new Date("2019-11-01"),
  },
  {
    id: "cust-004",
    name: "Maersk Logistics UK",
    status: "active",
    address: { street: "50 Eastbourne Terrace", city: "London", state: "England", zip: "W2 6LG", country: "UK" },
    contact: { email: "bookings@maersk-uk.co.uk", phone: "+44 20 7654 3210", preferredChannel: "email" },
    billing: { creditLimit: 1000000, currency: "GBP", paymentTerms: "net90" },
    createdAt: new Date("2018-05-10"),
  },
  {
    id: "cust-005",
    name: "Hanseatic Trade GmbH",
    status: "inactive",
    address: { street: "Am Sandtorkai 48", city: "Hamburg", state: "Hamburg", zip: "20457", country: "Germany" },
    contact: { email: "kontakt@hanseatic-trade.de", phone: "+49 40 300 5100", preferredChannel: "phone" },
    billing: { creditLimit: 180000, currency: "EUR", paymentTerms: "net60" },
    createdAt: new Date("2020-01-20"),
  },
  {
    id: "cust-006",
    name: "Pacific Rim Freight",
    status: "active",
    address: { street: "8 Marina Boulevard", city: "Singapore", state: "Central", zip: "018981", country: "Singapore" },
    contact: { email: "ops@pacrimfreight.sg", phone: "+65 6321 7788", preferredChannel: "sms" },
    billing: { creditLimit: 400000, currency: "USD", paymentTerms: "net30" },
    createdAt: new Date("2022-02-14"),
  },
  {
    id: "cust-007",
    name: "Fjord Carriers AS",
    status: "prospect",
    address: { street: "Sjøgata 5", city: "Bergen", state: "Vestland", zip: "5003", country: "Norway" },
    contact: { email: "post@fjordcarriers.no", phone: "+47 55 30 2000", preferredChannel: "email" },
    billing: { creditLimit: 0, currency: "EUR", paymentTerms: "prepaid" },
    createdAt: new Date("2024-08-01"),
  },
  {
    id: "cust-008",
    name: "Aegean Bulk Transport",
    status: "active",
    address: { street: "Akti Miaouli 85", city: "Piraeus", state: "Attica", zip: "185 38", country: "Greece" },
    contact: { email: "chartering@aegeanbulk.gr", phone: "+30 210 429 1500", preferredChannel: "phone" },
    billing: { creditLimit: 320000, currency: "EUR", paymentTerms: "net60" },
    createdAt: new Date("2021-09-30"),
  },
  {
    id: "cust-009",
    name: "Great Lakes Shipping Co",
    status: "active",
    address: { street: "200 Lakeshore Dr", city: "Chicago", state: "IL", zip: "60601", country: "USA" },
    contact: { email: "dispatch@greatlakes-ship.com", phone: "+1 312 555 4400", preferredChannel: "email" },
    billing: { creditLimit: 600000, currency: "USD", paymentTerms: "net30" },
    createdAt: new Date("2019-04-18"),
  },
  {
    id: "cust-010",
    name: "Baltic Dry Partners",
    status: "inactive",
    address: { street: "Kaivokatu 10", city: "Helsinki", state: "Uusimaa", zip: "00100", country: "Finland" },
    contact: { email: "info@balticdry.fi", phone: "+358 9 228 1000", preferredChannel: "email" },
    billing: { creditLimit: 150000, currency: "EUR", paymentTerms: "net30" },
    createdAt: new Date("2020-11-05"),
  },
  {
    id: "cust-011",
    name: "Yokohama Marine Services",
    status: "active",
    address: { street: "3-1 Shinko", city: "Yokohama", state: "Kanagawa", zip: "231-0001", country: "Japan" },
    contact: { email: "service@yokohama-marine.jp", phone: "+81 45 680 2200", preferredChannel: "phone" },
    billing: { creditLimit: 450000, currency: "USD", paymentTerms: "net60" },
    createdAt: new Date("2022-06-12"),
  },
  {
    id: "cust-012",
    name: "Cape Town Terminals",
    status: "prospect",
    address: { street: "Duncan Road", city: "Cape Town", state: "Western Cape", zip: "8001", country: "South Africa" },
    contact: { email: "enquiries@ct-terminals.co.za", phone: "+27 21 449 3000", preferredChannel: "email" },
    billing: { creditLimit: 0, currency: "USD", paymentTerms: "prepaid" },
    createdAt: new Date("2024-09-01"),
  },
];

export function NestedObjectsDemo() {
  return (
    <DemoShell
      title="Nested Objects & Dot Paths"
      description="Nested z.object() fields are automatically flattened into dot-path columns (e.g. address.city, contact.email). The schema pipeline walks the Zod tree and produces one column per leaf field."
      features={["Nested Objects", "Dot-Path Columns", "Value Objects", "Flattened Display"]}
      schema={schemaSource}
      codeBlocks={[
        { title: "Overrides", code: overridesSource, defaultOpen: true },
        { title: "Usage", code: usageSource, defaultOpen: true },
      ]}
    >
      <EntityList
        entityType="customer"
        schema={CustomerSchema}
        data={customers}
        exclude={["id"]}
        defaultVisible={[
          "name",
          "status",
          "address.city",
          "address.country",
          "contact.email",
          "contact.preferredChannel",
          "billing.creditLimit",
          "billing.currency",
          "createdAt",
        ]}
        overrides={{
          "contact.email": { format: "link", label: "Email" },
          "billing.creditLimit": { format: "currency", label: "Credit Limit" },
        }}
        getRowId={(row) => row.id}
      />
    </DemoShell>
  );
}
