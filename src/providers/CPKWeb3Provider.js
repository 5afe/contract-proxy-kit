const CPKProvider = require('./CPKProvider');
const { predeterminedSaltNonce } = require('../utils/constants');
const cpkFactoryAbi = require('../abis/CpkFactoryAbi.json');
const safeAbi = require('../abis/SafeAbi.json');
const multiSendAbi = require('../abis/MultiSendAbi.json');

class CPKWeb3Provider extends CPKProvider {
  constructor({ web3 }) {
    super();
    this.web3 = web3;
  }

  async init({
    isConnectedToSafe, ownerAccount, masterCopyAddress, proxyFactoryAddress, multiSendAddress,
  }) {
    const multiSend = new this.web3.eth.Contract(multiSendAbi, multiSendAddress);
    let contract;
    let proxyFactory;

    if (isConnectedToSafe) {
      contract = new this.web3.eth.Contract(safeAbi, ownerAccount);
    } else {
      proxyFactory = new this.web3.eth.Contract(cpkFactoryAbi, proxyFactoryAddress);
      const create2Salt = this.web3.utils.keccak256(this.web3.eth.abi.encodeParameters(
        ['address', 'uint256'],
        [ownerAccount, predeterminedSaltNonce],
      ));

      contract = new this.web3.eth.Contract(safeAbi, this.web3.utils.toChecksumAddress(
        this.web3.utils.soliditySha3(
          '0xff',
          { t: 'address', v: proxyFactory.options.address },
          { t: 'bytes32', v: create2Salt },
          this.web3.utils.soliditySha3(
            await proxyFactory.methods.proxyCreationCode().call(),
            this.web3.eth.abi.encodeParameters(['address'], [masterCopyAddress]),
          ),
        ).slice(-40),
      ));
    }

    return {
      multiSend,
      contract,
      proxyFactory,
    };
  }

  getProvider() {
    return this.web3.currentProvider;
  }

  async getNetworkId() {
    return this.web3.eth.net.getId();
  }

  async getOwnerAccount() {
    return this.web3.eth.defaultAccount || (await this.web3.eth.getAccounts())[0];
  }

  async getCodeAtAddress(contract) {
    return this.web3.eth.getCode(this.constructor.getContractAddress(contract));
  }

  static getContractAddress(contract) {
    return contract.options.address;
  }

  static promiEventToPromise(promiEvent, sendOptions) {
    return new Promise(
      (resolve, reject) => promiEvent.once(
        'transactionHash',
        (hash) => resolve({ sendOptions, promiEvent, hash }),
      ).catch(reject),
    );
  }

  checkSingleCall(from, to, value, data) {
    return this.web3.eth.call({
      from,
      to,
      value,
      data,
    });
  }

  static async attemptTransaction(contract, viewContract, methodName, params, sendOptions, err) {
    if (!(await contract.methods[methodName](...params).call(sendOptions))) throw err;

    const promiEvent = contract.methods[methodName](...params).send(sendOptions);

    return this.promiEventToPromise(promiEvent, sendOptions);
  }

  attemptSafeProviderSendTx(txObj, sendOptions) {
    const promiEvent = this.web3.eth.sendTransaction({
      ...txObj,
      ...sendOptions,
    });
    return this.constructor.promiEventToPromise(promiEvent, sendOptions);
  }

  async attemptSafeProviderMultiSendTxs(txs) {
    const hash = await (
      this.web3.currentProvider.host === 'CustomProvider'
        ? this.web3.currentProvider.send(
          'gs_multi_send',
          txs,
        ) : new Promise(
          (resolve, reject) => this.web3.currentProvider.send({
            jsonrpc: '2.0',
            id: new Date().getTime(),
            method: 'gs_multi_send',
            params: txs,
          }, (err, result) => {
            if (err) return reject(err);
            if (result.error) return reject(result.error);
            return resolve(result.result);
          }),
        )
    );
    return { hash };
  }

  encodeMultiSendCalldata(multiSend, txs) {
    return multiSend.methods.multiSend(
      `0x${txs.map((tx) => [
        this.web3.eth.abi.encodeParameter('uint8', tx.operation).slice(-2),
        this.web3.eth.abi.encodeParameter('address', tx.to).slice(-40),
        this.web3.eth.abi.encodeParameter('uint256', tx.value).slice(-64),
        this.web3.eth.abi.encodeParameter('uint256', this.web3.utils.hexToBytes(tx.data).length).slice(-64),
        tx.data.replace(/^0x/, ''),
      ].join('')).join('')}`,
    ).encodeABI();
  }

  static getSendOptions(options, ownerAccount) {
    return {
      from: ownerAccount,
      ...(options || {}),
    };
  }
}

module.exports = CPKWeb3Provider;
