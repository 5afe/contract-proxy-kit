import EthLibAdapter, { Contract } from '../EthLibAdapter';
import EthersV4ContractAdapter from './EthersV4ContractAdapter';
import EthersV5ContractAdapter from './EthersV5ContractAdapter';
import {
  TransactionResult, CallOptions, SendOptions, EthCallTx, formatCallTx, EthSendTx, normalizeGasLimit
} from '../../utils/transactions';
import { zeroAddress } from '../../utils/constants';
import { Address, Abi } from '../../utils/basicTypes';

export interface EthersAdapterConfig {
  ethers: any;
  signer: any;
}

export interface EthersTransactionResult extends TransactionResult {
  transactionResponse: Record<string, any>;
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

  signMessage(message: string): Promise<string> {
    const messageArray = this.ethers.utils.arrayify(message);
    return this.signer.signMessage(messageArray);
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
    const ethersVersion = this.ethers.version;

    // TO-DO: Use semver comparison
    if (ethersVersion.split('.')[0] === '4') {
      return new EthersV4ContractAdapter(contract, this);
    }
    if (ethersVersion.split('.')[0] === 'ethers/5') {
      return new EthersV5ContractAdapter(contract, this);
    }
    throw new Error(`ethers version ${ethersVersion} not supported`);
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

  async getCallRevertData(tx: EthCallTx, block: string | number): Promise<string> {
    try {
      // Handle old Geth/Ganache --noVMErrorsOnRPCResponse revert data
      return await this.ethCall(tx, block);
    } catch (e) {
      if (typeof e.data === 'string') {
        if (e.data.startsWith('Reverted 0x'))
          // handle OpenEthereum revert data format
          return e.data.slice(9);

        if (e.data.startsWith('0x'))
          // handle new Geth format
          return e.data;
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

  async checkFromAddress(from: Address): Promise<void> {
    const { getAddress } = this.ethers.utils;
    const expectedFrom = await this.getAccount();
    if (getAddress(from) !== expectedFrom) {
      throw new Error(`want from ${expectedFrom} but got from ${from}`);
    }
  }

  async ethSendTransaction(tx: EthSendTx): Promise<EthersTransactionResult> {
    const { from, gas, ...sendTx } = normalizeGasLimit(tx);
    await this.checkFromAddress(from);
    const transactionResponse = await this.signer.sendTransaction({ gasLimit: gas, ...sendTx });
    return { transactionResponse, hash: transactionResponse.hash };
  }

  toSafeRelayTxResult(txHash: string, tx: Record<string, any>): Promise<EthersTransactionResult> {
    return new Promise(
      (resolve, reject) => resolve({
        transactionResponse: new Promise(
          (resolve, reject) => resolve(tx),
        ),
        hash: txHash
      }),
    );
  }

  getSendOptions(ownerAccount: Address, options?: CallOptions): SendOptions {
    return {
      from: ownerAccount,
      ...options,
    };
  }
}

export default EthersAdapter;
