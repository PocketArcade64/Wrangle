import creaturesCsv from './creatures.csv?raw';

export type MovementPattern = 'graze' | 'flee' | 'charge';
export type AttackPattern = 'none' | 'radial';
export type AtkStyle = 'physical' | 'special';

export interface SpeciesDef {
  id: string;
  name: string;
  /** Elemental types - tracked in data now; battles use them from M3. */
  type1?: string;
  type2?: string;
  /** Battle base stats (used from M3). */
  hp?: number;
  attack?: number;
  defense?: number;
  spAttack?: number;
  spDefense?: number;
  speed?: number;
  /** Physical or special attacker - used by the battle system (M3). */
  atkStyle?: AtkStyle;
  /** Loops required to fill the capture gauge. */
  requiredLoops: number;
  bodyRadius: number;
  /** Base walk speed in the capture arena, px/s. */
  moveSpeed: number;
  movement: MovementPattern;
  attackPattern: AttackPattern;
  attackIntervalMs?: number;
  /** Whole HEALTH bars removed per hit. */
  attackDamage?: number;
  telegraphMs?: number;
  ringMaxR?: number;
  ringSpeed?: number;
  /** Charge movers: interval between dashes (ms). */
  dashIntervalMs?: number;
  textureKey: string;
  blurb: string;
}

const MOVEMENTS: MovementPattern[] = ['graze', 'flee', 'charge'];
const ATTACK_PATTERNS: AttackPattern[] = ['none', 'radial'];
const ATK_STYLES: AtkStyle[] = ['physical', 'special'];

// Defaults applied when capture-behavior columns are left blank, so a row
// with just a name and types is immediately playable.
// Base capture meter is 100 points at 10 points per loop = 10 loops.
const DEFAULT_LOOPS = 10;
const DEFAULT_BODY_RADIUS = 40;
const DEFAULT_MOVE_SPEED = 100;

/**
 * Creature data lives in creatures.csv - an Excel/Numbers/Sheets-editable
 * spreadsheet. Row order in the CSV IS the dex order. This module parses and
 * validates it at build time; a bad row throws a descriptive error (visible
 * in the browser console / Vite overlay).
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
      throw new Error(`creatures.csv (${get(row, 'name') || get(row, 'id')}): column "${name}" is not a number: "${v}"`);
    }
    return n;
  };

  const seen = new Set<string>();
  const species: SpeciesDef[] = [];

  for (const r of rows.slice(1)) {
    if (!r.some((c) => c.trim() !== '')) continue;

    const name = get(r, 'name');
    const id = get(r, 'id') || name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!id) throw new Error('creatures.csv: a data row is missing both "id" and "name"');
    if (seen.has(id)) throw new Error(`creatures.csv: duplicate id "${id}"`);
    seen.add(id);

    const movementRaw = get(r, 'movement');
    const movement = (movementRaw === '' ? 'graze' : movementRaw) as MovementPattern;
    if (!MOVEMENTS.includes(movement)) {
      throw new Error(`creatures.csv (${id}): movement must be one of ${MOVEMENTS.join(' / ')}`);
    }
    const attackRaw = get(r, 'attackPattern');
    const attackPattern = (attackRaw === '' ? 'none' : attackRaw) as AttackPattern;
    if (!ATTACK_PATTERNS.includes(attackPattern)) {
      throw new Error(`creatures.csv (${id}): attackPattern must be one of ${ATTACK_PATTERNS.join(' / ')}`);
    }
    const atkStyleRaw = get(r, 'atkStyle');
    const atkStyle = atkStyleRaw === '' ? undefined : (atkStyleRaw as AtkStyle);
    if (atkStyle !== undefined && !ATK_STYLES.includes(atkStyle)) {
      throw new Error(`creatures.csv (${id}): atkStyle must be one of ${ATK_STYLES.join(' / ')}`);
    }

    species.push({
      id,
      name: name || id.toUpperCase(),
      type1: get(r, 'type1') || undefined,
      type2: get(r, 'type2') || undefined,
      hp: optNum(r, 'hp'),
      attack: optNum(r, 'attack'),
      defense: optNum(r, 'defense'),
      spAttack: optNum(r, 'spAttack'),
      spDefense: optNum(r, 'spDefense'),
      speed: optNum(r, 'speed'),
      atkStyle,
      requiredLoops: optNum(r, 'loops') ?? DEFAULT_LOOPS,
      bodyRadius: optNum(r, 'bodyRadius') ?? DEFAULT_BODY_RADIUS,
      moveSpeed: optNum(r, 'moveSpeed') ?? DEFAULT_MOVE_SPEED,
      movement,
      attackPattern,
      attackIntervalMs: optNum(r, 'attackIntervalMs'),
      attackDamage: optNum(r, 'attackDamage'),
      telegraphMs: optNum(r, 'telegraphMs'),
      ringMaxR: optNum(r, 'ringMaxR'),
      ringSpeed: optNum(r, 'ringSpeed'),
      dashIntervalMs: optNum(r, 'dashIntervalMs'),
      // Blank textureKey defaults to the id: BootScene loads
      // public/sprites/<id>.png, and scenes fall back to the mystery blob
      // if that file doesn't exist yet.
      textureKey: get(r, 'textureKey') || id,
      blurb: get(r, 'blurb')
    });
  }

  return species;
}

export const SPECIES: SpeciesDef[] = buildSpecies();

export function speciesById(id: string): SpeciesDef {
  const s = SPECIES.find((sp) => sp.id === id);
  if (!s) throw new Error(`Unknown species id: ${id}`);
  return s;
}
