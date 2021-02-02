import BigNumber from "bignumber.js"

export const formatBalance = (balance: BigNumber | undefined): string => {
  if (!balance) {
    return '0 ETH'
  }
  const ethDecimals = new BigNumber(10).pow(18)
  return balance.div(ethDecimals).decimalPlaces(7).toString() + ' ETH'
}
