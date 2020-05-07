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

interface CPKProvider {
  init({
    isConnectedToSafe,
    ownerAccount,
    masterCopyAddress,
    proxyFactoryAddress,
    multiSendAddress
  }: CPKProviderInit): Promise<CPKProviderInitResult>;

  getProvider(): any;

  getNetworkId(): Promise<number>;

  getOwnerAccount(): Promise<string>;

  getCodeAtAddress(contract: any): Promise<string>;

  getContract(abi: Array<object>, address: string): any;

  getContractAddress(contract: any): string;

  getCallRevertData(opts: {
    from: string;
    to: string;
    value?: number | string;
    data: string;
    gasLimit?: number | string;
  }): Promise<string>;

  checkMethod(
    contract: any,
    viewContract: any,
    methodName: string,
    params: Array<any>,
    sendOptions?: object,
    gasLimit?: number | string,
    err?: Error,
  ): Promise<number>;

  execMethod(
    contract: any,
    methodName: string,
    params: Array<any>,
    sendOptions?: {
      gasLimit?: number | string;
    }
  ): Promise<TransactionResult>;

  encodeAttemptTransaction(contractAbi: object[], methodName: string, params: any[]): string;

  attemptSafeProviderSendTx(
    tx: SafeProviderSendTransaction,
    options?: object
  ): Promise<TransactionResult>;

  attemptSafeProviderMultiSendTxs(
    transactions: SafeProviderSendTransaction[]
  ): Promise<{ hash: string }>;

  encodeMultiSendCallData(transactions: NonStandardTransaction[]): string;

  getSendOptions(ownerAccount: string, options?: object): object | undefined;
}

export default CPKProvider;
