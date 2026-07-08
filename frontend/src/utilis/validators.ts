// src/utils/validators.ts
export const isValidEmail = (email: string): boolean => {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 8;
};

export const isValidUUID = (uuid: string): boolean => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
};

export const isValidContainerName = (name: string): boolean => {
  return name.trim().length > 0 && name.trim().length <= 100;
};

export const isValidVolume = (volume: number): boolean => {
  return volume > 0 && volume <= 10000;
};

export const isValidContainerCode = (code: string): boolean => {
  const regex = /^\d+-[A-Z]{3}$/;
  return regex.test(code);
};

export const isValidUniqueNumber = (uniqueNumber: string): boolean => {
  return uniqueNumber.trim().length > 0 && uniqueNumber.trim().length <= 50;
};