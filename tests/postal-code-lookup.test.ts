import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  finishPostalCodeLookup,
  startPostalCodeLookup,
} from '../src/components/docket/address-intake';
import { createPostalCodeLookup } from '../src/components/docket/postal-code-lookup-client';
import {
  createUsPostalCodeLookup,
  lookupUsPostalCode,
} from '../src/lib/docket/us-postal-code-lookup';
import { GET } from '../app/api/address/postal-code/route';

describe('local postal-code suggestions', () => {
  it('uses the bundled GeoNames snapshot for a ZIP and ZIP+4 without mutating data', () => {
    assert.deepEqual(lookupUsPostalCode('02139'), [{ city: 'Cambridge', state: 'MA' }]);
    assert.deepEqual(lookupUsPostalCode('02139-9999'), [{ city: 'Cambridge', state: 'MA' }]);

    const firstResult = lookupUsPostalCode('02139');
    firstResult[0].city = 'Changed by caller';
    assert.deepEqual(lookupUsPostalCode('02139'), [{ city: 'Cambridge', state: 'MA' }]);
  });

  it('keeps all distinct postal city/state rows and lets the UI mark multi-city results ambiguous', () => {
    const lookup = createUsPostalCodeLookup([
      ['12345', 'Northville', 'NY'],
      ['12345', 'Southville', 'NY'],
      ['12345', 'Northville', 'NY'],
    ]);
    const loading = startPostalCodeLookup(1, '12345', 0);
    const result = finishPostalCodeLookup(loading, {
      requestId: 1,
      zip: '12345',
      editRevision: 0,
      currentZip: '12345',
      currentEditRevision: 0,
      locations: lookup('12345'),
    });

    assert.deepEqual(lookup('12345'), [
      { city: 'Northville', state: 'NY' },
      { city: 'Southville', state: 'NY' },
    ]);
    assert.equal(result.status, 'ambiguous');
    assert.equal(result.suggestion, null);
  });

  it('returns an empty result for unknown or malformed postal codes', () => {
    assert.deepEqual(lookupUsPostalCode('00000'), []);
    assert.deepEqual(lookupUsPostalCode('0213'), []);
    assert.deepEqual(lookupUsPostalCode('ABCDE'), []);
    assert.deepEqual(createUsPostalCodeLookup([['00001', 'Example', 'MH']])('00001'), []);
  });

  it('calls only the first-party ZIP endpoint and sends only the normalized ZIP', async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const lookup = createPostalCodeLookup(async (input, init) => {
      requests.push({ input, init });
      return new Response(JSON.stringify({ locations: [{ city: 'Cambridge', state: 'MA' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    assert.deepEqual(await lookup('02139-1200'), [{ city: 'Cambridge', state: 'MA' }]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].input, '/api/address/postal-code?zip=02139');
    assert.equal(requests[0].init?.method, 'GET');
    assert.equal(requests[0].init?.cache, 'no-store');
    assert.deepEqual(await lookup('not a ZIP'), []);
    assert.equal(requests.length, 1);
  });

  it('serves the local dataset for valid ZIPs and rejects malformed input', async () => {
    const response = GET(new NextRequest('http://localhost/api/address/postal-code?zip=02139'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), { locations: [{ city: 'Cambridge', state: 'MA' }] });

    const invalid = GET(new NextRequest('http://localhost/api/address/postal-code?zip=21'));
    assert.equal(invalid.status, 400);
  });
});
