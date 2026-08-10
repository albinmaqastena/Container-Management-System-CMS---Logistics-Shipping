import { JwtModuleOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';

export const jwtConfig = (): JwtModuleOptions => {
  const secret =
    process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET is not defined in environment variables',
    );
  }

  if (secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters long',
    );
  }

  const accessTokenExpiresIn =
    process.env.JWT_ACCESS_EXPIRES_IN ||
    process.env.JWT_EXPIRES_IN ||
    '15m';

  return {
    secret,

    signOptions: {
      expiresIn:
        accessTokenExpiresIn as StringValue,

      algorithm: 'HS256',

      issuer:
        process.env.JWT_ISSUER ||
        'container-management-system',

      audience:
        process.env.JWT_AUDIENCE ||
        'container-management-users',
    },
  };
};