const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });

async function run() {
  await client.connect();
  try {
    await client.query(`
      INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) 
      VALUES (
        'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 
        '00000000-0000-0000-0000-000000000000', 
        'authenticated', 
        'authenticated', 
        'test@teseo.lat', 
        crypt('password123', gen_salt('bf')), 
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
    `);
    console.log('User created successfully in auth.users');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();