import { OperationType, zeroAddress, predeterminedSaltNonce } from './utils/constants';
import { defaultNetworks } from './utils/networks';
import { standardizeTransactions } from './utils/transactions';

class CPK {
  static CALL = OperationType.CALL;
  static DELEGATE_CALL = OperationType.DELEGATE_CALL;

  cpkProvider;
  ownerAccount;
  networks;
  multiSend;
  contract;
  viewContract;
  proxyFactory;
  viewProxyFactory;
  masterCopyAddress;
  fallbackHandlerAddress;
  isConnectedToSafe;
  
  static async create(opts) {
    if (!opts) throw new Error('missing options');
    const cpk = new CPK(opts);
    await cpk.init();
    return cpk;
  }
  
  constructor({
    cpkProvider,
    ownerAccount,
    networks,
  }) {
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

  async init() {
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

  async getOwnerAccount() {
    if (this.ownerAccount != null) return this.ownerAccount;
    return this.cpkProvider.getOwnerAccount();
  }

  setOwnerAccount(ownerAccount) {
    this.ownerAccount = ownerAccount;
  }

  get address() {
    return this.cpkProvider.constructor.getContractAddress(this.contract);
  }

  async execTransactions(transactions, options) {
    const signatureForAddress = (address) => `0x000000000000000000000000${
      address.replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;

    const ownerAccount = await this.getOwnerAccount();
    const codeAtAddress = await this.cpkProvider.getCodeAtAddress(this.contract);
    const sendOptions = await this.cpkProvider.getSendOptions(options, ownerAccount);

    if (transactions.length === 1) {
      const {
        to, value, data, operation,
      } = standardizeTransactions(transactions)[0];

      if (operation === CPK.CALL) {
        await this.cpkProvider.checkSingleCall(this.address, to, value, data);

        if (this.isConnectedToSafe) {
          return this.cpkProvider.attemptSafeProviderSendTx({ to, value, data }, sendOptions);
        }
      }

      if (!this.isConnectedToSafe) {
        if (codeAtAddress !== '0x') {
          return this.cpkProvider.attemptTransaction(
            this.contract,
            this.viewContract,
            'execTransaction',
            [
              to,
              value,
              data,
              operation,
              0,
              0,
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
      const connectedSafeTxs = standardizedTxs.map(({
        to, value, data,
      }) => ({
        to,
        value,
        data,
      }));

      return this.cpkProvider.attemptSafeProviderMultiSendTxs(connectedSafeTxs);
    }

    if (codeAtAddress !== '0x') {
      return this.cpkProvider.attemptTransaction(
        this.contract,
        this.viewContract,
        'execTransaction',
        [
          this.cpkProvider.constructor.getContractAddress(this.multiSend),
          0,
          this.cpkProvider.encodeMultiSendCallData(transactions),
          CPK.DELEGATE_CALL,
          0,
          0,
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
        this.cpkProvider.constructor.getContractAddress(this.multiSend),
        0,
        this.cpkProvider.encodeMultiSendCallData(transactions),
        CPK.DELEGATE_CALL,
      ],
      sendOptions,
      new Error('proxy creation and transaction execution expected to fail'),
    );
  }
}

export default CPK;
