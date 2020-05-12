import { OperationType, zeroAddress, predeterminedSaltNonce, Address } from './utils/constants';
import { defaultNetworks, NetworksConfig } from './utils/networks';
import { joinHexData, getHexDataLength } from './utils/hex-data';
import { standardizeTransactions, Transaction, TransactionResult, ExecOptions } from './utils/transactions';
import EthLibAdapter, { Contract } from './eth-lib-adapters/EthLibAdapter';
import cpkFactoryAbi from './abis/CpkFactoryAbi.json';
import safeAbi from './abis/SafeAbi.json';
import multiSendAbi from './abis/MultiSendAbi.json';

interface CPKConfig {
  ethLibAdapter: EthLibAdapter;
  ownerAccount?: string;
  networks?: NetworksConfig;
}

class CPK {
  static Call = OperationType.Call;
  static DelegateCall = OperationType.DelegateCall;

  ethLibAdapter: EthLibAdapter;
  ownerAccount?: Address;
  networks: NetworksConfig;
  multiSend?: Contract;
  contract?: Contract;
  proxyFactory?: Contract;
  masterCopyAddress?: Address;
  fallbackHandlerAddress?: Address;
  isConnectedToSafe = false;
  
  static async create(opts: CPKConfig): Promise<CPK> {
    if (!opts) throw new Error('missing options');
    const cpk = new CPK(opts);
    await cpk.init();
    return cpk;
  }
  
  constructor({
    ethLibAdapter,
    ownerAccount,
    networks,
  }: CPKConfig) {
    if (!ethLibAdapter) {
      throw new Error('ethLibAdapter property missing from options');
    }
    this.ethLibAdapter = ethLibAdapter;
    
    this.setOwnerAccount(ownerAccount);
    this.networks = {
      ...defaultNetworks,
      ...networks,
    };
  }

  async init(): Promise<void> {
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

  async getOwnerAccount(): Promise<Address> {
    if (this.ownerAccount) return this.ownerAccount;
    return this.ethLibAdapter.getAccount();
  }

  setOwnerAccount(ownerAccount?: Address): void {
    this.ownerAccount = ownerAccount;
  }

  get address(): Address {
    if (this.contract == null)
      throw new Error('CPK uninitialized');
    return this.contract.address;
  }

  encodeMultiSendCallData(transactions: Transaction[]): string {
    const multiSend = this.multiSend || this.ethLibAdapter.getContract(multiSendAbi);

    const standardizedTxs = standardizeTransactions(transactions);

    return multiSend.encode('multiSend', [
      joinHexData(standardizedTxs.map((tx) => this.ethLibAdapter.abiEncodePacked(
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
    const ownerAccount = await this.getOwnerAccount();
    const codeAtAddress = await this.ethLibAdapter.getCode(this.address);
    let gasLimit = options && (options.gasLimit || options.gas);
    const sendOptions = { ...options, from: ownerAccount };

    const standardizedTxs = standardizeTransactions(transactions);

    if (this.isConnectedToSafe) {
      if (standardizedTxs.length === 1 && standardizedTxs[0].operation === CPK.Call) {
        const { to, value, data } = transactions[0];
        return this.ethLibAdapter.ethSendTransaction({
          to, value, data,
          ...sendOptions,
        });
      } else {
        // NOTE: DelegateCalls get converted to Calls here
        return {
          hash: await this.ethLibAdapter.providerSend(
            'gs_multi_send',
            transactions.map(
              ({ to, value, data }) => ({ to, value, data }),
            ),
          ),
        };
      }
    } else {
      if (
        this.contract == null ||
        this.multiSend == null ||
        this.proxyFactory == null
      ) {
        throw new Error('CPK uninitialized');
      }

      let to, value, data, operation;
      let tryToGetRevertMessage = false;
      let txFailErrorMessage = 'transaction execution expected to fail';

      if (standardizedTxs.length === 1) {
        ({
          to, value, data, operation,
        } = standardizedTxs[0]);

        tryToGetRevertMessage = operation === OperationType.Call;
      } else {
        to = this.multiSend.address;
        value = 0;
        data = this.encodeMultiSendCallData(standardizedTxs);
        operation = CPK.DelegateCall;
        txFailErrorMessage = `batch ${txFailErrorMessage}`;
      }

      let targetContract, execMethodName, execParams;
      if (codeAtAddress !== '0x') {
        // (r, s, v) where v is 1 means this signature is approved by
        // the address encoded in the value r
        // "Hashes are automatically approved by the sender of the message"
        const safeAutoApprovedSignature = this.ethLibAdapter.abiEncodePacked(
          { type: 'uint256', value: ownerAccount },
          { type: 'uint256', value: 0 },
          { type: 'uint8', value: 1 },
        );
        targetContract = this.contract;
        execMethodName = 'execTransaction';
        execParams = [
          to, value, data, operation,
          0, 0, 0, zeroAddress, zeroAddress,
          safeAutoApprovedSignature,
        ];
      } else {
        txFailErrorMessage = `proxy creation and ${txFailErrorMessage}`;
        targetContract = this.proxyFactory;
        execMethodName = 'createProxyAndExecTransaction';
        execParams = [
          this.masterCopyAddress,
          predeterminedSaltNonce,
          this.fallbackHandlerAddress,
          this.multiSend.address,
          0,
          this.encodeMultiSendCallData(transactions),
          CPK.DelegateCall,
        ];
      }

      gasLimit = await this.ethLibAdapter.findSuccessfulGasLimit(
        targetContract,
        execMethodName,
        execParams,
        sendOptions,
        gasLimit,
      );

      if (gasLimit == null) {
        // no limit will result in a successful execution
        if (tryToGetRevertMessage) {
          try {
            const revertData = await this.ethLibAdapter.getCallRevertData({
              from: this.address, to, value, data, gasLimit: 6000000,
            }, 'latest');
            const errorMessage = this.ethLibAdapter.decodeError(revertData);
            txFailErrorMessage = `${txFailErrorMessage}: ${ errorMessage }`;
          } catch (e) {
            // empty
          }
        }
        throw new Error(txFailErrorMessage);
      }

      return targetContract.send(execMethodName, execParams, { ...sendOptions, gasLimit });
    }
  }
}

export default CPK;
