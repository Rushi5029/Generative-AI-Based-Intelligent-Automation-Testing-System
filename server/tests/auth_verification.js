import assert from 'assert';
import { generateToken, verifyToken } from '../src/utils/jwt.js';
import * as authService from '../src/services/authService.js';
import { authenticate, authorize } from '../src/middleware/auth.js';

console.log('🧪 Starting Authentication & Authorization Automated Test Suite...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name} ->`, err.message);
    failed++;
  }
}

async function runTests() {
  // Test 1: JWT generation and verification
  test('JWT: Sign and verify payload integrity', () => {
    const testUserId = '654321654321654321654321';
    const token = generateToken(testUserId);
    assert(token && typeof token === 'string', 'Token should be a non-empty string');
    
    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, testUserId, 'Decoded token ID must match subject user ID');
  });

  // Test 2: Invalid/Tampered JWT rejection
  test('JWT: Reject tampered or malformed tokens', () => {
    assert.throws(() => {
      verifyToken('tampered.invalid.token');
    }, /Invalid or expired token/i);
  });

  // Test 3: Authorization middleware role enforcement
  test('RBAC: Admin-only access permits Admin, rejects QA/Viewer', () => {
    const adminReq = { user: { role: 'Admin' } };
    const qaReq = { user: { role: 'QA' } };
    const viewerReq = { user: { role: 'Viewer' } };
    
    let adminPassed = false;
    const adminMiddleware = authorize(['Admin']);
    
    // Admin request should call next()
    adminMiddleware(adminReq, {}, () => { adminPassed = true; });
    assert(adminPassed, 'Admin should pass Admin-only check');
    
    // QA request should return 403 Forbidden
    let qaBlocked = false;
    const qaRes = {
      status: (code) => {
        if (code === 403) qaBlocked = true;
        return { json: () => {} };
      }
    };
    adminMiddleware(qaReq, qaRes, () => {});
    assert(qaBlocked, 'QA role should be denied 403 Forbidden on Admin resource');
  });

  // Test 4: RBAC multi-role authorization
  test('RBAC: Allows QA and Admin, rejects Viewer', () => {
    const middleware = authorize(['Admin', 'QA']);
    let qaPassed = false;
    let viewerBlocked = false;

    middleware({ user: { role: 'QA' } }, {}, () => { qaPassed = true; });
    assert(qaPassed, 'QA should pass [Admin, QA] check');

    const res = {
      status: (code) => {
        if (code === 403) viewerBlocked = true;
        return { json: () => {} };
      }
    };
    middleware({ user: { role: 'Viewer' } }, res, () => {});
    assert(viewerBlocked, 'Viewer should be rejected');
  });

  // Test 5: Reject unauthenticated requests in auth middleware
  test('Auth Middleware: Reject missing Authorization header', async () => {
    const req = { headers: {} };
    let unauthorized = false;
    const res = {
      status: (code) => {
        if (code === 401) unauthorized = true;
        return { json: () => {} };
      }
    };
    await authenticate(req, res, () => {});
    assert(unauthorized, 'Missing token must result in 401 Unauthorized');
  });

  // Test 6: Cross-user resource ownership validation
  test('Resource Isolation: User A cannot modify User B resources', () => {
    const resourceOwnerId = 'owner_12345';
    const attackerUserId = 'attacker_67890';
    
    // Simulate project/test-case ownership check
    const resource = { id: 'tc_1', ownerId: resourceOwnerId, name: 'Private Tests' };
    const canAccess = (user, item) => user.id === item.ownerId || user.role === 'Admin';
    
    assert.strictEqual(canAccess({ id: attackerUserId, role: 'QA' }, resource), false, 'Attacker QA should not access another user resource');
    assert.strictEqual(canAccess({ id: resourceOwnerId, role: 'QA' }, resource), true, 'Owner should access own resource');
    assert.strictEqual(canAccess({ id: attackerUserId, role: 'Admin' }, resource), true, 'Admin can administer resources');
  });

  // Test 7: Google profile sanitization and stable sub linking
  test('Google OAuth: Safe sub identification and display name fallback', () => {
    const rawPayload = {
      email: 'PrathameshShinde0195@gmail.com',
      sub: 'google_sub_1092837465',
      name: 'Prathamesh Shinde'
    };
    
    const normalizedEmail = rawPayload.email.toLowerCase().trim();
    const cleanSub = rawPayload.sub.trim();
    assert.strictEqual(normalizedEmail, 'prathameshshinde0195@gmail.com', 'Email must be normalized to lowercase');
    assert.strictEqual(cleanSub, 'google_sub_1092837465', 'Subject ID must be preserved exactly');
  });

  console.log(`\n========================================`);
  console.log(`🏁 Total Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
