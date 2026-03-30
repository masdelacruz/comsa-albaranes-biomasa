import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://edxlcvqrddnvwzuxfjni.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkeGxjdnFyZGRudnd6dXhmam5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTAyNTcsImV4cCI6MjA5MDM4NjI1N30.-ZN5zHsZ0Ood-zJC3Tm8i2fk7aPGaXhCxZsbC0mfJ30'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)