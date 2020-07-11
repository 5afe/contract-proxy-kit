import { OperationType, zeroAddress, predeterminedSaltNonce, Address, NumberLike } from './utils/constants';
import { defaultNetworks, NetworksConfig } from './utils/networks';
import { joinHexData, getHexDataLength } from './utils/hex-data';
import { Transaction, TransactionResult, ExecOptions, standardizeTransaction, SendOptions, StandardTransaction, normalizeGasLimit, TransactionError, NormalizeGas } from './utils/transactions';
import EthLibAdapter, { Contract } from './eth-lib-adapters/EthLibAdapter';
import cpkFactoryAbi from './abis/CpkFactoryAbi.json';
import safeAbi from './abis/SafeAbi.json';
import multiSendAbi from './abis/MultiSendAbi.json';

interface CPKConfig {
  ethLibAdapter: EthLibAdapter;
  ownerAccount?: string;
  networks?: NetworksConfig;
}

interface ContractTxObj {
  contract: Contract;
  methodName: string;
  params: any[];
}

class CPK {
  static Call = OperationType.Call;
  static DelegateCall = OperationType.DelegateCall;

  ethLibAdapter: EthLibAdapter;
  ownerAccount?: Address;
  networks: NetworksConfig;
  multiSend?: Contract;
  contract?: Contract;
  proxyFactory?: Contract;
  masterCopyAddress?: Address;
  fallbackHandlerAddress?: Address;
  isConnectedToSafe = false;
  
  static async create(opts: CPKConfig): Promise<CPK> {
    if (!opts) throw new Error('missing options');
    const cpk = new CPK(opts);
    await cpk.init();
    return cpk;
  }
  
  constructor({
    ethLibAdapter,
    ownerAccount,
    networks,
  }: CPKConfig) {
    if (!ethLibAdapter) {
      throw new Error('ethLibAdapter property missing from options');
    }
    this.ethLibAdapter = ethLibAdapter;
    
    this.setOwnerAccount(ownerAccount);
    this.networks = {
      ...defaultNetworks,
      ...networks,
    };
  }

  async init(): Promise<void> {
    const networkId = await this.ethLibAdapter.getNetworkId();
    const network = this.networks[networkId];

    if (!network) {
      throw new Error(`unrecognized network ID ${networkId}`);
    }

    this.masterCopyAddress = network.masterCopyAddress;
    this.fallbackHandlerAddress = network.fallbackHandlerAddress;

    const ownerAccount = await this.getOwnerAccount();

    const provider = this.ethLibAdapter.getProvider();
    const wc = provider && (provider.wc || (provider.connection && provider.connection.wc));
    if (
      wc && wc.peerMeta && wc.peerMeta.name
      && wc.peerMeta.name.startsWith('Gnosis Safe')
    ) {
      this.isConnectedToSafe = true;
    }

    this.multiSend = this.ethLibAdapter.getContract(multiSendAbi, network.multiSendAddress);

    if (this.isConnectedToSafe) {
      this.contract = this.ethLibAdapter.getContract(safeAbi, ownerAccount);
    } else {
      this.proxyFactory = this.ethLibAdapter.getContract(
        cpkFactoryAbi,
        network.proxyFactoryAddress,
      );

      const salt = this.ethLibAdapter.keccak256(this.ethLibAdapter.abiEncode(
        ['address', 'uint256'],
        [ownerAccount, predeterminedSaltNonce],
      ));
      const initCode = this.ethLibAdapter.abiEncodePacked(
        { type: 'bytes', value: await this.proxyFactory.call('proxyCreationCode', []) },
        {
          type: 'bytes',
          value: this.ethLibAdapter.abiEncode(['address'], [network.masterCopyAddress]),
        },
      );
      const proxyAddress = this.ethLibAdapter.calcCreate2Address(
        this.proxyFactory.address,
        salt,
        initCode
      );

      this.contract = this.ethLibAdapter.getContract(safeAbi, proxyAddress);
    }
  }

  async getOwnerAccount(): Promise<Address> {
    if (this.ownerAccount) return this.ownerAccount;
    return this.ethLibAdapter.getAccount();
  }

  setOwnerAccount(ownerAccount?: Address): void {
    this.ownerAccount = ownerAccount;
  }

  get address(): Address {
    if (!this.contract) {
      throw new Error('CPK uninitialized');
    }
    return this.contract.address;
  }

  encodeMultiSendCallData(transactions: Transaction[]): string {
    const multiSend = this.multiSend || this.ethLibAdapter.getContract(multiSendAbi);

    const standardizedTxs = transactions.map(standardizeTransaction);

    return multiSend.encode('multiSend', [
      joinHexData(standardizedTxs.map((tx) => this.ethLibAdapter.abiEncodePacked(
        { type: 'uint8', value: tx.operation },
        { type: 'address', value: tx.to },
        { type: 'uint256', value: tx.value },
        { type: 'uint256', value: getHexDataLength(tx.data) },
        { type: 'bytes', value: tx.data },
      ))),
    ]);
  }

  async execTransactions(
    transactions: Transaction[],
    options?: ExecOptions,
  ): Promise<TransactionResult> {
    const ownerAccount = await this.getOwnerAccount();
    const sendOptions = normalizeGasLimit({ ...options, from: ownerAccount });

    if (this.isConnectedToSafe) {
      return this.execTxsWhileConnectedToSafe(transactions, sendOptions);
    }

    const safeExecTxParams = this.getSafeExecTxParams(transactions);

    const codeAtAddress = await this.ethLibAdapter.getCode(this.address);
    const isDeployed = codeAtAddress !== '0x';

    const txObj = isDeployed
      ? this.getSafeProxyTxObj(safeExecTxParams, ownerAccount)
      : this.getCPKFactoryTxObj(safeExecTxParams);

    const { success, gasLimit } = await this.findGasLimit(txObj, sendOptions);

    if (success) {
      const { contract, methodName, params } = txObj;
      sendOptions.gas = gasLimit;
      return contract.send(methodName, params, sendOptions);
    } else {
      throw await this.makeTransactionError(
        safeExecTxParams,
        gasLimit,
        isDeployed,
        transactions.length === 1,
      );
    }
  }

