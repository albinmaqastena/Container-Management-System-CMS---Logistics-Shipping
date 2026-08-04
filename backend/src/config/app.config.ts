// src/config/app.config.ts

import { registerAs } from '@nestjs/config';

export interface AppConfiguration {
  frontendUrl: string;
}

export default registerAs('app', (): AppConfiguration => {
  const frontendUrl = process.env.FRONTEND_URL?.trim();

  if (!frontendUrl) {
    throw new Error('FRONTEND_URL environment variable is required');
  }

  try {
    new URL(frontendUrl);
  } catch {
    throw new Error('FRONTEND_URL must be a valid absolute URL');
  }

  return {
    frontendUrl,
  };
});
