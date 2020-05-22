import { zeroAddress, predeterminedSaltNonce } from '../../utils/constants';
import TransactionManager, { ExecTransactionProps, TransactionManagerConfig } from '../TransactionManager';
import EthLibAdapter, { Contract } from '../../ethLibAdapters/EthLibAdapter';
import {
  OperationType,
  TransactionResult,
  SendOptions,
  StandardTransaction,
  TransactionError,
  NormalizeGas,
} from '../../utils/transactions';
import { NumberLike, Address } from '../../utils/basicTypes';

interface ContractTxObj {
  contract: Contract;
  methodName: string;
  params: any[];
}

class CpkTransactionManager implements TransactionManager {

  get config(): TransactionManagerConfig {
    return {
      name: 'CpkTransactionManager',
      url: undefined,
    };
  }

  async execTransactions({
    safeExecTxParams,
    signature,
    contracts,
    ethLibAdapter,
    isSingleTx,
    isDeployed,
    sendOptions,
  }: ExecTransactionProps): Promise<TransactionResult> {
    const { safeContract, proxyFactory, masterCopyAddress, fallbackHandlerAddress } = contracts;

    const txObj: ContractTxObj = isDeployed
      ? this.getSafeProxyTxObj(safeContract, safeExecTxParams, signature)
      : this.getCPKFactoryTxObj(
        masterCopyAddress,
        fallbackHandlerAddress,
        safeExecTxParams,
        proxyFactory,
      );

    const { success, gasLimit } = await this.findGasLimit(ethLibAdapter, txObj, sendOptions);
    sendOptions.gas = gasLimit;

    if (!success) {
      throw await this.makeTransactionError(
        ethLibAdapter,
        safeExecTxParams,
        safeContract.address,
        gasLimit,
        isDeployed,
        isSingleTx,
      );
    }

    const { contract, methodName, params } = txObj;

    return contract.send(methodName, params, sendOptions);
  }

  private getSafeProxyTxObj(
    safeContract: Contract,
    { to, value, data, operation }: StandardTransaction,
    safeAutoApprovedSignature: string,
  ): ContractTxObj {
    return {
      contract: safeContract,
      methodName: 'execTransaction',
      params: [
        to, value, data, operation,
        0, 0, 0, zeroAddress, zeroAddress,
        safeAutoApprovedSignature,
      ],
    };
  }

  private getCPKFactoryTxObj(
    masterCopyAddress: Address,
    fallbackHandlerAddress: Address,
    { to, value, data, operation }: StandardTransaction,
    proxyFactory?: Contract,
  ): ContractTxObj {
    if (!proxyFactory) {
      throw new Error('CPK factory uninitialized');
    }

    return {
      contract: proxyFactory,
      methodName: 'createProxyAndExecTransaction',
      params: [
        masterCopyAddress,
        predeterminedSaltNonce,
        fallbackHandlerAddress,
        to,
        value,
        data,
        operation,
      ],
    };
  }

  private async findGasLimit(
    ethLibAdapter: EthLibAdapter,
    { contract, methodName, params }: ContractTxObj,
    sendOptions: NormalizeGas<SendOptions>,
  ): Promise<{ success: boolean; gasLimit: number }> {
    const toNumber = (num: NumberLike): number => Number(num.toString());
    if (!sendOptions.gas) {
      const blockGasLimit = toNumber((await ethLibAdapter.getBlock('latest')).gasLimit);
      const gasEstimateOptions = { ...sendOptions, gas: blockGasLimit };

      if (!(await contract.call(methodName, params, gasEstimateOptions))) {
        return { success: false, gasLimit: blockGasLimit };
      }

      let gasLow = await contract.estimateGas(methodName, params, sendOptions);
      let gasHigh = blockGasLimit;

      gasEstimateOptions.gas = gasLow;

      if (!(await contract.call(methodName, params, gasEstimateOptions))) {
        while (gasLow <= gasHigh) {
          const testGasLimit = Math.floor((gasLow + gasHigh) * 0.5);
          gasEstimateOptions.gas = testGasLimit;
  
          if (await contract.call(methodName, params, gasEstimateOptions)) {
            // values > gasHigh will work
            gasHigh = testGasLimit - 1;
          } else {
            // values <= gasLow will work
            gasLow = testGasLimit + 1;
          }
        }
        // gasLow is now our target gas value
      }

      return { success: true, gasLimit: gasLow };
    }

    return {
      success: await contract.call(methodName, params, sendOptions),
      gasLimit: toNumber(sendOptions.gas),
    };
  }

  private async makeTransactionError(
    ethLibAdapter: EthLibAdapter,
    { to, value, data, operation }: StandardTransaction,
    safeAddress: Address,
    gasLimit: number,
    isDeployed: boolean,
    isSingleTx: boolean,
  ): Promise<Error> {
    let errorMessage = `${
      isDeployed ? '' : 'proxy creation and '
    }${
      isSingleTx ? 'transaction' : 'batch transaction'
    } execution expected to fail`;

    let revertData, revertMessage;
    if (isSingleTx && operation === OperationType.Call) {
      try {
        revertData = await ethLibAdapter.getCallRevertData({
          from: safeAddress, to, value, data, gasLimit,
        }, 'latest');
        revertMessage = ethLibAdapter.decodeError(revertData);
        errorMessage = `${errorMessage}: ${ revertMessage }`;
      } catch (e) {
        // empty
      }
    }
    return new TransactionError(errorMessage, revertData, revertMessage);
  }
}

export default CpkTransactionManager;
