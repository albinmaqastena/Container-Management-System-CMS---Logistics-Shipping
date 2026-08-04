// src/utils/validators.ts
export const isValidEmail = (email: string): boolean => {
  const normalizedEmail = email.trim();
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(normalizedEmail);
};

/**
 * Kontrollon nëse password-i ka gjatësinë minimale 8 karaktere.
 * Nuk kontrollon kompleksitetin (shkronja, numra, simbole) pa verifikim të DTO-ve të backend-it.
 */
export const hasMinimumPasswordLength = (password: string): boolean =>
  password.length >= 8;

// Ruajmë isValidPassword si alias për të mos thyer kodin ekzistues
export const isValidPassword = hasMinimumPasswordLength;

export const isValidUUID = (uuid: string): boolean => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid.trim());
};

export const isValidContainerName = (name: string): boolean => {
  const normalizedName = name.trim();
  return normalizedName.length > 0 && normalizedName.length <= 100;
};

export const isValidVolume = (volume: number): boolean => {
  // Kufiri i sipërm nuk është konfirmuar nga backend-i.
  return Number.isFinite(volume) && volume > 0;
};

export const isValidContainerCode = (code: string): boolean => {
  // Backend-i gjeneron kode në format CNT-A1B2C3D4E5 (CNT- + 10 karaktere hex)
  return /^CNT-[A-F0-9]{10}$/.test(code.trim().toUpperCase());
};

export const isValidUniqueNumber = (uniqueNumber: string): boolean => {
  const normalized = uniqueNumber.trim();
  return normalized.length > 0 && normalized.length <= 50;
};