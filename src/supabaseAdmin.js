import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://edxlcvqrddnvwzuxfjni.supabase.co'

// Necesita la service_role key (Project Settings → API → service_role)
// Añade en .env:  VITE_SUPABASE_SERVICE_KEY=eyJ...
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''

export const supabaseAdmin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null
