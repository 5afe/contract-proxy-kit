import CPKProvider, { CPKProviderInit, CPKProviderInitResult, TransactionResult } from './CPKProvider';
import { predeterminedSaltNonce, zeroAddress } from '../utils/constants';
import {
  standardizeTransactions,
  NonStandardTransaction,
  SafeProviderSendTransaction,
} from '../utils/transactions';
import cpkFactoryAbi from '../abis/CpkFactoryAbi.json';
import safeAbi from '../abis/SafeAbi.json';
import multiSendAbi from '../abis/MultiSendAbi.json';

interface CPKWeb3ProviderConfig {
  web3: any;
}

interface Web3TransactionResult extends TransactionResult {
  sendOptions?: object;
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
    const multiSend = this.getContract(multiSendAbi, multiSendAddress);
    let contract;
    let proxyFactory;

    if (isConnectedToSafe) {
      contract = this.getContract(safeAbi, ownerAccount);
    } else {
      proxyFactory = this.getContract(cpkFactoryAbi, proxyFactoryAddress);
      const create2Salt = this.web3.utils.keccak256(this.web3.eth.abi.encodeParameters(
        ['address', 'uint256'],
        [ownerAccount, predeterminedSaltNonce],
      ));

      contract = this.getContract(safeAbi, this.web3.utils.toChecksumAddress(
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

  getContract(abi: Array<object>, address: string): any {
    const contract = new this.web3.eth.Contract(abi, address);
    return contract;
  }

  getContractAddress(contract: any): string {
    return contract.options.address;
  }

  static promiEventToPromise(
    promiEvent: any,
    sendOptions?: object,
  ): Promise<Web3TransactionResult> {
    return new Promise(
      (resolve, reject) => promiEvent.once(
        'transactionHash',
        (hash: string) => resolve({ sendOptions, promiEvent, hash }),
      ).catch(reject),
    );
  }

  providerSend(method: string, params: any[]): Promise<any> {
    return this.web3.currentProvider.host === 'CustomProvider'
      ? this.web3.currentProvider.send(
        method,
        params,
      ) : new Promise(
        (resolve, reject) => this.web3.currentProvider.send({
          jsonrpc: '2.0',
          id: new Date().getTime(),
          method,
          params,
        }, (err: any, result: any) => {
          if (err) return reject(err);
          if (result.error) return reject(result.error);
          return resolve(result.result);
        }),
      );
  }

  async getCallRevertData({
    from, to, value, data, gasLimit,
  }: {
    from: string;
    to: string;
    value?: number | string;
    data: string;
    gasLimit?: number | string;
  }): Promise<string> {
    try {
      // throw with full error data if provider is Web3 1.x
      // by using a low level eth_call instead of web3.eth.call
      // this also handles Geth/Ganache --noVMErrorsOnRPCResponse
      const payload: {
        from: string;
        to: string;
        value?: string;
        data: string;
        gas?: string;
      } = { from, to, data };
      if (value != null) payload.value = this.web3.utils.toHex(value);
      if (gasLimit != null) payload.gas = this.web3.utils.toHex(gasLimit);
      return await this.providerSend(
        'eth_call',
        [payload, 'latest'],
      );
    } catch (e) {
      let errData = e.data;
      if (errData == null && e.message.startsWith('Node error: ')) {
        // parse out error data if provider is Web3 2.x
        errData = JSON.parse(e.message.slice(12)).data;
      }
      
      if (typeof errData === 'string' && errData.startsWith('Reverted 0x')) {
        // handle OpenEthereum revert data format
        return errData.slice(9);
      }

      // handle Ganache revert data format
      const txHash = Object.getOwnPropertyNames(errData).filter((k) => k.startsWith('0x'))[0];
      return errData[txHash].return;
    }
  }

  decodeError(revertData: string): string {
    if (!revertData.startsWith('0x08c379a0'))
      return revertData;

    return this.web3.eth.abi.decodeParameters(['string'], `0x${revertData.slice(10)}`)[0];
  }

  async findSuccessfulGasLimit(
    contract: any,
    viewContract: any,
    methodName: string,
    params: Array<any>,
    sendOptions?: object,
    gasLimit?: number | string,
  ): Promise<number | undefined> {
    const txObj = contract.methods[methodName](...params);

    if (gasLimit == null) {
      const blockGasLimit = (await this.web3.eth.getBlock('latest')).gasLimit;

      const gasEstimateOptions = { ...sendOptions, gas: blockGasLimit };
      if (!(await txObj.call(gasEstimateOptions))) return;

      let gasLow = Number(await txObj.estimateGas(gasEstimateOptions));
      let gasHigh = blockGasLimit;

      gasEstimateOptions.gas = gasLow;

      if (!(await txObj.call(gasEstimateOptions))) {
        while (gasLow <= gasHigh) {
          const testGasLimit = Math.floor((gasLow + gasHigh) * 0.5);
          gasEstimateOptions.gas = testGasLimit;

          if (await txObj.call(gasEstimateOptions)) {
            // values > gasHigh will work
            gasHigh = testGasLimit - 1;
          } else {
            // values <= gasLow will work
            gasLow = testGasLimit + 1;
          }
        }
        // gasLow is now our target gas value
      }

      return gasLow;

    } else if (!(await txObj.call({ ...sendOptions, gas: gasLimit }))) return;

    return Number(gasLimit);
  }

  async execMethod(
    contract: any,
    methodName: string,
    params: Array<any>,
    sendOptions?: {
      gasLimit?: number | string;
    }
  ): Promise<Web3TransactionResult> {

    const txObject = contract.methods[methodName](...params);
    const gasLimit = sendOptions && (
      sendOptions.gasLimit || await txObject.estimateGas(sendOptions)
    );
    const actualSendOptions = { ...sendOptions, gas: gasLimit };
    const promiEvent = txObject.send(actualSendOptions);

    return CPKWeb3Provider.promiEventToPromise(promiEvent, sendOptions);
  }

  encodeAttemptTransaction(contractAbi: object[], methodName: string, params: any[]): string {
    const contract = this.getContract(contractAbi, zeroAddress);
    const payload = contract.methods[methodName](...params).encodeABI();
    return payload;
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
    const multiSend = this.getContract(multiSendAbi, zeroAddress);
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

  getSendOptions(ownerAccount: string, options?: object): object | undefined {
    return {
      from: ownerAccount,
      ...(options || {}),
    };
  }

  getGasPrice(): Promise<number> {
    return this.web3.eth.getGasPrice();
  }

  getSafeNonce(safeAddress: string): Promise<number> {
    const safeContract = this.getContract(safeAbi, safeAddress);
    return safeContract.methods.nonce().call();
  }
}

export default CPKWeb3Provider;
