import crypto from 'crypto';
import config from '../config/config';

const ALGO = 'aes-256-gcm';

const getEncryptionKey = (): Buffer => {
      const secret =
            config.JWT_SECRET ||
            config.refreshTokenSecret ||
            'imoscan-repair-passcode-fallback-secret';
      return crypto.scryptSync(secret, 'imoscan-device-passcode-v1', 32);
};

export type DevicePasscodeType = 'none' | 'pin' | 'password' | 'pattern';

export interface EncryptedPasscodeResult {
      type: DevicePasscodeType;
      encryptedValue: string;
      isSet: boolean;
      maskedValue: string;
      lengthHint: number;
      updatedAt: Date;
}

export const encryptDevicePasscode = (
      type: DevicePasscodeType,
      rawValue: string
): EncryptedPasscodeResult => {
      const cleaned = rawValue.trim();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(ALGO, getEncryptionKey(), iv);
      const encrypted = Buffer.concat([cipher.update(cleaned, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const payload = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;

      const dotCount = Math.min(Math.max(cleaned.length, 4), 10);
      const maskedValue =
            type === 'pattern'
                  ? `Pattern (${cleaned.split(/[-,\s]+/).filter(Boolean).length} dots)`
                  : '•'.repeat(dotCount);

      return {
            type,
            encryptedValue: payload,
            isSet: true,
            maskedValue,
            lengthHint: cleaned.length,
            updatedAt: new Date(),
      };
};

export const decryptDevicePasscode = (encryptedPayload: string): string => {
      const parts = String(encryptedPayload || '').split(':');
      if (parts.length !== 3) {
            throw new Error('Stored passcode payload is corrupted');
      }
      const [ivHex, tagHex, dataHex] = parts;
      const decipher = crypto.createDecipheriv(
            ALGO,
            getEncryptionKey(),
            Buffer.from(ivHex, 'hex')
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      const decrypted = Buffer.concat([
            decipher.update(Buffer.from(dataHex, 'hex')),
            decipher.final(),
      ]);
      return decrypted.toString('utf8');
};

export const isAuthorizedTechnicianRole = (params: {
      role?: string;
      jobRole?: string;
      actorName?: string;
      assignedTechnician?: string;
}): boolean => {
      const role = (params.role || '').trim().toLowerCase();
      if (role === 'shopkeeper' || role === 'admin') {
            return true;
      }

      if (role === 'staff') {
            const jobRole = (params.jobRole || '').trim().toLowerCase();
            if (/(tech|repair|engineer|workshop|manager|supervisor|owner)/i.test(jobRole)) {
                  return true;
            }
            const actor = (params.actorName || '').trim().toLowerCase();
            const assigned = (params.assignedTechnician || '').trim().toLowerCase();
            if (actor && assigned && (actor === assigned || actor.includes(assigned) || assigned.includes(actor))) {
                  return true;
            }
            return false;
      }

      return false;
};
