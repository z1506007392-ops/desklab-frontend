// Six-digit login codes. A uint32 modulo 1_000_000 is not uniform: 2^32 is
// 967296 more than a multiple of 1_000_000, so 000000–967295 would show up
// once more often than 967296–999999. Rejection sampling keeps only the
// largest multiple of the span that fits in a uint32, so each code has
// exactly 4294 accepted rolls.

export const LOGIN_CODE_SPAN = 1000000;
const UINT32_SPAN = 2 ** 32;
export const LOGIN_CODE_ROLL_LIMIT = UINT32_SPAN - (UINT32_SPAN % LOGIN_CODE_SPAN);

export function loginCodeFromUint32(roll) {
  if (!Number.isInteger(roll) || roll < 0 || roll >= LOGIN_CODE_ROLL_LIMIT) return null;
  return String(roll % LOGIN_CODE_SPAN).padStart(6, '0');
}

// Eight draws is enough. The chance of rejecting a fair uint32 eight times
// is about 10^-29. A ninth draw is not used, so a broken source cannot fall
// through to the biased modulo.
export function uniformLoginCode(nextUint32) {
  for (let draw = 0; draw < 8; draw += 1) {
    const code = loginCodeFromUint32(nextUint32());
    if (code) return code;
  }
  return null;
}
