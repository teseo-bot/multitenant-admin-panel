const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

(async () => {
  const formData = new FormData();
  const fileContent = fs.readFileSync('/Users/teseohome/projects/Teseo-AI-CRM/tests/test_document.txt');
  const blob = new Blob([fileContent], { type: 'text/plain' });
  formData.append('file', blob, 'test_document.txt');

  const res = await fetch('http://localhost:3003/api/asset-studio/documents/upload', {
    method: 'POST',
    body: formData,
    // Add a mocked Authorization header or mock the session?
    // Since the API requires an authenticated user, I should probably sign in first
    // and grab the JWT token, or the API relies on Next.js cookies...
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
})();