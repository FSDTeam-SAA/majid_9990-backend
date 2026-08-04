export interface ContactCardDetails {
      firstName: string;
      lastName?: string;
      email?: string;
      phone?: string;
      shopName?: string;
      shopAddress?: string;
      whatsappNumber?: string;
}

const escapeVCardValue = (value: string) =>
      value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

export const createContactVCard = (contact: ContactCardDetails): string => {
      const firstName = contact.firstName.trim();
      const lastName = contact.lastName?.trim() ?? '';
      const fullName = `${firstName} ${lastName}`.trim() || contact.shopName?.trim() || 'Shopkeeper';
      const lines = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${escapeVCardValue(fullName)}`,
            `N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`,
      ];

      if (contact.shopName?.trim()) {
            lines.push(`ORG:${escapeVCardValue(contact.shopName.trim())}`);
      }

      if (contact.phone?.trim()) {
            lines.push(`TEL;TYPE=WORK,VOICE:${escapeVCardValue(contact.phone.trim())}`);
      }

      if (contact.email?.trim()) {
            lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(contact.email.trim())}`);
      }

      if (contact.shopAddress?.trim()) {
            lines.push(`ADR;TYPE=WORK:;;${escapeVCardValue(contact.shopAddress.trim())};;;;`);
      }

      if (contact.whatsappNumber?.trim()) {
            lines.push(`NOTE:${escapeVCardValue(`WhatsApp: ${contact.whatsappNumber.trim()}`)}`);
      }

      lines.push('END:VCARD');
      return `${lines.join('\r\n')}\r\n`;
};

export const getContactCardFilename = (contact: ContactCardDetails): string => {
      const rawName =
            contact.shopName?.trim() || `${contact.firstName} ${contact.lastName ?? ''}`.trim() || 'shopkeeper';
      const fileName = rawName
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();

      return `${fileName || 'shopkeeper'}-contact.vcf`;
};
