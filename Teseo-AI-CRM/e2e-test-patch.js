const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));

  console.log("Navigating to /auth/login...");
  await page.goto('http://localhost:3009/auth/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Fetch leads using client-side fetch since we have the cookie
  console.log("Fetching leads to get ID...");
  const leadsResult = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/leads');
      if (!res.ok) return { error: res.status };
      const json = await res.json();
      return json.data;
    } catch(e) {
      return { error: e.message };
    }
  });

  if (leadsResult && !leadsResult.error && leadsResult.length > 0) {
    const leadId = leadsResult[0].id;
    console.log("Found lead ID:", leadId, leadsResult[0].name);
    
    // Test PATCH endpoint
    console.log("Testing PATCH /api/leads/[id]...");
    const patchResult = await page.evaluate(async (id) => {
      try {
        const res = await fetch(`/api/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Contacted', sort_order: 1000 })
        });
        return res.status;
      } catch(e) {
        return e.message;
      }
    }, leadId);
    console.log("PATCH API status:", patchResult);

  } else {
    console.log("No leads found or error:", leadsResult);
  }

  await browser.close();
})();