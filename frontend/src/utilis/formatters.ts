// src/utils/formatters.ts

// Krijojmë një instance të DateTimeFormat për ta ripërdorur
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDate = (
  date: string | Date | null | undefined,
): string => {
  if (!date) {
    return '—';
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return '—';
  }

  return dateFormatter.format(parsedDate);
};

export const formatCurrency = (
  amount: number,
  currency = 'CNY',
  locale = 'en-GB',
): string => {
  if (!Number.isFinite(amount)) {
    return '—';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatVolume = (volume: number): string => {
  if (!Number.isFinite(volume)) {
    return '—';
  }

  return `${volume.toFixed(2)} m³`;
};

export const formatPercentage = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return `${value.toFixed(1)}%`;
};

export const formatContainerCode = (code: string): string => {
  // Normalizimi i thjeshtë: heq hapësira, uppercase
  return code.trim().toUpperCase();
};

/**
 * Formatimi i numrave të mëdhenj (total items, users, containers, etj.)
 */
export const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat('en-US').format(value);
};