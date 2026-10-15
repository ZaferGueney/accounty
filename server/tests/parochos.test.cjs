const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ParochosService, ParochosError } = require('../src/services/parochosService');
const transformer = require('../src/services/parochosTransformer');
const einvoice = require('../src/services/einvoiceService');

const ACCOUNT = 'https://beta-account.parochos.gr';
const API = 'https://beta-srv.parochos.gr';

// Fake axios: routes keyed by "METHOD url"; each route is a function or a queue of functions.
function fakeHttp(routes) {
  const calls = [];
  const handle = async (method, url, body, config) => {
    calls.push({ method, url, body, headers: config?.headers || {} });
    let r = routes[`${method} ${url}`];
    if (Array.isArray(r)) r = r.length > 1 ? r.shift() : r[0];
    if (!r) throw new Error(`unexpected ${method} ${url}`);
    return r(body, config);
  };
  return {
    calls,
    post: (url, body, config) => handle('POST', url, body, config),
    get: (url, config) => handle('GET', url, undefined, config)
  };
}

const httpError = (status, data = {}) => {
  const e = new Error(`Request failed with status code ${status}`);
  e.response = { status, data };
  return e;
};

const loginOk = (jwt = 'jwt-1', expMs = 3600e3) => () => ({
  data: {
    jwt,
    jwtExpiration: new Date(Date.UTC(2026, 9, 15, 12) + expMs).toISOString(),
    jwtRefreshToken: 'refresh-1',
    jwtRefreshTokenExpiration: '2026-12-01T00:00:00Z',
    url1: `${API}/`
  }
});

const signed = (overrides = {}) => ({
  data: {
    signing: {
      paymentTokens: [],
      authenticationCode: 'FC8369FDA587D5B964FBD641356732F3BBC71F7D',
      qrCode: `${API}/fd/3ea67dde:1`,
      qrUrlAADE: 'https://mydataapidev.aade.gr/TimologioQR/QRInfo?q=abc',
      pdfUploaded: false,
      pdfFileUrl: null,
      publishStatus: 0,
      cancellationMark: null,
      uid: 'A198335EC131EBF5D5E2A20AC7A303B1F22B8F7F',
      mark: 400001962023921
    },
    processId: '7f221a9e-f5f5-4d14-9ed9-08deaa6dde3f',
    externalSystemId: 'accounty-inv1',
    status: 1,
    errorCategory: null,
    errorCode: null,
    errorMessage: null,
    ...overrides
  }
});

const NOW = Date.UTC(2026, 9, 15, 12);
const makeService = (http, extra = {}) =>
  new ParochosService({
    username: 'api-user',
    password: 'pw',
    subscriptionKey: 'sub-key',
    env: 'test',
    http,
    now: () => NOW,
    sleep: async () => {},
    pollAttempts: 3,
    pollIntervalMs: 0,
    ...extra
  });

const sampleInvoice = (over = {}) => ({
  _id: 'inv1',
  invoiceNumber: 'A0042',
  invoiceType: '2.1',
  issueDate: '2026-11-03T00:00:00.000Z',
  createdAt: '2026-11-03T09:15:30.000Z',
  dueDate: '2026-11-17T00:00:00.000Z',
  currency: 'EUR',
  vatRegulation: 'standard',
  issuer: { vatNumber: '803058973', branch: 0, name: 'LBNSWRK', taxInfo: { afm: '803058973' } },
  counterpart: {
    name: 'Demo AE',
    country: 'GR',
    taxInfo: { afm: '094019245' },
    address: { street: 'Ermou', number: '10', postalCode: '10563', city: 'Athens' }
  },
  invoiceDetails: [
    {
      lineNumber: 1,
      description: 'Web development',
      quantity: 10,
      unit: 'hrs',
      unitPrice: 50,
      netValue: 500,
      vatCategory: '1',
      vatAmount: 120,
      incomeClassification: [{ classificationType: 'E3_561_001', categoryId: 'category1_3', amount: 500 }]
    }
  ],
  totals: { totalNetValue: 500, totalVatAmount: 120, totalGrossValue: 620, totalAmount: 620 },
  payment: { method: '5' },
  ...over
});

// ---------------------------------------------------------------- mapping

