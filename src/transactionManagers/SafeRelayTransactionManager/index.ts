import fetch from 'node-fetch';
import BigNumber from 'bignumber.js';
import TransactionManager, { ExecTransactionProps, TransactionManagerConfig } from '../TransactionManager';
import { TransactionResult, OperationType } from '../../utils/transactions';
import { zeroAddress } from '../../utils/constants';
import { Address } from '../../utils/basicTypes';
import EthLibAdapter from '../../ethLibAdapters/EthLibAdapter';

BigNumber.set({ EXPONENTIAL_AT: [-7, 255] });

interface SafeRelayTransactionManagerConfig {
  url: string;
}

interface TransactionEstimationsProps {
  safe: Address;
  to: Address;
  value: number;
  data: string;
  operation: OperationType;
  gasToken?: Address;
}

interface RelayEstimation {
  safeTxGas: number;
  baseGas: number;
  dataGas: number;
  operationalGas: number;
  gasPrice: number;
  lastUsedNonce: number;
  gasToken: Address;
}

interface TransactionToRelayProps {
  url: string;
  tx: any;
  safe: Address;
  signatures: any;
  ethLibAdapter: EthLibAdapter;
}

interface SafeBalance {
  tokenAddress: Address;
  balance: string;
}

class SafeRelayTransactionManager implements TransactionManager {
  url: string

  constructor({ url }: SafeRelayTransactionManagerConfig) {
    if (!url) {
      throw new Error('url property missing from options');
    }
    this.url = url;
  }

  get config(): TransactionManagerConfig {
    return {
      name: 'SafeRelayTransactionManager',
      url: this.url,
    };
  }

  async execTransactions({
    safeExecTxParams,
    signature,
    contracts,
    ethLibAdapter,
  }: ExecTransactionProps): Promise<TransactionResult> {
    const { safeContract } = contracts;
  
    const to = safeExecTxParams.to;
    const value = safeExecTxParams.value;
    const data = safeExecTxParams.data;
    const operation = safeExecTxParams.operation;

    const relayEstimations = await this.getTransactionEstimations({
      safe: safeContract.address,
      to,
      value,
      data,
      operation,
    });

    const tx = {
      to,
      value,
      data,
      operation,
      gasToken: relayEstimations.gasToken,
      safeTxGas: relayEstimations.safeTxGas,
      dataGas: relayEstimations.baseGas, // TO-DO: dataGas will be obsolete. Check again when this endpoint is updated to v2
      gasPrice: relayEstimations.gasPrice,
      nonce: relayEstimations.lastUsedNonce,
      refundReceiver: zeroAddress,
    };

    const rsvSignature = [{
      r: new BigNumber(signature.slice(0,66)).toString(),
      s: new BigNumber('0x' + signature.slice(66,130)).toString(),
      v: new BigNumber('0x' + signature.slice(130,132)).toString(),
    }];

    return this.sendTransactionToRelay({
      url: this.url,
      safe: safeContract.address,
      tx,
      signatures: rsvSignature,
      ethLibAdapter,
    });
  }

  private async getTransactionEstimations({
    safe,
    to,
    value,
    data,
    operation,
    gasToken,
  }: TransactionEstimationsProps): Promise<RelayEstimation> {
    const url = this.url + '/api/v1/safes/' + safe + '/transactions/estimate/';
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    const body: { [key: string]: any } = {
      safe,
      to,
      value,
      data,
      operation,
    };
    if (gasToken) {
      body.gasToken = gasToken;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response) {
      throw new Error('Connection');
    }
    const jsonResponse = await response.json();

    if (response.status !== 200) {
      throw new Error(jsonResponse.exception);
    }
    return jsonResponse;
  }

  private async sendTransactionToRelay({
    tx,
    safe,
    signatures,
    ethLibAdapter,
  }: TransactionToRelayProps): Promise<any>  {
    const url = this.url + '/api/v1/safes/' + safe + '/transactions/';
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
    const body = {
      safe,
      ...tx,
      signatures
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response) {
      throw new Error('Connection');
    }
    const jsonResponse = await response.json();

    if (response.status !== 201) {
      throw new Error(jsonResponse.exception);
    }
    return ethLibAdapter.toSafeRelayTxResult(jsonResponse.txHash, jsonResponse.ethereumTx);
  }
}

export default SafeRelayTransactionManager;
