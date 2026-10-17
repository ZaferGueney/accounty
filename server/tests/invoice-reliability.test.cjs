// Reliability fixes for invoice create/send (no database, no network).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');

const Invoice = require('../src/models/invoiceModel');
const aadeTransformer = require('../src/services/aadeTransformer');
const parochosTransformer = require('../src/services/parochosTransformer');
const { resolveAadeCredentials } = require('../src/services/aadeCredentials');
const { ParochosService } = require('../src/services/parochosService');
const einvoice = require('../src/services/einvoiceService');

const USER = '64b000000000000000000001';

const line = (over = {}) => ({
  lineNumber: 1,
  description: 'Event hosting',
  quantity: 1,
  unit: 'pcs',
  unitPrice: 100,
  netValue: 100,
  vatCategory: '1',
  vatAmount: 24,
  incomeClassification: [{ classificationType: 'E3_561_001', categoryId: 'category1_3', amount: 0 }],
  ...over
});

const invoiceData = (over = {}) => ({
  userId: USER,
  invoiceNumber: 'A0001',
  series: 'A',
  invoiceType: '2.1',
  issueDate: new Date('2026-10-01'),
  dueDate: new Date('2026-10-31'),
  issuer: { vatNumber: '123456789', country: 'GR', name: 'Issuer', taxInfo: { afm: '123456789' } },
  counterpart: { name: 'Customer', country: 'GR', taxInfo: { afm: '987654321' }, address: {} },
  invoiceDetails: [line()],
  payment: { method: '3' },
  currency: 'EUR',
  ...over
});

// ------------------------------------------------------------ model

test('totals are derived before validation, so a request without totals saves', async () => {
  const doc = new Invoice(invoiceData({ invoiceDetails: [line(), line({ lineNumber: 2, netValue: 50, vatAmount: 12 })] }));
  await doc.validate();
  assert.equal(doc.totals.totalNetValue, 150);
  assert.equal(doc.totals.totalVatAmount, 36);
  assert.equal(doc.totals.totalAmount, 186);
});

test('a single income classification gets the line net value (duplicates carried 0)', async () => {
  const doc = new Invoice(invoiceData({ invoiceDetails: [line({ netValue: 1006, vatAmount: 241.44 })] }));
  await doc.validate();
  assert.equal(doc.invoiceDetails[0].incomeClassification[0].amount, 1006);
});

test('createWithNextNumber takes the next number when a concurrent save won the race', async () => {
  const origGen = Invoice.generateInvoiceNumber;
  const origCreate = Invoice.create;
  const numbers = ['A0007', 'A0007', 'A0008'];
  const tried = [];
  Invoice.generateInvoiceNumber = async () => numbers.shift();
  Invoice.create = async (doc) => {
    tried.push(doc.invoiceNumber);
    if (tried.length < 3) {
      const err = new Error('E11000 duplicate key error collection: invoices index: invoiceNumber_1 dup key');
      err.code = 11000;
      err.keyPattern = { invoiceNumber: 1 };
      throw err;
    }
    return doc;
  };
  try {
    const created = await Invoice.createWithNextNumber({ userId: USER, series: 'A' });
    assert.equal(created.invoiceNumber, 'A0008');
    assert.deepEqual(tried, ['A0007', 'A0007', 'A0008']);

    // Other errors are not swallowed
    Invoice.generateInvoiceNumber = async () => 'A0009';
    Invoice.create = async () => { const e = new Error('validation'); e.name = 'ValidationError'; throw e; };
    await assert.rejects(Invoice.createWithNextNumber({ userId: USER }), /validation/);
  } finally {
    Invoice.generateInvoiceNumber = origGen;
    Invoice.create = origCreate;
  }
});

test('schema has no duplicate index definitions (startup warnings)', () => {
  const keys = Invoice.schema.indexes().map(([k]) => JSON.stringify(k));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes(JSON.stringify({ userId: 1, idempotencyKey: 1 })));
});

// ------------------------------------------------------------ transformers

test('myDATA XML: classification amounts follow the line net value', () => {
  const inv = invoiceData({
    invoiceDetails: [line({ netValue: 200, incomeClassification: [{ classificationType: 'E3_561_001', categoryId: 'category1_3', amount: 0 }] }),
      line({ lineNumber: 2, netValue: 50, incomeClassification: [{ classificationType: 'E3_561_001', categoryId: 'category1_3', amount: 999 }] })],
    totals: { totalNetValue: 250, totalVatAmount: 60, totalGrossValue: 310, totalAmount: 310 }
  });
  const xml = aadeTransformer.invoiceToXML(inv);
  assert.ok(xml.includes('<icls:amount>200.00</icls:amount>'));
  assert.ok(xml.includes('<icls:amount>50.00</icls:amount>'));
  assert.ok(xml.includes('<icls:amount>250.00</icls:amount>'), 'summary adds up the lines');
  assert.ok(!xml.includes('<icls:amount>0.00</icls:amount>'));
  assert.ok(!xml.includes('999'));
});

