import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET is not defined',
    );
  }

  if (secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters long',
    );
  }

  return {
    jwt: {
      secret,

      accessTokenExpiresIn:
        process.env.JWT_ACCESS_EXPIRES_IN ||
        process.env.JWT_EXPIRES_IN ||
        '15m',

      refreshTokenExpiresIn:
        process.env.JWT_REFRESH_EXPIRES_IN ||
        '7d',

      issuer:
        process.env.JWT_ISSUER ||
        'container-management-system',

      audience:
        process.env.JWT_AUDIENCE ||
        'container-management-users',
    },

    argon2: {
      saltLength: 16,
      hashLength: 32,
      timeCost: 3,
      memoryCost: 4096,
      parallelism: 1,
    },

    rateLimit: {
      loginAttempts: Number(
        process.env.AUTH_LOGIN_ATTEMPTS ||
          5,
      ),

      blockDuration: Number(
        process.env.AUTH_BLOCK_DURATION_MS ||
          15 * 60 * 1000,
      ),
    },
  };
});