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

// Pure TypeScript QR Code (ECC Level M, Byte mode, Versions 1-8)
const VERSION_CAP_M = [0, 14, 26, 42, 62, 84, 106, 122, 152];
const VERSION_EC_M = [0, 10, 16, 26, 36, 48, 64, 72, 88];
const VERSION_BLOCKS_M: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 16],
  [1, 28],
  [1, 44],
  [2, 32],
  [2, 43],
  [4, 27],
  [4, 31],
  [2, 38],
];
const ALIGNMENT_POS: ReadonlyArray<readonly number[]> = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGenerator(ecLen);
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

export function encodeQrSvg(text: string): { size: number; path: string } | null {
  const bytes = new TextEncoder().encode(text);
  let version = 0;
  for (let v = 1; v < VERSION_CAP_M.length; v++) {
    if (bytes.length <= VERSION_CAP_M[v]) {
      version = v;
      break;
    }
  }
  if (version === 0) return null;

  const [blockCount, dataPerBlock] = VERSION_BLOCKS_M[version];
  const totalData = version === 8 ? 2 * 38 + 2 * 39 : blockCount * dataPerBlock;
  // Version 8 has four blocks (two of 38 and two of 39 data codewords), 22 error-correction codewords each.
  const ecPerBlock = VERSION_EC_M[version] / (version === 8 ? 4 : blockCount);

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);
  const maxBits = totalData * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const dataBytes = new Uint8Array(totalData);
  for (let i = 0; i < bits.length / 8; i++) {
    let val = 0;
    for (let b = 0; b < 8; b++) val = (val << 1) | bits[i * 8 + b];
    dataBytes[i] = val;
  }
  const pads = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < totalData; i++, p++) {
    dataBytes[i] = pads[p % 2];
  }

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  const totalBlocks = version === 8 ? 4 : blockCount;
  for (let b = 0; b < totalBlocks; b++) {
    const len = version === 8 && b >= 2 ? 39 : dataPerBlock;
    const slice = dataBytes.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(slice);
    ecBlocks.push(rsRemainder(slice, ecPerBlock));
  }

  const codewords: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) if (i < blk.length) codewords.push(blk[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const blk of ecBlocks) codewords.push(blk[i]);
  }

  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));

  const setModule = (r: number, c: number, val: number, isFunc = true) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = val;
      if (isFunc) reserved[r][c] = 1;
    }
  };

  const drawFinder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inBox = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setModule(r0 + r, c0 + c, inBox && (onBorder || inCore) ? 1 : 0);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0 ? 1 : 0);
    setModule(i, 6, i % 2 === 0 ? 1 : 0);
  }
  setModule(size - 8, 8, 1);

  const aligns = ALIGNMENT_POS[version];
  const lastAlign = aligns[aligns.length - 1];
  for (const ar of aligns) {
    for (const ac of aligns) {
      // The three centres that fall on a finder pattern are left out; the others are drawn,
      // also those on the timing line (version 7 and above).
      const onFinder =
        (ar === 6 && ac === 6) || (ar === 6 && ac === lastAlign) || (ar === lastAlign && ac === 6);
      if (onFinder) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const val = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0) ? 1 : 0;
          setModule(ar + r, ac + c, val);
        }
      }
    }
  }

  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      reserved[8][i] = 1;
      reserved[i][8] = 1;
    }
  }
  for (let i = size - 8; i < size; i++) {
    reserved[8][i] = 1;
    reserved[i][8] = 1;
  }
  if (version >= 7) {
    // Reserve version info areas
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][size - 11 + j] = 1;
        reserved[size - 11 + j][i] = 1;
      }
    }
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
    const vBits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = (vBits >> i) & 1;
      modules[Math.floor(i / 3)][size - 11 + (i % 3)] = bit;
      modules[size - 11 + (i % 3)][Math.floor(i / 3)] = bit;
    }
  }

  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  let up = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const r = up ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!reserved[r][c]) {
          let bit = 0;
          if (bitIdx < totalBits) {
            bit = (codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          modules[r][c] = bit;
        }
      }
    }
    up = !up;
  }

  // Try the eight masks and keep the one with the lowest penalty: it scans best.
  const unmasked = modules.map((row) => Int8Array.from(row));
  let best: Int8Array[] | null = null;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = unmasked.map((row) => Int8Array.from(row));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && maskApplies(mask, r, c)) candidate[r][c] ^= 1;
      }
    }
    drawFormatInfo(candidate, size, mask);
    const penalty = maskPenalty(candidate, size);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = candidate;
    }
  }
  const finalModules = best!;

  // The standard asks for a quiet zone of four light modules around the code.
  const quiet = 4;
  const paths: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (finalModules[r][c] === 1) {
        paths.push(`M${c + quiet},${r + quiet}h1v1h-1z`);
      }
    }
  }
  return { size: size + quiet * 2, path: paths.join('') };
}

function maskApplies(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

/** Writes the 15 format bits (error correction level M and the mask) in both places. */
function drawFormatInfo(modules: Int8Array[], size: number, mask: number): void {
  const data = (0b00 << 3) | mask; // level M is 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> i) & 1;
    if (i < 6) modules[i][8] = bit;
    else if (i < 8) modules[i + 1][8] = bit;
    else modules[size - 15 + i][8] = bit;

    if (i < 8) modules[8][size - 1 - i] = bit;
    else if (i < 9) modules[8][7] = bit;
    else modules[8][14 - i] = bit;
  }
}

/** The four penalty rules of the standard: long runs, 2x2 blocks, finder-like patterns, imbalance. */
function maskPenalty(modules: Int8Array[], size: number): number {
  let penalty = 0;
  const line = (get: (i: number) => number): void => {
    let run = 1;
    for (let i = 1; i < size; i++) {
      if (get(i) === get(i - 1)) {
        run++;
        if (run === 5) penalty += 3;
        else if (run > 5) penalty += 1;
      } else {
        run = 1;
      }
    }
    // 1:1:3:1:1 dark-light-dark pattern with four light modules on one side.
    for (let i = 0; i + 11 <= size; i++) {
      const w = (k: number) => get(i + k);
      const dark = w(0) && !w(1) && w(2) && w(3) && w(4) && !w(5) && w(6);
      if (dark && !w(7) && !w(8) && !w(9) && !w(10)) penalty += 40;
      const darkRight = w(4) && !w(5) && w(6) && w(7) && w(8) && !w(9) && w(10);
      if (darkRight && !w(0) && !w(1) && !w(2) && !w(3)) penalty += 40;
    }
  };
  for (let i = 0; i < size; i++) {
    line((k) => modules[i][k]);
    line((k) => modules[k][i]);
  }
  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c] === 1) dark++;
      if (
        r + 1 < size &&
        c + 1 < size &&
        modules[r][c] === modules[r][c + 1] &&
        modules[r][c] === modules[r + 1][c] &&
        modules[r][c] === modules[r + 1][c + 1]
      ) {
        penalty += 3;
      }
    }
  }
  const total = size * size;
  penalty += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return penalty;
}
