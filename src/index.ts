import initSdk, { SafeInfo, SdkInstance } from '@gnosis.pm/safe-apps-sdk';
import { predeterminedSaltNonce } from './utils/constants';
import { Address } from './utils/basicTypes';
import { OperationType, standardizeSafeAppsTransaction } from './utils/transactions';
import { defaultNetworks, NetworksConfig } from './config/networks';
import { joinHexData, getHexDataLength } from './utils/hexData';
import {
  Transaction,
  TransactionResult,
  ExecOptions,
  standardizeTransaction,
  StandardTransaction,
  normalizeGasLimit,
} from './utils/transactions';
import EthLibAdapter, { Contract } from './ethLibAdapters/EthLibAdapter';
import TransactionManager, { CPKContracts, TransactionManagerNames } from './transactionManagers/TransactionManager';
import CpkTransactionManager from './transactionManagers/CpkTransactionManager';
import cpkFactoryAbi from './abis/CpkFactoryAbi.json';
import safeAbi from './abis/SafeAbi.json';
import multiSendAbi from './abis/MultiSendAbi.json';
import SafeAppsSdkTransactionManager from './transactionManagers/SafeAppsSdkTransactionManager';

export interface CPKConfig {
  ethLibAdapter: EthLibAdapter;
  transactionManager?: TransactionManager;
  ownerAccount?: string;
  networks?: NetworksConfig;
}

class CPK {
  static Call = OperationType.Call;
  static DelegateCall = OperationType.DelegateCall;

  appsSdk: SdkInstance;
  safeAppInfo?: SafeInfo;

  ethLibAdapter?: EthLibAdapter;
  transactionManager?: TransactionManager;
  networks: NetworksConfig;
  ownerAccount?: Address;
  isConnectedToSafe = false;

  contract?: Contract;
  multiSend?: Contract;
  proxyFactory?: Contract;
  masterCopyAddress?: Address;
  fallbackHandlerAddress?: Address;

  private setSafeInfo = (safeInfo: SafeInfo): void => {
    this.safeAppInfo = safeInfo;

    this.setOwnerAccount(safeInfo.safeAddress);

    //if (!this.transactionManager) {
    this.transactionManager = new SafeAppsSdkTransactionManager();
    this.isConnectedToSafe = true;
    //}
  }

  static async create(opts?: CPKConfig): Promise<CPK> {
    const cpk = new CPK(opts);
    
    if (opts) {
      await cpk.init();
    }
    return cpk;
  }
  
  constructor(opts?: CPKConfig) {
    this.appsSdk = initSdk();
    this.appsSdk.addListeners({
      onSafeInfo: this.setSafeInfo,
    });

    this.networks = {
      ...defaultNetworks
    };
    if (!opts) {
      return;
    }

    const { ethLibAdapter, transactionManager, ownerAccount, networks } = opts;
    if (!ethLibAdapter) {
      throw new Error('ethLibAdapter property missing from options');
    }
    this.ethLibAdapter = ethLibAdapter;
    this.transactionManager = transactionManager
      ? transactionManager
      : new CpkTransactionManager();
    this.ownerAccount = ownerAccount;
    this.networks = {
      ...defaultNetworks,
      ...networks,
    };
  }

  async init(): Promise<void> {
    if (!this.ethLibAdapter) {
      throw new Error('CPK uninitialized ethLibAdapter');
    }

    const networkId = await this.ethLibAdapter.getNetworkId();
    const network = this.networks[networkId];
    if (!network) {
      throw new Error(`unrecognized network ID ${networkId}`);
    }

    this.masterCopyAddress = network.masterCopyAddress;
    this.fallbackHandlerAddress = network.fallbackHandlerAddress;

    const ownerAccount = await this.getOwnerAccount();

    const provider = this.ethLibAdapter.getProvider();
    const wc = provider && (provider.wc || (provider.connection && provider.connection.wc));
    if (
      wc && wc.peerMeta && wc.peerMeta.name
      && wc.peerMeta.name.startsWith('Gnosis Safe')
    ) {
      this.isConnectedToSafe = true;
    }

    this.multiSend = this.ethLibAdapter.getContract(multiSendAbi, network.multiSendAddress);

    if (this.isConnectedToSafe) {
      this.contract = this.ethLibAdapter.getContract(safeAbi, ownerAccount);
    } else {
      this.proxyFactory = this.ethLibAdapter.getContract(
        cpkFactoryAbi,
        network.proxyFactoryAddress,
      );

      const salt = this.ethLibAdapter.keccak256(this.ethLibAdapter.abiEncode(
        ['address', 'uint256'],
        [ownerAccount, predeterminedSaltNonce],
      ));
      const initCode = this.ethLibAdapter.abiEncodePacked(
        { type: 'bytes', value: await this.proxyFactory.call('proxyCreationCode', []) },
        {
          type: 'bytes',
          value: this.ethLibAdapter.abiEncode(['address'], [network.masterCopyAddress]),
        },
      );
      const proxyAddress = this.ethLibAdapter.calcCreate2Address(
        this.proxyFactory.address,
        salt,
        initCode
      );

      this.contract = this.ethLibAdapter.getContract(safeAbi, proxyAddress);
    }
  }

