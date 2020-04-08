const { BigNumber } = require('bignumber.js');
const safeAbi = require('../abis/SafeAbi.json');
const { zeroAddress } = require('./constants');

const baseGasValue = (hexValue) => {
  switch (hexValue) {
  case '0x': return 0;
  case '00': return 4;
  default: return 68;
  }
};

const estimateBaseGasCosts = (dataString) => {
  // eslint-disable-next-line
  const reducer = (accumulator, currentValue) => accumulator += baseGasValue(currentValue);
  return dataString.match(/.{2}/g).reduce(reducer, 0);
};

const estimateBaseGas = async (
  cpkProvider,
  to,
  value,
  data,
  operation,
  txGasEstimate,
  gasToken,
  refundReceiver,
  signatureCount,
  nonce,
  gasPrice,
) => {
  // (array count (3 -> r, s, v) + ecrecover costs) * signature count
  const signatureCost = signatureCount * (68 + 2176 + 2176 + 6000);

  const payload = cpkProvider.encodeAttemptTransaction(
    safeAbi,
    'execTransaction',
    [
      to,
      value,
      data,
      operation,
      txGasEstimate,
      0,
      gasPrice,
      gasToken,
      refundReceiver,
      '0x',
    ],
  );

  let baseGasEstimate = estimateBaseGasCosts(payload) + signatureCost + (nonce > 0 ? 5000 : 20000);
  baseGasEstimate += 1500; // 1500 -> hash generation costs
  baseGasEstimate += 1000; // 1000 -> Event emission
  return baseGasEstimate + 32000; // Add aditional gas costs (e.g. base tx costs, transfer costs)
};

const estimateSafeTxGas = async (
  cpkProvider,
  safeAddress,
  signatureCount,
  data,
  to,
  value,
  operation,
) => {
  let txGasEstimate;
  let additionalGas = 10000;
  const txGasToken = zeroAddress;
  const refundReceiver = zeroAddress;
  
  const gasPrice = await cpkProvider.getGasPrice();
  const nonce = await cpkProvider.getSafeNonce(safeAddress);
  const estimateData = cpkProvider.encodeAttemptTransaction(
    safeAbi,
    'requiredTxGas',
    [
      to,
      value,
      data,
      operation,
    ],
  );

  try {
    const estimateResponse = await cpkProvider.checkSingleCall({
      from: safeAddress,
      to: safeAddress,
      data: estimateData,
    });
    txGasEstimate = new BigNumber(estimateResponse.substring(138), 16);

    // Add 10k else we will fail in case of nested calls
    txGasEstimate = txGasEstimate.toNumber() + additionalGas;
  } catch (error) {
    console.error('Error calculating tx gas estimation', error);
  }

  const baseGasEstimate = await estimateBaseGas(
    cpkProvider,
    to,
    value,
    data,
    operation,
    txGasEstimate,
    txGasToken,
    refundReceiver,
    signatureCount,
    nonce,
    gasPrice,
  );

  for (let i = 0; i < 100; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const estimateResponse = await cpkProvider.checkSingleCall({
        to: safeAddress,
        from: safeAddress,
        data: estimateData,
        gasLimit: txGasEstimate + baseGasEstimate + 32000,
      });

      if (estimateResponse !== '0x') {
        break;
      }
    } catch (error) {
      console.error('Error calculating tx gas estimation', error);
    }
    txGasEstimate += additionalGas;
    additionalGas *= 2;
  }

  return { safeTxGas: txGasEstimate, baseGas: baseGasEstimate };
};

module.exports = { estimateSafeTxGas };
