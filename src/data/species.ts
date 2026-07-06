import creaturesCsv from './creatures.csv?raw';

export type MovementPattern = 'graze' | 'flee' | 'charge';
export type AttackPattern = 'none' | 'radial';
export type AtkStyle = 'physical' | 'special';

export interface SpeciesDef {
  id: string;
  name: string;
  /** Elemental type - tracked in data now; battles use it from M3. */
  type?: string;
  /** Physical or special attacker - used by the battle system (M3). */
  atkStyle?: AtkStyle;
  textureKey: string;
  bodyRadius: number;
  requiredLoops: number;
  /** Base walk speed, px/s. */
  moveSpeed: number;
  movement: MovementPattern;
  attack: AttackPattern;
  attackIntervalMs?: number;
  /** Whole HEALTH bars removed per hit. */
  attackDamage?: number;
  telegraphMs?: number;
  ringMaxR?: number;
  ringSpeed?: number;
  /** Charge movers: interval between dashes (ms). */
  dashIntervalMs?: number;
  blurb: string;
}

const MOVEMENTS: MovementPattern[] = ['graze', 'flee', 'charge'];
const ATTACKS: AttackPattern[] = ['none', 'radial'];
const ATK_STYLES: AtkStyle[] = ['physical', 'special'];

/**
 * Creature data lives in creatures.csv - an Excel/Numbers/Sheets-editable
 * spreadsheet. This module parses and validates it at build time; a bad row
 * throws a descriptive error (visible in the browser console / Vite overlay).
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function buildSpecies(): SpeciesDef[] {
  // Excel quirks: trim() strips any leading BOM (U+FEFF is whitespace per
  // spec); normalize \r\n and old-Mac \r line endings.
  const clean = creaturesCsv.replace(/\r\n?/g, '\n').trim();
  const rows = parseCsv(clean);
  if (rows.length < 2) throw new Error('creatures.csv: no data rows found');
  const header = rows[0].map((h) => h.trim());

  const get = (row: string[], name: string): string => {
    const i = header.indexOf(name);
    return i >= 0 && i < row.length ? row[i].trim() : '';
  };
  const optNum = (row: string[], name: string): number | undefined => {
    const v = get(row, name);
    if (v === '') return undefined;
    const n = Number(v);
    if (Number.isNaN(n)) {
      throw new Error(`creatures.csv (${get(row, 'id')}): column "${name}" is not a number: "${v}"`);
    }
    return n;
  };
  const reqNum = (row: string[], name: string): number => {
    const n = optNum(row, name);
    if (n === undefined) {
      throw new Error(`creatures.csv (${get(row, 'id')}): column "${name}" is required`);
    }
    return n;
  };

  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const id = get(r, 'id');
      if (!id) throw new Error('creatures.csv: a data row is missing its "id"');

      const movement = get(r, 'movement') as MovementPattern;
      if (!MOVEMENTS.includes(movement)) {
        throw new Error(`creatures.csv (${id}): movement must be one of ${MOVEMENTS.join(' / ')}`);
      }
      const attack = get(r, 'attack') as AttackPattern;
      if (!ATTACKS.includes(attack)) {
        throw new Error(`creatures.csv (${id}): attack must be one of ${ATTACKS.join(' / ')}`);
      }
      const atkStyleRaw = get(r, 'atkStyle');
      const atkStyle = atkStyleRaw === '' ? undefined : (atkStyleRaw as AtkStyle);
      if (atkStyle !== undefined && !ATK_STYLES.includes(atkStyle)) {
        throw new Error(`creatures.csv (${id}): atkStyle must be one of ${ATK_STYLES.join(' / ')}`);
      }
      const textureKey = get(r, 'textureKey');
      if (!textureKey) throw new Error(`creatures.csv (${id}): textureKey is required`);

      return {
        id,
        name: get(r, 'name') || id.toUpperCase(),
        type: get(r, 'type') || undefined,
        atkStyle,
        textureKey,
        bodyRadius: reqNum(r, 'bodyRadius'),
        requiredLoops: reqNum(r, 'loops'),
        moveSpeed: reqNum(r, 'moveSpeed'),
        movement,
        attack,
        attackIntervalMs: optNum(r, 'attackIntervalMs'),
        attackDamage: optNum(r, 'attackDamage'),
        telegraphMs: optNum(r, 'telegraphMs'),
        ringMaxR: optNum(r, 'ringMaxR'),
        ringSpeed: optNum(r, 'ringSpeed'),
        dashIntervalMs: optNum(r, 'dashIntervalMs'),
        blurb: get(r, 'blurb')
      };
    });
}

export const SPECIES: SpeciesDef[] = buildSpecies();

export function speciesById(id: string): SpeciesDef {
  const s = SPECIES.find((sp) => sp.id === id);
  if (!s) throw new Error(`Unknown species id: ${id}`);
  return s;
}
