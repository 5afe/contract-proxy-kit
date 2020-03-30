const CPKProvider = require('./CPKProvider');
const { predeterminedSaltNonce } = require('../utils/constants');
const cpkFactoryAbi = require('../abis/CpkFactoryAbi.json');
const safeAbi = require('../abis/SafeAbi.json');
const multiSendAbi = require('../abis/MultiSendAbi.json');

class CPKEthersProvider extends CPKProvider {
  constructor({ ethers, signer }) {
    super();
    if (!signer) {
      throw new Error('missing signer required for ethers');
    }
    this.ethers = ethers;
    this.signer = signer;
  }

  async init({
    isConnectedToSafe, ownerAccount, masterCopyAddress, proxyFactoryAddress, multiSendAddress,
  }) {
    const abiToViewAbi = (abi) => abi.map(({
      constant, // eslint-disable-line
      stateMutability, // eslint-disable-line
      ...rest
    }) => Object.assign(rest, {
      constant: true,
      stateMutability: 'view',
    }));

    const multiSend = new this.ethers.Contract(multiSendAddress, multiSendAbi, this.signer);
    let contract;
    let viewContract;
    let proxyFactory;
    let viewProxyFactory;

    if (isConnectedToSafe) {
      contract = new this.ethers.Contract(ownerAccount, safeAbi, this.signer);
      viewContract = new this.ethers.Contract(
        ownerAccount,
        abiToViewAbi(safeAbi),
        this.signer,
      );
    } else {
      proxyFactory = new this.ethers.Contract(
        proxyFactoryAddress,
        cpkFactoryAbi,
        this.signer,
      );
      viewProxyFactory = new this.ethers.Contract(
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
          proxyFactory.address,
          create2Salt,
          this.ethers.utils.solidityKeccak256(['bytes', 'bytes'], [
            await proxyFactory.proxyCreationCode(),
            this.ethers.utils.defaultAbiCoder.encode(['address'], [masterCopyAddress]),
          ]),
        ]).slice(-40),
      );

      contract = new this.ethers.Contract(address, safeAbi, this.signer);
      viewContract = new this.ethers.Contract(address, abiToViewAbi(safeAbi), this.signer);
    }

    return {
      multiSend,
      contract,
      viewContract,
      proxyFactory,
      viewProxyFactory,
    };
  }

  getProvider() {
    // eslint-disable-next-line no-underscore-dangle
    return this.signer.provider.provider || this.signer.provider._web3Provider;
  }

  async getNetworkId() {
    return (await this.signer.provider.getNetwork()).chainId;
  }

  async getOwnerAccount() {
    return this.signer.getAddress();
  }

  async getCodeAtAddress(contract) {
    return this.signer.provider.getCode(this.constructor.getContractAddress(contract));
  }

  static getContractAddress(contract) {
    return contract.address;
  }

  checkSingleCall(from, to, value, data) {
    return this.signer.provider.call({
      from,
      to,
      value,
      data,
    });
  }

  static async attemptTransaction(contract, viewContract, methodName, params, options, err) {
    if (!(await viewContract.functions[methodName](...params))) throw err;
    const transactionResponse = await contract.functions[methodName](
      ...params,
      ...(!options ? [] : [options]),
    );
    return { transactionResponse, hash: transactionResponse.hash };
  }

  async attemptSafeProviderSendTx(txObj, options) {
    const transactionResponse = await this.signer.sendTransaction({
      ...txObj,
      ...(options || {}),
    });
    return { transactionResponse, hash: transactionResponse.hash };
  }

  async attemptSafeProviderMultiSendTxs(txs) {
    const hash = await this.signer.provider.send('gs_multi_send', txs);
    return { hash };
  }

  encodeMultiSendCalldata(multiSend, txs) {
    return multiSend.interface.functions.multiSend.encode([
      this.ethers.utils.hexlify(
        this.ethers.utils.concat(
          txs.map(
            (tx) => this.ethers.utils.solidityPack(
              ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
              [
                tx.operation,
                tx.to,
                tx.value,
                this.ethers.utils.hexDataLength(tx.data),
                tx.data,
              ],
            ),
          ),
        ),
      ),
    ]);
  }

  // eslint-disable-next-line
  static getSendOptions(options, ownerAccount) {
    return options;
  }
}

module.exports = CPKEthersProvider;
