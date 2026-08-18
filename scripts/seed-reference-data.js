#!/usr/bin/env node
/**
 * One-time seed script: populates activities, exercises, muscle_groups
 * from forma_seed_data.json using the Supabase service-role key.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your-service-role-key \
 *   node scripts/seed-reference-data.js
 *
 * The script is idempotent — it upserts on the unique `name` column.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY before running this script.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const seedPath = join(__dirname, '../supabase/seeds/forma_seed_data.json');
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

async function upsert(table, rows, conflictColumn = 'name') {
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictColumn, ignoreDuplicates: false });
  if (error) throw new Error(`[${table}] ${error.message}`);
  console.log(`  ✓ ${table}: ${rows.length} rows upserted`);
}

async function main() {
  console.log('Seeding reference tables…\n');

  await upsert('activity_catalog', seed.activities.map(a => ({
    name:              a.name,
    category:          a.category,
    type:              a.type,
    leg_load:          a.leg_load,
    upper_load:        a.upper_load,
    cardio_load:       a.cardio_load,
    core_load:         a.core_load,
    intensity_default: a.intensity_default,
    recovery_hours:    a.recovery_hours,
    notes:             a.notes ?? '',
  })));

  await upsert('ref_exercises', seed.exercises.map(e => ({
    name:              e.name,
    category:          e.category,
    primary_muscles:   e.primary_muscles,
    secondary_muscles: e.secondary_muscles,
    movement_pattern:  e.movement_pattern,
    equipment:         e.equipment,
    wger_id:           e.wger_id ?? null,
  })));

  await upsert('ref_muscle_groups', seed.muscle_groups.map(m => ({
    name:                   m.name,
    body_region:            m.body_region,
    recovery_hours_default: m.recovery_hours_default,
  })));

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
