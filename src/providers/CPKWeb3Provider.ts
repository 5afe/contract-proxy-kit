import CPKProvider, { CPKProviderInit, CPKProviderInitResult, TransactionResult } from './CPKProvider';
import { predeterminedSaltNonce } from '../utils/constants';
import {
  standardizeTransactions,
  NonStandardTransaction,
  SafeProviderSendTransaction
} from '../utils/transactions';
import cpkFactoryAbi from '../abis/CpkFactoryAbi.json';
import safeAbi from '../abis/SafeAbi.json';
import multiSendAbi from '../abis/MultiSendAbi.json';

interface CPKWeb3ProviderConfig {
  web3: any;
}

interface Web3TransactionResult extends TransactionResult {
  sendOptions: object;
  promiEvent: Promise<any>;
}

class CPKWeb3Provider implements CPKProvider {
  web3: any;

  constructor({ web3 }: CPKWeb3ProviderConfig) {
    if (!web3) {
      throw new Error('web3 property missing from options');
    }
    this.web3 = web3;
  }

  async init({
    isConnectedToSafe, ownerAccount, masterCopyAddress, proxyFactoryAddress, multiSendAddress,
  }: CPKProviderInit): Promise<CPKProviderInitResult> {
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

  getProvider(): any {
    return this.web3.currentProvider;
  }

  async getNetworkId(): Promise<number> {
    return this.web3.eth.net.getId();
  }

  async getOwnerAccount(): Promise<string> {
    return this.web3.eth.defaultAccount || (await this.web3.eth.getAccounts())[0];
  }

  async getCodeAtAddress(contract: any): Promise<string> {
    return this.web3.eth.getCode(this.getContractAddress(contract));
  }

  getContractAddress(contract: any): string {
    return contract.options.address;
  }

  static promiEventToPromise(promiEvent: any, sendOptions: object): Promise<Web3TransactionResult> {
    return new Promise(
      (resolve, reject) => promiEvent.once(
        'transactionHash',
        (hash: string) => resolve({ sendOptions, promiEvent, hash }),
      ).catch(reject),
    );
  }

  checkSingleCall(from: string, to: string, value: number | string, data: string): Promise<any> {
    return this.web3.eth.call({
      from,
      to,
      value,
      data,
    });
  }

  async attemptTransaction(
    contract: any,
    viewContract: any,
    methodName: string,
    params: Array<any>,
    sendOptions: object,
    err: Error
  ): Promise<Web3TransactionResult> {
    if (!(await contract.methods[methodName](...params).call(sendOptions))) throw err;

    const promiEvent = contract.methods[methodName](...params).send(sendOptions);

    return CPKWeb3Provider.promiEventToPromise(promiEvent, sendOptions);
  }

  async attemptSafeProviderSendTx(
    txObj: SafeProviderSendTransaction,
    sendOptions: object
  ): Promise<Web3TransactionResult> {
    const promiEvent = this.web3.eth.sendTransaction({
      ...txObj,
      ...sendOptions,
    });
    return CPKWeb3Provider.promiEventToPromise(promiEvent, sendOptions);
  }

  async attemptSafeProviderMultiSendTxs(
    txs: SafeProviderSendTransaction[]
  ): Promise<{ hash: string }> {
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
          }, (err: Error, result: any) => {
            if (err) return reject(err);
            if (result.error) return reject(result.error);
            return resolve(result.result);
          }),
        )
    );
    return { hash };
  }

  encodeMultiSendCallData(transactions: NonStandardTransaction[]): string {
    const multiSend = new this.web3.eth.Contract(multiSendAbi);
    const standardizedTxs = standardizeTransactions(transactions);

    return multiSend.methods.multiSend(
      `0x${standardizedTxs.map((tx) => [
        this.web3.eth.abi.encodeParameter('uint8', tx.operation).slice(-2),
        this.web3.eth.abi.encodeParameter('address', tx.to).slice(-40),
        this.web3.eth.abi.encodeParameter('uint256', tx.value).slice(-64),
        this.web3.eth.abi.encodeParameter('uint256', this.web3.utils.hexToBytes(tx.data).length).slice(-64),
        tx.data.replace(/^0x/, ''),
      ].join('')).join('')}`,
    ).encodeABI();
  }

  getSendOptions(options: object, ownerAccount: string): object {
    return {
      from: ownerAccount,
      ...(options || {}),
    };
  }
}

export default CPKWeb3Provider;
