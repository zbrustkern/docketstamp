// Loaded before TypeScript/application imports. Tests may stub fetch, but no
// actual network transport is allowed, including SDKs that do not use fetch.
const deny = () => { throw new Error('OFFLINE_TEST_NETWORK_DENIED'); };
require('node:net').Socket.prototype.connect = deny;
require('node:tls').connect = deny;
require('node:dgram').createSocket = deny;
globalThis.fetch = async () => { throw new Error('OFFLINE_TEST_FETCH_DENIED'); };
if (process.env.USE_MOCK_FIRESTORE !== 'true' || process.env.NODE_ENV !== 'test') {
  throw new Error('Offline runner requires explicit test/mock environment');
}
