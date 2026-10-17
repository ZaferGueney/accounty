/**
 * Maps an Accounty invoice (Mongo document / plain object) to the Parochos
 * "source" payload (Parochos API v3, "Tax Authorities & UBL2.1 configured in
 * External System"). Field names follow Parochos_API_Documentation_3.0.29.
 *
 * Reuses the myDATA transformer for invoice-number parsing so series/aa stay
 * identical to what was sent to AADE directly.
 */
const aadeTransformer = require('./aadeTransformer');

// AADE vatCategory -> VAT percent
const VAT_PERCENT = { 1: 24, 2: 13, 3: 6, 4: 17, 5: 9, 6: 4, 7: 0, 8: 0, 9: 3, 10: 4 };

// Accounty unit -> [AADE measurementUnit, UBL unit code (UN/ECE rec 20)]
// AADE codes: 1 pieces, 2 kg, 3 litres, 4 metres, 5 m2, 6 m3, 7 other.
const UNITS = {
  pcs: [1, 'H87'],
  kg: [2, 'KGM'],
  liters: [3, 'LTR'],
  m: [4, 'MTR'],
  m2: [5, 'MTK'],
  hrs: [7, 'HUR'],
  days: [7, 'DAY'],
  months: [7, 'MON']
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const ymd = (date) => {
  if (!date) return undefined;
  const d = new Date(date);
  if (isNaN(d)) return undefined;
  return d.toISOString().split('T')[0];
};

/**
 * Parochos wants the issue date WITH the time of issue. Accounty stores the
 * issue date (often midnight); when the record was created on that same day we
 * use the creation time, otherwise the stored timestamp as is.
 */
const issueDateTime = (invoice) => {
  const issue = new Date(invoice.issueDate || Date.now());
  const created = invoice.createdAt ? new Date(invoice.createdAt) : null;
  if (created && !isNaN(created) && ymd(created) === ymd(issue)) return created.toISOString();
  return issue.toISOString();
};

const vatCategoryUbl = (vatCategory, vatRegulation) => {
  const cat = Number(vatCategory);
  if (cat >= 1 && cat <= 6) return 'S';
  if (cat === 8) return 'O';
  switch (vatRegulation) {
    case 'reverseChargeEU':
    case 'reverseChargeDE':
      return 'AE';
    case 'intraCommunity':
      return 'K';
    case 'export':
      return 'G';
    case 'nonTaxableAbroad':
      return 'O';
    default:
      return 'E';
  }
};

const isRetail = (type) => String(type || '').startsWith('11');
const isCredit = (type) => String(type || '').startsWith('5');

const clean = (obj) => {
  Object.keys(obj).forEach((k) => {
    if (obj[k] === undefined || obj[k] === null || obj[k] === '') delete obj[k];
  });
  return obj;
};

function buildCounterpart(invoice) {
  const cp = invoice.counterpart || {};
  if (isRetail(invoice.invoiceType) && !cp.taxInfo?.afm && !cp.vatNumber) {
    // Anonymous retail customer, as in the Parochos hospitality example
    return { vatNumber: '', name: cp.name || 'Πελάτης Λιανικής', country: cp.country || 'GR' };
  }
  const addr = cp.address || {};
  return clean({
    vatNumber: cp.taxInfo?.afm || cp.vatNumber || '',
    branch: Number(cp.branch) || 0,
    name: cp.name,
    country: cp.country && cp.country !== 'Other' ? cp.country : 'GR',
    street: addr.street,
    streetNumber: addr.number,
    postalCode: addr.postalCode,
    city: addr.city,
    email: cp.email
  });
}

function buildLine(line, index, invoice) {
  const [measurementUnit, measurementUnitUbl] = UNITS[line.unit] || UNITS.pcs;
  const netValue = round2(line.netValue);
  const vatAmount = round2(line.vatAmount);
  const vatCategory = Number(line.vatCategory) || 1;

  const detail = clean({
    lineNumber: index + 1,
    entityName: line.description || line.itemDescription || `Line ${index + 1}`,
    itemDescr: line.itemDescription,
    lineComments: line.lineComments,
    quantity: Number(line.quantity) || 1,
    measurementUnit,
    measurementUnitUbl,
    netValue,
    vatAmount,
    totalValue: round2(netValue + vatAmount),
    vatCategory,
    vatPercent: VAT_PERCENT[vatCategory] ?? 0,
    vatCategoryUbl: vatCategoryUbl(vatCategory, invoice.vatRegulation),
    // Not stored in the Accounty model yet; passed through if present.
    vatExemption: line.vatExemptionCategory || invoice.vatExemptionCategory
  });

  // Amounts recomputed from the line net value (see aadeTransformer.lineClassifications)
  const classifications = aadeTransformer.lineClassifications({ ...line, netValue });
  if (classifications.length) {
    detail.incomeClassification = classifications.map((c) => ({
      classificationType: c.classificationType,
      classificationCategory: c.categoryId,
      amount: c.amount
    }));
  }
  return detail;
}

function buildTaxesTotals(invoice) {
  const taxes = [];
  (invoice.invoiceDetails || []).forEach((line) => {
    if (line.withholdingTaxCategory && Number(line.withheldAmount) > 0) {
      taxes.push({
        taxType: 1, // withholding
        taxCategory: Number(line.withholdingTaxCategory),
        underlyingValue: round2(line.netValue),
        taxAmount: round2(line.withheldAmount)
      });
    }
  });
  return taxes;
}

/**
 * publishType: 0 = none, 1 = B2B e-invoice, 2 = B2G.
 * Env PAROCHOS_PUBLISH_TYPE = auto (default) | 0 | 1 | 2.
 * auto -> B2B (1) for Greek counterparts with an AFM on invoice/credit types,
 *         none (0) for retail receipts and foreign counterparts.
 */
function resolvePublishType(invoice, setting = process.env.PAROCHOS_PUBLISH_TYPE) {
  if (setting !== undefined && setting !== '' && setting !== 'auto') return Number(setting);
  if (isRetail(invoice.invoiceType)) return 0;
  const cp = invoice.counterpart || {};
  const greek = !cp.country || cp.country === 'GR';
  return greek && (cp.taxInfo?.afm || cp.vatNumber) ? 1 : 0;
}

/**
 * Build the Parochos `source` object for one invoice.
 */
function invoiceToSource(invoice, options = {}) {
  const { series, aa } = aadeTransformer.parseInvoiceNumber(invoice.invoiceNumber);
  const issuer = invoice.issuer || {};
  const totals = invoice.totals || {};

  const header = clean({
    series,
    aa,
    issueDate: issueDateTime(invoice),
    dueDate: ymd(invoice.dueDate),
    invoiceType: invoice.invoiceType,
    invoiceTypeUbl: isCredit(invoice.invoiceType) ? '381' : '380',
    currency: invoice.currency || 'EUR'
  });
  if (header.currency !== 'EUR' && invoice.exchangeRate && invoice.exchangeRate !== 1) {
    header.exchangeRate = Number(invoice.exchangeRate);
  }

  const source = {
    invoice: {
      // Greek issuer: name/address are taken from the AADE registry.
      issuer: { vatNumber: issuer.taxInfo?.afm || issuer.vatNumber, branch: Number(issuer.branch) || 0, country: 'GR' },
      counterpart: buildCounterpart(invoice),
      invoiceHeader: header,
      paymentMethods: [
        { type: Number(invoice.payment?.method || 3), amount: round2(totals.totalAmount) }
      ],
      invoiceDetails: (invoice.invoiceDetails || []).map((l, i) => buildLine(l, i, invoice)),
      invoiceSummary: {
        totalNetValue: round2(totals.totalNetValue),
        totalVatAmount: round2(totals.totalVatAmount),
        totalValue: round2(totals.totalAmount)
      },
      publishType: resolvePublishType(invoice, options.publishType)
    }
  };

  const taxesTotals = buildTaxesTotals(invoice);
  if (taxesTotals.length) source.invoice.taxesTotals = taxesTotals;

  // Credit notes (5.1) must reference the original MARK(s); not in the model yet.
  const correlated = invoice.correlatedInvoices || invoice.correlatedMarks;
  if (Array.isArray(correlated) && correlated.length) {
    source.invoice.correlatedInvoices = correlated.map((c) =>
      typeof c === 'object' ? clean({ mark: Number(c.mark), externalSystemId: c.externalSystemId }) : { mark: Number(c) }
    );
  }

  if (options.printProfileCode) source.invoice.printProfileCode = options.printProfileCode;
  return source;
}

/** Stable Parochos externalSystemId for an Accounty invoice. */
function externalSystemIdFor(invoice) {
  if (invoice.providerInfo?.externalSystemId) return invoice.providerInfo.externalSystemId;
  return `accounty-${String(invoice._id || invoice.id || invoice.invoiceNumber)}`;
}

module.exports = {
  invoiceToSource,
  externalSystemIdFor,
  resolvePublishType,
  vatCategoryUbl,
  VAT_PERCENT,
  UNITS
};
