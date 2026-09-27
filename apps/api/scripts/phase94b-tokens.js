const jwt = require('jsonwebtoken');
const KEY = '33b29b3d331d95a7a029160cbbb4c64cc7e094271b0a6f501da19a596ade7217';
const WRONG_KEY = '00000000000000000000000000000000000000000000000000000000deadbeef';
const ISS = 'music-os-360-dev';
const TENANT_A = '10000000-0000-0000-0000-000000000002';
const TENANT_B = '99999999-9999-9999-9999-999999999999';
const USER_OWNER   = 'b77f6a08-5049-4f66-b690-547c1dd59d3c';
const USER_EDITOR  = '22222222-2222-2222-2222-222222222222';
const USER_VIEWER  = '33333333-3333-3333-3333-333333333333';
const USER_MANAGER = '44444444-4444-4444-4444-444444444444';

function sign(payload, opts = {}) {
  return jwt.sign(payload, opts.secret ?? KEY, {
    algorithm: 'HS256',
    issuer: opts.issuer ?? ISS,
    expiresIn: opts.expiresIn ?? '2h',
  });
}

console.log(JSON.stringify({
  owner_A:    sign({ sub: USER_OWNER,   session_id: 'owner',   app_metadata: { org_id: TENANT_A, role: 'owner'   } }),
  editor_A:   sign({ sub: USER_EDITOR,  session_id: 'editor',  app_metadata: { org_id: TENANT_A, role: 'editor'  } }),
  viewer_A:   sign({ sub: USER_VIEWER,  session_id: 'viewer',  app_metadata: { org_id: TENANT_A, role: 'viewer'  } }),
  manager_A:  sign({ sub: USER_MANAGER, session_id: 'manager', app_metadata: { org_id: TENANT_A, role: 'manager' } }),
  expired_A:  sign({ sub: USER_OWNER,   session_id: 'expired', app_metadata: { org_id: TENANT_A, role: 'owner'   } }, { expiresIn: '-1h' }),
  wrong_sig:  sign({ sub: USER_OWNER,   session_id: 'wsig',    app_metadata: { org_id: TENANT_A, role: 'owner'   } }, { secret: WRONG_KEY }),
  wrong_iss:  sign({ sub: USER_OWNER,   session_id: 'wiss',    app_metadata: { org_id: TENANT_A, role: 'owner'   } }, { issuer: 'attacker' }),
  no_orgid:   sign({ sub: USER_OWNER,   session_id: 'noorg',   app_metadata: { role: 'owner' } }),
  forged_tenant_B: sign({ sub: USER_VIEWER, session_id: 'forge', app_metadata: { org_id: TENANT_B, role: 'owner' } }),
}, null, 2));
