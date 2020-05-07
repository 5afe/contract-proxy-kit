import { OperationType, zeroAddress, predeterminedSaltNonce } from './utils/constants';
import { defaultNetworks, NetworksConfig } from './utils/networks';
import { standardizeTransactions, SafeProviderSendTransaction, NonStandardTransaction } from './utils/transactions';
import CPKProvider from './providers/CPKProvider';

interface CPKConfig {
  cpkProvider: CPKProvider;
  ownerAccount?: string;
  networks?: NetworksConfig;
}

class CPK {
  static Call = OperationType.Call;
  static DelegateCall = OperationType.DelegateCall;

  cpkProvider: CPKProvider;
  ownerAccount?: string;
  networks: NetworksConfig;
  multiSend: any;
  contract: any;
  viewContract: any;
  proxyFactory: any;
  viewProxyFactory: any;
  masterCopyAddress?: string;
  fallbackHandlerAddress?: string;
  isConnectedToSafe = false;
  
  static async create(opts: CPKConfig): Promise<CPK> {
    if (!opts) throw new Error('missing options');
    const cpk = new CPK(opts);
    await cpk.init();
    return cpk;
  }
  
  constructor({
    cpkProvider,
    ownerAccount,
    networks,
  }: CPKConfig) {
    if (!cpkProvider) {
      throw new Error('cpkProvider property missing from options');
    }
    this.cpkProvider = cpkProvider;
    
    this.setOwnerAccount(ownerAccount);
    this.networks = {
      ...defaultNetworks,
      ...(networks || {}),
    };
  }

  async init(): Promise<void> {
    const networkId = await this.cpkProvider.getNetworkId();
    const network = this.networks[networkId];

    if (!network) {
      throw new Error(`unrecognized network ID ${networkId}`);
    }

    this.masterCopyAddress = network.masterCopyAddress;
    this.fallbackHandlerAddress = network.fallbackHandlerAddress;

    const ownerAccount = await this.getOwnerAccount();

    const provider = this.cpkProvider.getProvider();
    const wc = provider && (provider.wc || (provider.connection && provider.connection.wc));
    if (
      wc && wc.peerMeta && wc.peerMeta.name
      && wc.peerMeta.name.startsWith('Gnosis Safe')
    ) {
      this.isConnectedToSafe = true;
    }

    const initializedCpkProvider = await this.cpkProvider.init({
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

  async getOwnerAccount(): Promise<string> {
    if (this.ownerAccount) return this.ownerAccount;
    return this.cpkProvider.getOwnerAccount();
  }

  setOwnerAccount(ownerAccount?: string): void {
    this.ownerAccount = ownerAccount;
  }

  get address(): string {
    return this.cpkProvider.getContractAddress(this.contract);
  }

  async execTransactions(
    transactions: NonStandardTransaction[],
    options?: {
      gasLimit?: number | string;
      gas?: number | string;
    }
  ): Promise<any> {
    const signatureForAddress = (address: string): string => `0x000000000000000000000000${
      address.replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;

    const ownerAccount = await this.getOwnerAccount();
    const codeAtAddress = await this.cpkProvider.getCodeAtAddress(this.contract);
    let gasLimit = options && (options.gasLimit || options.gas);
    const sendOptions = await this.cpkProvider.getSendOptions(ownerAccount, options);

    const standardizedTxs = standardizeTransactions(transactions);

    if (this.isConnectedToSafe) {
      const connectedSafeTxs: SafeProviderSendTransaction[] = standardizedTxs.map(
        ({ to, value, data }) => ({ to, value, data }),
      );

      if (standardizedTxs.length === 1 && standardizedTxs[0].operation === CPK.Call) {
        return this.cpkProvider.attemptSafeProviderSendTx(connectedSafeTxs[0], sendOptions);
      } else {
        // NOTE: DelegateCalls get converted to Calls here
        return this.cpkProvider.attemptSafeProviderMultiSendTxs(connectedSafeTxs);
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
        to = this.cpkProvider.getContractAddress(this.multiSend);
        value = 0;
        data = this.cpkProvider.encodeMultiSendCallData(standardizedTxs);
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
          this.cpkProvider.getContractAddress(this.multiSend),
          0,
          this.cpkProvider.encodeMultiSendCallData(transactions),
          CPK.DelegateCall,
        ];
      }

      gasLimit = await this.cpkProvider.findSuccessfulGasLimit(
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
            const revertData = await this.cpkProvider.getCallRevertData({
              from: this.address, to, value, data, gasLimit: 6000000,
            });
            const errorMessage = this.cpkProvider.decodeError(revertData);
            txFailErrorMessage = `${txFailErrorMessage}: ${ errorMessage }`;
          } catch (e) {
            // empty
          }
        }
        throw new Error(txFailErrorMessage);
      }

      return this.cpkProvider.execMethod(
        targetContract,
        execMethodName,
        execParams,
        { ...sendOptions, gasLimit },
      );
    }
  }
}

export default CPK;
