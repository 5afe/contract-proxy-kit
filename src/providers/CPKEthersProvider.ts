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
    const abiToViewAbi = (abi: any): object => abi.map(({
      constant, // eslint-disable-line
      stateMutability, // eslint-disable-line
      ...rest
    }: any) => Object.assign(rest, {
      constant: true,
      stateMutability: 'view',
    }));

    const multiSend = new this.ethers.Contract(multiSendAddress, multiSendAbi, this.signer);
    let contract;
    let viewContract;
    let proxyFactory;
    let viewProxyFactory;

    if (isConnectedToSafe) {
      contract = new this.ethers.Contract(ownerAccount, safeAbi, this.signer);
      viewContract = new this.ethers.Contract(
        ownerAccount,
        abiToViewAbi(safeAbi),
        this.signer,
      );
    } else {
      proxyFactory = new this.ethers.Contract(
        proxyFactoryAddress,
        cpkFactoryAbi,
        this.signer,
      );
      viewProxyFactory = new this.ethers.Contract(
        proxyFactoryAddress,
        abiToViewAbi(cpkFactoryAbi),
        this.signer,
      );

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

      contract = new this.ethers.Contract(address, safeAbi, this.signer);
      viewContract = new this.ethers.Contract(address, abiToViewAbi(safeAbi), this.signer);
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

  getContractAddress(contract: any): string {
    return contract.address;
  }

  checkSingleCall(from: string, to: string, value: number, data: string): Promise<any> {
    return this.signer.provider.call({
      from,
      to,
      value,
      data,
    });
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
    const multiSend = new this.ethers.Contract(zeroAddress, multiSendAbi, this.signer);
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
}

export default CPKEthersProvider;
