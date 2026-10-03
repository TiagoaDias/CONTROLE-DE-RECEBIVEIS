import QRCode from 'qrcode';

/**
 * Generates a high-definition PNG Data URL containing the official PIX QR Code.
 * Compatible with all Brazilian Banking Apps and standard QR readers.
 *
 * @param pixKey The PIX key (default: '(14) 99733-9863')
 * @param amount Optional installment amount
 * @param merchantName Merchant name (default: 'Tiago Dias')
 * @param merchantCity Merchant city (default: 'Mineiros do Tietê')
 */
export async function generatePixQrCodeDataUrl(
  pixKey = '(14) 99733-9863',
  amount?: number,
  merchantName = 'Tiago Dias',
  merchantCity = 'Mineiros do Tietê'
): Promise<string> {
  const cleanPhone = pixKey.replace(/\D/g, '') || '14997339863';
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  
  // Clean Merchant Name and City according to EMV standard (ASCII only, max length)
  const cleanName = merchantName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 25) || 'TIAGO DIAS';
  const cleanCity = merchantCity.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 15) || 'MINEIROS TIETE';

  // Format PIX EMV Standard Payload (BR Code)
  // Payload Format Indicator + Point of Initiation + Merchant Account Information
  const gui = '0014br.gov.bcb.pix';
  const keyField = `01${formattedPhone.length.toString().padStart(2, '0')}${formattedPhone}`;
  const maiContent = `${gui}${keyField}`;
  const mai = `26${maiContent.length.toString().padStart(2, '0')}${maiContent}`;
  const mcc = '52040000';
  const currency = '5303986';
  const amountField = amount && amount > 0 ? `54${amount.toFixed(2).length.toString().padStart(2, '0')}${amount.toFixed(2)}` : '';
  const country = '5802BR';
  const nameField = `59${cleanName.length.toString().padStart(2, '0')}${cleanName}`;
  const cityField = `60${cleanCity.length.toString().padStart(2, '0')}${cleanCity}`;
  const additionalData = '62070503***';

  const rawPayload = `000201${mai}${mcc}${currency}${amountField}${country}${nameField}${cityField}${additionalData}6304`;

  // Calculate CRC16-CCITT for official EMV compliance
  let crc = 0xffff;
  for (let i = 0; i < rawPayload.length; i++) {
    crc ^= rawPayload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  const crcHex = (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const finalPixPayload = `${rawPayload}${crcHex}`;

  try {
    return await QRCode.toDataURL(finalPixPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#0a192f',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating official PIX QR code:', err);
    return await QRCode.toDataURL(`PIX:${formattedPhone}`, {
      margin: 1,
      width: 320,
    });
  }
}