test('maps an Accounty B2B service invoice to the Parochos source', () => {
  const src = transformer.invoiceToSource(sampleInvoice(), { publishType: 'auto' });
  const inv = src.invoice;
  assert.deepEqual(inv.issuer, { vatNumber: '803058973', branch: 0, country: 'GR' });
  assert.equal(inv.counterpart.vatNumber, '094019245');
  assert.equal(inv.counterpart.name, 'Demo AE');
  assert.equal(inv.counterpart.streetNumber, '10');
  assert.equal(inv.invoiceHeader.series, 'A');
  assert.equal(inv.invoiceHeader.aa, '42');
  assert.equal(inv.invoiceHeader.issueDate, '2026-11-03T09:15:30.000Z'); // time of issue from createdAt
  assert.equal(inv.invoiceHeader.dueDate, '2026-11-17');
  assert.equal(inv.invoiceHeader.invoiceType, '2.1');
  assert.equal(inv.invoiceHeader.invoiceTypeUbl, '380');
  assert.equal(inv.invoiceHeader.currency, 'EUR');
  assert.deepEqual(inv.paymentMethods, [{ type: 5, amount: 620 }]);
  const line = inv.invoiceDetails[0];
  assert.equal(line.lineNumber, 1);
  assert.equal(line.entityName, 'Web development');
  assert.equal(line.quantity, 10);
  assert.equal(line.measurementUnit, 7);
  assert.equal(line.measurementUnitUbl, 'HUR');
  assert.equal(line.netValue, 500);
  assert.equal(line.vatAmount, 120);
  assert.equal(line.totalValue, 620);
  assert.equal(line.vatCategory, 1);
  assert.equal(line.vatPercent, 24);
  assert.equal(line.vatCategoryUbl, 'S');
  assert.deepEqual(line.incomeClassification, [
    { classificationType: 'E3_561_001', classificationCategory: 'category1_3', amount: 500 }
  ]);
  assert.deepEqual(inv.invoiceSummary, { totalNetValue: 500, totalVatAmount: 120, totalValue: 620 });
  assert.equal(inv.publishType, 1);
  assert.equal(inv.taxesTotals, undefined);
});

test('mapping: retail receipt, credit note, withholding, zero-rate and publishType rules', () => {
  const retail = transformer.invoiceToSource(
    sampleInvoice({ invoiceNumber: 'R000007', invoiceType: '11.2', counterpart: { name: '' } }),
    { publishType: 'auto' }
  ).invoice;
  assert.deepEqual(retail.counterpart, { vatNumber: '', name: 'Πελάτης Λιανικής', country: 'GR' });
  assert.equal(retail.publishType, 0);
  assert.equal(retail.invoiceHeader.aa, '7');

  const credit = transformer.invoiceToSource(
    sampleInvoice({ invoiceType: '5.1', correlatedInvoices: ['400001962023921'] }),
    { publishType: 'auto' }
  ).invoice;
  assert.equal(credit.invoiceHeader.invoiceTypeUbl, '381');
  assert.deepEqual(credit.correlatedInvoices, [{ mark: 400001962023921 }]);

  const wh = sampleInvoice();
  wh.invoiceDetails[0].withholdingTaxCategory = '3';
  wh.invoiceDetails[0].withheldAmount = 100;
  assert.deepEqual(transformer.invoiceToSource(wh).invoice.taxesTotals, [
    { taxType: 1, taxCategory: 3, underlyingValue: 500, taxAmount: 100 }
  ]);

  const eu = sampleInvoice({ vatRegulation: 'reverseChargeEU', counterpart: { name: 'GmbH', country: 'DE', vatNumber: 'DE123' } });
  eu.invoiceDetails[0].vatCategory = '7';
  eu.invoiceDetails[0].vatAmount = 0;
  eu.invoiceDetails[0].vatExemptionCategory = '3';
  const euSrc = transformer.invoiceToSource(eu, { publishType: 'auto' }).invoice;
  assert.equal(euSrc.invoiceDetails[0].vatPercent, 0);
  assert.equal(euSrc.invoiceDetails[0].vatCategoryUbl, 'AE');
  assert.equal(euSrc.invoiceDetails[0].vatExemption, '3');
  assert.equal(euSrc.counterpart.country, 'DE');
  assert.equal(euSrc.publishType, 0);

  assert.equal(transformer.resolvePublishType(sampleInvoice(), '0'), 0);
  assert.equal(transformer.externalSystemIdFor({ _id: 'abc' }), 'accounty-abc');
  assert.equal(transformer.externalSystemIdFor({ _id: 'abc', providerInfo: { externalSystemId: 'keep' } }), 'keep');
  assert.throws(() => transformer.invoiceToSource(sampleInvoice({ invoiceNumber: 'bad-1' })));
});

