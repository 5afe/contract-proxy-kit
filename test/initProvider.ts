import Web3Maj1Min2 from 'web3-1-2';
import {RelayProvider} from '@opengsn/gsn';

export function loggingProvider(provider: any): any {
  return {
    send(req: any, cb: any) {
      // console.log('=== logsend', req);
      provider.send(req, cb);
    },
    origProvider: provider.origProvider
  };
}

export function initProvider(usingGSN: boolean): any {
  const provider = new Web3Maj1Min2.providers.HttpProvider('http://localhost:8545');

  //bypass gsn
  if (!usingGSN)
    return provider;

  function gsnAddr(name: string): string {
    return require(`../build/gsn/${name}.json`).address;
  }

  const gsnProvider = new RelayProvider(provider as any, {
    // verbose:true,
    relayHubAddress: gsnAddr('RelayHub'),
    stakeManagerAddress: gsnAddr('StakeManager'),
    paymasterAddress: gsnAddr('Paymaster'),
    forwarderAddress: gsnAddr('Forwarder')
  });

  return gsnProvider;
}