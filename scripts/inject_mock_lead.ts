import { createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const mockLead = {
    name: "Carlos Lead",
    company: "Corp Inc",
    email: "carlos@corp.inc",
    phone: "+52 55 1234 5678",
    status: "New",
    source: "inbound_whatsapp",
    icp_score: 85,
    assigned_node: "sdr",
    metadata: { note: "Mock lead injected for testing." },
    sort_order: 1
  };

  const { data, error } = await supabase.from('leads').insert([mockLead]).select().single();
  if (error) {
    console.error("Error inserting lead:", error);
  } else {
    console.log("Successfully injected mock lead:", data);
  }
}
run();
