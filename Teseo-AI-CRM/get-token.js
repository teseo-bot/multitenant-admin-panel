import { createClient } from '@supabase/supabase-js'

const supabase = createClient('http://127.0.0.1:54321', 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH')

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test1776727678522@example.com',
    password: 'password123'
  })
  
  if (error) {
    console.error('Error signing in:', error)
    return
  }
  
  console.log('Access Token:', data.session?.access_token)
}

main()