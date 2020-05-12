import { EthTx, TransactionResult, SendOptions, CallOptions, EthCallTx } from '../utils/transactions';
import { joinHexData } from '../utils/hex-data';
import { Address, Abi, NumberLike } from '../utils/constants';

export interface Contract {
  address: Address;
  call(methodName: string, params: any[], options?: CallOptions): Promise<any>;
  send(methodName: string, params: any[], options?: SendOptions): Promise<TransactionResult>;
  estimateGas(methodName: string, params: any[], options?: CallOptions): Promise<number>;
  encode(methodName: string, params: any[]): string;
}

abstract class EthLibAdapter {
  abstract keccak256(data: string): string;

  abstract abiEncode(types: string[], values: any[]): string;

  abstract abiDecode(types: string[], data: string): any[];

  abstract calcCreate2Address(deployer: Address, salt: string, initCode: string): string;

  abstract getProvider(): any;

  abstract providerSend(method: string, params: any[]): Promise<any>;

  abstract getNetworkId(): Promise<number>;

  abstract getAccount(): Promise<Address>;

  abstract getCode(address: Address): Promise<string>;

  abstract getBlock(blockHashOrBlockNumber: string | number): Promise<{ [property: string]: any }>

  abstract getContract(abi: Abi, address?: Address): Contract;

  abstract getCallRevertData(tx: EthCallTx): Promise<string>;

  abstract ethSendTransaction(tx: EthTx, options?: SendOptions): Promise<TransactionResult>;

  abiEncodePacked(...params: { type: string; value: any }[]): string {
    return joinHexData(params.map(({ type, value }) => {
      const encoded = this.abiEncode([type], [value]);

      if (type === 'bytes' || type === 'string') {
        const bytesLength = parseInt(encoded.slice(66, 130), 16);
        return encoded.slice(130, 130 + 2 * bytesLength);
      }

      let typeMatch = type.match(/^(?:u?int\d*|bytes\d+|address)\[\]$/);
      if (typeMatch != null) {
        return encoded.slice(130);
      }

      if (type.startsWith('bytes')) {
        const bytesLength = parseInt(type.slice(5));
        return encoded.slice(2, 2 + 2 * bytesLength);
      }

      typeMatch = type.match(/^u?int(\d*)$/);
      if (typeMatch != null) {
        if (typeMatch[1] !== '') {
          const bytesLength = parseInt(typeMatch[1]) / 8;
          return encoded.slice(-2 * bytesLength);
        }
        return encoded.slice(-64);
      }

      if (type === 'address') {
        return encoded.slice(-40);
      }

      throw new Error(`unsupported type ${type}`);
    }));
  }

  decodeError(revertData: string): string {
    if (!revertData.startsWith('0x08c379a0'))
      return revertData;

    return this.abiDecode(['string'], `0x${revertData.slice(10)}`)[0];
  }

  async findSuccessfulGasLimit(
    contract: Contract,
    methodName: string,
    params: any[],
    sendOptions: SendOptions,
    gasLimit?: NumberLike,
  ): Promise<number | undefined> {
    if (gasLimit == null) {
      const blockGasLimit = Number((await this.getBlock('latest')).gasLimit.toString());

      const gasEstimateOptions = { ...sendOptions, gas: blockGasLimit };
      if (!(await contract.call(methodName, params, gasEstimateOptions))) return;

      let gasLow = await contract.estimateGas(methodName, params, sendOptions);
      let gasHigh = blockGasLimit;

      gasEstimateOptions.gas = gasLow;

      if (!(await contract.call(methodName, params, gasEstimateOptions))) {
        while (gasLow <= gasHigh) {
          const testGasLimit = Math.floor((gasLow + gasHigh) * 0.5);
          gasEstimateOptions.gas = testGasLimit;

          if (await contract.call(methodName, params, gasEstimateOptions)) {
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

    } else if (!(await contract.call(methodName, params, sendOptions))) return;

    return Number(gasLimit);
  }
}

export default EthLibAdapter;
