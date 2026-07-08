// src/config/auth.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    accessTokenExpiresIn: '15m', // ✅ 15 minuta
    refreshTokenExpiresIn: '7d', // ✅ 7 ditë
  },
  argon2: {
    saltLength: 16,
    hashLength: 32,
    timeCost: 3,
    memoryCost: 4096,
    parallelism: 1,
  },
  rateLimit: {
    loginAttempts: 5, // ✅ 5 tentativa
    blockDuration: 15 * 60 * 1000, // ✅ 15 minuta
  },
}));