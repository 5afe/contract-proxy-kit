const { BigNumber } = require('bignumber.js');
const safeAbi = require('../abis/SafeAbi.json');

const estimateSafeTxGas = async (
  cpkProvider,
  safeAddress,
  data,
  to,
  value,
  operation,
) => {
  try {
    const safe = cpkProvider.getContract(safeAbi, safeAddress);

    let estimateData;
    if (cpkProvider.web3) {
      estimateData = safe.methods.requiredTxGas(to, value, data, operation).encodeABI();
    } else if (cpkProvider.ethers && cpkProvider.signer) {
      estimateData = await safe.requiredTxGas(to, value, data, operation);
    }

    const estimateResponse = await cpkProvider.checkSingleCall({
      from: safeAddress,
      to: safeAddress,
      data: estimateData,
    });

    const txGasEstimate = new BigNumber(estimateResponse.substring(138), 16);

    // Add 10k else we will fail in case of nested calls
    const safeTxGas = txGasEstimate.toNumber() + 10000;

    return safeTxGas;
  } catch (error) {
    console.error('Error calculating tx gas estimation', error);
    return 0;
  }
};

module.exports = { estimateSafeTxGas };