test('several classifications are kept only when they add up to the net value', () => {
  const ok = aadeTransformer.lineClassifications(line({ netValue: 100, incomeClassification: [
    { classificationType: 'E3_561_001', categoryId: 'category1_3', amount: 60 },
    { classificationType: 'E3_561_002', categoryId: 'category1_3', amount: 40 }] }));
  assert.equal(ok.length, 2);
  const bad = aadeTransformer.lineClassifications(line({ netValue: 100, incomeClassification: [
    { classificationType: 'E3_561_001', categoryId: 'category1_3', amount: 0 },
    { classificationType: 'E3_561_002', categoryId: 'category1_3', amount: 0 }] }));
  assert.deepEqual(bad, [{ classificationType: 'E3_561_001', categoryId: 'category1_3', amount: 100 }]);
});

test('Parochos payload: classification amount = line net value', () => {
  const source = parochosTransformer.invoiceToSource({ ...invoiceData(), _id: 'x', totals: { totalNetValue: 100, totalVatAmount: 24, totalAmount: 124 } });
  assert.equal(source.invoice.invoiceDetails[0].incomeClassification[0].amount, 100);
});

// ------------------------------------------------------------ credentials

const encrypt = (text) => {
  const key = crypto.scryptSync('accounty-aade-encryption-key-2024-change-in-prod', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return iv.toString('hex') + ':' + cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
};

test('AADE credentials: Settings win over the environment', () => {
  const settings = { aadeCredentials: { isConfigured: true, username: 'u1', subscriptionKey: encrypt('k1'), environment: 'production' } };
  const r = resolveAadeCredentials(settings, { NODE_ENV: 'development', AADE_DEV_USER_ID: 'env', AADE_DEV_KEY: 'envkey' });
  assert.equal(r.ok, true);
  assert.equal(r.source, 'settings');
  assert.deepEqual(r.credentials, { username: 'u1', subscriptionKey: 'k1', environment: 'production' });
});

test('AADE credentials: NODE_ENV picks PROD/DEV names, generic AADE_USER_ID/AADE_KEY as fallback', () => {
  assert.equal(resolveAadeCredentials(null, { NODE_ENV: 'production', AADE_PROD_USER_ID: 'p', AADE_PROD_KEY: 'pk', AADE_DEV_USER_ID: 'd', AADE_DEV_KEY: 'dk' }).credentials.username, 'p');
  assert.equal(resolveAadeCredentials(null, { NODE_ENV: 'development', AADE_PROD_USER_ID: 'p', AADE_PROD_KEY: 'pk', AADE_DEV_USER_ID: 'd', AADE_DEV_KEY: 'dk' }).credentials.username, 'd');
  const generic = resolveAadeCredentials(null, { NODE_ENV: 'production', AADE_USER_ID: 'g', AADE_KEY: 'gk' });
  assert.equal(generic.ok, true);
  assert.equal(generic.credentials.subscriptionKey, 'gk');
});

test('AADE credentials: clear message when missing or undecryptable', () => {
  const missing = resolveAadeCredentials(null, { NODE_ENV: 'development', AADE_KEY: 'only-key' });
  assert.equal(missing.ok, false);
  assert.match(missing.message, /AADE_DEV_USER_ID or AADE_USER_ID/);
  assert.doesNotMatch(missing.message, /only-key/);
  const broken = resolveAadeCredentials({ aadeCredentials: { isConfigured: true, username: 'u', subscriptionKey: 'not-encrypted' } }, {});
  assert.equal(broken.ok, false);
  assert.match(broken.message, /cannot be decrypted/);
});

// ------------------------------------------------------------ provider retry safety

test('Parochos network failure keeps the externalSystemId so a retry checks before sending', async () => {
  const calls = [];
  const http = {
    post: async (url) => {
      calls.push(url);
      if (url.endsWith('/loginToSubscription')) {
        return { data: { jwt: 'j', jwtExpiration: new Date(Date.now() + 3600e3).toISOString(), url1: 'https://api.test' } };
      }
      if (url.endsWith('/api/Send')) { const e = new Error('socket hang up'); throw e; }
      if (url.endsWith('/api/Get')) return { data: { status: 1, signing: { mark: 4001, uid: 'U', authenticationCode: 'A' } } };
      throw new Error('unexpected ' + url);
    }
  };
  const service = new ParochosService({ username: 'u', password: 'p', subscriptionKey: 'k', env: 'test', http, sleep: async () => {} });
  const doc = new Invoice({ ...invoiceData(), _id: new mongoose.Types.ObjectId() });
  doc.save = async function () { return this; };

  const first = await einvoice.submitViaProvider(doc, { service });
  assert.equal(first.outcome, 'error');
  assert.equal(doc.aadeInfo.transmissionFailure, 'network');
  assert.equal(doc.providerInfo.externalSystemId, `accounty-${doc._id}`);

  // Retry: Parochos actually got it -> no second Send
  const sendsBefore = calls.filter((u) => u.endsWith('/api/Send')).length;
  const second = await einvoice.submitViaProvider(doc, { service });
  assert.equal(second.outcome, 'transmitted');
  assert.equal(calls.filter((u) => u.endsWith('/api/Send')).length, sendsBefore, 'no duplicate Send');
  assert.equal(doc.aadeInfo.mark, '4001');
});
