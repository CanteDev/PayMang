// Script para aplicar la migración de packs directamente con Supabase service role
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rjspuxdvpdwescrvudgz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqc3B1eGR2cGR3ZXNjcnZ1ZGd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYxMDU3MywiZXhwIjoyMDg2MTg2NTczfQ.axN7WqPgCf6OJRuyb3Bo1tGseSRH2NDLXFgvVBHllRQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    console.log('Applying packs migration...');

    const sql = `
        ALTER TABLE packs
          ADD COLUMN IF NOT EXISTS commission_closer DECIMAL(5,2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS commission_coach  DECIMAL(5,2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS commission_setter DECIMAL(5,2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS description TEXT;
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql });

    // If exec_sql isn't available, try direct query via REST
    if (error && error.message?.includes('exec_sql')) {
        console.log('exec_sql not available, trying direct approach...');
        // Check current columns
        const { data: cols } = await supabase
            .from('packs')
            .select('commission_closer, commission_coach, commission_setter, description')
            .limit(1);

        if (cols !== null) {
            console.log('✅ Columns already exist! Migration was already applied or was done manually.');
        } else {
            console.log('❌ Columns do not exist. Please run this SQL in your Supabase dashboard:');
            console.log(sql);
        }
    } else if (error) {
        console.error('Migration error:', error.message);
        console.log('\nPlease run this SQL manually in your Supabase SQL editor:');
        console.log(sql);
    } else {
        console.log('✅ Migration applied successfully!');
    }
}

applyMigration().catch(console.error);