// ---------------------------------------------------------------- login

test('login sends credentials to the beta identity server and caches the JWT + url1', async () => {
  const http = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: loginOk(),
    [`POST ${API}/api/Get`]: () => signed()
  });
  const svc = makeService(http);
  await svc.get({ externalSystemId: 'x' });
  await svc.get({ externalSystemId: 'y' });
  const logins = http.calls.filter((c) => c.url.endsWith('loginToSubscription'));
  assert.equal(logins.length, 1, 'token is cached between calls');
  assert.deepEqual(logins[0].body, { subscriptionKey: 'sub-key', email: 'api-user', password: 'pw' });
  const api = http.calls.find((c) => c.url === `${API}/api/Get`);
  assert.equal(api.headers.Authorization, 'Bearer jwt-1');
  assert.equal(api.headers['X-Version'], '3.0');
  assert.equal(svc.getStatus().environment, 'test');
});

test('prod env uses the production identity server', () => {
  assert.equal(makeService(fakeHttp({}), { env: 'prod' }).accountUrl, 'https://account.parochos.gr');
  assert.equal(makeService(fakeHttp({}), { env: undefined }).env, 'test');
});

test('expired JWT is refreshed with the refresh token, failed refresh falls back to login', async () => {
  const http = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: [loginOk('jwt-old', -1000), loginOk('jwt-relogin')],
    [`POST ${ACCOUNT}/api/token/Refresh`]: [
      (body) => {
        assert.deepEqual(body, { token: 'jwt-old', refreshToken: 'refresh-1' });
        return { data: { jwt: 'jwt-refreshed', jwtExpiration: '2026-10-15T13:00:00Z', jwtRefreshToken: 'refresh-2', jwtRefreshTokenExpiration: '2026-12-01T00:00:00Z' } };
      }
    ],
    [`POST ${API}/api/Get`]: () => signed()
  });
  const svc = makeService(http);
  await svc.login();
  await svc.get({ externalSystemId: 'x' });
  const get = http.calls.filter((c) => c.url === `${API}/api/Get`).pop();
  assert.equal(get.headers.Authorization, 'Bearer jwt-refreshed');
  assert.equal(svc.session.baseUrl, API, 'url1 kept after refresh');

  // refresh endpoint failing -> new login
  const http2 = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: [loginOk('jwt-old', -1000), loginOk('jwt-relogin')],
    [`POST ${ACCOUNT}/api/token/Refresh`]: () => { throw httpError(400); },
    [`POST ${API}/api/Get`]: () => signed()
  });
  const svc2 = makeService(http2);
  await svc2.login();
  await svc2.get({ externalSystemId: 'x' });
  assert.equal(http2.calls.filter((c) => c.url === `${API}/api/Get`).pop().headers.Authorization, 'Bearer jwt-relogin');
});

test('login errors: 403 -> AUTH error, missing credentials -> CONFIG error', async () => {
  const http = fakeHttp({ [`POST ${ACCOUNT}/api/account/loginToSubscription`]: () => { throw httpError(403); } });
  await assert.rejects(makeService(http).login(), (e) => e instanceof ParochosError && e.code === 'AUTH' && e.httpStatus === 403);
  await assert.rejects(makeService(http, { password: '' }).login(), (e) => e.code === 'CONFIG');
});

// ---------------------------------------------------------------- send

test('send posts the documented envelope and returns MARK/UID/auth code/QR', async () => {
  const http = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: loginOk(),
    [`POST ${API}/api/Send`]: () => signed()
  });
  const svc = makeService(http);
  const r = await svc.transmitInvoice(sampleInvoice());
  const send = http.calls.find((c) => c.url === `${API}/api/Send`);
  assert.equal(send.body.externalSystemId, 'accounty-inv1');
  assert.equal(send.body.identifier, 'Parochos');
  assert.equal(send.body.transmissionType, 5);
  assert.equal(send.body.source.invoice.invoiceHeader.series, 'A');
  assert.equal(r.success, true);
  assert.equal(r.mark, '400001962023921');
  assert.equal(r.uid, 'A198335EC131EBF5D5E2A20AC7A303B1F22B8F7F');
  assert.equal(r.authenticationCode, 'FC8369FDA587D5B964FBD641356732F3BBC71F7D');
  assert.equal(r.qrCodeUrl, `${API}/fd/3ea67dde:1`);
  assert.equal(r.processId, '7f221a9e-f5f5-4d14-9ed9-08deaa6dde3f');
  assert.deepEqual(r.errors, []);
});

