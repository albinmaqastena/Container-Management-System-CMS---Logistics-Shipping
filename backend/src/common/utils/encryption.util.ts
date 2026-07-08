// src/common/utils/encryption.util.ts
import * as CryptoJS from 'crypto-js';

export class EncryptionUtil {
  private static readonly secretKey = process.env.ENCRYPTION_KEY || 'default-key-change-me';

  static encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.secretKey).toString();
  }

  static decrypt(encryptedText: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}