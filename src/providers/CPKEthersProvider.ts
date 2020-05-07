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

  async getCallRevertData({
    from, to, value, data,
  }: {
    from: string;
    to: string;
    value?: number | string;
    data: string;
    gasLimit?: number | string;
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

  decodeError(revertData: string): string {
    if (!revertData.startsWith('0x08c379a0'))
      return revertData;

    return this.ethers.utils.defaultAbiCoder.decode(['string'], `0x${revertData.slice(10)}`)[0];
  }

  ethCall(
    opts: {
      from?: string;
      to: string;
      gas?: number | string | object;
      gasLimit?: number | string | object;
      gasPrice?: number | string | object;
      value?: number | string | object;
      data?: string;
    },
    block: number | string,
  ): Promise<string> {
    // This is to workaround https://github.com/ethers-io/ethers.js/issues/819
    const toHex = (v: number | string | object): string =>
      `0x${Number(v.toString()).toString(16)}`;
    const formattedOpts: {
      from?: string;
      to: string;
      gas?: string;
      gasPrice?: string;
      value?: string;
      data?: string;
    } = { to: opts.to };
    if (opts.from != null) formattedOpts.from = opts.from;
    if (opts.to != null) formattedOpts.to = opts.to;
    if (opts.gas != null) {
      if (opts.gasLimit != null)
        throw new Error(`specified both gas and gasLimit on eth_call params: ${
          JSON.stringify(opts, null, 2)
        }`);
      formattedOpts.gas = toHex(opts.gas);
    } else if (opts.gasLimit != null) {
      formattedOpts.gas = toHex(opts.gasLimit);
    }
    if (opts.value != null) {
      formattedOpts.value = toHex(opts.value);
    }
    if (opts.data != null) {
      formattedOpts.data = opts.data;
    }
    return this.signer.provider.send('eth_call', [
      formattedOpts,
      block,
    ]);
  }

  async findSuccessfulGasLimit(
    contract: any,
    viewContract: any,
    methodName: string,
    params: Array<any>,
    sendOptions?: object,
    gasLimit?: number | string,
  ): Promise<number | undefined> {
    const callData = contract.interface.functions[methodName].encode(params);
    const from = await this.getOwnerAccount();
    const to = this.getContractAddress(contract);
    const makeCallWithGas = async (gas: number): Promise<boolean> =>
      !!Number(await this.ethCall({
        ...sendOptions,
        from,
        to,
        gas,
        data: callData,
      }, 'latest'));

    if (gasLimit == null) {
      const blockGasLimit = (await this.signer.provider.getBlock('latest')).gasLimit.toNumber();

      if (!(await makeCallWithGas(blockGasLimit))) return;

      let gasLow = (await contract.estimate[methodName](...params)).toNumber();
      let gasHigh = blockGasLimit;

      if (!(await makeCallWithGas(gasLow))) {
        while (gasLow <= gasHigh) {
          const testGasLimit = Math.floor((gasLow + gasHigh) * 0.5);

          if (await makeCallWithGas(testGasLimit)) {
            // values > gasHigh will work
            gasHigh = testGasLimit - 1;
          } else {
            // values <= gasLow will work
            gasLow = testGasLimit + 1;
          }
        }
        // gasLow is now our target gas value
      }

      return gasLow;
    } else if (!(await makeCallWithGas(Number(gasLimit)))) return;

    return Number(gasLimit);
  }

  async execMethod(
    contract: any,
    methodName: string,
    params: Array<any>,
    sendOptions?: {
      gasLimit?: number | string;
    }
  ): Promise<EthersTransactionResult> {
    const transactionResponse = await contract.functions[methodName](
      ...params,
      ...(!sendOptions ? [] : [sendOptions]),
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
  getSendOptions(ownerAccount: string, options?: object): object | undefined {
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
