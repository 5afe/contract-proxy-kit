import { TransactionResult, StandardTransaction } from '../utils/transactions';
import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter';
import { Address } from '../utils/basicTypes';

export interface TransactionManagerConfig {
  name: string;
  url?: string;
}

export interface CPKContracts {
  safeContract: Contract;
  proxyFactory?: Contract;
  masterCopyAddress: Address;
  fallbackHandlerAddress: Address;
}

export interface ExecTransactionProps {
  safeExecTxParams: StandardTransaction;
  signature: string;
  contracts: CPKContracts;
  ethLibAdapter: EthLibAdapter;
  isSingleTx: boolean;
  isDeployed: boolean;
  sendOptions: any;
}

interface TransactionManager {
  config: TransactionManagerConfig;

  execTransactions({
    safeExecTxParams,
    signature,
    contracts,
    ethLibAdapter,
    isSingleTx,
    isDeployed,
    sendOptions,
  }: ExecTransactionProps): Promise<TransactionResult>;
}

export default TransactionManager;