  private async execTxsWhileConnectedToSafe(
    transactions: Transaction[],
    sendOptions: SendOptions,
  ): Promise<TransactionResult> {
    if (
      transactions.length === 1 &&
      (!transactions[0].operation || transactions[0].operation === CPK.Call)
    ) {
      const { to, value, data } = transactions[0];
      return this.ethLibAdapter.ethSendTransaction({
        to, value, data,
        ...sendOptions,
      });
    } else {
      if (transactions.some(
        ({ operation }) => operation === OperationType.DelegateCall
      )) {
        throw new Error('DelegateCall unsupported by WalletConnected Safe');
      }

      return {
        hash: await this.ethLibAdapter.providerSend(
          'gs_multi_send',
          transactions.map(
            ({ to, value, data }) => ({ to, value, data }),
          ),
        ),
      };
    }
  }

  private getSafeExecTxParams(transactions: Transaction[]): StandardTransaction {
    if (transactions.length === 1) {
      return standardizeTransaction(transactions[0]);
    } else {
      if (!this.multiSend) {
        throw new Error('CPK MultiSend uninitialized');
      }
      return {
        to: this.multiSend.address,
        value: 0,
        data: this.encodeMultiSendCallData(transactions),
        operation: CPK.DelegateCall,
      };
    }
  }

  private getSafeProxyTxObj(
    { to, value, data, operation }: StandardTransaction,
    ownerAccount: Address
  ): ContractTxObj {
    if (!this.contract) {
      throw new Error('CPK uninitialized');
    }
    // (r, s, v) where v is 1 means this signature is approved by
    // the address encoded in the value r
    // "Hashes are automatically approved by the sender of the message"
    const safeAutoApprovedSignature = this.ethLibAdapter.abiEncodePacked(
      { type: 'uint256', value: ownerAccount },
      { type: 'uint256', value: 0 },
      { type: 'uint8', value: 1 },
    );

    return {
      contract: this.contract,
      methodName: 'execTransaction',
      params: [
        to, value, data, operation,
        0, 0, 0, zeroAddress, zeroAddress,
        safeAutoApprovedSignature,
      ],
    };
  }

  private getCPKFactoryTxObj(
    { to, value, data, operation }: StandardTransaction,
  ): ContractTxObj {
    if (!this.proxyFactory) {
      throw new Error('CPK factory uninitialized');
    }

    return {
      contract: this.proxyFactory,
      methodName: 'createProxyAndExecTransaction',
      params: [
        this.masterCopyAddress,
        predeterminedSaltNonce,
        this.fallbackHandlerAddress,
        to,
        value,
        data,
        operation,
      ],
    };
  }

  private async findGasLimit(
    { contract, methodName, params }: ContractTxObj,
    sendOptions: NormalizeGas<SendOptions>,
  ): Promise<{ success: boolean; gasLimit: number }> {
    async function checkOptions(options: NormalizeGas<SendOptions>): Promise<boolean> {
      try {
        return await contract.call(methodName, params, options);
      } catch (e) {
        return false;
      }
    }

    const toNumber = (num: NumberLike): number => Number(num.toString());
    if (!sendOptions.gas) {
      const blockGasLimit = toNumber((await this.ethLibAdapter.getBlock('latest')).gasLimit);
      
      const gasEstimateOptions = { ...sendOptions, gas: blockGasLimit };
      if (!(await checkOptions(gasEstimateOptions))) {
        return { success: false, gasLimit: blockGasLimit };
      }
      
      const gasSearchError = 10000;
      let gasLow = await contract.estimateGas(methodName, params, sendOptions);
      let gasHigh = blockGasLimit;
  
      gasEstimateOptions.gas = gasLow;
  
      if (!(await checkOptions(gasEstimateOptions))) {
        while (gasLow + gasSearchError <= gasHigh) {
          const testGasLimit = Math.floor((gasLow + gasHigh) * 0.5);
          gasEstimateOptions.gas = testGasLimit;
  
          if (await checkOptions(gasEstimateOptions)) {
            // values > gasHigh will work
            gasHigh = testGasLimit - 1;
          } else {
            // values <= gasLow will work
            gasLow = testGasLimit + 1;
          }
        }
        // the final target gas value is in the interval [gasLow, gasHigh)
      }

      const gasLimit = Math.min(Math.ceil((gasHigh + 1) * 1.1), blockGasLimit);

      return { success: true, gasLimit };
    }

    return {
      success: await checkOptions(sendOptions),
      gasLimit: toNumber(sendOptions.gas),
    };
  }

  private async makeTransactionError(
    { to, value, data, operation }: StandardTransaction,
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
        revertData = await this.ethLibAdapter.getCallRevertData({
          from: this.address, to, value, data, gasLimit,
        }, 'latest');
        revertMessage = this.ethLibAdapter.decodeError(revertData);
        errorMessage = `${errorMessage}: ${ revertMessage }`;
      } catch (e) {
        // empty
      }
    }
    return new TransactionError(errorMessage, revertData, revertMessage);
  }
}

export default CPK;
