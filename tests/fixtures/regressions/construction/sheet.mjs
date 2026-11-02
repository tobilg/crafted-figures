export default {schemaVersion: 1, figure: './static-figure.mjs', config: './print.config.json',
  title: 'H-06 · Hose inspection bench', description: 'Eight-degree inspection pose · millimetres · matching Ø6 terminals.', maxPages: 2, steps: [],
  views: {main: {pose: 'inspection'}},
  parts: [
    {id: 'instrument', label: 'Vented instrument', description: 'Six open roof slots; separate wall panels.'},
    {id: 'round-fitting', label: 'Round fitting', description: 'Flanged instrument terminal.'},
    {id: 'coupling', label: 'Bored coupling', description: 'Ø6 bore matches both terminal rims.'},
    {id: 'braided-lead', label: 'Flexible lead', description: 'Ø6 opaque route with braided surface engraving.'},
    {id: 'rigid-pipe', label: 'Rigid pipe', description: '24 mm long; split at saddle boundaries.'},
    {id: 'saddle', label: 'Curved support', description: 'A tangent seat supports the 3 mm radius.'}
  ]};
