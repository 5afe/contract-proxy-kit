const toConfirmationPromise = (promiEvent) => new Promise(
  (resolve, reject) => promiEvent.on('confirmation',
    (confirmationNumber, receipt) => resolve(receipt)).catch(reject),
);

module.exports = {
  toConfirmationPromise,
};
