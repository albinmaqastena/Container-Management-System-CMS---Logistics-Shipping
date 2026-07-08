// src/utils/formatters.ts
export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatVolume = (volume: number): string => {
  return `${volume.toFixed(2)} m³`;
};

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const formatContainerCode = (code: string): string => {
  // Ndarja e kodit në pjesë për shfaqje më të mirë
  const parts = code.split('-');
  if (parts.length === 2) {
    const timestamp = new Date(parseInt(parts[0])).toLocaleDateString();
    return `${parts[1]} (${timestamp})`;
  }
  return code;
};