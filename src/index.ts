import { OperationType, zeroAddress, predeterminedSaltNonce } from './utils/constants';
import { defaultNetworks, NetworksConfig } from './utils/networks';
import { standardizeTransactions, SafeProviderSendTransaction, Transaction } from './utils/transactions';
import EthLibAdapter, { Contract, Address, TransactionResult } from './eth-lib-adapters/EthLibAdapter';

interface CPKConfig {
  ethLibAdapter: EthLibAdapter;
  ownerAccount?: string;
  networks?: NetworksConfig;
}

class CPK {
  static Call = OperationType.Call;
  static DelegateCall = OperationType.DelegateCall;

  ethLibAdapter: EthLibAdapter;
  ownerAccount?: Address;
  networks: NetworksConfig;
  multiSend: Contract;
  contract: Contract;
  viewContract: Contract;
  proxyFactory: Contract;
  viewProxyFactory: Contract;
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
      ...(networks || {}),
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

    const initializedCpkProvider = await this.ethLibAdapter.init({
      isConnectedToSafe: this.isConnectedToSafe,
      ownerAccount,
      masterCopyAddress: network.masterCopyAddress,
      proxyFactoryAddress: network.proxyFactoryAddress,
      multiSendAddress: network.multiSendAddress,
    });

    this.multiSend = initializedCpkProvider.multiSend;
    this.contract = initializedCpkProvider.contract;
    this.viewContract = initializedCpkProvider.viewContract;
    this.proxyFactory = initializedCpkProvider.proxyFactory;
    this.viewProxyFactory = initializedCpkProvider.viewProxyFactory;
  }

  async getOwnerAccount(): Promise<Address> {
    if (this.ownerAccount) return this.ownerAccount;
    return this.ethLibAdapter.getOwnerAccount();
  }

  setOwnerAccount(ownerAccount?: Address): void {
    this.ownerAccount = ownerAccount;
  }

  get address(): Address {
    return this.ethLibAdapter.getContractAddress(this.contract);
  }

  async execTransactions(
    transactions: Transaction[],
    options?: {
      gasLimit?: number | string;
      gas?: number | string;
    }
  ): Promise<TransactionResult> {
    const signatureForAddress = (address: string): string => `0x000000000000000000000000${
      address.replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;

    const ownerAccount = await this.getOwnerAccount();
    const codeAtAddress = await this.ethLibAdapter.getCode(this.address);
    let gasLimit = options && (options.gasLimit || options.gas);
    const sendOptions = await this.ethLibAdapter.getSendOptions(ownerAccount, options);

    const standardizedTxs = standardizeTransactions(transactions);

    if (this.isConnectedToSafe) {
      const connectedSafeTxs: SafeProviderSendTransaction[] = standardizedTxs.map(
        ({ to, value, data }) => ({ to, value, data }),
      );

      if (standardizedTxs.length === 1 && standardizedTxs[0].operation === CPK.Call) {
        return this.ethLibAdapter.attemptSafeProviderSendTx(connectedSafeTxs[0], sendOptions);
      } else {
        // NOTE: DelegateCalls get converted to Calls here
        return this.ethLibAdapter.attemptSafeProviderMultiSendTxs(connectedSafeTxs);
      }
    } else {
      let to, value, data, operation;
      let tryToGetRevertMessage = false;
      let txFailErrorMessage = 'transaction execution expected to fail';

      if (standardizedTxs.length === 1) {
        ({
          to, value, data, operation,
        } = standardizedTxs[0]);

        tryToGetRevertMessage = operation === OperationType.Call;
      } else {
        to = this.ethLibAdapter.getContractAddress(this.multiSend);
        value = 0;
        data = this.ethLibAdapter.encodeMultiSendCallData(standardizedTxs);
        operation = CPK.DelegateCall;
        txFailErrorMessage = `batch ${txFailErrorMessage}`;
      }

      let targetContract, targetViewContract, execMethodName, execParams;
      if (codeAtAddress !== '0x') {
        targetContract = this.contract;
        targetViewContract = this.viewContract;
        execMethodName = 'execTransaction';
        execParams = [
          to, value, data, operation,
          0, 0, 0, zeroAddress, zeroAddress,
          signatureForAddress(ownerAccount),
        ];
      } else {
        txFailErrorMessage = `proxy creation and ${txFailErrorMessage}`;
        targetContract = this.proxyFactory;
        targetViewContract = this.viewProxyFactory;
        execMethodName = 'createProxyAndExecTransaction';
        execParams = [
          this.masterCopyAddress,
          predeterminedSaltNonce,
          this.fallbackHandlerAddress,
          this.ethLibAdapter.getContractAddress(this.multiSend),
          0,
          this.ethLibAdapter.encodeMultiSendCallData(transactions),
          CPK.DelegateCall,
        ];
      }

      gasLimit = await this.ethLibAdapter.findSuccessfulGasLimit(
        targetContract,
        targetViewContract,
        execMethodName,
        execParams,
        sendOptions,
        gasLimit,
      );

      if (gasLimit == null) {
        // no limit will result in a successful execution
        if (tryToGetRevertMessage) {
          try {
            const revertData = await this.ethLibAdapter.getCallRevertData({
              from: this.address, to, value, data, gasLimit: 6000000,
            });
            const errorMessage = this.ethLibAdapter.decodeError(revertData);
            txFailErrorMessage = `${txFailErrorMessage}: ${ errorMessage }`;
          } catch (e) {
            // empty
          }
        }
        throw new Error(txFailErrorMessage);
      }

      return this.ethLibAdapter.execMethod(
        targetContract,
        execMethodName,
        execParams,
        { ...sendOptions, gasLimit },
      );
    }
  }
}

export default CPK;
