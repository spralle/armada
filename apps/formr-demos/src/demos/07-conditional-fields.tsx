import { DemoShell } from '../renderers/DemoShell';
import { DemoFormRoot } from '../renderers/DemoFormRoot';

const schema = {
  type: 'object',
  required: ['employmentStatus'],
  properties: {
    employmentStatus: {
      type: 'string',
      title: 'Employment Status',
      enum: ['Employed', 'Self-Employed', 'Student', 'Retired', 'Unemployed'],
    },
    companyName: {
      type: 'string',
      title: 'Company Name',
      description: 'Required if employed',
    },
    jobTitle: { type: 'string', title: 'Job Title' },
    businessName: {
      type: 'string',
      title: 'Business Name',
      description: 'Required if self-employed',
    },
    businessType: {
      type: 'string',
      title: 'Business Type',
      enum: ['Sole Proprietorship', 'LLC', 'Corporation', 'Partnership'],
    },
    schoolName: {
      type: 'string',
      title: 'School/University',
      description: 'Required if student',
    },
    fieldOfStudy: { type: 'string', title: 'Field of Study' },
    annualIncome: {
      type: 'number',
      title: 'Annual Income',
      minimum: 0,
      description: 'Approximate annual income',
    },
    hasHealthInsurance: {
      type: 'boolean',
      title: 'Health Insurance',
      description: 'Do you have health insurance?',
    },
  },
  dependentRequired: {
    companyName: ['employmentStatus'],
    businessName: ['employmentStatus'],
  },
};

const layout = {
  type: 'group',
  id: 'root',
  children: [
    {
      type: 'section',
      id: 'status',
      props: { title: 'Employment Status' },
      children: [{ type: 'field', id: 'f-status', path: 'employmentStatus' }],
    },
    {
      type: 'section',
      id: 'employed',
      props: { title: 'Employment Details', columns: 2 },
      children: [
        { type: 'field', id: 'f-company', path: 'companyName' },
        { type: 'field', id: 'f-job', path: 'jobTitle' },
      ],
    },
    {
      type: 'section',
      id: 'self-employed',
      props: { title: 'Business Details', columns: 2 },
      children: [
        { type: 'field', id: 'f-business', path: 'businessName' },
        { type: 'field', id: 'f-businessType', path: 'businessType' },
      ],
    },
    {
      type: 'section',
      id: 'student',
      props: { title: 'Education', columns: 2 },
      children: [
        { type: 'field', id: 'f-school', path: 'schoolName' },
        { type: 'field', id: 'f-study', path: 'fieldOfStudy' },
      ],
    },
    {
      type: 'section',
      id: 'financial',
      props: { title: 'Financial Information', columns: 2 },
      children: [
        { type: 'field', id: 'f-income', path: 'annualIncome' },
        { type: 'field', id: 'f-insurance', path: 'hasHealthInsurance' },
      ],
    },
  ],
} as const;

export function ConditionalFieldsDemo() {
  return (
    <DemoShell
      title="Conditional Fields"
      description="Demonstrates conditional field requirements. The Employment Status choice drives which fields become contextually required. Uses JSON Schema `dependentRequired` for automatic validation."
      features={['Conditional Required', 'dependentRequired', 'RadioGroup', 'Multi-Section', 'Responsive Columns']}
      schema={schema}
      layout={layout}
    >
      <DemoFormRoot
        schema={schema}
        data={{}}
        layout={layout}
        onChange={(path, value) => console.log('change', path, value)}
        responsive
      />
    </DemoShell>
  );
}
