const safeAbi = [
  {
    type: 'function',
    name: 'setup',
    constant: false,
    payable: false,
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address[]', name: 'owners' },
      { type: 'uint256', name: 'threshold' },
      { type: 'address', name: 'to' },
      { type: 'bytes', name: 'data' },
      { type: 'address', name: 'fallbackHandler' },
      { type: 'address', name: 'paymentToken' },
      { type: 'uint256', name: 'payment' },
      { type: 'address', name: 'paymentReceiver' },
    ],
  },
  {
    type: 'function',
    name: 'execTransaction',
    constant: false,
    payable: false,
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'value' },
      { type: 'bytes', name: 'data' },
      { type: 'uint8', name: 'operation' },
      { type: 'uint256', name: 'safeTxGas' },
      { type: 'uint256', name: 'baseGas' },
      { type: 'uint256', name: 'gasPrice' },
      { type: 'address', name: 'gasToken' },
      { type: 'address', name: 'refundReceiver' },
      { type: 'bytes', name: 'signatures' },
    ],
    outputs: [{ type: 'bool', name: 'success' }],
  },
];

const safeProxyFactoryAbi = [
  {
    type: 'function',
    name: 'proxyCreationCode',
    constant: true,
    payable: false,
    stateMutability: 'pure',
    inputs: [],
    outputs: [{ type: 'bytes', name: '' }],
  },
  {
    type: 'function',
    name: 'createSafeProxy',
    constant: false,
    payable: false,
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'masterCopy' },
      { type: 'bytes', name: 'initializer' },
      { type: 'uint256', name: 'saltNonce' },
    ],
    outputs: [{ type: 'address', name: 'proxy' }],
  },
];

const multiSendAbi = [
  {
    type: 'function',
    name: 'multiSend',
    constant: false,
    payable: false,
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'bytes', name: 'transactions' },
    ],
    outputs: [],
  },
];

const defaultNetworks = {
  // mainnet
  1: {
    masterCopyAddress: '0xaE32496491b53841efb51829d6f886387708F99B',
    multiSendAddress: '0xB522a9f781924eD250A11C54105E51840B138AdD',
    callbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980',
  },
  // rinkeby
  4: {
    masterCopyAddress: '0xaE32496491b53841efb51829d6f886387708F99B',
    multiSendAddress: '0xB522a9f781924eD250A11C54105E51840B138AdD',
    callbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980',
  },
  // goerli
  5: {
    masterCopyAddress: '0xaE32496491b53841efb51829d6f886387708F99B',
    multiSendAddress: '0xB522a9f781924eD250A11C54105E51840B138AdD',
    callbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980',
  },
  // kovan
  42: {
    masterCopyAddress: '0xaE32496491b53841efb51829d6f886387708F99B',
    multiSendAddress: '0xB522a9f781924eD250A11C54105E51840B138AdD',
    callbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980',
  },
};

const zeroAddress = `0x${'0'.repeat(40)}`;

// keccak256('Safe Proxy SDK')
const predeterminedSaltNonce = '0xc2c578f2767787805d9e1c4d285808763ed96bd0883de61207107249afc6ae55';

