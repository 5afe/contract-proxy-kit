const safeAbi = require('../abis/SafeAbi.json');

const estimateSafeTxGas = async (
  cpkProvider,
  safeAddress,
  data,
  to,
  value,
  operation,
) => {
  let safeTxGas;
  let additionalGas = 10000;

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

  const estimateResponse = await cpkProvider.getCallRevertData({
    from: safeAddress,
    to: safeAddress,
    data: estimateData,
  });

  safeTxGas = parseInt(estimateResponse.substring(138), 16);

  // Add 10k else we will fail in case of nested calls
  safeTxGas += additionalGas;

  const baseGasEstimate = 6000 + 1500 + 1000 + 32000;

  for (let i = 0; i < 100; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const estimateResponse = await cpkProvider.getCallRevertData({
      to: safeAddress,
      from: safeAddress,
      data: estimateData,
      gasLimit: safeTxGas + baseGasEstimate,
    });

    if (estimateResponse !== '0x') {
      break;
    }

    safeTxGas += additionalGas;
    additionalGas *= 2;
  }

  return { safeTxGas, baseGas: baseGasEstimate };
};

module.exports = { estimateSafeTxGas };
