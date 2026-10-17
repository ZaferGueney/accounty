/**
 * Routes invoice issuing either directly to AADE myDATA (default, existing
 * aadeService flow) or through an e-invoicing provider.
 *
 *   EINVOICE_PROVIDER=parochos  -> invoices from the BillMou UI go through Parochos
 *   (unset / "mydata")          -> unchanged behaviour
 */
const { getParochosService, ParochosError } = require('./parochosService');
const parochosTransformer = require('./parochosTransformer');

const getProvider = () => {
  const p = String(process.env.EINVOICE_PROVIDER || 'mydata').trim().toLowerCase();
  return p === 'parochos' ? 'parochos' : 'mydata';
};

const usesProvider = () => getProvider() !== 'mydata';

/**
 * Transmit an invoice document through the configured provider and persist
 * the outcome on it.
 *
 * @returns {{ outcome: 'transmitted'|'pending'|'rejected'|'error', message?: string, errors?: Array }}
 */
async function submitViaProvider(invoice, { service = getParochosService() } = {}) {
  if (!service.isConfigured()) {
    return {
      outcome: 'error',
      httpStatus: 400,
      message: 'Parochos credentials not configured (PAROCHOS_USERNAME, PAROCHOS_PASSWORD, PAROCHOS_SUBSCRIPTION_KEY).'
    };
  }

  let result;
  try {
    result = await service.transmitInvoice(invoice.toObject ? invoice.toObject() : invoice);
  } catch (err) {
    const isAuth = err instanceof ParochosError && (err.code === 'AUTH' || err.code === 'CONFIG');
    invoice.status = 'draft';
    invoice.aadeStatus = 'failed';
    invoice.aadeInfo = invoice.aadeInfo || {};
    invoice.aadeInfo.transmissionFailure = isAuth ? 'authentication' : err.network ? 'network' : 'server_error';
    invoice.applyProviderResult(
      {
        provider: 'parochos',
        // Remember the id even on failure: after a lost/timed-out response the
        // next attempt asks Parochos for this id first instead of sending again.
        externalSystemId: parochosTransformer.externalSystemIdFor(invoice),
        errors: [{ code: err.code || 'ERROR', category: err.category, message: err.message }]
      },
      service.env
    );
    await invoice.save();
    return { outcome: 'error', httpStatus: isAuth ? 400 : 502, message: err.message };
  }

  if (result.success) {
    invoice.status = 'sent';
    const qrDataUrl = await service.qrDataUrl(result.qrCodeUrl || result.qrUrlAADE);
    await invoice.markTransmittedViaProvider(result, { qrDataUrl, environment: service.env });
    return { outcome: 'transmitted', result };
  }

  invoice.applyProviderResult(result, service.env);
  invoice.status = 'draft';
  if (result.inProgress) {
    // Accepted by Parochos, not yet signed by AADE. Retrying "send" re-checks it first.
    invoice.aadeStatus = 'pending';
    await invoice.save();
    return {
      outcome: 'pending',
      httpStatus: 202,
      message: 'Parochos is still processing the invoice. Check status again in a moment.'
    };
  }

  invoice.aadeStatus = 'failed';
  invoice.aadeInfo.transmissionFailure = 'validation';
  await invoice.save();
  return {
    outcome: 'rejected',
    httpStatus: 400,
    message: 'Parochos/AADE rejected the invoice. Invoice saved as draft - fix errors and try again.',
    errors: result.errors
  };
}

/** Re-query the provider for an invoice that is pending (or to refresh its data). */
async function refreshProviderStatus(invoice, { service = getParochosService() } = {}) {
  const externalSystemId = invoice.providerInfo?.externalSystemId;
  if (!externalSystemId) return { outcome: 'error', httpStatus: 400, message: 'Invoice was not sent through a provider' };
  const result = await service.get({ externalSystemId });
  if (result.success) {
    if (invoice.aadeStatus !== 'transmitted') {
      invoice.status = 'sent';
      const qrDataUrl = await service.qrDataUrl(result.qrCodeUrl || result.qrUrlAADE);
      await invoice.markTransmittedViaProvider({ ...result, externalSystemId }, { qrDataUrl, environment: service.env });
    } else {
      invoice.applyProviderResult({ ...result, externalSystemId }, service.env);
      await invoice.save();
    }
    return { outcome: 'transmitted', result };
  }
  invoice.applyProviderResult({ ...result, externalSystemId }, service.env);
  if (!result.inProgress && invoice.aadeStatus !== 'transmitted') invoice.aadeStatus = 'failed';
  await invoice.save();
  return { outcome: result.inProgress ? 'pending' : 'rejected', result, errors: result.errors };
}

module.exports = { getProvider, usesProvider, submitViaProvider, refreshProviderStatus };
