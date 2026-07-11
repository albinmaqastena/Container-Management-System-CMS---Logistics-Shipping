// src/common/utils/encryption.util.ts

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export class EncryptionUtil {
  private static readonly algorithm = 'aes-256-gcm';

  private static getKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY;

    if (!secret) {
      throw new Error('ENCRYPTION_KEY is not defined');
    }

    if (secret.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }

    return createHash('sha256').update(secret).digest();
  }

  static encrypt(plainText: string): string {
    if (!plainText) {
      return '';
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.getKey(), iv);

    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    return [
      'v1',
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  static decrypt(encryptedText: string): string {
    if (!encryptedText) {
      return '';
    }

    const [version, ivValue, authTagValue, encryptedValue] = encryptedText.split('.');

    if (version !== 'v1' || !ivValue || !authTagValue || !encryptedValue) {
      throw new Error('Invalid encrypted payload format');
    }

    const decipher = createDecipheriv(
      this.algorithm,
      this.getKey(),
      Buffer.from(ivValue, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(authTagValue, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
