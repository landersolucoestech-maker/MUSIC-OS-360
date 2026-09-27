const jwt = require('jsonwebtoken');
const KEY = '33b29b3d331d95a7a029160cbbb4c64cc7e094271b0a6f501da19a596ade7217';
const WRONG_KEY = '00000000000000000000000000000000000000000000000000000000deadbeef';
const ISS = 'music-os-360-dev';
const TENANT_A = '10000000-0000-0000-0000-000000000002';
const TENANT_B = '99999999-9999-9999-9999-999999999999';
const USER_A = 'b77f6a08-5049-4f66-b690-547c1dd59d3c';
const USER_B = '11111111-2222-3333-4444-555555555555';

function sign(payload, opts = {}) {
  return jwt.sign(payload, opts.secret ?? KEY, {
    algorithm: 'HS256',
    issuer: opts.issuer ?? ISS,
    expiresIn: opts.expiresIn ?? '2h',
  });
}

const tokens = {
  owner_A:       sign({ sub: USER_A, session_id: 's-owner-A',    app_metadata: { org_id: TENANT_A, role: 'owner' } }),
  admin_A:       sign({ sub: USER_A, session_id: 's-admin-A',    app_metadata: { org_id: TENANT_A, role: 'admin' } }),
  manager_A:     sign({ sub: USER_A, session_id: 's-manager-A',  app_metadata: { org_id: TENANT_A, role: 'manager' } }),
  viewer_A:      sign({ sub: USER_A, session_id: 's-viewer-A',   app_metadata: { org_id: TENANT_A, role: 'viewer' } }),
  owner_B:       sign({ sub: USER_B, session_id: 's-owner-B',    app_metadata: { org_id: TENANT_B, role: 'owner' } }),
  expired_A:     sign({ sub: USER_A, session_id: 's-expired-A',  app_metadata: { org_id: TENANT_A, role: 'owner' } }, { expiresIn: '-1h' }),
  wrong_sig:     sign({ sub: USER_A, session_id: 's-wrong-sig',  app_metadata: { org_id: TENANT_A, role: 'owner' } }, { secret: WRONG_KEY }),
  wrong_iss:     sign({ sub: USER_A, session_id: 's-wrong-iss',  app_metadata: { org_id: TENANT_A, role: 'owner' } }, { issuer: 'attacker' }),
  no_orgid:      sign({ sub: USER_A, session_id: 's-no-org',     app_metadata: { role: 'owner' } }),
  super_admin_A: sign({ sub: USER_A, session_id: 's-super-A',    app_metadata: { org_id: TENANT_A, role: 'super_admin' } }),
};

console.log(JSON.stringify(tokens, null, 2));
