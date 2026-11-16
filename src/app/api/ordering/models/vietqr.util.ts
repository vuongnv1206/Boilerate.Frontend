import qrcode from 'qrcode-generator';

const BANK_BINS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['970436', ['vietcombank', 'vcb', 'ngoai thuong']],
  ['970407', ['techcombank', 'tcb', 'ky thuong']],
  ['970422', ['mbbank', 'mb bank', 'mb', 'quan doi']],
  ['970418', ['bidv', 'dau tu va phat trien']],
  ['970415', ['vietinbank', 'ctg', 'cong thuong']],
  ['970416', ['acb', 'a chau']],
  ['970432', ['vpbank', 'vpb', 'vietnam thinh vuong']],
  ['970423', ['tpbank', 'tpb', 'tien phong']],
  ['970403', ['sacombank', 'stb', 'sai gon thuong tin']],
  ['970437', ['hdbank', 'hdb', 'phat trien tp hcm']],
  ['970405', ['agribank', 'vba', 'nong nghiep']],
  ['970441', ['vib', 'quoc te']],
  ['970443', ['shb', 'sai gon ha noi']],
  ['970426', ['msb', 'hang hai']],
  ['970448', ['ocb', 'phuong dong']],
  ['970440', ['seabank', 'seab', 'dong nam a']],
  ['970431', ['eximbank', 'eib', 'xuat nhap khau']],
  ['970449', ['lpbank', 'lpb', 'lienvietpostbank', 'loc phat']],
  ['970428', ['namabank', 'nam a', 'nab']],
  ['970412', ['pvcombank', 'dai chung']],
  ['970409', ['bacabank', 'bac a', 'bab']],
  ['970424', ['shinhan']],
  ['970454', ['timo', 'vietcapital', 'ban viet']],
  ['546034', ['cake']],
  ['546035', ['ubank']],
];

function stripAccents(value: string): string {
  return value
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function resolveVietQrBankBin(bankNameOrCode: string | null | undefined): string | null {
  if (!bankNameOrCode) return null;
  const trimmed = bankNameOrCode.trim();
  const binMatch = trimmed.match(/\b(\d{6})\b/);
  if (binMatch) return binMatch[1];

  const normalized = stripAccents(trimmed);
  for (const [bin, aliases] of BANK_BINS) {
    if (aliases.some((alias) => normalized.includes(alias))) {
      return bin;
    }
  }
  return null;
}

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildVietQrPayload(params: {
  bankBin: string;
  accountNumber: string;
  amount: number;
  description: string;
}): string {
  const cleanAccount = params.accountNumber.replace(/\s+/g, '');
  const cleanDesc = stripAccents(params.description)
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);

  const bankInfo = tlv('00', params.bankBin) + tlv('01', cleanAccount);
  const merchantAccount = tlv('00', 'A000000727') + tlv('01', bankInfo) + tlv('02', 'QRIBFTTA');
  const amountStr = Math.round(params.amount).toString();
  const additional = cleanDesc ? tlv('62', tlv('08', cleanDesc)) : '';

  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', merchantAccount) +
    tlv('53', '704') +
    tlv('54', amountStr) +
    tlv('58', 'VN') +
    additional +
    '6304';

  return body + crc16Ccitt(body);
}

/**
 * Draws a QR code (error correction level M) as an SVG path: one unit square per dark module, with
 * the quiet zone of four light modules the standard asks for. Returns null if the text is too long.
 */
export function encodeQrSvg(text: string): { size: number; path: string } | null {
  const quiet = 4;
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text, 'Byte');
    qr.make();
    const count = qr.getModuleCount();
    const paths: string[] = [];
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) paths.push(`M${col + quiet},${row + quiet}h1v1h-1z`);
      }
    }
    return { size: count + quiet * 2, path: paths.join('') };
  } catch {
    return null;
  }
}
