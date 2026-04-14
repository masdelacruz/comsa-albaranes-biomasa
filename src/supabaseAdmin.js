import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://edxlcvqrddnvwzuxfjni.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkeGxjdnFyZGRudnd6dXhmam5pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgxMDI1NywiZXhwIjoyMDkwMzg2MjU3fQ.ZDJderejJ7AlTF867NfeJISzjiCTp164yFgspQklNgY'

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
