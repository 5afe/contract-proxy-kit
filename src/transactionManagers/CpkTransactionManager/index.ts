import EthLibAdapter, { Contract } from '../../ethLibAdapters/EthLibAdapter'
import { Address, NumberLike } from '../../utils/basicTypes'
import { defaultTxData, sentinelOwner, zeroAddress } from '../../utils/constants'
import {
  NormalizeGas,
  OperationType,
  SendOptions,
  SimpleTransactionResult,
  StandardTransaction,
  Transaction,
  TransactionError,
  TransactionResult,
  TxReaction
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
  get config(): TransactionManagerConfig {
    return {
      name: TransactionManagerNames.CpkTransactionManager,
      url: undefined
    }
  }

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

    let txObj
    if (isDeployed) {
      txObj = this.getSafeProxyTxObj(
        safeContract,
        safeExecTxParams,
        this.makeAutoApprovedSignature(ethLibAdapter, ownerAccount),
      );
    } else {
      if (!proxyFactory) {
        throw new Error('missing proxy factory for undeployed transactions');
      }
      txObj = this.getCPKFactoryTxObj(
        ownerAccount,
        masterCopyAddress,
        saltNonce,
        fallbackHandlerAddress,
        safeExecTxParams,
        this.makeAutoApprovedSignature(ethLibAdapter, ownerAccount),
        this.makeAutoApprovedSignature(ethLibAdapter, proxyFactory.address),
        proxyFactory,
        safeContract,
      );
    }

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
    transactions: Transaction[],
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
    ownerAccount: Address,
    masterCopyAddress: Address,
    salt: string,
    fallbackHandlerAddress: Address,
    transaction: StandardTransaction,
    safeOwnerApprovedSignature: string,
    safeFactoryApprovedSignature: string,
    proxyFactory: Contract,
    safeContract: Contract,
  ): ContractTxObj {
    const execTxObj = this.getSafeProxyTxObj(safeContract, transaction, safeFactoryApprovedSignature);
    const swapTxObj = this.getSafeProxyTxObj(
      safeContract,
      {
        to: safeContract.address,
        value: 0,
        data: safeContract.encode('swapOwner', [
          sentinelOwner,
          proxyFactory.address,
          ownerAccount,
        ]),
        operation: OperationType.Call,
      },
      safeFactoryApprovedSignature,
    );
    const txs = [
      {
        // setup new Safe with the factory as the owner
        value: 0,
        data: safeContract.encode('setup', [
          [proxyFactory.address], // address[] owners
          1, // uint256 threshold
          zeroAddress, // address to
          defaultTxData, // bytes data
          fallbackHandlerAddress, // address fallbackHandler
          zeroAddress, // address paymentToken
          0, // uint256 payment
          zeroAddress, // address payable paymentReceiver
        ]),
        reaction: TxReaction.IgnoreReturn,
      },
      {
        // execute first transactions with the factory
        value: transaction.value,
        data: execTxObj.contract.encode(execTxObj.methodName, execTxObj.params),
        reaction: TxReaction.CaptureBoolReturn,
      },
      {
        // change the owner of the Safe from the factory to the owner account
        value: 0,
        data: swapTxObj.contract.encode(swapTxObj.methodName, swapTxObj.params),
        reaction: TxReaction.RevertOnReturnFalse,
      },
    ]
    return {
      contract: proxyFactory,
      methodName: 'createProxyAndExecTransactions',
      params: [
        ownerAccount,
        masterCopyAddress,
        salt,
        txs,
        safeOwnerApprovedSignature,
      ]
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

  private makeAutoApprovedSignature(
    ethLibAdapter: EthLibAdapter,
    msgSender: Address
  ): string {
    // (r, s, v) where v is 1 means this signature is approved by the address encoded in value r
    // "Hashes are automatically approved by the sender of the message"
    return ethLibAdapter.abiEncodePacked(
      { type: 'uint256', value: msgSender }, // r
      { type: 'uint256', value: 0 }, // s
      { type: 'uint8', value: 1 } // v
    )
  }
}

export default CpkTransactionManager
