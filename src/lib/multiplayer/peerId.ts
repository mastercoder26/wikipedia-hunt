export const PEER_PREFIX = 'wikidash-'

export function peerIdFor(code: string): string {
  return `${PEER_PREFIX}${code}`
}
