const defaultGasLimit = '0x100000';

const toConfirmationPromise = (promiEvent) => new Promise(
  (resolve, reject) => promiEvent.on('confirmation',
    (confirmationNumber, receipt) => resolve(receipt)).catch(reject),
);

module.exports = {
  defaultGasLimit,
  toConfirmationPromise,
};
