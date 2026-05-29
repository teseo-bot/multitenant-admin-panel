const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
  await client.connect();
  const userId = '00000000-0000-0000-0000-000000000001';
  try {
    await client.query(`
      INSERT INTO tenants (id, name, status)
      VALUES ('10000000-0000-0000-0000-000000000001', 'Dev Tenant', 'active')
      ON CONFLICT (id) DO NOTHING;
    `);
    await client.query(`
      INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        $1,
        'authenticated',
        'authenticated',
        'test@teseo.lat',
        crypt('password123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        now(),
        now(),
        '',
        '',
        '',
        ''
      ) ON CONFLICT (id) DO NOTHING;
    `, [userId]);
    console.log('User created in auth.users');
  } catch(e) {
    console.error('Error seeding user:', e);
  } finally {
    await client.end();
  }
}
run();