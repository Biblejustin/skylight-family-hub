/**
 * 5x7 dot-matrix font patterns for digits and colon.
 * Each character is a 7-row array of 5-bit numbers (MSB = leftmost dot).
 * 1 = lit, 0 = dim.
 */

const DOT_MATRIX: Record<string, number[]> = {
  '0': [
    0b01110,
    0b10001,
    0b10011,
    0b10101,
    0b11001,
    0b10001,
    0b01110,
  ],
  '1': [
    0b00100,
    0b01100,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b01110,
  ],
  '2': [
    0b01110,
    0b10001,
    0b00001,
    0b00110,
    0b01000,
    0b10000,
    0b11111,
  ],
  '3': [
    0b01110,
    0b10001,
    0b00001,
    0b00110,
    0b00001,
    0b10001,
    0b01110,
  ],
  '4': [
    0b00010,
    0b00110,
    0b01010,
    0b10010,
    0b11111,
    0b00010,
    0b00010,
  ],
  '5': [
    0b11111,
    0b10000,
    0b11110,
    0b00001,
    0b00001,
    0b10001,
    0b01110,
  ],
  '6': [
    0b01110,
    0b10000,
    0b10000,
    0b11110,
    0b10001,
    0b10001,
    0b01110,
  ],
  '7': [
    0b11111,
    0b00001,
    0b00010,
    0b00100,
    0b01000,
    0b01000,
    0b01000,
  ],
  '8': [
    0b01110,
    0b10001,
    0b10001,
    0b01110,
    0b10001,
    0b10001,
    0b01110,
  ],
  '9': [
    0b01110,
    0b10001,
    0b10001,
    0b01111,
    0b00001,
    0b00001,
    0b01110,
  ],
  ':': [
    0b00000,
    0b00100,
    0b00100,
    0b00000,
    0b00100,
    0b00100,
    0b00000,
  ],
  ' ': [
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
  ],
};

/** Number of columns per character */
export const DOT_COLS = 5;
/** Number of rows per character */
export const DOT_ROWS = 7;

/** Check if a specific dot is active: row 0-6, col 0-4 */
export function isDotActive(char: string, row: number, col: number): boolean {
  const pattern = DOT_MATRIX[char];
  if (!pattern) return false;
  return ((pattern[row] >> (DOT_COLS - 1 - col)) & 1) === 1;
}