  isSafeApp(): boolean {
    return !!this.safeAppInfo &&
      this.transactionManager?.config.name === TransactionManagerNames.SafeAppsSdkTransactionManager;
  }

  async getOwnerAccount(): Promise<Address> {
    if (this.ownerAccount) {
      return this.ownerAccount;
    }
    if (!this.ethLibAdapter) {
      throw new Error('CPK uninitialized ethLibAdapter');
    }
    return this.ethLibAdapter.getAccount();
  }

  get address(): Address | undefined {
    if (this.isSafeApp()) {
      return this.safeAppInfo?.safeAddress;
    }
    if (!this.contract) {
      return undefined;
    }
    return this.contract.address;
  }

  setOwnerAccount(ownerAccount?: Address): void {
    this.ownerAccount = ownerAccount;
  }

  setEthLibAdapter(ethLibAdapter: EthLibAdapter): void {
    this.ethLibAdapter = ethLibAdapter;
  }

  setTransactionManager(transactionManager: TransactionManager): void {
    this.transactionManager = transactionManager;
  }

  setNetworks(networks: NetworksConfig): void {
    this.networks = {
      ...defaultNetworks,
      ...networks,
    };
  }

  encodeMultiSendCallData(transactions: Transaction[]): string {
    if (!this.ethLibAdapter) {
      throw new Error('CPK ethLibAdapter uninitialized');
    }

    const multiSend = this.multiSend || this.ethLibAdapter.getContract(multiSendAbi);
    const standardizedTxs = transactions.map(standardizeTransaction);

    const ethLibAdapter = this.ethLibAdapter;
    return multiSend.encode('multiSend', [
      joinHexData(standardizedTxs.map((tx) => ethLibAdapter.abiEncodePacked(
        { type: 'uint8', value: tx.operation },
        { type: 'address', value: tx.to },
        { type: 'uint256', value: tx.value },
        { type: 'uint256', value: getHexDataLength(tx.data) },
        { type: 'bytes', value: tx.data },
      ))),
    ]);
  }

  async execTransactions(
    transactions: Transaction[],
    options?: ExecOptions,
  ): Promise<TransactionResult> {
    if (!this.transactionManager) {
      throw new Error('CPK transactionManager uninitialized');
    }

    if (this.isSafeApp() && transactions.length >= 1) {
      const standardizedTxs = transactions.map(standardizeSafeAppsTransaction);
      return this.transactionManager.execTransactions({
        appsSdk: this.appsSdk,
        transactions: standardizedTxs
      });
    }

    if (!this.address) {
      throw new Error('CPK address uninitialized');
    }
    if (!this.contract) {
      throw new Error('CPK contract uninitialized');
    }
    if (!this.masterCopyAddress) {
      throw new Error('CPK masterCopyAddress uninitialized');
    }
    if (!this.fallbackHandlerAddress) {
      throw new Error('CPK fallbackHandlerAddress uninitialized');
    }
    if (!this.ethLibAdapter) {
      throw new Error('CPK ethLibAdapter uninitialized');
    }

    const ownerAccount = await this.getOwnerAccount();
    const safeExecTxParams = this.getSafeExecTxParams(transactions);
    const sendOptions = normalizeGasLimit({ ...options, from: ownerAccount });

    const codeAtAddress = await this.ethLibAdapter.getCode(this.address);
    const isDeployed = codeAtAddress !== '0x';

    const txManager = !isDeployed
      ? new CpkTransactionManager()
      : this.transactionManager;

    const cpkContracts: CPKContracts = {
      safeContract: this.contract,
      proxyFactory: this.proxyFactory,
      masterCopyAddress: this.masterCopyAddress,
      fallbackHandlerAddress: this.fallbackHandlerAddress,
    };


    return txManager.execTransactions({
      ownerAccount,
      safeExecTxParams,
      transactions,
      contracts: cpkContracts,
      ethLibAdapter: this.ethLibAdapter,
      isDeployed,
      isConnectedToSafe: this.isConnectedToSafe,
      sendOptions,
    });
  }

  private getSafeExecTxParams(transactions: Transaction[]): StandardTransaction {
    if (transactions.length === 1) {
      return standardizeTransaction(transactions[0]);
    }

    if (!this.multiSend) {
      throw new Error('CPK MultiSend uninitialized');
    }

    return {
      to: this.multiSend.address,
      value: 0,
      data: this.encodeMultiSendCallData(transactions),
      operation: CPK.DelegateCall,
    };
  }
}

export default CPK;
