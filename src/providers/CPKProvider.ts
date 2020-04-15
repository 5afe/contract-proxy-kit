import { NonStandardTransaction, SafeProviderSendTransaction } from '../utils/transactions';

export interface CPKProviderInit {
  isConnectedToSafe: boolean;
  ownerAccount: string;
  masterCopyAddress: string;
  proxyFactoryAddress: string;
  multiSendAddress: string;
}

export interface CPKProviderInitResult {
  multiSend: any;
  contract: any;
  viewContract?: any;
  proxyFactory: any;
  viewProxyFactory?: any;
}

export interface TransactionResult {
  hash: string;
}

abstract class CPKProvider {
  constructor() {
    if (this.constructor === CPKProvider) {
      throw new Error('Abstract classes can\'t be instantiated.');
    }
  }

  abstract getContractAddress(contract: any): string
    
  abstract getSendOptions(options: object, ownerAccount: string): object;
    
  abstract async init({
    isConnectedToSafe,
    ownerAccount,
    masterCopyAddress,
    proxyFactoryAddress,
    multiSendAddress
  }: CPKProviderInit): Promise<CPKProviderInitResult>;

  abstract getProvider(): any;

  abstract async getNetworkId(): Promise<number>;

  abstract getOwnerAccount(): Promise<string>;

  abstract async getCodeAtAddress(contract: any): Promise<string>;

  // abstract getContract(abi, address);

  abstract checkSingleCall(from: string, to: string, value: number, data: string): Promise<any>;

  abstract async attemptTransaction(
    contract: any,
    viewContract: any,
    methodName: string,
    params: Array<any>,
    sendOptions: object,
    err: Error
  ): Promise<TransactionResult>;

  abstract async attemptSafeProviderSendTx(
    tx: SafeProviderSendTransaction,
    options: object
  ): Promise<TransactionResult>;

  abstract async attemptSafeProviderMultiSendTxs(
    transactions: SafeProviderSendTransaction[]
  ): Promise<{ hash: string }>;

  abstract encodeMultiSendCallData(transactions: NonStandardTransaction[]): string;

  // abstract encodeAttemptTransaction(contractAbi, methodName, params);

  // abstract getGasPrice();

  // abstract getSafeNonce(safeAddress);
}

export default CPKProvider;
