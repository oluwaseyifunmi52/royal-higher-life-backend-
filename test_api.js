const axios = require('axios');

async function testApis() {
  console.log('Testing Royal HigherLife API endpoints...\n');
  
  // Test public endpoints
  const publicEndpoints = [
    { name: 'GET /health', url: 'http://127.0.0.1:8000/health' },
    { name: 'GET /api/events', url: 'http://127.0.0.1:8000/api/events' },
    { name: 'GET /api/reviews', url: 'http://127.0.0.1:8000/api/reviews' },
    { name: 'GET /api/gallery', url: 'http://127.0.0.1:8000/api/gallery' },
    { name: 'GET /api/ministries', url: 'http://127.0.0.1:8000/api/ministries' },
    { name: 'GET /api/donations/currencies', url: 'http://127.0.0.1:8000/api/donations/currencies' },
  ];
  
  for (const ep of publicEndpoints) {
    try {
      const res = await axios.get(ep.url);
      console.log(`✓ ${ep.name} - Status: ${res.status}`);
    } catch (e) {
      console.log(`✗ ${ep.name} - Error: ${e.message}`);
    }
  }
  
  console.log('\n--- Protected endpoints (expecting 401/403) ---\n');
  
  // Test protected endpoints (should fail without auth)
  const protectedEndpoints = [
    { name: 'POST /api/auth/login', url: 'http://127.0.0.1:8000/api/auth/login' },
    { name: 'GET /api/newsletter', url: 'http://127.0.0.1:8000/api/newsletter' },
    { name: 'GET /api/contacts', url: 'http://127.0.0.1:8000/api/contacts' },
  ];
  
  for (const ep of protectedEndpoints) {
    try {
      const res = await axios.post(ep.url, { email: 'test@test.com', password: 'password' });
      console.log(`✓ ${ep.name} - Status: ${res.status} - ${res.data.message}`);
    } catch (e) {
      console.log(`✗ ${ep.name} - Error: ${e.response?.status} - ${e.response?.data?.message || e.message}`);
    }
  }
}

testApis().catch(console.error);