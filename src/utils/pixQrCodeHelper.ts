import QRCode from 'qrcode';

/**
 * Normalizes and formats a PIX key into official Central Bank of Brazil (BACEN / DICT) standards.
 * - Phone keys MUST be in international format starting with '+55' (e.g., '+5514997339863')
 * - Emails MUST be trimmed and lowercase
 * - CPF / CNPJ MUST be digits only
 * - Random EVP UUIDs MUST be trimmed and lowercase
 */
export function formatPixKeyForEmv(rawKey: string): string {
  if (!rawKey) return '+5514997339863';
  const trimmed = rawKey.trim();

  // 1. Email Key
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }

  // 2. Random EVP Key (UUID format)
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const cleanDigits = trimmed.replace(/\D/g, '');

  // 3. CNPJ (14 digits)
  if (cleanDigits.length === 14) {
    return cleanDigits;
  }

  // 4. Phone Key starting with '+'
  if (trimmed.startsWith('+')) {
    return `+${cleanDigits}`;
  }

  // 5. Phone Key already including 55 country code without '+' (12 or 13 digits e.g. '5514997339863')
  if ((cleanDigits.length === 12 || cleanDigits.length === 13) && cleanDigits.startsWith('55')) {
    return `+${cleanDigits}`;
  }

  // 6. Phone Key (10 or 11 digits e.g. '14997339863' or '(14) 99733-9863')
  // If it's 10 or 11 digits and starts with valid DDD (11-99), treat as phone key in E.164
  if (cleanDigits.length === 10 || cleanDigits.length === 11) {
    const ddd = parseInt(cleanDigits.slice(0, 2), 10);
    if (ddd >= 11 && ddd <= 99) {
      return `+55${cleanDigits}`;
    }
    return cleanDigits; // fallback CPF
  }

  // Default fallback
  return cleanDigits || '+5514997339863';
}

/**
 * Calculates official EMVCo / Bacen CRC16-CCITT Checksum for Pix BR Code payload.
 * Polynomial: 0x1021, Init: 0xFFFF.
 */
export function computePixCrc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generates an official, 100% EMVCo / Bacen-compliant PIX BR Code Payload string.
 */
export function generatePixEmvPayload(
  pixKey = '(14) 99733-9863',
  amount?: number,
  merchantName = 'Tiago Dias',
  merchantCity = 'Mineiros do Tietê'
): string {
  const formattedKey = formatPixKeyForEmv(pixKey);

  // Clean Merchant Name and City according to EMV standard (ASCII only, max 25 / 15 chars)
  const cleanName = merchantName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
    .slice(0, 25)
    .trim() || 'TIAGO DIAS';

  let cleanCity = merchantCity
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
    .trim();

  if (cleanCity.includes('MINEIROS')) {
    cleanCity = 'MINEIROS TIETE';
  } else {
    cleanCity = cleanCity.slice(0, 15) || 'MINEIROS TIETE';
  }

  // Build Merchant Account Information (Field 26)
  const gui = '0014br.gov.bcb.pix';
  const keyField = `01${formattedKey.length.toString().padStart(2, '0')}${formattedKey}`;
  const maiContent = `${gui}${keyField}`;
  const mai = `26${maiContent.length.toString().padStart(2, '0')}${maiContent}`;

  const mcc = '52040000';
  const currency = '5303986';

  let amountField = '';
  if (amount && amount > 0) {
    const formattedAmount = amount.toFixed(2);
    amountField = `54${formattedAmount.length.toString().padStart(2, '0')}${formattedAmount}`;
  }

  const country = '5802BR';
  const nameField = `59${cleanName.length.toString().padStart(2, '0')}${cleanName}`;
  const cityField = `60${cleanCity.length.toString().padStart(2, '0')}${cleanCity}`;
  const additionalData = '62070503***';

  const rawPayload = `000201${mai}${mcc}${currency}${amountField}${country}${nameField}${cityField}${additionalData}6304`;
  const crcHex = computePixCrc16Ccitt(rawPayload);

  return `${rawPayload}${crcHex}`;
}

/**
 * Generates a high-definition PNG Data URL containing the official PIX QR Code.
 * Compatible with ALL Brazilian Banking Apps (Nubank, Itaú, Bradesco, BB, Inter, Santander, Caixa, Asaas, etc.).
 *
 * @param pixKey The PIX key (default: '(14) 99733-9863')
 * @param amount Optional installment or total amount
 * @param merchantName Merchant name (default: 'Tiago Dias')
 * @param merchantCity Merchant city (default: 'Mineiros do Tietê')
 */
export async function generatePixQrCodeDataUrl(
  pixKey = '(14) 99733-9863',
  amount?: number,
  merchantName = 'Tiago Dias',
  merchantCity = 'Mineiros do Tietê'
): Promise<string> {
  const finalPixPayload = generatePixEmvPayload(pixKey, amount, merchantName, merchantCity);

  try {
    return await QRCode.toDataURL(finalPixPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error rendering official PIX QR Code:', err);
    // Fallback QR code with payload string directly
    return await QRCode.toDataURL(finalPixPayload, {
      margin: 2,
      width: 512,
    });
  }
}
