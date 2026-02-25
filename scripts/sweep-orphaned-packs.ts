import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Sweeping for orphaned active packs...");

    // Find all active packs
    const { data: activePacks } = await supabase.from('packs').select('*').eq('is_active', true);

    if (!activePacks) {
        console.log("No active packs found.");
        return;
    }

    let deactivatedCount = 0;

    for (const pack of activePacks) {
        // Check if this pack has any active offers
        const { count, error: countError } = await supabase
            .from('pack_offers')
            .select('*', { count: 'exact', head: true })
            .eq('pack_id', pack.id)
            .eq('is_active', true);

        if (!countError && count === 0) {
            console.log(`Deactivating pack "${pack.name}" (ID: ${pack.id}) because it has 0 active offers.`);

            const { error: updateError } = await supabase
                .from('packs')
                .update({ is_active: false })
                .eq('id', pack.id);

            if (updateError) {
                console.error(`Failed to deactivate ${pack.name}:`, updateError);
            } else {
                deactivatedCount++;
            }
        }
    }

    console.log(`Sweeping completed. Deactivated ${deactivatedCount} orphaned packs.`);
}

main();
