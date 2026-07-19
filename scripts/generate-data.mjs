// Generates src/data/countries.json (country metadata for both list modes)
// and copies the Natural Earth 50m TopoJSON used by the globe/continent maps.
//
// Sources:
//  - world-countries (npm): names, ISO codes, region/subregion, UN membership, flag emoji
//  - world-atlas (npm): Natural Earth admin-0 countries, 1:50m, TopoJSON keyed by ISO numeric id
import { createRequire } from 'node:module';
import { writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const worldCountries = require('world-countries');
const topo = require('world-atlas/countries-50m.json');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src', 'data');
mkdirSync(outDir, { recursive: true });

// UN observers / special cases included in the "UN 196" list alongside the 193 members.
const UN_EXTRAS = new Set(['VAT', 'PSE', 'TWN']);

// Present in world-countries but not UN-196 → travel list only.
// Kosovo, Western Sahara, Antarctica (a continent-country from a travel perspective).
const TRAVEL_ONLY_ISO = new Set(['UNK', 'ESH', 'ATA']);

// De facto states missing from world-countries entirely → hand-authored entries.
// mapName is the Natural Earth feature name when geometry exists at 1:50m.
const CUSTOM = [
  { code: 'SML', name: 'Somaliland', continent: 'Africa', flag: '🏴', mapName: 'Somaliland' },
  { code: 'NCY', name: 'Northern Cyprus', continent: 'Europe', flag: '🏴', mapName: 'N. Cyprus' },
  { code: 'PMR', name: 'Transnistria', continent: 'Europe', flag: '🏴', mapName: null },
  { code: 'ABK', name: 'Abkhazia', continent: 'Asia', flag: '🏴', mapName: null },
  { code: 'SOS', name: 'South Ossetia', continent: 'Asia', flag: '🏴', mapName: null },
];

const geometries = topo.objects.countries.geometries;
const byMapId = new Map(geometries.filter((g) => g.id).map((g) => [g.id, g]));
const byMapName = new Map(geometries.map((g) => [g.properties?.name, g]));

// Some Natural Earth features (de facto states) carry no ISO numeric id.
// The app keys those by feature name instead: "n:<name>".
const keyOf = (g) => g.id ?? `n:${g.properties.name}`;

function continentOf(c) {
  if (c.region === 'Americas') {
    return c.subregion === 'South America' ? 'South America' : 'North America';
  }
  if (c.region === 'Antarctic') return 'Antarctica';
  return c.region; // Africa, Asia, Europe, Oceania
}

// Dependent territories drawn as their own Natural Earth features. Tapping one
// selects its sovereign country, and it is painted with the sovereign's status.
// Keyed by NE feature name → ISO cca3 of the sovereign.
const TERRITORIES = {
  'N. Mariana Is.': 'USA',
  'U.S. Virgin Is.': 'USA',
  Guam: 'USA',
  'American Samoa': 'USA',
  'Puerto Rico': 'USA',
  'S. Geo. and the Is.': 'GBR',
  'Br. Indian Ocean Ter.': 'GBR',
  'Saint Helena': 'GBR',
  'Pitcairn Is.': 'GBR',
  Anguilla: 'GBR',
  'Falkland Is.': 'GBR',
  'Cayman Is.': 'GBR',
  Bermuda: 'GBR',
  'British Virgin Is.': 'GBR',
  'Turks and Caicos Is.': 'GBR',
  Montserrat: 'GBR',
  Jersey: 'GBR',
  Guernsey: 'GBR',
  'Isle of Man': 'GBR',
  Niue: 'NZL',
  'Cook Is.': 'NZL',
  Aruba: 'NLD',
  Curaçao: 'NLD',
  'Sint Maarten': 'NLD',
  'St. Pierre and Miquelon': 'FRA',
  'Wallis and Futuna Is.': 'FRA',
  'St-Martin': 'FRA',
  'St-Barthélemy': 'FRA',
  'Fr. Polynesia': 'FRA',
  'New Caledonia': 'FRA',
  'Fr. S. Antarctic Lands': 'FRA',
  Åland: 'FIN',
  Greenland: 'DNK',
  'Faeroe Is.': 'DNK',
  Macao: 'CHN',
  'Hong Kong': 'CHN',
  'Indian Ocean Ter.': 'AUS',
  'Heard I. and McDonald Is.': 'AUS',
  'Norfolk Island': 'AUS',
};

const out = [];
const missingGeometry = [];

for (const c of worldCountries) {
  const isUn = c.unMember || UN_EXTRAS.has(c.cca3);
  const isTravelOnly = TRAVEL_ONLY_ISO.has(c.cca3);
  if (!isUn && !isTravelOnly) continue;

  let mapId = c.ccn3 && byMapId.has(c.ccn3) ? c.ccn3 : null;
  if (!mapId && byMapName.has(c.name.common)) mapId = keyOf(byMapName.get(c.name.common));
  if (!mapId) missingGeometry.push(c.name.common);

  out.push({
    code: c.cca3,
    name: c.name.common,
    flag: c.flag,
    continent: continentOf(c),
    un: isUn,
    mapId,
  });
}

for (const c of CUSTOM) {
  const g = c.mapName ? byMapName.get(c.mapName) : null;
  if (c.mapName && !g) missingGeometry.push(c.name);
  out.push({
    code: c.code,
    name: c.name,
    flag: c.flag,
    continent: c.continent,
    un: false,
    mapId: g ? keyOf(g) : null,
  });
}

out.sort((a, b) => a.name.localeCompare(b.name));

const codes = new Set(out.map((c) => c.code));
const territories = {};
for (const [neName, sovereign] of Object.entries(TERRITORIES)) {
  const g = byMapName.get(neName);
  if (!g) {
    console.warn(`Territory not found in map data: ${neName}`);
    continue;
  }
  if (!codes.has(sovereign)) {
    console.warn(`Territory ${neName} points at unknown sovereign ${sovereign}`);
    continue;
  }
  territories[keyOf(g)] = sovereign;
}

writeFileSync(join(outDir, 'countries.json'), JSON.stringify(out, null, 2));
writeFileSync(join(outDir, 'territories.json'), JSON.stringify(territories, null, 2));
copyFileSync(require.resolve('world-atlas/countries-50m.json'), join(outDir, 'world-50m.json'));

const un = out.filter((c) => c.un).length;
console.log(`Wrote ${out.length} countries (${un} in UN list, ${out.length} in travel list).`);
if (missingGeometry.length) {
  console.log(`No 50m geometry (list-only): ${missingGeometry.join(', ')}`);
}
