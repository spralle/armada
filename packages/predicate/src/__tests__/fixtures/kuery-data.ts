/** Test data ported verbatim from kuery/test/kuery.js and kuery/test/skip.js */

export const collection = [
  {
    id: 1,
    name: 'Andreas',
    address: { street: 'Bellmansgatan' },
    born: new Date('1980-01-01T12:00:00.000Z'),
    isActive: true,
  },
  {
    id: 2,
    name: 'Sven',
    address: {},
    girlfriends: [{ wife: {} }],
    born: new Date('1989-01-01T12:00:00.000Z'),
    isActive: true,
  },
  {
    id: 3,
    name: 'Christian',
    born: new Date('1990-01-01T12:00:00.000Z'),
    girlfriends: { wife: {} },
    isActive: false,
    parts: [
      { name: 'part1', parts: [] },
      { name: 'part2', parts: [{ name: 'part2.sub1' }] },
      { name: 'part3', parts: '' },
    ],
  },
  {
    id: 4,
    name: 'Emil',
    girlfriends: [
      { name: 'fanny', hotness: 10 },
      {
        name: 'eve',
        hotness: 1000,
        boyfriends: [
          {
            id: 4,
            name: 'Emil',
            girlfriends: [
              { name: 'fanny', hotness: 10 },
              { name: 'eve' },
            ],
          },
          { id: 2, name: 'Sven' },
        ],
      },
    ],
    parts: [
      { name: 'part1', parts: [] },
      {
        name: 'part2',
        parts: [{ name: 'part2.sub1' }, { name: 'part2.sub2' }],
      },
      { name: 'part3' },
    ],
    bikes: [
      {
        bike: {
          brand: 'trek',
          wheels: [
            { position: 'front', type: 'carbon' },
            { position: 'back', type: 'aluminum' },
          ],
        },
      },
      {
        bike: {
          brand: 'unicycle',
          wheels: [{ position: 'front', type: 'aluminum' }],
        },
      },
    ],
    currentBike: [{ brand: 'trek', wheels: ['front', 'back'] }],
    born: new Date('1982-01-01T12:00:00.000Z'),
  },
  {
    id: 5,
    name: 'PG',
    girlfriends: [{ name: 'Hanna', hotness: 200 }],
    born: new Date('1989-01-01T12:00:00.000Z'),
    parts: [
      { name: 'part1', parts: [] },
      { name: 'part2', parts: [{ name: 'part2.sub1' }] },
      { name: 'part3', parts: 'TODO' },
      { name: 'part3', parts: {} },
    ],
  },
];

export const collectionWithNull = [
  { id: 6, name: 'KE', girlfriends: null },
];

/** Smaller collection used in skip/limit/sort tests */
export const skipCollection = [
  {
    id: 1,
    name: 'Andreas',
    address: { street: 'Bellmansgatan' },
    born: new Date('1980-01-01T12:00:00.000Z'),
  },
  { id: 2, name: 'Sven', born: new Date('1989-01-01T12:00:00.000Z') },
  {
    id: 3,
    name: 'Christian',
    born: new Date('1990-01-01T12:00:00.000Z'),
  },
  {
    id: 4,
    name: 'Emil',
    girlfriends: [
      { name: 'fanny', hotness: 10 },
      { name: 'eve', hotness: 1000 },
    ],
    born: new Date('1982-01-01T12:00:00.000Z'),
  },
];
