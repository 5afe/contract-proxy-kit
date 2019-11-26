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
  {
    type: 'function',
    name: 'swapOwner',
    constant: false,
    payable: false,
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'prevOwner' },
      { type: 'address', name: 'oldOwner' },
      { type: 'address', name: 'newOwner' },
    ],
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
      { type: 'uint256', name: 'saltNonce' },
      { type: 'address', name: 'delegatecallTarget' },
      { type: 'bytes', name: 'initialCalldata' },
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
const SENTINEL_OWNERS = `0x${'0'.repeat(39)}1`;

// keccak256('Safe Proxy SDK')
const predeterminedSaltNonce = '0xc2c578f2767787805d9e1c4d285808763ed96bd0883de61207107249afc6ae55';

const toConfirmationPromise = (promievent) => new Promise(
  (resolve, reject) => promievent.on('confirmation',
    (confirmationNumber, receipt) => resolve(receipt)).catch(reject),
);

const SafeProxy = class SafeProxy {
  static async create(opts) {
    if (opts == null) throw new Error('missing options');
    const safeProxy = new SafeProxy(opts);
    await safeProxy.init();
    return safeProxy;
  }

  constructor({
    web3,
    ethers,
    signer,
    ownerAccount,
    networks,
  }) {
    if (web3 != null) {
      this.apiType = 'web3';
      this.web3 = web3;
    } else if (ethers != null) {
      this.apiType = 'ethers';
      this.ethers = ethers;
      if (signer == null) {
        throw new Error('missing signer required for ethers');
      }
      this.signer = signer;
    } else throw new Error('web3/ethers property missing from options');

    this.setOwnerAccount(ownerAccount);
    this.networks = {
      ...defaultNetworks,
      ...(networks || {}),
    };
  }

  async init() {
    const networkID = this.apiType === 'web3'
      ? await this.web3.eth.net.getId()
      : (await this.signer.provider.getNetwork()).chainId;
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
    this.callbackHandlerAddress = callbackHandlerAddress;

    const ownerAccount = await this.getOwnerAccount();

    if (this.apiType === 'web3') {
      this.proxyFactory = new this.web3.eth.Contract(safeProxyFactoryAbi, proxyFactoryAddress);
      this.multiSend = new this.web3.eth.Contract(multiSendAbi, multiSendAddress);

      const create2Salt = this.web3.utils.keccak256(this.web3.eth.abi.encodeParameters(
        ['address', 'uint256'],
        [ownerAccount, predeterminedSaltNonce],
      ));

      this.contract = new this.web3.eth.Contract(safeAbi, this.web3.utils.toChecksumAddress(
        this.web3.utils.soliditySha3(
          '0xff',
          { t: 'address', v: this.proxyFactory.options.address },
          { t: 'bytes32', v: create2Salt },
          this.web3.utils.soliditySha3(
            await this.proxyFactory.methods.proxyCreationCode().call(),
            this.web3.eth.abi.encodeParameters(['address'], [this.masterCopyAddress]),
          ),
        ).slice(-40),
      ));
    } else if (this.apiType === 'ethers') {
      this.proxyFactory = new this.ethers.Contract(
        proxyFactoryAddress,
        safeProxyFactoryAbi,
        this.signer,
      );
      this.multiSend = new this.ethers.Contract(multiSendAddress, multiSendAbi, this.signer);

      const create2Salt = this.ethers.utils.keccak256(this.ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256'],
        [ownerAccount, predeterminedSaltNonce],
      ));

      this.contract = new this.ethers.Contract(this.ethers.utils.getAddress(
        this.ethers.utils.solidityKeccak256(['bytes', 'address', 'bytes32', 'bytes32'], [
          '0xff',
          this.proxyFactory.address,
          create2Salt,
          this.ethers.utils.solidityKeccak256(['bytes', 'bytes'], [
            await this.proxyFactory.proxyCreationCode(),
            this.ethers.utils.defaultAbiCoder.encode(['address'], [this.masterCopyAddress]),
          ]),
        ]).slice(-40),
      ), safeAbi, this.signer);
    }
  }

  async getOwnerAccount() {
    if (this.ownerAccount != null) return this.ownerAccount;
    if (this.apiType === 'web3') return this.web3.eth.defaultAccount || (await this.web3.eth.getAccounts())[0];
    if (this.apiType === 'ethers') return this.signer.getAddress();
    throw new Error(`invalid API type ${this.apiType}`);
  }

  setOwnerAccount(ownerAccount) {
    this.ownerAccount = ownerAccount;
  }

  get address() {
    if (this.apiType === 'web3') return this.contract.options.address;
    if (this.apiType === 'ethers') return this.contract.address;
    throw new Error(`invalid API type ${this.apiType}`);
  }

  async execTransactions(transactions) {
    const signatureForAddress = (address) => `0x000000000000000000000000${
      address.replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;

    const ownerAccount = await this.getOwnerAccount();

    let sendTransactionToContract;
    let codeAtAddress;
    let getContractAddress;
    let encodeMultiSendCalldata;
    let encodeContractCalldata;

    if (this.apiType === 'web3') {
      const blockGasLimit = (await this.web3.eth.getBlock(this.web3.eth.defaultBlock)).gasLimit;
      const sendOpts = {
        from: ownerAccount,
        gas: blockGasLimit,
      };

      sendTransactionToContract = (contract, methodName, params) => toConfirmationPromise(
        contract.methods[methodName](...params).send(sendOpts),
      );

      codeAtAddress = await this.web3.eth.getCode(this.address);

      getContractAddress = (contract) => contract.options.address;

      encodeMultiSendCalldata = (txs) => this.multiSend.methods.multiSend(
        `0x${txs.map((tx) => [
          this.web3.eth.abi.encodeParameter('uint8', tx.operation).slice(-2),
          this.web3.eth.abi.encodeParameter('address', tx.to).slice(-40),
          this.web3.eth.abi.encodeParameter('uint256', tx.value).slice(-64),
          this.web3.eth.abi.encodeParameter('uint256', this.web3.utils.hexToBytes(tx.data).length).slice(-64),
          tx.data.replace(/^0x/, ''),
        ].join('')).join('')}`,
      ).encodeABI();

      encodeContractCalldata = (contract, methodName, params) => (
        contract.methods[methodName](...params).encodeABI()
      );
    } else if (this.apiType === 'ethers') {
      sendTransactionToContract = (contract, methodName, params) => (
        contract.functions[methodName](...params)
      );

      codeAtAddress = (await this.signer.provider.getCode(this.address));

      getContractAddress = (contract) => contract.address;

      encodeMultiSendCalldata = (txs) => this.multiSend.interface.functions.multiSend.encode([
        this.ethers.utils.hexlify(
          this.ethers.utils.concat(
            txs.map(
              (tx) => this.ethers.utils.solidityPack(
                ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
                [tx.operation, tx.to, tx.value, this.ethers.utils.hexDataLength(tx.data), tx.data],
              ),
            ),
          ),
        ),
      ]);

      encodeContractCalldata = (contract, methodName, params) => (
        contract.interface.functions[methodName].encode(params)
      );
    } else {
      throw new Error(`invalid API type ${this.apiType}`);
    }

    if (transactions.length === 1 && codeAtAddress !== '0x') {
      const transaction = transactions[0];
      const {
        operation,
        to,
        value,
        data,
      } = transaction;

      return sendTransactionToContract(this.contract, 'execTransaction', [
        to, value, data, operation,
        0, 0, 0, zeroAddress, zeroAddress,
        signatureForAddress(ownerAccount),
      ]);
    }

    if (codeAtAddress === '0x') {
      return sendTransactionToContract(this.proxyFactory, 'createSafeProxy', [
        this.masterCopyAddress,
        predeterminedSaltNonce,
        getContractAddress(this.multiSend),
        encodeMultiSendCalldata([
          {
            operation: SafeProxy.CALL,
            to: this.address,
            value: 0,
            data: encodeContractCalldata(this.contract, 'setup', [
              [getContractAddress(this.proxyFactory)],
              1,
              zeroAddress,
              '0x',
              this.callbackHandlerAddress,
              zeroAddress,
              0,
              zeroAddress,
            ]),
          },
          {
            operation: SafeProxy.CALL,
            to: this.address,
            value: 0,
            data: encodeContractCalldata(this.contract, 'execTransaction', [
              getContractAddress(this.multiSend), 0,
              encodeMultiSendCalldata(transactions.concat([{
                operation: SafeProxy.CALL,
                to: this.address,
                value: 0,
                data: encodeContractCalldata(this.contract, 'swapOwner', [
                  SENTINEL_OWNERS,
                  getContractAddress(this.proxyFactory),
                  ownerAccount,
                ]),
              }])),
              SafeProxy.DELEGATECALL,
              0, 0, 0, zeroAddress, zeroAddress,
              signatureForAddress(getContractAddress(this.proxyFactory)),
            ]),
          },
        ]),
      ]);
    }

    return sendTransactionToContract(this.contract, 'execTransaction', [
      getContractAddress(this.multiSend), 0,
      encodeMultiSendCalldata(transactions),
      SafeProxy.DELEGATECALL,
      0, 0, 0, zeroAddress, zeroAddress,
      signatureForAddress(ownerAccount),
    ]);
  }
};

SafeProxy.CALL = 0;
SafeProxy.DELEGATECALL = 1;

module.exports = SafeProxy;
