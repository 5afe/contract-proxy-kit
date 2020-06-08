import EthLibAdapter, { Contract } from './EthLibAdapter';
import {
  TransactionResult,
  SendOptions,
  CallOptions,
  EthCallTx,
  formatCallTx,
  EthSendTx,
  normalizeGasLimit,
} from '../utils/transactions';
import { Address, Abi } from '../utils/constants';

interface Web3AdapterConfig {
  web3: any;
}

interface Web3TransactionResult extends TransactionResult {
  sendOptions?: SendOptions;
  promiEvent: Promise<any>;
}

function toTxResult(
  promiEvent: any,
  sendOptions?: SendOptions,
): Promise<Web3TransactionResult> {
  return new Promise(
    (resolve, reject) => promiEvent.once(
      'transactionHash',
      (hash: string) => resolve({ sendOptions, promiEvent, hash }),
    ).catch(reject),
  );
}

class Web3ContractAdapter implements Contract {
  constructor(public contract: any) {}

  get address(): Address {
    return this.contract.options.address;
  }

  call(methodName: string, params: any[], options?: CallOptions): Promise<any> {
    return this.contract.methods[methodName](...params).call(options && normalizeGasLimit(options));
  }

  send(methodName: string, params: any[], options?: SendOptions): Promise<Web3TransactionResult> {
    const promiEvent = this.contract.methods[methodName](...params).send(
      options && normalizeGasLimit(options)
    );
    return toTxResult(promiEvent, options);
  }

  async estimateGas(methodName: string, params: any[], options?: CallOptions): Promise<number> {
    return Number(await this.contract.methods[methodName](...params).estimateGas(
      options && normalizeGasLimit(options)
    ));
  }

  encode(methodName: string, params: any[]): string {
    return this.contract.methods[methodName](...params).encodeABI();
  }
}

class Web3Adapter extends EthLibAdapter {
  web3: any;

  constructor({ web3 }: Web3AdapterConfig) {
    super();

    if (!web3) {
      throw new Error('web3 property missing from options');
    }
    this.web3 = web3;
  }

  getProvider(): any {
    return this.web3.currentProvider;
  }

  providerSend(method: string, params: any[]): Promise<any> {
    return (this.web3.currentProvider.host)
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

  async getNetworkId(): Promise<number> {
    return this.web3.eth.net.getId();
  }

  async getAccount(): Promise<Address> {
    return this.web3.eth.defaultAccount || (await this.web3.eth.getAccounts())[0];
  }

  keccak256(data: string): string {
    return this.web3.utils.keccak256(data);
  }

  abiEncode(types: string[], values: any[]): string {
    return this.web3.eth.abi.encodeParameters(types, values);
  }

  abiDecode(types: string[], data: string): any[] {
    return this.web3.eth.abi.decodeParameters(types, data);
  }

  calcCreate2Address(deployer: Address, salt: string, initCode: string): string {
    return this.web3.utils.toChecksumAddress(
      this.web3.utils.soliditySha3(
        '0xff',
        { t: 'address', v: deployer },
        { t: 'bytes32', v: salt },
        this.keccak256(initCode),
      ).slice(-40),
    );
  }

  getCode(address: Address): Promise<string> {
    return this.web3.eth.getCode(address);
  }

  getBlock(blockHashOrBlockNumber: string | number): Promise<{ [property: string]: any }> {
    return this.web3.eth.getBlock(blockHashOrBlockNumber);
  }

  getContract(abi: Abi, address: Address): Contract {
    const contract = new this.web3.eth.Contract(abi, address);
    return new Web3ContractAdapter(contract);
  }

  async getCallRevertData(tx: EthCallTx, block: string | number): Promise<string> {
    try {
      // this block handles Geth/Ganache --noVMErrorsOnRPCResponse
      // use a low level eth_call instead of web3.eth.call so
      // full error data from eth node is available if provider is Web3 1.x
      return await this.providerSend(
        'eth_call',
        [formatCallTx(tx), block],
      );
    } catch (e) {
      let errData = e.data;
      if (!errData && e.message.startsWith('Node error: ')) {
        // parse out error data from eth node if provider is Web3 2.x
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

  ethSendTransaction(tx: EthSendTx): Promise<Web3TransactionResult> {
    return toTxResult(this.web3.eth.sendTransaction(normalizeGasLimit(tx)), tx);
  }
}

export default Web3Adapter;
