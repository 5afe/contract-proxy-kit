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

const cpkFactoryAbi = [
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
    name: 'createProxyAndExecTransaction',
    constant: false,
    payable: false,
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'masterCopy' },
      { type: 'uint256', name: 'saltNonce' },
      { type: 'address', name: 'fallbackHandler' },
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'value' },
      { type: 'bytes', name: 'data' },
      { type: 'uint8', name: 'operation' },
    ],
    outputs: [
      { type: 'bool', name: 'execTransactionSuccess' },
    ],
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
  // rinkeby
  4: {
    masterCopyAddress: '0xaE32496491b53841efb51829d6f886387708F99B',
    proxyFactoryAddress: '0x336c19296d3989e9e0c2561ef21c964068657c38',
    multiSendAddress: '0xB522a9f781924eD250A11C54105E51840B138AdD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980',
  },
  // goerli
  5: {
    masterCopyAddress: '0xaE32496491b53841efb51829d6f886387708F99B',
    proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
    multiSendAddress: '0xB522a9f781924eD250A11C54105E51840B138AdD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980',
  },
  // kovan
  42: {
    masterCopyAddress: '0xaE32496491b53841efb51829d6f886387708F99B',
    proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
    multiSendAddress: '0xB522a9f781924eD250A11C54105E51840B138AdD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980',
  },
};

const zeroAddress = `0x${'0'.repeat(40)}`;

// keccak256(toUtf8Bytes('Contract Proxy Kit'))
const predeterminedSaltNonce = '0xcfe33a586323e7325be6aa6ecd8b4600d232a9037e83c8ece69413b777dabe65';

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
      fallbackHandlerAddress,
    } = network;

    this.masterCopyAddress = masterCopyAddress;
    this.fallbackHandlerAddress = fallbackHandlerAddress;

    const ownerAccount = await this.getOwnerAccount();

    if (this.apiType === 'web3') {
      this.proxyFactory = new this.web3.eth.Contract(cpkFactoryAbi, proxyFactoryAddress);
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
      const abiToViewAbi = (abi) => abi.map(({
        constant,
        stateMutability,
        ...rest
      }) => Object.assign(rest, {
        constant: true,
        stateMutability: 'view',
      }));

      this.proxyFactory = new this.ethers.Contract(
        proxyFactoryAddress,
        cpkFactoryAbi,
        this.signer,
      );
      this.viewProxyFactory = new this.ethers.Contract(
        proxyFactoryAddress,
        abiToViewAbi(cpkFactoryAbi),
        this.signer,
      );

      this.multiSend = new this.ethers.Contract(multiSendAddress, multiSendAbi, this.signer);

      const create2Salt = this.ethers.utils.keccak256(this.ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256'],
        [ownerAccount, predeterminedSaltNonce],
      ));

      const address = this.ethers.utils.getAddress(
        this.ethers.utils.solidityKeccak256(['bytes', 'address', 'bytes32', 'bytes32'], [
          '0xff',
          this.proxyFactory.address,
          create2Salt,
          this.ethers.utils.solidityKeccak256(['bytes', 'bytes'], [
            await this.proxyFactory.proxyCreationCode(),
            this.ethers.utils.defaultAbiCoder.encode(['address'], [this.masterCopyAddress]),
          ]),
        ]).slice(-40),
      );

      this.contract = new this.ethers.Contract(address, safeAbi, this.signer);
      this.viewContract = new this.ethers.Contract(address, abiToViewAbi(safeAbi), this.signer);
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

    let checkSingleCall;
    let attemptTransaction;
    let codeAtAddress;
    let getContractAddress;
    let encodeMultiSendCalldata;

    if (this.apiType === 'web3') {
      const toConfirmationPromise = (promievent) => new Promise(
        (resolve, reject) => promievent.on('confirmation',
          (confirmationNumber, receipt) => resolve(receipt)).catch(reject),
      );

      const blockGasLimit = (await this.web3.eth.getBlock(this.web3.eth.defaultBlock)).gasLimit;
      const sendOpts = {
        from: ownerAccount,
        gas: blockGasLimit,
      };

      checkSingleCall = (to, value, data) => this.web3.eth.call({
        from: this.address,
        to,
        value,
        data,
      });

      attemptTransaction = async (contract, viewContract, methodName, params, err) => {
        if (!(await contract.methods[methodName](...params).call(sendOpts))) throw err;
        return toConfirmationPromise(
          contract.methods[methodName](...params).send(sendOpts),
        );
      };

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
    } else if (this.apiType === 'ethers') {
      checkSingleCall = (to, value, data) => this.signer.provider.call({
        from: this.address,
        to,
        value,
        data,
      });

      attemptTransaction = async (contract, viewContract, methodName, params, err) => {
        if (!(await viewContract.functions[methodName](...params))) throw err;
        return (await contract.functions[methodName](...params)).wait();
      };

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
    } else {
      throw new Error(`invalid API type ${this.apiType}`);
    }

    if (transactions.length === 1) {
      const transaction = transactions[0];
      const {
        operation,
        to,
        value,
        data,
      } = transaction;

      if (operation === CPK.CALL) {
        await checkSingleCall(to, value, data);
      }

      if (codeAtAddress !== '0x') {
        return attemptTransaction(
          this.contract, this.viewContract,
          'execTransaction',
          [
            to, value, data, operation,
            0, 0, 0, zeroAddress, zeroAddress,
            signatureForAddress(ownerAccount),
          ],
          new Error('transaction execution expected to fail'),
        );
      }

      return attemptTransaction(
        this.proxyFactory, this.viewProxyFactory,
        'createProxyAndExecTransaction',
        [
          this.masterCopyAddress,
          predeterminedSaltNonce,
          this.fallbackHandlerAddress,
          to, value, data, operation,
        ],
        new Error('proxy creation and transaction execution expected to fail'),
      );
    }

    if (codeAtAddress !== '0x') {
      return attemptTransaction(
        this.contract, this.viewContract,
        'execTransaction',
        [
          getContractAddress(this.multiSend), 0,
          encodeMultiSendCalldata(transactions),
          CPK.DELEGATECALL,
          0, 0, 0, zeroAddress, zeroAddress,
          signatureForAddress(ownerAccount),
        ],
        new Error('transaction execution expected to fail'),
      );
    }

    return attemptTransaction(
      this.proxyFactory, this.viewProxyFactory,
      'createProxyAndExecTransaction',
      [
        this.masterCopyAddress,
        predeterminedSaltNonce,
        this.fallbackHandlerAddress,
        getContractAddress(this.multiSend), 0,
        encodeMultiSendCalldata(transactions),
        CPK.DELEGATECALL,
      ],
      new Error('proxy creation and transaction execution expected to fail'),
    );
  }
};

CPK.CALL = 0;
CPK.DELEGATECALL = 1;

module.exports = CPK;
