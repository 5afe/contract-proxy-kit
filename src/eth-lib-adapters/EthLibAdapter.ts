import { Transaction, SafeProviderSendTransaction } from '../utils/transactions';

type Json =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | Json[];
type JsonObject = { [property: string]: Json }

export type Contract = any;
export type Address = string;
export type Abi = JsonObject[];

export interface EthLibAdapterInitParams {
  isConnectedToSafe: boolean;
  ownerAccount: Address;
  masterCopyAddress: Address;
  proxyFactoryAddress: Address;
  multiSendAddress: Address;
}

export interface EthLibAdapterInitResult {
  multiSend: Contract;
  contract: Contract;
  viewContract?: Contract;
  proxyFactory: Contract;
  viewProxyFactory?: Contract;
}

export interface TransactionResult {
  hash: string;
}

interface EthLibAdapter {
  init({
    isConnectedToSafe,
    ownerAccount,
    masterCopyAddress,
    proxyFactoryAddress,
    multiSendAddress
  }: EthLibAdapterInitParams): Promise<EthLibAdapterInitResult>;

  getProvider(): any;

  getNetworkId(): Promise<number>;

  getOwnerAccount(): Promise<Address>;

  getCode(address: Address): Promise<string>;

  getContract(abi: Abi, address: Address): Contract;

  getContractAddress(contract: Contract): Address;

  getCallRevertData(opts: {
    from: Address;
    to: Address;
    value?: number | string;
    data: string;
    gasLimit?: number | string;
  }): Promise<string>;

  decodeError(revertData: string): string;

  findSuccessfulGasLimit(
    contract: Contract,
    viewContract: Contract,
    methodName: string,
    params: any[],
    sendOptions?: object,
    gasLimit?: number | string,
  ): Promise<number | undefined>;

  execMethod(
    contract: Contract,
    methodName: string,
    params: any[],
    sendOptions?: {
      gasLimit?: number | string;
    }
  ): Promise<TransactionResult>;

  encodeAttemptTransaction(contractAbi: Abi, methodName: string, params: any[]): string;

  attemptSafeProviderSendTx(
    tx: SafeProviderSendTransaction,
    options?: object
  ): Promise<TransactionResult>;

  attemptSafeProviderMultiSendTxs(
    txs: SafeProviderSendTransaction[]
  ): Promise<{ hash: string }>;

  encodeMultiSendCallData(transactions: Transaction[]): string;

  getSendOptions(ownerAccount: Address, options?: object): object | undefined;
}

export default EthLibAdapter;
