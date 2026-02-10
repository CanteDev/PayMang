import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const packs = [
    {
        name: 'Pack Básico',
        price: 500.00,
        gateway_ids: {
            stripe: 'price_basic_test',
            hotmart: 'offer_basic_test',
            sequra: 'pack_basic_test'
        },
        is_active: true
    },
    {
        name: 'Pack Premium',
        price: 1200.00,
        gateway_ids: {
            stripe: 'price_premium_test',
            hotmart: 'offer_premium_test',
            sequra: 'pack_premium_test'
        },
        is_active: true
    },
    {
        name: 'Pack Elite',
        price: 2500.00,
        gateway_ids: {
            stripe: 'price_elite_test',
            hotmart: 'offer_elite_test',
            sequra: 'pack_elite_test'
        },
        is_active: true
    }
];

async function createPacks() {
    console.log('📦 Creando packs...\n');

    for (const pack of packs) {
        try {
            const { data, error } = await supabase
                .from('packs')
                .insert(pack)
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    console.log(`⚠️  Pack ya existe: ${pack.name}`);
                } else {
                    throw error;
                }
            } else {
                console.log(`✅ ${pack.name} - ${pack.price}€`);
            }
        } catch (error) {
            console.error(`❌ Error creando ${pack.name}:`, error);
        }
    }

    console.log('\n✅ Packs creados exitosamente!');
}

createPacks();
