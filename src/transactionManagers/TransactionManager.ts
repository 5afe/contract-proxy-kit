import { TransactionResult, StandardTransaction, Transaction } from '../utils/transactions';
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
  ownerAccount: Address,
  safeExecTxParams: StandardTransaction;
  transactions: Transaction[];
  contracts: CPKContracts;
  ethLibAdapter: EthLibAdapter;
  isDeployed: boolean;
  isConnectedToSafe: boolean;
  sendOptions: any;
}

interface TransactionManager {
  config: TransactionManagerConfig;

  execTransactions({
    ownerAccount,
    safeExecTxParams,
    transactions,
    contracts,
    ethLibAdapter,
    isDeployed,
    isConnectedToSafe,
    sendOptions,
  }: ExecTransactionProps): Promise<TransactionResult>;
}

export default TransactionManager;
