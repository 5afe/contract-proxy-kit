import safeAbi from '../abis/SafeAbi.json';
import CPKProvider from '../providers/CPKProvider';
import { OperationType } from './constants';

export const estimateSafeTxGas = async (
  cpkProvider: CPKProvider,
  safeAddress: string,
  data: string,
  to: string,
  value: number | string,
  operation: OperationType,
): Promise<number> => {
  let safeTxGas;

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

  // Multiply by (64/63)^10 to ensure calls up to 10 deep in stack
  // See: https://eips.ethereum.org/EIPS/eip-150
  // Add at least 10k, so smaller deeper calls can be made
  const additionalGas = Math.max(
    10000,
    Math.floor(0.17056152512 * safeTxGas),
  );
  safeTxGas += additionalGas;

  return safeTxGas;
};

module.exports = { estimateSafeTxGas };
