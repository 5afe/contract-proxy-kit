import EthLibAdapter, { Contract } from '../../ethLibAdapters/EthLibAdapter'
import { Address, NumberLike } from '../../utils/basicTypes'
import { zeroAddress } from '../../utils/constants'
import {
  NormalizeGas,
  OperationType,
  SendOptions,
  SimpleTransactionResult,
  StandardTransaction,
  TransactionError,
  TransactionResult
} from '../../utils/transactions'
import TransactionManager, {
  ExecTransactionProps,
  TransactionManagerConfig,
  TransactionManagerNames
} from '../TransactionManager'

interface ContractTxObj {
  contract: Contract
  methodName: string
  params: any[]
}

class CpkTransactionManager implements TransactionManager {
  /**
   * Returns the configuration of the CpkTransactionManager.
   *
   * @returns The name of the TransactionManager in use and the URL of the service
   */
  get config(): TransactionManagerConfig {
    return {
      name: TransactionManagerNames.CpkTransactionManager,
      url: undefined
    }
  }

  /**
   * Executes a list of transactions.
   *
   * @param options
   * @returns The transaction response
   */
  async execTransactions({
    ownerAccount,
    safeExecTxParams,
    transactions,
    ethLibAdapter,
    contractManager,
    saltNonce,
    isDeployed,
    isConnectedToSafe,
    sendOptions
  }: ExecTransactionProps): Promise<TransactionResult> {
    const {
      contract: safeContract,
      proxyFactory,
      masterCopyAddress,
      fallbackHandlerAddress
    } = contractManager
    if (!safeContract) {
      throw new Error('CPK Proxy contract uninitialized')
    }

    if (isConnectedToSafe) {
      return this.execTxsWhileConnectedToSafe(ethLibAdapter, transactions, sendOptions)
    }

    // (r, s, v) where v is 1 means this signature is approved by the address encoded in value r
    // "Hashes are automatically approved by the sender of the message"
    const autoApprovedSignature = ethLibAdapter.abiEncodePacked(
      { type: 'uint256', value: ownerAccount }, // r
      { type: 'uint256', value: 0 }, // s
      { type: 'uint8', value: 1 } // v
    )

    const txObj: ContractTxObj = isDeployed
      ? this.getSafeProxyTxObj(safeContract, safeExecTxParams, autoApprovedSignature)
      : this.getCPKFactoryTxObj(
          masterCopyAddress,
          fallbackHandlerAddress,
          safeExecTxParams,
          saltNonce,
          proxyFactory
        )

    const { success, gasLimit } = await this.findGasLimit(ethLibAdapter, txObj, sendOptions)
    sendOptions.gas = gasLimit
    const isSingleTx = transactions.length === 1

    if (!success) {
      throw await this.makeTransactionError(
        ethLibAdapter,
        safeExecTxParams,
        safeContract.address,
        gasLimit,
        isDeployed,
        isSingleTx
      )
    }

    const { contract, methodName, params } = txObj

    return contract.send(methodName, params, sendOptions)
  }

  private async execTxsWhileConnectedToSafe(
    ethLibAdapter: EthLibAdapter,
    transactions: StandardTransaction[],
    sendOptions: SendOptions
  ): Promise<SimpleTransactionResult> {
    if (transactions.some(({ operation }) => operation === OperationType.DelegateCall)) {
      throw new Error('DelegateCall unsupported by Gnosis Safe')
    }

    if (transactions.length === 1) {
      const { to, value, data } = transactions[0]
      return ethLibAdapter.ethSendTransaction({
        to,
        value,
        data,
        ...sendOptions
      })
    }

    return {
      hash: await ethLibAdapter.providerSend(
        'gs_multi_send',
        transactions.map(({ to, value, data }) => ({ to, value, data }))
      )
    }
  }

  private getSafeProxyTxObj(
    safeContract: Contract,
    { to, value, data, operation }: StandardTransaction,
    safeAutoApprovedSignature: string
  ): ContractTxObj {
    return {
      contract: safeContract,
      methodName: 'execTransaction',
      params: [
        to,
        value,
        data,
        operation,
        0,
        0,
        0,
        zeroAddress,
        zeroAddress,
        safeAutoApprovedSignature
      ]
    }
  }

  private getCPKFactoryTxObj(
    masterCopyAddress: Address,
    fallbackHandlerAddress: Address,
    { to, value, data, operation }: StandardTransaction,
    saltNonce: string,
    proxyFactory: Contract
  ): ContractTxObj {
    return {
      contract: proxyFactory,
      methodName: 'createProxyAndExecTransaction',
      params: [masterCopyAddress, saltNonce, fallbackHandlerAddress, to, value, data, operation]
    }
  }

  private async findGasLimit(
    ethLibAdapter: EthLibAdapter,
    { contract, methodName, params }: ContractTxObj,
    sendOptions: NormalizeGas<SendOptions>
  ): Promise<{ success: boolean; gasLimit: number }> {
    async function checkOptions(options: NormalizeGas<SendOptions>): Promise<boolean> {
      try {
        return await contract.call(methodName, params, options)
      } catch (e) {
        return false
      }
    }

    const toNumber = (num: NumberLike): number => Number(num.toString())
    if (!sendOptions.gas) {
      const blockGasLimit = toNumber((await ethLibAdapter.getBlock('latest')).gasLimit)

      const gasEstimateOptions = { ...sendOptions, gas: blockGasLimit }
      if (!(await checkOptions(gasEstimateOptions))) {
        return { success: false, gasLimit: blockGasLimit }
      }

      const gasSearchError = 10000
      let gasLow = await contract.estimateGas(methodName, params, sendOptions)
      let gasHigh = blockGasLimit

      gasEstimateOptions.gas = gasLow

      if (!(await checkOptions(gasEstimateOptions))) {
        while (gasLow + gasSearchError <= gasHigh) {
          const testGasLimit = Math.floor((gasLow + gasHigh) * 0.5)
          gasEstimateOptions.gas = testGasLimit

          if (await checkOptions(gasEstimateOptions)) {
            // values > gasHigh will work
            gasHigh = testGasLimit - 1
          } else {
            // values <= gasLow will fail
            gasLow = testGasLimit + 1
          }
        }
      } else {
        gasHigh = gasLow - 1
      }
      // the final target gas value is > gasHigh

      const gasLimit = Math.min(Math.ceil((gasHigh + 1) * 1.02), blockGasLimit)

      return { success: true, gasLimit }
    }

    return {
      success: await checkOptions(sendOptions),
      gasLimit: toNumber(sendOptions.gas)
    }
  }

  private async makeTransactionError(
    ethLibAdapter: EthLibAdapter,
    { to, value, data, operation }: StandardTransaction,
    safeAddress: Address,
    gasLimit: number,
    isDeployed: boolean,
    isSingleTx: boolean
  ): Promise<Error> {
    let errorMessage = `${isDeployed ? '' : 'proxy creation and '}${
      isSingleTx ? 'transaction' : 'batch transaction'
    } execution expected to fail`

    let revertData, revertMessage
    if (isSingleTx && operation === OperationType.Call) {
      try {
        revertData = await ethLibAdapter.getCallRevertData(
          {
            from: safeAddress,
            to,
            value,
            data,
            gasLimit
          },
          'latest'
        )
        revertMessage = ethLibAdapter.decodeError(revertData)
        errorMessage = `${errorMessage}: ${revertMessage}`
      } catch (e) {
        // empty
      }
    }
    return new TransactionError(errorMessage, revertData, revertMessage)
  }
}

export default CpkTransactionManager
