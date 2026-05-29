import test, { describe, it, before } from 'node:test';
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3006';
const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111';
const API_URL = `${BASE_URL}/api/campaigns/${CAMPAIGN_ID}/events`;

// These keys are from the .env.local or standard supabase local env
const M2M_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY'; // SUPABASE_SERVICE_ROLE_KEY

describe('POST /api/campaigns/[id]/events Webhook Integration Tests', () => {
  it('should return 401 Unauthorized if M2M token is missing', async () => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        eventType: 'message_sent',
        agentRole: 'SDR',
        payload: {}
      })
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Unauthorized');
  });

  it('should return 401 Unauthorized if M2M token is invalid', async () => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid_token',
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        eventType: 'message_sent',
        agentRole: 'SDR',
      })
    });
    assert.strictEqual(res.status, 401);
  });

  it('should return 400 Validation Error if X-Idempotency-Key is missing', async () => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${M2M_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType: 'message_sent',
        agentRole: 'SDR',
        payload: {}
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.issues.includes('Missing X-Idempotency-Key header'));
  });

  it('should return 400 Validation Error on malformed payload', async () => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${M2M_KEY}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        eventType: 'invalid_event', // Not in the enum
        agentRole: '', // Empty role
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    console.log(data); assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'Validation Error');
    // Ensure the payload has zod issues
    assert.ok(Array.isArray(data.issues));
    assert.ok(data.issues.length > 0);
  });

  it('should return 404 if campaign does not exist', async () => {
    const NOT_FOUND_URL = `${BASE_URL}/api/campaigns/22222222-2222-2222-2222-222222222222/events`;
    const res = await fetch(NOT_FOUND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${M2M_KEY}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        eventType: 'message_sent',
        agentRole: 'SDR',
        payload: {}
      })
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.error, 'Campaign not found');
  });

  it('should process a valid event and return 201 Created', async () => {
    const idempotencyKey = crypto.randomUUID();
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${M2M_KEY}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        eventType: 'message_sent',
        agentRole: 'SDR',
        payload: { text: "Hello!" }
      })
    });
    
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.data.id);
    
    // Attempt idempotency collision
    const res2 = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${M2M_KEY}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        eventType: 'message_sent',
        agentRole: 'SDR',
        payload: { text: "Hello!" }
      })
    });
    
    assert.strictEqual(res2.status, 409);
    const data2 = await res2.json();
    assert.strictEqual(data2.success, true);
    assert.strictEqual(data2.message, 'Event already processed');
    assert.strictEqual(data2.data.id, data.data.id);
  });
});