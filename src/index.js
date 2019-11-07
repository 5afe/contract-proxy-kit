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

const proxyFactoryAbi = [
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
    payable: false,
    stateMutability: 'nonpayable',
    constant: false,
    inputs: [
      { type: 'address', name: 'masterCopy' },
      { type: 'bytes', name: 'initializer' },
      { type: 'uint256', name: 'saltNonce' },
    ],
    name: 'createProxyWithNonce',
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
    proxyFactoryAddress: '0x50e55Af101C777bA7A1d560a774A82eF002ced9F',
    multiSendAddress: '0xB522a9f781924eD250A11C54105E51840B138AdD',
  },
  // rinkeby
  4: {
    masterCopyAddress: '0xaE32496491b53841efb51829d6f886387708F99B',
    proxyFactoryAddress: '0x50e55Af101C777bA7A1d560a774A82eF002ced9F',
    multiSendAddress: '0xB522a9f781924eD250A11C54105E51840B138AdD',
  },
  // goerli
  5: {
    masterCopyAddress: '0xaE32496491b53841efb51829d6f886387708F99B',
    proxyFactoryAddress: '0x50e55Af101C777bA7A1d560a774A82eF002ced9F',
    multiSendAddress: '0xB522a9f781924eD250A11C54105E51840B138AdD',
  },
  // kovan
  42: {
    masterCopyAddress: '0xaE32496491b53841efb51829d6f886387708F99B',
    proxyFactoryAddress: '0x50e55Af101C777bA7A1d560a774A82eF002ced9F',
    multiSendAddress: '0xB522a9f781924eD250A11C54105E51840B138AdD',
  },
};

const zeroAddress = `0x${'0'.repeat(40)}`;

// keccak256('Safe Proxy SDK')
const predeterminedSaltNonce = '0xc2c578f2767787805d9e1c4d285808763ed96bd0883de61207107249afc6ae55';

module.exports = class SafeProxy {
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

  async getOwnerAccount() {
    return this.ownerAccount
      || this.web3.eth.defaultAccount
      || (await this.web3.eth.getAccounts())[0];
  }

  setOwnerAccount(ownerAccount) {
    this.ownerAccount = ownerAccount;
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
    } = network;

    this.masterCopyAddress = masterCopyAddress;
    this.proxyFactory = new this.web3.eth.Contract(proxyFactoryAbi, proxyFactoryAddress);
    this.multiSend = new this.web3.eth.Contract(multiSendAbi, multiSendAddress);

    const ownerAccount = await this.getOwnerAccount();

    this.setupCallData = this.contract.methods.setup(
      [ownerAccount],
      1,
      zeroAddress,
      '0x',
      zeroAddress,
      zeroAddress,
      0,
      zeroAddress,
    ).encodeABI();

    const create2Salt = this.web3.utils.soliditySha3(
      this.web3.utils.keccak256(this.setupCallData),
      predeterminedSaltNonce,
    );

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

  async execTransactions(transactions) {
    const ownerAccount = await this.getOwnerAccount();
    const codeAtAddress = await this.web3.eth.getCode(this.contract.options.address);

    if (codeAtAddress === '0x') {
      await this.proxyFactory.methods.createProxyWithNonce(
        this.masterCopyAddress,
        this.setupCallData,
        predeterminedSaltNonce,
      ).send({ from: ownerAccount, gas: 6000000 });
    }

    if (transactions.length === 1) {
      const transaction = transactions[0];
      const {
        operation,
        to,
        value,
        data,
      } = transaction;

      const signature = `0x000000000000000000000000${
        ownerAccount.replace('0x', '').toLowerCase()
      }000000000000000000000000000000000000000000000000000000000000000001`;

      await this.contract.methods.execTransaction(
        to, value, data, operation,
        0, 0, 0, zeroAddress, zeroAddress,
        signature,
      ).send();
    } else {
      for (let i = 0; i < transactions.length; i += 1) {
        const transaction = transactions[i];
        const {
          operation,
          to,
          value,
          data,
        } = transaction;

        // const encodeData = function (operation, to, value, data) {
        //   const dataBuffer = Buffer.from(util.stripHexPrefix(data), 'hex');
        //   const encoded = abi.solidityPack(['uint8', 'address', 'uint256', 'uint256', 'bytes'], [operation, to, value, dataBuffer.length, dataBuffer]);
        //   return encoded.toString('hex');
        // };
      }
    }
  }
};
