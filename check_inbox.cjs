const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://hwhpntkjdjddltllrohb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3aHBudGtqZGpkZGx0bGxyb2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MDk1NjksImV4cCI6MjA3ODk4NTU2OX0.FvbghzrwzqYZKS5ObCaE5svoyLJ98d9g26tY9h2ND10');
async function run() {
  const { data, error } = await supabase.from('inbox_ctes').select('*').limit(1);
  console.log("Inbox CT-es:", data);
}
run();
