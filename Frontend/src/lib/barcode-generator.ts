/**
 * Pure JavaScript Code128 Barcode SVG Generator
 * Generates clean, crisp Code128 SVG string or Data URL for display and thermal label printing.
 */

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

const START_CODE_B = 104;
const STOP_CODE = 106;

export function encodeCode128(text: string): string[] {
  const codes: number[] = [START_CODE_B];
  let checksum = START_CODE_B;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    const safeCode = code >= 0 && code <= 95 ? code : 0;
    codes.push(safeCode);
    checksum += safeCode * (i + 1);
  }

  const checkSymbol = checksum % 103;
  codes.push(checkSymbol);
  codes.push(STOP_CODE);

  return codes.map((c) => CODE128_PATTERNS[c] || CODE128_PATTERNS[0]);
}

export function generateBarcodeSVG(text: string, options: { height?: number; barWidth?: number; showText?: boolean } = {}): string {
  const cleanText = (text || "000000000000").trim();
  const patterns = encodeCode128(cleanText);
  const barWidth = options.barWidth || 2;
  const height = options.height || 45;
  const showText = options.showText !== false;

  let x = 10;
  const rects: string[] = [];

  for (const pattern of patterns) {
    let isBar = true;
    for (let i = 0; i < pattern.length; i++) {
      const width = parseInt(pattern[i], 10) * barWidth;
      if (isBar) {
        rects.push(`<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000" />`);
      }
      x += width;
      isBar = !isBar;
    }
  }

  const totalWidth = x + 10;
  const totalHeight = height + (showText ? 18 : 4);
  const textY = height + 14;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="100%" shape-rendering="crispEdges">
      <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="#fff" />
      <g>${rects.join("")}</g>
      ${showText ? `<text x="${totalWidth / 2}" y="${textY}" font-family="Courier, monospace, sans-serif" font-size="13" font-weight="700" text-anchor="middle" fill="#000">${cleanText}</text>` : ""}
    </svg>
  `.trim();
}
