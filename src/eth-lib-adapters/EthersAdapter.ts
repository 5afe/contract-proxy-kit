import EthLibAdapter, { Contract } from './EthLibAdapter';
import {
  EthTx, TransactionResult, CallOptions, SendOptions, EthCallTx, formatCallTx
} from '../utils/transactions';
import { zeroAddress, Address, Abi } from '../utils/constants';

interface EthersAdapterConfig {
  ethers: any;
  signer: any;
}

interface EthersTransactionResult extends TransactionResult {
  transactionResponse: object;
}

class EthersContractAdapter implements Contract {
  contract: any;
  ethersAdapter: EthersAdapter;

  constructor(contract: any, ethersAdapter: EthersAdapter) {
    this.contract = contract;
    this.ethersAdapter = ethersAdapter;
  }

  get address(): Address {
    return this.contract.address;
  }

  async call(methodName: string, params: any[], options?: CallOptions): Promise<any> {
    const data = this.encode(methodName, params);
    const resHex = await this.ethersAdapter.ethCall({
      ...options,
      to: this.address,
      data,
    }, 'latest');
    const rets = this.contract.interface.functions[methodName].decode(resHex);

    if (rets.length === 1)
      return rets[0];

    return rets;
  }

  async send(
    methodName: string,
    params: any[],
    options?: SendOptions,
  ): Promise<EthersTransactionResult> {
    let transactionResponse;
    if (options != null) {
      const { from, ...sendOptions } = options;
      const { getAddress } = this.ethersAdapter.ethers.utils;
      const expectedFrom = await this.ethersAdapter.getAccount();
      if (getAddress(from) !== expectedFrom) {
        throw new Error(`want from ${expectedFrom} but got from ${from}`);
      }
      transactionResponse = await this.contract.functions[methodName](
        ...params,
        sendOptions,
      );
    } else {
      transactionResponse = await this.contract.functions[methodName](
        ...params,
      );
    }
    return { transactionResponse, hash: transactionResponse.hash };
  }

  async estimateGas(methodName: string, params: any[], options?: CallOptions): Promise<number> {
    return (await this.contract.estimate[methodName](
      ...params,
      ...(!options ? [] : [options]),
    )).toNumber();
  }

  encode(methodName: string, params: any[]): string {
    return this.contract.interface.functions[methodName].encode(params);
  }
}

class EthersAdapter extends EthLibAdapter {
  ethers: any;
  signer: any;

  constructor({ ethers, signer }: EthersAdapterConfig) {
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

  getProvider(): any {
    // eslint-disable-next-line no-underscore-dangle
    return this.signer.provider.provider || this.signer.provider._web3Provider;
  }

  providerSend(method: string, params: any[]): Promise<any> {
    return this.signer.provider.send(method, params);
  }

  async getNetworkId(): Promise<number> {
    return (await this.signer.provider.getNetwork()).chainId;
  }

  async getAccount(): Promise<Address> {
    return this.signer.getAddress();
  }

  keccak256(data: string): string {
    return this.ethers.utils.keccak256(data);
  }

  abiEncode(types: string[], values: any[]): string {
    return this.ethers.utils.defaultAbiCoder.encode(types, values);
  }

  abiDecode(types: string[], data: string): any[] {
    return this.ethers.utils.defaultAbiCoder.decode(types, data);
  }

  getContract(abi: Abi, address?: Address): Contract {
    const contract = new this.ethers.Contract(address || zeroAddress, abi, this.signer);
    return new EthersContractAdapter(contract, this);
  }

  calcCreate2Address(deployer: Address, salt: string, initCode: string): string {
    return this.ethers.utils.getAddress(
      this.ethers.utils.solidityKeccak256(['bytes', 'address', 'bytes32', 'bytes32'], [
        '0xff',
        deployer,
        salt,
        this.keccak256(initCode),
      ]).slice(-40),
    );
  }

  getCode(address: Address): Promise<string> {
    return this.signer.provider.getCode(address);
  }

  getBlock(blockHashOrBlockNumber: string | number): Promise<{ [property: string]: any }> {
    return this.signer.provider.getBlock(blockHashOrBlockNumber);
  }

  async getCallRevertData(tx: EthCallTx): Promise<string> {
    try {
      // Handle Geth/Ganache --noVMErrorsOnRPCResponse revert data
      return await this.ethCall(tx, 'latest');
    } catch (e) {
      if (typeof e.data === 'string' && e.data.startsWith('Reverted 0x')) {
        // handle OpenEthereum revert data format
        return e.data.slice(9);
      }

      // handle Ganache revert data format
      const txHash = Object.getOwnPropertyNames(e.data).filter((k) => k.startsWith('0x'))[0];
      return e.data[txHash].return;
    }
  }

  ethCall(
    tx: EthCallTx,
    block: number | string,
  ): Promise<string> {
    // This is to workaround https://github.com/ethers-io/ethers.js/issues/819
    return this.providerSend('eth_call', [
      formatCallTx(tx),
      block,
    ]);
  }

  async ethSendTransaction(tx: EthTx, options?: SendOptions): Promise<EthersTransactionResult> {
    const sendOptions: { from?: string } = { ...options };
    delete sendOptions.from;
    const transactionResponse = await this.signer.sendTransaction({
      ...tx,
      ...sendOptions,
    });
    return { transactionResponse, hash: transactionResponse.hash };
  }

  getSendOptions(ownerAccount: Address, options?: CallOptions): SendOptions {
    return {
      from: ownerAccount,
      ...options,
    };
  }
}

export default EthersAdapter;
