const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'http://127.0.0.1:54321',
  'process.env.SUPABASE_SERVICE_ROLE_KEY'
);

(async () => {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'e2e@teseo.lat',
    password: 'password123',
    email_confirm: true
  });
  if (error) {
    if (error.message.includes('already exists')) {
       console.log('User already exists, updating password...');
       const { data: usersData } = await supabase.auth.admin.listUsers();
       const user = usersData.users.find(u => u.email === 'e2e@teseo.lat');
       await supabase.auth.admin.updateUserById(user.id, { password: 'password123' });
       console.log('Password updated.');
    } else {
       console.error('Error:', error);
    }
  } else {
    console.log('User created:', data);
  }
})();
