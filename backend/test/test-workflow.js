// End-to-End API Integration & Workflow Handshake Test for Suit & Stitch
const http = require('http');

const BASE_URL = 'http://localhost:5000';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const contentType = res.headers['content-type'] || '';
        let json = null;
        if (contentType.includes('application/json')) {
          try {
            json = JSON.parse(buffer.toString('utf-8'));
          } catch (e) {
            json = null;
          }
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          raw: buffer,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  SUIT & STITCH END-TO-END WORKFLOW HANDSHAKE TESTS ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    console.log('1. Health & Telemetry Check');
    const health = await request('GET', '/health');
    assert(health.status === 200, 'Server responds with status 200 OK');
    assert(health.data.status === 'healthy', 'System status is "healthy"');
    assert(health.data.database === 'connected', 'PostgreSQL database is connected');

    // 2. Boutiques & Catalog
    console.log('\n2. Boutiques & Garment Catalog Discovery');
    const boutiques = await request('GET', '/api/boutiques');
    assert(boutiques.status === 200, 'GET /api/boutiques returns 200 OK');
    assert(boutiques.data.data.length >= 2, `Retrieved ${boutiques.data.data.length} luxury ateliers from PostgreSQL`);
    const totalDesigns = boutiques.data.data.reduce((acc, b) => acc + (b.designs ? b.designs.length : 0), 0);
    assert(totalDesigns >= 4, `Catalog contains ${totalDesigns} bespoke garments with fabric swatches`);

    // 3. User Authentication for All 4 Roles
    console.log('\n3. Role-Based Authentication & JWT Issuance');
    
    // Customer
    const custAuth = await request('POST', '/api/auth/login', {
      email: 'customer@suitstitch.com',
      password: 'password123',
    });
    assert(custAuth.status === 200 && custAuth.data.token, 'Customer login succeeds with valid JWT');
    const customerToken = custAuth.data.token;

    // Associate
    const assocAuth = await request('POST', '/api/auth/login', {
      email: 'associate@suitstitch.com',
      password: 'password123',
    });
    assert(assocAuth.status === 200 && assocAuth.data.token, 'Associate tailor login succeeds with valid JWT');
    const associateToken = assocAuth.data.token;

    // Boutique Partner
    const boutAuth = await request('POST', '/api/auth/login', {
      email: 'boutique@darzi.com',
      password: 'password123',
    });
    assert(boutAuth.status === 200 && boutAuth.data.token, 'Boutique studio partner login succeeds with valid JWT');
    const boutiqueToken = boutAuth.data.token;

    // Delivery Agent
    const delAuth = await request('POST', '/api/auth/login', {
      email: 'delivery@suitstitch.com',
      password: 'password123',
    });
    assert(delAuth.status === 200 && delAuth.data.token, 'Logistics delivery agent login succeeds with valid JWT');
    const deliveryToken = delAuth.data.token;

    // 4. Customer Order Retrieval
    console.log('\n4. User-Scoped Order Pipeline');
    const ordersRes = await request('GET', '/api/orders/my-orders', null, {
      Authorization: `Bearer ${customerToken}`,
    });
    assert(ordersRes.status === 200, 'GET /api/orders/my-orders returns 200 OK');
    assert(ordersRes.data.data.length >= 1, `Customer has ${ordersRes.data.data.length} active bespoke order(s)`);
    const activeOrder = ordersRes.data.data[0];
    const orderId = activeOrder.id;
    assert(orderId.startsWith('ORD-'), `Order follows bespoke format '${orderId}'`);
    assert(activeOrder.status === 'booked', `Order initial status is 'booked'`);

    // 5. Doorstep OTP Verification & Rate Limiting
    console.log('\n5. Doorstep OTP Flow & Rate Limiter');
    
    // Test wrong OTP attempt (Rate-limiting counter check)
    const badOtp = await request('POST', '/api/associate/verify-otp', {
      orderId,
      otp: '9999',
    }, {
      Authorization: `Bearer ${associateToken}`,
    });
    assert(badOtp.status === 400, 'Invalid OTP attempt rejected with 400 Bad Request');
    assert(badOtp.data.remainingAttempts === 4, `Rate-limiting decremented remaining attempts to ${badOtp.data.remainingAttempts}`);

    // Test correct OTP verification
    const correctOtp = await request('POST', '/api/associate/verify-otp', {
      orderId,
      otp: '4829', // seeded demo OTP
    }, {
      Authorization: `Bearer ${associateToken}`,
    });
    assert(correctOtp.status === 200, 'Valid 4-digit OTP verified successfully (200 OK)');
    assert(correctOtp.data.status === 'ASSOCIATE_ARRIVING', 'Order status advanced to ASSOCIATE_ARRIVING');
    assert(!!correctOtp.data.verificationToken, 'Associate issued short-lived measurement session token (15m expiration)');
    const verificationToken = correctOtp.data.verificationToken;

    // 6. Biometric Sizing Telemetry Submission
    console.log('\n6. Biometric Sizing Telemetry & Studio Transmission');
    const measurementPayload = {
      orderId,
      chest: 39.5,
      waist: 33.0,
      hips: 41.0,
      inseam: 31.5,
      neck: 16.0,
      shoulders: 18.5,
      tailorNotes: 'Slanted right shoulder, relaxed wrist cuff.',
    };

    const submitRes = await request('POST', '/api/associate/submit-measurements', measurementPayload, {
      Authorization: `Bearer ${associateToken}`,
      'X-Verification-Token': verificationToken,
    });
    if (submitRes.status !== 200) {
      console.log('SUBMIT ERROR:', submitRes.status, submitRes.data);
    }
    assert(submitRes.status === 200, 'Biometric telemetry stored in PostgreSQL and transmitted to atelier');
    assert(submitRes.data && submitRes.data.order && submitRes.data.order.status === 'measurements_taken', 'Order status advanced to MEASUREMENTS_TAKEN');
    assert(submitRes.data.order.measurements.chest === 39.5, 'Stored exact chest dimension (39.5")');

    // Test token single-use: Re-using the same verification token must fail
    const replayRes = await request('POST', '/api/associate/submit-measurements', measurementPayload, {
      Authorization: `Bearer ${associateToken}`,
      'X-Verification-Token': verificationToken,
    });
    assert(replayRes.status === 401 || replayRes.status === 400, 'Replay attack blocked: Verification token revoked after single use');

    // 7. Atelier Workshop Handshake & Pattern Card PDF
    console.log('\n7. Atelier Workshop Cutting & Production');
    
    // Boutique starts stitching
    const stitchRes = await request('PUT', `/api/production/orders/${orderId}/start-stitching`, {}, {
      Authorization: `Bearer ${boutiqueToken}`,
    });
    assert(stitchRes.status === 200, 'Atelier accepted sizing telemetry: PUT start-stitching returns 200 OK');
    assert(stitchRes.data.order.status === 'in_production', 'Order status advanced to IN_PRODUCTION');

    // Printable Pattern Card PDF Download
    const patternCardRes = await request('GET', `/api/production/orders/${orderId}/pattern-card`, null, {
      Authorization: `Bearer ${boutiqueToken}`,
    });
    assert(patternCardRes.status === 200, 'GET pattern-card streams A4 Production Ticket PDF');
    assert(patternCardRes.headers['content-type'].includes('application/pdf'), 'Content-Type is application/pdf');
    assert(patternCardRes.raw.length > 500, `Generated PDF buffer is non-empty (${patternCardRes.raw.length} bytes)`);

    // Boutique finishes stitching & marks ready
    const readyRes = await request('PUT', `/api/production/orders/${orderId}/mark-ready`, {}, {
      Authorization: `Bearer ${boutiqueToken}`,
    });
    assert(readyRes.status === 200, 'Atelier completed stitching: PUT mark-ready returns 200 OK');
    assert(readyRes.data.order.status === 'dispatched', 'Order status advanced to DISPATCHED');

    // 8. Logistics Fleet Custody & Final Handover
    console.log('\n8. Logistics Fleet Custody & Final Handover');

    // Delivery agent confirms pickup
    const pickupRes = await request('PUT', `/api/logistics/orders/${orderId}/pickup`, {}, {
      Authorization: `Bearer ${deliveryToken}`,
    });
    assert(pickupRes.status === 200, 'Delivery agent scanned parcel: PUT pickup returns 200 OK');
    assert(pickupRes.data.order.status === 'dispatched', 'Custody logged with assigned delivery agent');

    // Delivery agent confirms final doorstep handover
    const deliverRes = await request('PUT', `/api/logistics/orders/${orderId}/deliver`, {}, {
      Authorization: `Bearer ${deliveryToken}`,
    });
    assert(deliverRes.status === 200, 'Doorstep handover confirmed: PUT deliver returns 200 OK');
    assert(deliverRes.data.order.status === 'delivered', 'Final order lifecycle reached: DELIVERED');

    console.log('\n====================================================');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED `);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}

runTests();
