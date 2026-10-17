/** Locale-aware formatting helpers shared by all screens. */

const localeMap: Record<string, string> = { en: 'en-GB', el: 'el-GR', de: 'de-DE' };

export const toIntlLocale = (locale?: string) => localeMap[locale || 'en'] || 'en-GB';

export const formatMoney = (
  value: number | null | undefined,
  locale?: string,
  currency = 'EUR',
  opts: { decimals?: number } = {}
) => {
  const n = typeof value === 'number' && isFinite(value) ? value : 0;
  const decimals = opts.decimals ?? 2;
  try {
    return new Intl.NumberFormat(toIntlLocale(locale), {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return `${n.toFixed(decimals)} ${currency}`;
  }
};

export const formatNumber = (value: number | null | undefined, locale?: string, decimals = 0) => {
  const n = typeof value === 'number' && isFinite(value) ? value : 0;
  return new Intl.NumberFormat(toIntlLocale(locale), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
};

export const formatDate = (value: string | number | Date | null | undefined, locale?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
};

/**
 * Turns an axios error into a readable message.
 * Handles JSON bodies, Blob bodies (PDF endpoints) and AADE error arrays.
 */
export const readApiError = async (err: any, fallback: string): Promise<string> => {
  let data = err?.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      data = JSON.parse(await data.text());
    } catch {
      data = null;
    }
  }
  return apiErrorText(err, fallback, data);
};

/** Synchronous variant for JSON responses. */
export const apiErrorText = (err: any, fallback: string, dataOverride?: any): string => {
  const data = dataOverride !== undefined ? dataOverride : err?.response?.data;
  if (data?.errors && Array.isArray(data.errors) && data.errors.length) {
    const lines = data.errors
      .map((e: any) =>
        typeof e === 'string' ? e : `${e.code ? `[${e.code}] ` : ''}${e.message || e.msg || ''}`
      )
      .filter(Boolean)
      .join('\n');
    return data.message ? `${data.message}\n${lines}` : lines;
  }
  if (data?.message) return data.message;
  if (typeof data?.error === 'string') return data.error;
  if (err?.code === 'ECONNABORTED') return `${fallback} (timeout)`;
  if (err?.message === 'Network Error') return `${fallback} (network error)`;
  return err?.message || fallback;
};
