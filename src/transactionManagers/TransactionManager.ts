import { SdkInstance } from '@gnosis.pm/safe-apps-sdk';
import { TransactionResult, StandardTransaction, Transaction, StandardSafeAppsTransaction } from '../utils/transactions';
import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter';
import { Address } from '../utils/basicTypes';

export enum TransactionManagerNames {
  CpkTransactionManager = 'CpkTransactionManager',
  SafeRelayTransactionManager = 'SafeRelayTransactionManager',
  SafeAppsSdkTransactionManager = 'SafeAppsSdkTransactionManager'
}

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

export interface ExecTransactionSafeAppsProps {
  appsSdk: SdkInstance;
  transactions: StandardSafeAppsTransaction[];
}

interface TransactionManager {
  config: TransactionManagerConfig;

  execTransactions(
    options: ExecTransactionProps | ExecTransactionSafeAppsProps
  ): Promise<TransactionResult>;
}

export default TransactionManager;
