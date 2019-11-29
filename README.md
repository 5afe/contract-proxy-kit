# Safe Proxy SDK

Enable batched transactions and contract account interactions using a unique deterministic Gnosis Safe.

    npm install gnosis/safe-proxy-sdk

## Usage

The Safe Proxy SDK package exposes a *SafeProxy* class:

```js
const SafeProxy = require('safe-proxy-sdk')
```

*SafeProxy* requires either [web3.js](https://web3js.readthedocs.io) or [ethers.js](https://docs.ethers.io/ethers.js/html/) to function. Currently the following versions are supported:

* web3.js 1.2
* web3.js 2.0 alpha
* ethers.js 4.0

### SafeProxy.create

To create a *SafeProxy* instance, use the static method `SafeProxy.create`. This method accepts an options object as a parameter, and will result in a promise which resolves to a *SafeProxy* instance if successful and rejects with an error otherwise.

#### Using with web3.js

To use *SafeProxy* with web3.js, supply `SafeProxy.create` with a *Web3* instance as the value of the `web3` key. For example:

```js
const Web3 = require('web3');
const web3 = new Web3(/*...*/);

const safeProxy = await SafeProxy.create({ web3 });
```

The proxy owner will be inferred by first trying `web3.eth.defaultAccount`, and then trying to select the 0th account from `web3.eth.getAccounts`. However, an owner account may also be explicitly set with the `ownerAccount` key:

```js
const safeProxy = await SafeProxy.create({ web3, ownerAccount: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1' });
```

#### Using with ethers.js

To use *SafeProxy* with ethers.js, supply `SafeProxy.create` with the `ethers` object and an ethers.js *Signer* which has an active *Provider* connection. For example:

```js
const { ethers } = require('ethers');
const provider = ethers.getDefaultProvider('homestead');
const wallet = ethers.Wallet.createRandom().connect(provider);

const safeProxy = await SafeProxy.create({ ethers, signer: wallet });
```

The proxy owner will be the account associated with the signer.

#### Networks configuration

Regardless of which type of underlying API is being used, the *SafeProxy* instance will check the ID of the network given by the provider in order to prepare for contract interactions. By default, the main Ethereum network (ID 1), as well as the Rinkeby (ID 4), Goerli (ID 5), and Kovan (ID 42) test networks will have preconfigured addresses for the required contracts:

* `masterCopyAddress`: Gnosis Safe master copy
* `proxyFactoryAddress`: SafeProxy factory
* `multiSendAddress`: MultiSend contract for batching transactions
* `fallbackHandlerAddress`: A fallback handler (DefaultCallbackHandler)

However, address configurations for networks may be added or overridden by supplying a configuration object as the value of the `networks` key in the options. For example, adding a configuration for a network with ID (4447) may be done in the following manner:

```js
const safeProxy = await SafeProxy.create({
  // ...otherOptions,
  networks: {
    4447: {
      masterCopyAddress: '0x2C2B9C9a4a25e24B174f26114e8926a9f2128FE4',
      proxyFactoryAddress: '0x345cA3e014Aaf5dcA488057592ee47305D9B3e10',
      multiSendAddress: '0x8f0483125FCb9aaAEFA9209D8E9d7b9C8B9Fb90F',
      fallbackHandlerAddress: '0xAa588d3737B611baFD7bD713445b314BD453a5C8',
    },
  },
});
```

Please refer to the `migrations/` folder of this package for information on how to deploy the required contracts on a network, and note that these addresses must be available for the connected network in order for *SafeProxy* creation to be successful.

### SafeProxy#address

Once created, the `address` property on a *SafeProxy* instance will provide the proxy's checksummed Ethereum address:

```js
> safeProxy.address
'0xdb6F36fC4e07eAfCAba1D0056609A76C91c5A1bC'
```

This address is calculated even if the proxy has not been deployed yet, and it is deterministically generated from the proxy owner address.

### SafeProxy#execTransactions

To execute transactions using a *SafeProxy* instance, call `execTransactions` with an *Array* of transactions to execute. If the proxy has not been deployed, this will also batch the proxy's deployment into the transaction. Multiple transactions will be batched and executed together if the proxy has been deployed.

Each of the `transactions` provided as input to this function must be an *Object* with the following properties:

* `operation`: Either `SafeProxy.CALL` (0) or `SafeProxy.DELEGATECALL` (1) to execute the transaction as either a normal call or a delegatecall.
* `to`: The target address of the transaction.
* `value`: The amount of ether to send along with this transaction.
* `data`: The calldata to send along with the transaction.

If any of the transactions would revert, this function will reject instead, and nothing will be executed.

For example, if the proxy account holds some ether, it may batch send ether to multiple accounts like so:

```js
const safeProxy = await SafeProxy.create(/* ... */);
const txReceipt = await safeProxy.execTransactions([
  {
    operation: SafeProxy.CALL,
    to: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
    value: `${1e18}`,
    data: '0x',
  },
  {
    operation: SafeProxy.CALL,
    to: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
    value: `${1e18}`,
    data: '0x',
  },
]);
```