test('send polls /api/Get while status is in progress', async () => {
  const http = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: loginOk(),
    [`POST ${API}/api/Send`]: () => ({ data: { status: 0, processId: 'p-1', externalSystemId: 'accounty-inv1', signing: { uid: ' null ', mark: null } } }),
    [`POST ${API}/api/Get`]: [
      (body) => { assert.deepEqual(body, { processId: 'p-1' }); return { data: { status: 0, processId: 'p-1', signing: {} } }; },
      () => signed()
    ]
  });
  const r = await makeService(http).transmitInvoice(sampleInvoice());
  assert.equal(r.success, true);
  assert.equal(http.calls.filter((c) => c.url === `${API}/api/Get`).length, 2);
});

test('still in progress after polling -> inProgress, no error', async () => {
  const http = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: loginOk(),
    [`POST ${API}/api/Send`]: () => ({ data: { status: 0, processId: 'p-1', signing: {} } }),
    [`POST ${API}/api/Get`]: () => ({ data: { status: 0, processId: 'p-1', signing: {} } })
  });
  const r = await makeService(http).transmitInvoice(sampleInvoice());
  assert.equal(r.success, false);
  assert.equal(r.inProgress, true);
  assert.equal(r.errors.length, 0);
});

test('operational error (HTTP 200, status 2) is returned as a rejection with code/category', async () => {
  const http = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: loginOk(),
    [`POST ${API}/api/Send`]: () => ({
      data: { status: 2, errorCode: '00010029', errorCategory: 'BTA', errorSeverity: 2, errorMessage: '102: Invalid counterpart VAT', signing: null }
    })
  });
  const r = await makeService(http).transmitInvoice(sampleInvoice());
  assert.equal(r.success, false);
  assert.equal(r.inProgress, false);
  assert.deepEqual(r.errors[0], { code: '00010029', category: 'BTA', severity: 2, message: '102: Invalid counterpart VAT' });
});

test('401 on the API triggers one re-login and retry', async () => {
  const http = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: [loginOk('jwt-a'), loginOk('jwt-b')],
    [`POST ${API}/api/Send`]: [() => { throw httpError(401); }, () => signed()]
  });
  const r = await makeService(http).transmitInvoice(sampleInvoice());
  assert.equal(r.success, true);
  const sends = http.calls.filter((c) => c.url === `${API}/api/Send`);
  assert.deepEqual(sends.map((c) => c.headers.Authorization), ['Bearer jwt-a', 'Bearer jwt-b']);
});

test('network failure throws a ParochosError flagged as network', async () => {
  const http = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: loginOk(),
    [`POST ${API}/api/Send`]: () => { throw new Error('ECONNRESET'); }
  });
  await assert.rejects(makeService(http).transmitInvoice(sampleInvoice()), (e) => e instanceof ParochosError && e.network === true);
});

test('re-sending an invoice already known to Parochos checks /api/Get first (no duplicate)', async () => {
  const http = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: loginOk(),
    [`POST ${API}/api/Get`]: () => signed(),
    [`POST ${API}/api/Send`]: () => { throw new Error('must not send twice'); }
  });
  const r = await makeService(http).transmitInvoice(sampleInvoice({ providerInfo: { externalSystemId: 'accounty-inv1' } }));
  assert.equal(r.success, true);
  assert.equal(http.calls.filter((c) => c.url === `${API}/api/Send`).length, 0);
});

// ---------------------------------------------------------------- cancel

test('cancel: refuses sales invoices, cancels delivery notes by mark', async () => {
  const http = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: loginOk(),
    [`POST ${API}/api/Cancel`]: (body) => {
      assert.deepEqual(body, { mark: 400001962023921 });
      return { data: { status: 1, cancellationMark: 400001962099999 } };
    }
  });
  const svc = makeService(http);
  await assert.rejects(svc.cancel({ mark: '400001962023921', invoiceType: '2.1' }), (e) => e.code === 'NOT_CANCELLABLE');
  const r = await svc.cancel({ mark: '400001962023921', invoiceType: '9.3' });
  assert.deepEqual(r, { success: true, cancellationMark: '400001962099999', errors: [] });
});

