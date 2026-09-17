// Room codes are typed by humans, so the alphabet drops characters that are
// easy to confuse: O/0 and I/1 are excluded.

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 4

const ALPHABET_PATTERN = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, 'g')

function randomBytes(count: number): Uint8Array {
  const buffer = new Uint8Array(count)
  const cryptoRef = globalThis.crypto
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(buffer)
    return buffer
  }
  for (let i = 0; i < count; i += 1) {
    buffer[i] = Math.floor(Math.random() * 256)
  }
  return buffer
}

/** A 4-character room code drawn from the unambiguous alphabet. */
export function generateRoomCode(): string {
  const bytes = randomBytes(ROOM_CODE_LENGTH)
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length]
  }
  return code
}

/** Uppercase and strip anything outside the alphabet. Does not enforce length. */
export function normalizeRoomCode(input: string): string {
  if (typeof input !== 'string') return ''
  return input.toUpperCase().replace(ALPHABET_PATTERN, '').slice(0, ROOM_CODE_LENGTH)
}

/** True when `input` is exactly a well-formed room code. */
export function isValidRoomCode(input: unknown): input is string {
  if (typeof input !== 'string') return false
  return input.length === ROOM_CODE_LENGTH && normalizeRoomCode(input) === input
}
