// Smoke test for all API endpoints
// Usage: node api/test-api.js
// Requires the API server to be running on port 3000

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function test(label, fn) {
    try {
        await fn();
        console.log(`  PASS  ${label}`);
    } catch (err) {
        console.log(`  FAIL  ${label}: ${err.message}`);
        process.exitCode = 1;
    }
}

async function runTests() {
    console.log(`\nTesting API at ${API_URL}\n`);

    await test('GET /api/health', async () => {
        const res = await fetch(`${API_URL}/api/health`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const body = await res.json();
        if (body.status !== 'ok') throw new Error('Expected status: ok');
    });

    await test('GET /api/contacts', async () => {
        const res = await fetch(`${API_URL}/api/contacts`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const body = await res.json();
        if (!Array.isArray(body)) throw new Error('Expected array');
        console.log(`         (${body.length} contacts found)`);
    });

    await test('POST /api/interactions (creates test contact)', async () => {
        const res = await fetch(`${API_URL}/api/interactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contact_name: 'Test Contact',
                interaction_type: 'phone_call',
                direction: 'outgoing',
                duration_seconds: 300
            })
        });
        if (!res.ok) {
            const body = await res.json();
            throw new Error(body.error || `Status ${res.status}`);
        }
        const body = await res.json();
        if (!body.success) throw new Error('Expected success: true');
    });

    await test('GET /api/contacts/overdue/30', async () => {
        const res = await fetch(`${API_URL}/api/contacts/overdue/30`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const body = await res.json();
        if (!Array.isArray(body)) throw new Error('Expected array');
        console.log(`         (${body.length} overdue contacts)`);
    });

    await test('GET /api/interactions/recent/5', async () => {
        const res = await fetch(`${API_URL}/api/interactions/recent/5`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const body = await res.json();
        if (!Array.isArray(body)) throw new Error('Expected array');
        console.log(`         (${body.length} recent interactions)`);
    });

    console.log('\nDone.\n');
}

runTests();
