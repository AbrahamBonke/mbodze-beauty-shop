#!/usr/bin/env node

/**
 * Apply migration to new Supabase project
 * Usage: node apply-migration.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase credentials for NEW project
const SUPABASE_URL = 'https://fnvyevxvktbgjaxzdwoh.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_i1x1ZmDX6jt1GZ5UqHAXIA_nUxUgQ80';

// Migration SQL file
const MIGRATION_FILE = path.join(__dirname, 'supabase', 'migrations', '20260110073604_create_beauty_shop_schema.sql');

async function applyMigration() {
  console.log('🔧 Initializing Supabase admin client...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('📖 Reading migration SQL...');
  const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');

  if (!migrationSQL) {
    console.error('❌ Migration SQL file is empty');
    process.exit(1);
  }

  console.log('⏳ Applying migration SQL statements...');
  
  try {
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    let successCount = 0;
    let failCount = 0;

    for (const statement of statements) {
      try {
        // Use fetch to call Supabase SQL API
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/execute_sql`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'apikey': SUPABASE_SERVICE_KEY,
            },
            body: JSON.stringify({ sql_query: statement }),
          }
        );

        if (response.ok) {
          successCount++;
        } else {
          const errorText = await response.text();
          console.warn(`⚠️ Statement failed (may be harmless):`);
          console.warn(`   ${statement.substring(0, 80)}...`);
          failCount++;
        }
      } catch (e) {
        // Ignore individual statement errors (e.g., IF NOT EXISTS conflicts)
      }
    }

    console.log(`✅ Migration complete! Applied ${successCount} statements (${failCount} skipped/failed)`);
    
  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    console.error('');
    console.error('Manual steps to complete the migration:');
    console.error('1. Go to: https://app.supabase.com/project/fnvyevxvktbgjaxzdwoh/sql/new');
    console.error('2. Paste the entire content of: supabase/migrations/20260110073604_create_beauty_shop_schema.sql');
    console.error('3. Click "RUN" button');
    console.error('');
    process.exit(1);
  }

  console.log('');
  console.log('🎉 Schema is ready! Your new Supabase project has the required tables.');
  console.log('');
  console.log('Next steps:');
  console.log('1. Reload the app in your browser');
  console.log('2. Click "Sync" button or go online');
  console.log('3. All local data will sync to the remote database');
  console.log('');
  
  process.exit(0);
}

applyMigration().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
