const cpkFactoryAbi = require('./abis/CpkFactoryAbi.json')
const safeAbi = require('./abis/SafeAbi.json')
const multiSendAbi = require('./abis/MultiSendAbi.json')
const defaultNetworks = require('./utils/networks')
const { zeroAddress, predeterminedSaltNonce } = require('./utils/constants')

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

    const provider = this.apiType === 'web3'
      ? this.web3.currentProvider
      : this.signer.provider.provider
      || this.signer.provider._web3Provider; // eslint-disable-line no-underscore-dangle
    const wc = provider && (provider.wc || (provider.connection && provider.connection.wc));
    if (
      wc && wc.peerMeta && wc.peerMeta.name
      && wc.peerMeta.name.startsWith('Gnosis Safe')
    ) {
      this.isConnectedToSafe = true;
    }

    if (this.apiType === 'web3') {
      this.multiSend = new this.web3.eth.Contract(multiSendAbi, multiSendAddress);

      if (this.isConnectedToSafe) {
        this.contract = new this.web3.eth.Contract(safeAbi, ownerAccount);
      } else {
        this.proxyFactory = new this.web3.eth.Contract(cpkFactoryAbi, proxyFactoryAddress);
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
      }
    } else if (this.apiType === 'ethers') {
      const abiToViewAbi = (abi) => abi.map(({
        constant,
        stateMutability,
        ...rest
      }) => Object.assign(rest, {
        constant: true,
        stateMutability: 'view',
      }));

      this.multiSend = new this.ethers.Contract(multiSendAddress, multiSendAbi, this.signer);

      if (this.isConnectedToSafe) {
        this.contract = new this.ethers.Contract(ownerAccount, safeAbi, this.signer);
        this.viewContract = new this.ethers.Contract(
          ownerAccount,
          abiToViewAbi(safeAbi),
          this.signer,
        );
      } else {
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

  async execTransactions(transactions, options) {
    const signatureForAddress = (address) => `0x000000000000000000000000${
      address.replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;

    const toConnectedSafeTransactions = (txs) => txs.map(({
      to, value, data,
    }) => ({
      to,
      value,
      data,
    }));

    const ownerAccount = await this.getOwnerAccount();

    let checkSingleCall;
    let attemptTransaction;
    let attemptSafeProviderSendTx;
    let attemptSafeProviderMultiSendTxs;
    let codeAtAddress;
    let getContractAddress;
    let encodeMultiSendCalldata;

    if (this.apiType === 'web3') {
      const sendOptions = {
        from: ownerAccount,
        ...(options || {}),
      };
      const promiEventToPromise = (promiEvent) => new Promise(
        (resolve, reject) => promiEvent.once(
          'transactionHash',
          (hash) => resolve({ sendOptions, promiEvent, hash }),
        ).catch(reject),
      );

      checkSingleCall = (to, value, data) => this.web3.eth.call({
        from: this.address,
        to,
        value,
        data,
      });

      attemptTransaction = async (contract, viewContract, methodName, params, err) => {
        if (!(await contract.methods[methodName](...params).call(sendOptions))) throw err;

        const promiEvent = contract.methods[methodName](...params).send(sendOptions);

        return promiEventToPromise(promiEvent);
      };

      attemptSafeProviderSendTx = (txObj) => {
        const promiEvent = this.web3.eth.sendTransaction({
          ...txObj,
          ...sendOptions,
        });

        return promiEventToPromise(promiEvent);
      };

      attemptSafeProviderMultiSendTxs = async (txs) => {
        const hash = await (
          this.web3.currentProvider.host === 'CustomProvider'
            ? this.web3.currentProvider.send(
              'gs_multi_send',
              toConnectedSafeTransactions(txs),
            ) : new Promise(
              (resolve, reject) => this.web3.currentProvider.send({
                jsonrpc: '2.0',
                id: new Date().getTime(),
                method: 'gs_multi_send',
                params: toConnectedSafeTransactions(txs),
              }, (err, result) => {
                if (err) return reject(err);
                if (result.error) return reject(result.error);
                return resolve(result.result);
              }),
            )
        );
        return { hash };
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
        const transactionResponse = await contract.functions[methodName](
          ...params,
          ...(options == null ? [] : [options]),
        );
        return { transactionResponse, hash: transactionResponse.hash };
      };

      attemptSafeProviderSendTx = async (txObj) => {
        const transactionResponse = await this.signer.sendTransaction({
          ...txObj,
          ...(options || {}),
        });
        return { transactionResponse, hash: transactionResponse.hash };
      };

      attemptSafeProviderMultiSendTxs = async (txs) => {
        const hash = await this.signer.provider.send('gs_multi_send', toConnectedSafeTransactions(txs));
        return { hash };
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

        if (this.isConnectedToSafe) {
          return attemptSafeProviderSendTx({ to, value, data });
        }
      }

      if (!this.isConnectedToSafe) {
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
    }

    if (this.isConnectedToSafe) {
      return attemptSafeProviderMultiSendTxs(transactions);
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
