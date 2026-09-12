import crypto from 'crypto';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const base32Encode = (buffer: Buffer): string => {
      let bits = 0;
      let value = 0;
      let output = '';

      for (let i = 0; i < buffer.length; i++) {
            value = (value << 8) | buffer[i];
            bits += 8;

            while (bits >= 5) {
                  output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
                  bits -= 5;
            }
      }

      if (bits > 0) {
            output += BASE32_CHARS[(value << (5 - bits)) & 31];
      }

      return output;
};

export const base32Decode = (base32: string): Buffer => {
      const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
      let bits = 0;
      let value = 0;
      const bytes: number[] = [];

      for (let i = 0; i < cleaned.length; i++) {
            const index = BASE32_CHARS.indexOf(cleaned[i]);
            if (index === -1) continue;

            value = (value << 5) | index;
            bits += 5;

            if (bits >= 8) {
                  bytes.push((value >>> (bits - 8)) & 255);
                  bits -= 8;
            }
      }

      return Buffer.from(bytes);
};

export class TotpUtil {
      static readonly stepSeconds = 30;
      static readonly digits = 6;

      static generateSecret(byteLength: number = 20): string {
            const random = crypto.randomBytes(byteLength);
            return base32Encode(random);
      }

      static generateHotp(secret: string, counter: number): string {
            const key = base32Decode(secret);
            const counterBuffer = Buffer.alloc(8);
            counterBuffer.writeBigInt64BE(BigInt(counter), 0);

            const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
            const offset = hmac[hmac.length - 1] & 0x0f;

            const binary =
                  ((hmac[offset] & 0x7f) << 24) |
                  ((hmac[offset + 1] & 0xff) << 16) |
                  ((hmac[offset + 2] & 0xff) << 8) |
                  (hmac[offset + 3] & 0xff);

            const otp = binary % Math.pow(10, TotpUtil.digits);
            return otp.toString().padStart(TotpUtil.digits, '0');
      }

      static getCode(secret: string, date: Date = new Date()): string {
            const counter = Math.floor(date.getTime() / 1000 / TotpUtil.stepSeconds);
            return TotpUtil.generateHotp(secret, counter);
      }

      static verify(secret: string, code: string, window: number = 1): boolean {
            const cleaned = code.replace(/[\s-]/g, '');
            if (cleaned.length !== TotpUtil.digits) return false;

            const nowCounter = Math.floor(Date.now() / 1000 / TotpUtil.stepSeconds);

            for (let offset = -window; offset <= window; offset++) {
                  const expected = TotpUtil.generateHotp(secret, nowCounter + offset);
                  if (expected === cleaned) {
                        return true;
                  }
            }

            return false;
      }

      static provisioningUri({
            secret,
            account,
            issuer = 'imoscan',
      }: {
            secret: string;
            account: string;
            issuer?: string;
      }): string {
            const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
            return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TotpUtil.digits}&period=${TotpUtil.stepSeconds}`;
      }
}

export class OneTimeCodeUtil {
      static generateCode(): string {
            return crypto.randomInt(100000, 1000000).toString();
      }

      static newSalt(): string {
            return crypto.randomBytes(16).toString('hex');
      }

      static hash(code: string, salt: string): string {
            return crypto.createHash('sha256').update(code + salt).digest('hex');
      }

      static matches(code: string, salt: string, storedHash: string): boolean {
            const computed = OneTimeCodeUtil.hash(code, salt);
            return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
      }
}
