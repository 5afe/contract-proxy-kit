import { OperationType, zeroAddress, predeterminedSaltNonce } from './utils/constants';
import { defaultNetworks, NetworksConfig } from './utils/networks';
import { standardizeTransactions, SafeProviderSendTransaction, NonStandardTransaction } from './utils/transactions';
const { estimateSafeTxGas } = require('./utils');
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
    options: object
  ): Promise<any> {
    const signatureForAddress = (address: string): string => `0x000000000000000000000000${
      address.replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;

    const ownerAccount = await this.getOwnerAccount();
    const codeAtAddress = await this.cpkProvider.getCodeAtAddress(this.contract);
    const sendOptions = await this.cpkProvider.getSendOptions(options, ownerAccount);

    if (transactions.length === 1) {
      const {
        to, value, data, operation,
      } = standardizeTransactions(transactions)[0];

      if (operation === CPK.Call) {
        await this.cpkProvider.checkSingleCall({
          from: this.address,
          to,
          value,
          data,
        });

        if (this.isConnectedToSafe) {
          return this.cpkProvider.attemptSafeProviderSendTx({ to, value, data }, sendOptions);
        }
      }

      if (!this.isConnectedToSafe) {
        if (codeAtAddress !== '0x') {
          const { safeTxGas, baseGas } = await estimateSafeTxGas(
            this.cpkProvider,
            this.address,
            data,
            to,
            value,
            operation,
          );

          return this.cpkProvider.attemptTransaction(
            this.contract,
            this.viewContract,
            'execTransaction',
            [
              to,
              value,
              data,
              operation,
              safeTxGas,
              baseGas,
              0,
              zeroAddress,
              zeroAddress,
              signatureForAddress(ownerAccount),
            ],
            sendOptions,
            new Error('transaction execution expected to fail'),
          );
        }

        return this.cpkProvider.attemptTransaction(
          this.proxyFactory,
          this.viewProxyFactory,
          'createProxyAndExecTransaction',
          [
            this.masterCopyAddress,
            predeterminedSaltNonce,
            this.fallbackHandlerAddress,
            to,
            value,
            data,
            operation,
          ],
          sendOptions,
          new Error('proxy creation and transaction execution expected to fail'),
        );
      }
    }

    if (this.isConnectedToSafe) {
      const standardizedTxs = standardizeTransactions(transactions);
      const connectedSafeTxs: SafeProviderSendTransaction[] = standardizedTxs.map(({
        to, value, data,
      }) => ({
        data,
        to,
        value,
      }));

      return this.cpkProvider.attemptSafeProviderMultiSendTxs(connectedSafeTxs);
    }

    if (codeAtAddress !== '0x') {
      const to = this.cpkProvider.getContractAddress(this.multiSend);
      const value = 0;
      const data = this.cpkProvider.encodeMultiSendCallData(transactions);
      const operation = CPK.DelegateCall;

      const { safeTxGas, baseGas } = await estimateSafeTxGas(
        this.cpkProvider,
        this.address,
        data,
        to,
        value,
        operation,
      );

      return this.cpkProvider.attemptTransaction(
        this.contract,
        this.viewContract,
        'execTransaction',
        [
          to,
          value,
          data,
          operation,
          safeTxGas,
          baseGas,
          0,
          zeroAddress,
          zeroAddress,
          signatureForAddress(ownerAccount),
        ],
        sendOptions,
        new Error('transaction execution expected to fail'),
      );
    }

    return this.cpkProvider.attemptTransaction(
      this.proxyFactory,
      this.viewProxyFactory,
      'createProxyAndExecTransaction',
      [
        this.masterCopyAddress,
        predeterminedSaltNonce,
        this.fallbackHandlerAddress,
        this.cpkProvider.getContractAddress(this.multiSend),
        0,
        this.cpkProvider.encodeMultiSendCallData(transactions),
        CPK.DelegateCall,
      ],
      sendOptions,
      new Error('proxy creation and transaction execution expected to fail'),
    );
  }
}

export default CPK;
