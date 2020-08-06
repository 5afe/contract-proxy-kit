import { NumberLike } from './basicTypes'

export function joinHexData(hexData: string[]): string {
  return `0x${hexData
    .map((hex) => {
      const stripped = hex.replace(/^0x/, '')
      return stripped.length % 2 === 0 ? stripped : '0' + stripped
    })
    .join('')}`
}

export function getHexDataLength(hexData: string): number {
  return Math.ceil((hexData.startsWith('0x') ? hexData.length - 2 : hexData.length) / 2)
}

export function toHex(v: NumberLike): string {
  return `0x${Number(v.toString()).toString(16)}`
}
