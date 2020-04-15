abstract class CPKProvider {
  constructor() {
    if (this.constructor === CPKProvider) {
      throw new Error('Abstract classes can\'t be instantiated.');
    }
  }

  static getContractAddress(contract) {
    throw new Error('Not implemented.');
  }
  
  abstract attemptTransaction(contract, viewContract, methodName, params, sendOptions, err);
  
  abstract getSendOptions(options, ownerAccount);
    
  abstract init({
    isConnectedToSafe,
    ownerAccount,
    masterCopyAddress,
    proxyFactoryAddress,
    multiSendAddress
  });

  abstract getProvider();

  abstract getNetworkId();

  abstract getOwnerAccount();

  abstract getCodeAtAddress(contract);

  // abstract getContract(abi, address);

  abstract checkSingleCall(from, to, value, data);

  abstract attemptSafeProviderSendTx(tx, options);

  abstract attemptSafeProviderMultiSendTxs(transactions);

  abstract encodeMultiSendCallData(transactions);

  // abstract encodeAttemptTransaction(contractAbi, methodName, params);

  // abstract getGasPrice();

  // abstract getSafeNonce(safeAddress);
}

export default CPKProvider;
