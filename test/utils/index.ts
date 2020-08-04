export const toTxHashPromise = (promiEvent: any): Promise<any> => {
  return new Promise(
    (resolve, reject) => promiEvent
      .once('transactionHash', resolve)
      .catch(reject)
  );
};

export enum AccountType {
  Warm,
  Fresh,
  Connected
}