const SafeProxy = class SafeProxy {
  static async create(opts) {
    if (opts == null) throw new Error('missing options');
    const safeProxy = new SafeProxy(opts);
    await safeProxy.init();
    return safeProxy;
  }

  constructor({
    web3,
    ownerAccount,
    networks,
  }) {
    if (web3 == null) throw new Error('web3 property missing from options');
    this.web3 = web3;
    this.setOwnerAccount(ownerAccount);
    this.networks = {
      ...defaultNetworks,
      ...(networks || {}),
    };
    this.contract = new this.web3.eth.Contract(safeAbi);
  }

  async init() {
    const networkID = await this.web3.eth.net.getId();
    const network = this.networks[networkID];

    if (network == null) {
      throw Error(`unrecognized network ID ${networkID}`);
    }

    const {
      masterCopyAddress,
      proxyFactoryAddress,
      multiSendAddress,
      callbackHandlerAddress,
    } = network;

    this.masterCopyAddress = masterCopyAddress;
    this.proxyFactory = new this.web3.eth.Contract(safeProxyFactoryAbi, proxyFactoryAddress);
    this.multiSend = new this.web3.eth.Contract(multiSendAbi, multiSendAddress);
    this.callbackHandlerAddress = callbackHandlerAddress;

    const ownerAccount = await this.getOwnerAccount();

    const create2Salt = this.web3.utils.keccak256(this.web3.eth.abi.encodeParameters(
      ['address', 'uint256'],
      [ownerAccount, predeterminedSaltNonce],
    ));

    this.contract.options.address = this.web3.utils.toChecksumAddress(
      this.web3.utils.soliditySha3(
        '0xff',
        { t: 'address', v: this.proxyFactory.options.address },
        { t: 'bytes32', v: create2Salt },
        this.web3.utils.soliditySha3(
          await this.proxyFactory.methods.proxyCreationCode().call(),
          this.web3.eth.abi.encodeParameters(['address'], [this.masterCopyAddress]),
        ),
      ).slice(-40),
    );
  }

  async getOwnerAccount() {
    return this.ownerAccount
      || this.web3.eth.defaultAccount
      || (await this.web3.eth.getAccounts())[0];
  }

  setOwnerAccount(ownerAccount) {
    this.ownerAccount = ownerAccount;
  }

  get address() {
    return this.contract.options.address;
  }

  async execTransactions(transactions) {
    const ownerAccount = await this.getOwnerAccount();
    const blockGasLimit = (await this.web3.eth.getBlock(this.web3.eth.defaultBlock)).gasLimit;
    const sendOpts = {
      from: ownerAccount,
      gas: blockGasLimit,
    };

    const codeAtAddress = await this.web3.eth.getCode(this.contract.options.address);
    const signature = `0x000000000000000000000000${
      ownerAccount.replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;

    if (transactions.length === 1 && codeAtAddress !== '0x') {
      const transaction = transactions[0];
      const {
        operation,
        to,
        value,
        data,
      } = transaction;

      return this.contract.methods.execTransaction(
        to, value, data, operation,
        0, 0, 0, zeroAddress, zeroAddress,
        signature,
      ).send(sendOpts).promise;
    }

    const transactionsData = this.multiSend.methods.multiSend(`0x${
      transactions.map((tx) => [
        this.web3.eth.abi.encodeParameter('uint8', tx.operation).slice(-2),
        this.web3.eth.abi.encodeParameter('address', tx.to).slice(-40),
        this.web3.eth.abi.encodeParameter('uint256', tx.value).slice(-64),
        this.web3.eth.abi.encodeParameter('uint256', this.web3.utils.hexToBytes(tx.data).length).slice(-64),
        tx.data.replace(/^0x/, ''),
      ].join(''))
        .join('')
    }`).encodeABI();

    if (codeAtAddress === '0x') {
      return this.proxyFactory.methods.createSafeProxy(
        this.masterCopyAddress,
        this.contract.methods.setup(
          [ownerAccount],
          1,
          // NOTE: this can be problematic cuz it happens before fallback handler
          this.multiSend.options.address,
          transactionsData,
          this.callbackHandlerAddress,
          zeroAddress,
          0,
          zeroAddress,
        ).encodeABI(),
        predeterminedSaltNonce,
      ).send(sendOpts).promise;
    }

    return this.contract.methods.execTransaction(
      this.multiSend.options.address, 0, transactionsData,
      SafeProxy.DELEGATECALL,
      0, 0, 0, zeroAddress, zeroAddress,
      signature,
    ).send(sendOpts).promise;
  }
};

SafeProxy.CALL = 0;
SafeProxy.DELEGATECALL = 1;

module.exports = SafeProxy;
