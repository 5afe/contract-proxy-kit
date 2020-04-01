const CPKProvider = require('./CPKProvider');
const { zeroAddress, predeterminedSaltNonce } = require('../utils/constants');
const { standardizeTransactions } = require('../utils/transactions');
const cpkFactoryAbi = require('../abis/CpkFactoryAbi.json');
const safeAbi = require('../abis/SafeAbi.json');
const multiSendAbi = require('../abis/MultiSendAbi.json');

class CPKEthersProvider extends CPKProvider {
  constructor({ ethers, signer }) {
    super();
    if (!ethers) {
      throw new Error('ethers property missing from options');
    }
    if (!signer) {
      throw new Error('signer property missing from options');
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

    const multiSend = this.getContract(multiSendAbi, multiSendAddress);
    let contract;
    let viewContract;
    let proxyFactory;
    let viewProxyFactory;

    if (isConnectedToSafe) {
      contract = this.getContract(safeAbi, ownerAccount);
      viewContract = this.getContract(abiToViewAbi(safeAbi), ownerAccount);
    } else {
      proxyFactory = this.getContract(cpkFactoryAbi, proxyFactoryAddress);
      viewProxyFactory = this.getContract(abiToViewAbi(cpkFactoryAbi), proxyFactoryAddress);

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

      contract = this.getContract(safeAbi, address);
      viewContract = this.getContract(abiToViewAbi(safeAbi), address);
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

  getContract(abi, address) {
    const contract = new this.ethers.Contract(address, abi, this.signer);
    return contract;
  }

  static getContractAddress(contract) {
    return contract.address;
  }

  checkSingleCall({
    from, to, value, data,
  }) {
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

  encodeMultiSendCallData(transactions) {
    const multiSend = this.getContract(multiSendAbi, zeroAddress);
    const standardizedTxs = standardizeTransactions(transactions);

    return multiSend.interface.functions.multiSend.encode([
      this.ethers.utils.hexlify(
        this.ethers.utils.concat(
          standardizedTxs.map(
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
