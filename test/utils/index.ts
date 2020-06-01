export const toConfirmationPromise = (promiEvent: any): Promise<any> => new Promise(
  (resolve, reject) => promiEvent.on('confirmation',
    (confirmationNumber: number, receipt: any) => {
      resolve(receipt);
    }).catch(reject),
);
