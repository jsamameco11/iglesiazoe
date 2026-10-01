export function rootCellCode(network: string, number: number) {
  return `${String(number).padStart(2, "0")}${network.toUpperCase()}`;
}

/** 0106G = primera célula hija de 06G. */
export function daughterCellCode(parentCode: string, daughterNumber: number) {
  return `${String(daughterNumber).padStart(2, "0")}${parentCode.toUpperCase()}`;
}
