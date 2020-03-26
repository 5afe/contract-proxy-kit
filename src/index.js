const defaultNetworks = require('./utils/networks');
const { zeroAddress, predeterminedSaltNonce } = require('./utils/constants');

const CPKWeb3Provider = require('./providers/CPKWeb3Provider');
const CPKEthersProvider = require('./providers/CPKEthersProvider');

const CPK = class CPK {
  static async create(opts) {
    if (opts == null) throw new Error('missing options');
    const cpk = new CPK(opts);
    await cpk.init();
    return cpk;
  }

  constructor({
    web3,
    ethers,
    signer,
    ownerAccount,
    networks,
  }) {
    if (web3 != null) {
      this.cpkProvider = new CPKWeb3Provider({ web3 });
    } else if (ethers != null) {
      if (signer == null) {
        throw new Error('missing signer required for ethers');
      }
      this.cpkProvider = new CPKEthersProvider({ ethers, signer });
    } else throw new Error('web3/ethers property missing from options');

    this.setOwnerAccount(ownerAccount);
    this.networks = {
      ...defaultNetworks,
      ...(networks || {}),
    };
  }

  async init() {
    const networkID = await this.cpkProvider.getNetworkId();
    const network = this.networks[networkID];

    if (network == null) {
      throw Error(`unrecognized network ID ${networkID}`);
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
      multiSendAddress: network.multiSendAddress
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
    return this.cpkProvider.getContractAddress(this.contract);
  }

  async execTransactions(transactions, options) {
    const signatureForAddress = (address) => `0x000000000000000000000000${
      address.replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;

    const ownerAccount = await this.getOwnerAccount();
    const codeAtAddress = (await this.cpkProvider.getCodeAtAddress(this.contract));
    const sendOptions = await this.cpkProvider.getSendOptions(options, ownerAccount);

    let standardizedTxs = transactions.map((tx) => ({
      value: tx.value ? tx.value : 0,
      data: tx.data ? tx.data : '0x',
      operation: tx.operation ? tx.operation : CPK.CALL,
      ...tx,
    }));

    if (standardizedTxs.length === 1) {
      const { to, value, data, operation } = standardizedTxs[0];

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
          this.cpkProvider.getContractAddress(this.multiSend), 0,
          this.cpkProvider.encodeMultiSendCalldata(this.multiSend, standardizedTxs),
          CPK.DELEGATECALL,
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
        this.cpkProvider.getContractAddress(this.multiSend), 0,
        this.cpkProvider.encodeMultiSendCalldata(this.multiSend, standardizedTxs),
        CPK.DELEGATECALL,
      ],
      sendOptions,
      new Error('proxy creation and transaction execution expected to fail'),
    );
  }
};

CPK.CALL = 0;
CPK.DELEGATECALL = 1;

module.exports = CPK;
