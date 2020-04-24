import CPKProvider, { CPKProviderInit, CPKProviderInitResult, TransactionResult } from './CPKProvider';
import { zeroAddress, predeterminedSaltNonce } from '../utils/constants';
import {
  standardizeTransactions,
  NonStandardTransaction,
  SafeProviderSendTransaction
} from '../utils/transactions';
import cpkFactoryAbi from '../abis/CpkFactoryAbi.json';
import safeAbi from '../abis/SafeAbi.json';
import multiSendAbi from '../abis/MultiSendAbi.json';

interface CPKEthersProviderConfig {
  ethers: any;
  signer: any;
}

interface EthersTransactionResult extends TransactionResult {
  transactionResponse: object;
}

class CPKEthersProvider implements CPKProvider {
  ethers: any;
  signer: any;

  constructor({ ethers, signer }: CPKEthersProviderConfig) {
    if (!ethers) {
      throw new Error('ethers property missing from options');
    }
    if (!signer) {
      throw new Error('signer property missing from options');
    }
    this.ethers = ethers;
    this.signer = signer;
  }

  async init({
    isConnectedToSafe, ownerAccount, masterCopyAddress, proxyFactoryAddress, multiSendAddress,
  }: CPKProviderInit): Promise<CPKProviderInitResult> {
    const abiToViewAbi = (abi: any): object[] => abi.map(({
      constant, // eslint-disable-line
      stateMutability, // eslint-disable-line
      ...rest
    }: any) => Object.assign(rest, {
      constant: true,
      stateMutability: 'view',
    }));

    const multiSend = this.getContract(multiSendAbi, multiSendAddress);
    let contract;
    let viewContract;
    let proxyFactory;
    let viewProxyFactory;

    if (isConnectedToSafe) {
      contract = this.getContract(safeAbi, ownerAccount);
      viewContract = this.getContract(abiToViewAbi(safeAbi), ownerAccount);
    } else {
      proxyFactory = this.getContract(cpkFactoryAbi, proxyFactoryAddress);
      viewProxyFactory = this.getContract(abiToViewAbi(cpkFactoryAbi), proxyFactoryAddress);

      const create2Salt = this.ethers.utils.keccak256(this.ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256'],
        [ownerAccount, predeterminedSaltNonce],
      ));

      const address = this.ethers.utils.getAddress(
        this.ethers.utils.solidityKeccak256(['bytes', 'address', 'bytes32', 'bytes32'], [
          '0xff',
          proxyFactory.address,
          create2Salt,
          this.ethers.utils.solidityKeccak256(['bytes', 'bytes'], [
            await proxyFactory.proxyCreationCode(),
            this.ethers.utils.defaultAbiCoder.encode(['address'], [masterCopyAddress]),
          ]),
        ]).slice(-40),
      );

      contract = this.getContract(safeAbi, address);
      viewContract = this.getContract(abiToViewAbi(safeAbi), address);
    }

    return {
      multiSend,
      contract,
      viewContract,
      proxyFactory,
      viewProxyFactory,
    };
  }

  getProvider(): any {
    // eslint-disable-next-line no-underscore-dangle
    return this.signer.provider.provider || this.signer.provider._web3Provider;
  }

  async getNetworkId(): Promise<number> {
    return (await this.signer.provider.getNetwork()).chainId;
  }

  async getOwnerAccount(): Promise<string> {
    return this.signer.getAddress();
  }

  async getCodeAtAddress(contract: any): Promise<string> {
    return this.signer.provider.getCode(this.getContractAddress(contract));
  }

  getContract(abi: Array<object>, address: string): any {
    const contract = new this.ethers.Contract(address, abi, this.signer);
    return contract;
  }

  getContractAddress(contract: any): string {
    return contract.address;
  }

  checkSingleCall({ from, to, value, data }: {
    from: string;
    to: string;
    value: number | string;
    data: string;
  }): Promise<any> {
    return this.signer.provider.call({
      from,
      to,
      value,
      data,
    });
  }

  async getCallRevertData({
    from, to, value, data,
  }: {
    from: string;
    to: string;
    value: number | string;
    data: string;
  }): Promise<string> {
    try {
      // Handle Geth/Ganache --noVMErrorsOnRPCResponse revert data
      return await this.signer.provider.call({
        from,
        to,
        value,
        data,
      });
    } catch (e) {
      if (typeof e.data === 'string' && e.data.startsWith('Reverted 0x')) {
        // handle OpenEthereum revert data format
        return e.data.slice(9);
      }

      // handle Ganache revert data format
      const txHash = Object.getOwnPropertyNames(e.data).filter((k) => k.startsWith('0x'))[0];
      return e.data[txHash].return;
    }
  }

  async attemptTransaction(
    contract: any,
    viewContract: any,
    methodName: string,
    params: Array<any>,
    options: object,
    err: Error
  ): Promise<EthersTransactionResult> {
    if (!(await viewContract.functions[methodName](...params))) throw err;
    const transactionResponse = await contract.functions[methodName](
      ...params,
      ...(!options ? [] : [options]),
    );
    return { transactionResponse, hash: transactionResponse.hash };
  }

  encodeAttemptTransaction(contractAbi: object[], methodName: string, params: any[]): string {
    const iface = new this.ethers.utils.Interface(contractAbi);
    const payload = iface.functions[methodName].encode(params);
    return payload;
  }

  async attemptSafeProviderSendTx(
    txObj: SafeProviderSendTransaction,
    options: object
  ): Promise<EthersTransactionResult> {
    const transactionResponse = await this.signer.sendTransaction({
      ...txObj,
      ...(options || {}),
    });
    return { transactionResponse, hash: transactionResponse.hash };
  }

  async attemptSafeProviderMultiSendTxs(
    txs: SafeProviderSendTransaction[]
  ): Promise<{ hash: string }> {
    const hash = await this.signer.provider.send('gs_multi_send', txs);
    return { hash };
  }

  encodeMultiSendCallData(transactions: NonStandardTransaction[]): string {
    const multiSend = this.getContract(multiSendAbi, zeroAddress);
    const standardizedTxs = standardizeTransactions(transactions);

    return multiSend.interface.functions.multiSend.encode([
      this.ethers.utils.hexlify(
        this.ethers.utils.concat(
          standardizedTxs.map(
            (tx) => this.ethers.utils.solidityPack(
              ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
              [
                tx.operation,
                tx.to,
                tx.value,
                this.ethers.utils.hexDataLength(tx.data),
                tx.data,
              ],
            ),
          ),
        ),
      ),
    ]);
  }

  // eslint-disable-next-line
  getSendOptions(options: object, ownerAccount: string): object {
    return options;
  }

  async getGasPrice(): Promise<number> {
    const gasPrice = await this.signer.provider.getGasPrice();
    return gasPrice.toNumber();
  }

  async getSafeNonce(safeAddress: string): Promise<number> {
    const safeContract = this.getContract(safeAbi, safeAddress);
    const nonce = (await safeContract.nonce()).toNumber();
    return nonce;
  }
}

export default CPKEthersProvider;
