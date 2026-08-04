// src/config/mail.config.ts

import { registerAs } from '@nestjs/config';

export interface MailConfiguration {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export default registerAs('mail', (): MailConfiguration => {
  const host = process.env.MAIL_HOST?.trim();
  const user = process.env.MAIL_USER?.trim();
  const password = process.env.MAIL_PASSWORD;
  const from = process.env.MAIL_FROM?.trim();

  if (!host) {
    throw new Error('MAIL_HOST environment variable is required');
  }

  if (!user) {
    throw new Error('MAIL_USER environment variable is required');
  }

  if (!password) {
    throw new Error('MAIL_PASSWORD environment variable is required');
  }

  if (!from) {
    throw new Error('MAIL_FROM environment variable is required');
  }

  return {
    host,
    port: parsePositiveInteger(process.env.MAIL_PORT, 587),
    secure: process.env.MAIL_SECURE?.trim().toLowerCase() === 'true',
    user,
    password,
    from,
    connectionTimeout: parsePositiveInteger(process.env.MAIL_CONNECTION_TIMEOUT, 10_000),
    greetingTimeout: parsePositiveInteger(process.env.MAIL_GREETING_TIMEOUT, 10_000),
    socketTimeout: parsePositiveInteger(process.env.MAIL_SOCKET_TIMEOUT, 20_000),
  };
});
