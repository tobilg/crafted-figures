import Ajv from '../../runtime/ajv.mjs';
const str = { type: 'string', minLength: 1 },
  list = { type: 'array', items: str, uniqueItems: true },
  obj = (properties, required = []) => ({
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  });
const rect = { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
  point = { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 };
const action = {
  oneOf: [
    obj({ type: { const: 'pose' }, name: str }, ['type', 'name']),
    obj({ type: { const: 'state' }, value: { type: 'object' } }, ['type', 'value']),
    obj({ type: { const: 'time' }, value: { type: 'number', minimum: 0 } }, ['type', 'value']),
  ],
};
const view = {
  ...obj({
    pose: str,
    actions: { type: 'array', minItems: 1, items: action },
    time: { type: 'number', minimum: 0 },
    focus: list,
    hide: list,
    around: list,
    crop: rect,
    effects: { type: 'boolean' },
  }),
  oneOf: [
    { required: ['pose'], not: { required: ['actions'] } },
    { required: ['actions'], not: { required: ['pose'] } },
  ],
};
const note = obj({ view: str, title: str, text: str }, ['view', 'title', 'text']);
export const sheetSchema = {
  ...obj(
    {
      schemaVersion: { const: 1 },
      figure: str,
      artifact: str,
      config: str,
      title: str,
      description: { type: 'string' },
      views: {
        type: 'object',
        minProperties: 1,
        propertyNames: { pattern: '^[a-z][a-z0-9-]*$' },
        additionalProperties: view,
      },
      parts: {
        type: 'array',
        items: obj({ id: str, label: str, description: str, pin: point }, [
          'id',
          'label',
          'description',
        ]),
      },
      steps: { type: 'array', items: note },
      details: { type: 'array', items: note },
      assemblies: { type: 'array', items: note },
      maxPages: { type: 'integer', minimum: 1, maximum: 4 },
      eyebrow: { type: 'string', minLength: 1, maxLength: 80 },
      language: { type: 'string', pattern: '^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$' },
      paper: { enum: ['a4', 'letter'] },
      format: { enum: ['poster', 'drawing', 'detailed', 'all', 'available'] },
      typography: obj({
        body: { type: 'string', pattern: '^[a-zA-Z ,"\'-]+$' },
        size: { type: 'number', minimum: 9, maximum: 14 },
      }),
    },
    ['schemaVersion', 'title', 'views', 'parts', 'steps', 'maxPages'],
  ),
  oneOf: [
    { required: ['figure'], not: { required: ['artifact'] } },
    { required: ['artifact'], not: { required: ['figure'] } },
  ],
};
const validate = new Ajv({ allErrors: true }).compile(sheetSchema);
export function validateSheet(spec) {
  if (!validate(spec)) throw new Error(`sheet: ${JSON.stringify(validate.errors)}`);
  for (const item of [...spec.steps, ...(spec.details || []), ...(spec.assemblies || [])])
    if (!spec.views[item.view]) throw new Error(`sheet: missing referenced view ${item.view}`);
  for (const [id, v] of Object.entries(spec.views)) {
    if (v.around?.length && v.crop) throw new Error(`views.${id}: choose around or crop`);
    if (v.crop && (v.crop[2] <= 0 || v.crop[3] <= 0))
      throw new Error(`views.${id}.crop: positive dimensions required`);
  }
  return spec;
}
