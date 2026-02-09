import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

/**
 * 🧪 Script de datos de prueba
 * Crea usuarios, perfiles, estudiantes y packs para testing
 */

const TEST_USERS = [
    {
        email: 'coach@test.com',
        password: 'Coach123!',
        full_name: 'María García',
        role: 'coach'
    },
    {
        email: 'closer@test.com',
        password: 'Closer123!',
        full_name: 'Carlos Rodríguez',
        role: 'closer'
    },
    {
        email: 'setter@test.com',
        password: 'Setter123!',
        full_name: 'Ana Martínez',
        role: 'setter'
    },
    {
        email: 'coach2@test.com',
        password: 'Coach123!',
        full_name: 'Pedro Sánchez',
        role: 'coach'
    }
];

const TEST_STUDENTS = [
    {
        email: 'alumno1@test.com',
        full_name: 'Luis Fernández',
        phone: '+34 600 111 111',
        status: 'active'
    },
    {
        email: 'alumno2@test.com',
        full_name: 'Laura Gómez',
        phone: '+34 600 222 222',
        status: 'active'
    },
    {
        email: 'alumno3@test.com',
        full_name: 'Jorge Pérez',
        phone: '+34 600 333 333',
        status: 'active'
    },
    {
        email: 'alumno4@test.com',
        full_name: 'Sofía López',
        phone: '+34 600 444 444',
        status: 'active'
    },
    {
        email: 'alumno5@test.com',
        full_name: 'Miguel Torres',
        phone: '+34 600 555 555',
        status: 'finished'
    }
];

const TEST_PACKS = [
    {
        name: 'Pack Básico',
        price: 500.00,
        gateway_ids: {
            stripe: 'price_basic_test',
            hotmart: 'offer_basic_test',
            sequra: 'pack_basic_test'
        },
        description: 'Programa básico de 3 meses',
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
        description: 'Programa premium de 6 meses',
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
        description: 'Programa elite de 12 meses con mentoría 1:1',
        is_active: true
    },
    {
        name: 'Pack Starter (Inactivo)',
        price: 299.00,
        gateway_ids: {
            stripe: 'price_starter_test'
        },
        description: 'Pack descontinuado',
        is_active: false
    }
];

async function createTestUsers() {
    console.log('📝 Creando usuarios de prueba...\n');

    const createdUsers = [];

    for (const user of TEST_USERS) {
        try {
            // Crear usuario en auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: user.password,
                email_confirm: true
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    console.log(`⚠️  Usuario ya existe: ${user.email}`);
                    // Buscar el usuario existente
                    const { data: existingUser } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('email', user.email)
                        .single();

                    if (existingUser) {
                        createdUsers.push({
                            id: existingUser.id,
                            email: user.email,
                            role: user.role
                        });
                    }
                    continue;
                }
                throw authError;
            }

            // Crear perfil
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    email: user.email,
                    full_name: user.full_name,
                    role: user.role,
                    is_active: true
                });

            if (profileError) throw profileError;

            createdUsers.push({
                id: authData.user.id,
                email: user.email,
                role: user.role
            });

            console.log(`✅ ${user.role.toUpperCase()}: ${user.email} / ${user.password}`);
        } catch (error) {
            console.error(`❌ Error creando ${user.email}:`, error);
        }
    }

    console.log('');
    return createdUsers;
}

async function createTestPacks() {
    console.log('📦 Creando packs de prueba...\n');

    const createdPacks = [];

    for (const pack of TEST_PACKS) {
        try {
            const { data, error } = await supabase
                .from('packs')
                .insert(pack)
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Duplicate
                    console.log(`⚠️  Pack ya existe: ${pack.name}`);
                    const { data: existingPack } = await supabase
                        .from('packs')
                        .select('*')
                        .eq('name', pack.name)
                        .single();

                    if (existingPack) {
                        createdPacks.push(existingPack);
                    }
                    continue;
                }
                throw error;
            }

            createdPacks.push(data);
            console.log(`✅ ${pack.name} - ${pack.price}€`);
        } catch (error) {
            console.error(`❌ Error creando pack ${pack.name}:`, error);
        }
    }

    console.log('');
    return createdPacks;
}

async function createTestStudents(coaches) {
    console.log('👥 Creando estudiantes de prueba...\n');

    const createdStudents = [];
    const activeCoaches = coaches.filter(u => u.role === 'coach');

    for (let i = 0; i < TEST_STUDENTS.length; i++) {
        const student = TEST_STUDENTS[i];
        // Asignar coach de forma rotativa
        const assignedCoach = activeCoaches[i % activeCoaches.length];

        try {
            const { data, error } = await supabase
                .from('students')
                .insert({
                    ...student,
                    assigned_coach_id: assignedCoach?.id || null
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Duplicate email
                    console.log(`⚠️  Estudiante ya existe: ${student.email}`);
                    const { data: existingStudent } = await supabase
                        .from('students')
                        .select('*')
                        .eq('email', student.email)
                        .single();

                    if (existingStudent) {
                        createdStudents.push(existingStudent);
                    }
                    continue;
                }
                throw error;
            }

            createdStudents.push(data);
            const coachName = activeCoaches.find(c => c.id === assignedCoach?.id)?.email || 'Sin coach';
            console.log(`✅ ${student.full_name} (${student.email}) → Coach: ${coachName}`);
        } catch (error) {
            console.error(`❌ Error creando estudiante ${student.email}:`, error);
        }
    }

    console.log('');
    return createdStudents;
}

async function main() {
    console.log('🚀 Iniciando seed de datos de prueba...\n');
    console.log('='.repeat(60));
    console.log('');

    try {
        // 1. Crear usuarios
        const users = await createTestUsers();

        // 2. Crear packs
        const packs = await createTestPacks();

        // 3. Crear estudiantes
        const students = await createTestStudents(users);

        console.log('='.repeat(60));
        console.log('\n🎉 Seed completado exitosamente!\n');

        console.log('📋 RESUMEN:');
        console.log(`   - ${users.length} usuarios creados`);
        console.log(`   - ${packs.length} packs creados`);
        console.log(`   - ${students.length} estudiantes creados\n`);

        console.log('🔐 CREDENCIALES DE ACCESO:\n');
        console.log('   Admin:');
        console.log('   📧 canteriyu@gmail.com');
        console.log('   🔑 PayMang2024!\n');

        console.log('   Coach:');
        console.log('   📧 coach@test.com');
        console.log('   🔑 Coach123!\n');

        console.log('   Closer:');
        console.log('   📧 closer@test.com');
        console.log('   🔑 Closer123!\n');

        console.log('   Setter:');
        console.log('   📧 setter@test.com');
        console.log('   🔑 Setter123!\n');

        console.log('💡 Ahora puedes:');
        console.log('   1. Hacer login con cualquiera de estos usuarios');
        console.log('   2. Generar links de pago en el dashboard de admin');
        console.log('   3. Simular pagos con el botón "🎯 Simular Pago"');
        console.log('   4. Ver comisiones creadas automáticamente\n');

    } catch (error) {
        console.error('\n❌ Error en el seed:', error);
        process.exit(1);
    }
}

main();