// ---------------------------------------------------------------- routing

test('EINVOICE_PROVIDER switch defaults to direct myDATA', () => {
  const prev = process.env.EINVOICE_PROVIDER;
  delete process.env.EINVOICE_PROVIDER;
  assert.equal(einvoice.getProvider(), 'mydata');
  assert.equal(einvoice.usesProvider(), false);
  process.env.EINVOICE_PROVIDER = 'Parochos';
  assert.equal(einvoice.usesProvider(), true);
  process.env.EINVOICE_PROVIDER = 'something-else';
  assert.equal(einvoice.getProvider(), 'mydata');
  if (prev === undefined) delete process.env.EINVOICE_PROVIDER; else process.env.EINVOICE_PROVIDER = prev;
});

// Minimal stand-in for a mongoose invoice document
const fakeDoc = (data) => {
  const Invoice = require('../src/models/invoiceModel');
  const doc = new Invoice({ ...data, _id: undefined, userId: '64b000000000000000000001' });
  doc.saved = 0;
  doc.save = async function () { this.saved++; return this; };
  return doc;
};

test('submitViaProvider stores mark/uid/auth/QR on the invoice and marks it transmitted', async () => {
  const http = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: loginOk(),
    [`POST ${API}/api/Send`]: () => signed()
  });
  const doc = fakeDoc(sampleInvoice({ status: 'sent' }));
  const r = await einvoice.submitViaProvider(doc, { service: makeService(http) });
  assert.equal(r.outcome, 'transmitted');
  assert.equal(doc.status, 'sent');
  assert.equal(doc.aadeStatus, 'transmitted');
  assert.equal(doc.aadeInfo.mark, '400001962023921');
  assert.equal(doc.aadeInfo.uid, 'A198335EC131EBF5D5E2A20AC7A303B1F22B8F7F');
  assert.equal(doc.aadeInfo.authenticationCode, 'FC8369FDA587D5B964FBD641356732F3BBC71F7D');
  assert.match(doc.aadeInfo.qrUrl, /^data:image\/png;base64,/);
  assert.equal(doc.providerInfo.provider, 'parochos');
  assert.equal(doc.providerInfo.environment, 'test');
  assert.equal(doc.providerInfo.processId, '7f221a9e-f5f5-4d14-9ed9-08deaa6dde3f');
  assert.equal(doc.providerInfo.qrCodeUrl, `${API}/fd/3ea67dde:1`);
  assert.equal(doc.providerInfo.externalSystemId, `accounty-${doc._id}`);
  assert.equal(doc.validateSync(), undefined);
});

test('submitViaProvider: rejection keeps draft + errors, auth failure flagged, missing config', async () => {
  const rejectHttp = fakeHttp({
    [`POST ${ACCOUNT}/api/account/loginToSubscription`]: loginOk(),
    [`POST ${API}/api/Send`]: () => ({ data: { status: 2, errorCode: '00010015', errorCategory: 'BED', errorMessage: 'Errors while validating invoice source data' } })
  });
  const doc = fakeDoc(sampleInvoice({ status: 'sent' }));
  const r = await einvoice.submitViaProvider(doc, { service: makeService(rejectHttp) });
  assert.equal(r.outcome, 'rejected');
  assert.equal(r.httpStatus, 400);
  assert.equal(doc.status, 'draft');
  assert.equal(doc.aadeStatus, 'failed');
  assert.equal(doc.aadeInfo.transmissionFailure, 'validation');
  assert.equal(doc.providerInfo.lastError.code, '00010015');

  const authHttp = fakeHttp({ [`POST ${ACCOUNT}/api/account/loginToSubscription`]: () => { throw httpError(403); } });
  const doc2 = fakeDoc(sampleInvoice({ status: 'sent' }));
  const r2 = await einvoice.submitViaProvider(doc2, { service: makeService(authHttp) });
  assert.equal(r2.outcome, 'error');
  assert.equal(doc2.aadeInfo.transmissionFailure, 'authentication');

  const r3 = await einvoice.submitViaProvider(fakeDoc(sampleInvoice()), { service: makeService(fakeHttp({}), { subscriptionKey: '' }) });
  assert.equal(r3.outcome, 'error');
  assert.match(r3.message, /PAROCHOS_SUBSCRIPTION_KEY/);
});
