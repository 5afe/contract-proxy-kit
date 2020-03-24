# Contract Proxy Kit

[![Build Status](https://travis-ci.org/gnosis/contract-proxy-kit.svg?branch=master)](https://travis-ci.org/gnosis/contract-proxy-kit)

Enable batched transactions and contract account interactions using a unique deterministic Gnosis Safe.

    npm install contract-proxy-kit

## Usage

The Contract Proxy Kit package exposes a *CPK* class:

```js
const CPK = require('contract-proxy-kit')
```

*CPK* requires either [web3.js](https://web3js.readthedocs.io) or [ethers.js](https://docs.ethers.io/ethers.js/html/) to function. Currently the following versions are supported:

* web3.js 1.2
* web3.js 2.0 alpha
* ethers.js 4.0

### CPK.create

To create a *CPK* instance, use the static method `CPK.create`. This method accepts an options object as a parameter, and will result in a promise which resolves to a *CPK* instance if successful and rejects with an error otherwise.

#### Using with web3.js

To use *CPK* with web3.js, supply `CPK.create` with a *Web3* instance as the value of the `web3` key. For example:

```js
const Web3 = require('web3');
const web3 = new Web3(/*...*/);

const cpk = await CPK.create({ web3 });
```

The proxy owner will be inferred by first trying `web3.eth.defaultAccount`, and then trying to select the 0th account from `web3.eth.getAccounts`. However, an owner account may also be explicitly set with the `ownerAccount` key:

```js
const cpk = await CPK.create({ web3, ownerAccount: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1' });
```

#### Using with ethers.js

To use *CPK* with ethers.js, supply `CPK.create` with the `ethers` object and an ethers.js *Signer* which has an active *Provider* connection. For example:

```js
const { ethers } = require('ethers');
const provider = ethers.getDefaultProvider('homestead');
const wallet = ethers.Wallet.createRandom().connect(provider);

const cpk = await CPK.create({ ethers, signer: wallet });
```

The proxy owner will be the account associated with the signer.

#### Networks configuration

Regardless of which type of underlying API is being used, the *CPK* instance will check the ID of the network given by the provider in order to prepare for contract interactions. By default, Ethereum mainnet (ID 1) and the Rinkeby (ID 4), Goerli (ID 5), and Kovan (ID 42) test networks will have preconfigured addresses for the required contracts:

* `masterCopyAddress`: Gnosis Safe master copy
* `proxyFactoryAddress`: CPK factory
* `multiSendAddress`: MultiSend contract for batching transactions
* `fallbackHandlerAddress`: A fallback handler (DefaultCallbackHandler)

However, address configurations for networks may be added or overridden by supplying a configuration object as the value of the `networks` key in the options. For example, adding a configuration for a network with ID (4447) may be done in the following manner:

```js
const cpk = await CPK.create({
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

Please refer to the `migrations/` folder of this package for information on how to deploy the required contracts on a network, and note that these addresses must be available for the connected network in order for *CPK* creation to be successful.

### CPK#getOwnerAccount

This may be used to figure out which account the proxy considers the owner account. It returns a Promise which resolves to the owner account:

```js
const ownerAccount = await cpk.getOwnerAccount()
```

### CPK#address

Once created, the `address` property on a *CPK* instance will provide the proxy's checksummed Ethereum address:

```js
> cpk.address
'0xdb6F36fC4e07eAfCAba1D0056609A76C91c5A1bC'
```

This address is calculated even if the proxy has not been deployed yet, and it is deterministically generated from the proxy owner address.

#### Support for WalletConnected Gnosis Safe

If the provider underlying the *CPK* instance is connected to a Gnosis Safe via WalletConnect, the address will match the owner account:

```js
const ownerAccount = await cpk.getOwnerAccount()
cpk.address === ownerAccount // this will be true in that case
```

*CPK* will use the Safe's native support for batching transactions, and will not create an additional proxy contract account.

### CPK#execTransactions

To execute transactions using a *CPK* instance, call `execTransactions` with an *Array* of transactions to execute. If the proxy has not been deployed, this will also batch the proxy's deployment into the transaction. Multiple transactions will be batched and executed together if the proxy has been deployed.

Each of the `transactions` provided as input to this function must be an *Object* with the following properties:

* `operation`: Either `CPK.CALL` (0) or `CPK.DELEGATECALL` (1) to execute the transaction as either a normal call or a delegatecall. Note: when connected to Gnosis Safe via WalletConnect, this property is ignored, and `CPK.CALL` is assumed.
* `to`: The target address of the transaction.
* `value`: The amount of ether to send along with this transaction.
* `data`: The calldata to send along with the transaction.

If any of the transactions would revert, this function will reject instead, and nothing will be executed.

For example, if the proxy account holds some ether, it may batch send ether to multiple accounts like so:

```js
const cpk = await CPK.create(/* ... */);
const txObject = await cpk.execTransactions([
  {
    operation: CPK.CALL,
    to: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
    value: `${1e18}`,
    data: '0x',
  },
  {
    operation: CPK.CALL,
    to: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
    value: `${1e18}`,
    data: '0x',
  },
]);
```

#### Example calls to web3.js/Truffle contracts

The `data` field may be used to make calls to contracts from the proxy account. Suppose that `erc20` is a *web3.eth.Contract* instance for an ERC20 token for which the proxy account holds a balance, and `exchange` is a *web3.eth.Contract* instance of an exchange contract with an deposit requirement, where calling the deposit function on the exchange requires an allowance for the exchange by the depositor. Batching these transactions may be done like so:

```js
const { promiEvent, hash } = await cpk.execTransactions([
  {
    operation: CPK.CALL,
    to: erc20.options.address,
    value: 0,
    data: erc20.methods.approve(
      exchange.options.address,
      `${1e18}`,
    ).encodeABI(),
  },
  {
    operation: CPK.CALL,
    to: exchange.options.address,
    value: 0,
    data: exchange.methods.deposit(
      erc20.options.address,
      `${1e18}`,
    ).encodeABI(),
  },
]);

```

Suppose instead `erc20` and `exchange` are Truffle contract abstraction instances instead. Since Truffle contract abstraction instances contain a reference to an underlying *web3.eth.Contract* instance, they may be used in a similar manner:

```js
const { promiEvent, hash } = await cpk.execTransactions([
  {
    operation: CPK.CALL,
    to: erc20.address,
    value: 0,
    data: erc20.contract.methods.approve(
      exchange.address,
      `${1e18}`,
    ).encodeABI(),
  },
  {
    operation: CPK.CALL,
    to: exchange.address,
    value: 0,
    data: exchange.contract.methods.deposit(
      erc20.address,
      `${1e18}`,
    ).encodeABI(),
  },
]);

```

#### Example calls to ethers.js contracts

Similarly to the example in the previous section, suppose that `erc20` is a *ethers.Contract* instance for an ERC20 token for which the proxy account holds a balance, and `exchange` is a *ethers.Contract* instance of an exchange contract with an deposit requirement, where calling the deposit function on the exchange requires an allowance for the exchange by the depositor. Batching these transactions may be done like so:

```js
const { transactionResponse, hash } = await cpk.execTransactions([
  {
    operation: CPK.CALL,
    to: erc20.address,
    value: 0,
    data: erc20.interface.functions.approve.encode(
      exchange.address,
      `${1e18}`,
    ),
  },
  {
    operation: CPK.CALL,
    to: exchange.address,
    value: 0,
    data: exchange.interface.functions.deposit.encode(
      erc20.address,
      `${1e18}`,
    ),
  },
]);
```

#### Setting transaction options

An additional optional parameter may be passed to `execTransactions` to override default options for the transaction. For example, to batch send ether while paying a gas price of 3 Gwei for the overall transaction:

```js
const txObject = await cpk.execTransactions(
  [
    {
      operation: CPK.CALL,
      to: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
      value: `${1e18}`,
      data: '0x',
    },
    {
      operation: CPK.CALL,
      to: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
      value: `${1e18}`,
      data: '0x',
    },
  ],
  { gasPrice: `${3e9}` },
);
```

The gas limit for the overall transaction may also be altered. For example, to set the gas limit for a batch of transactions to one million:

```js
const txObject = await cpk.execTransactions(
  [
    // transactions...
  ],
  { gasLimit: 1000000 },
);
```

#### Support for WalletConnected Gnosis Safe

When WalletConnected to Gnosis Safe, `execTransactions` will use the Safe's native support for sending batch transactions (via `gs_multi_send`). In this case, the gas price option is not available, and `execTransactions` will only return a transaction hash.

```js
const { hash } = await cpk.execTransactions([
  {
    operation: CPK.CALL,
    to: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
    value: `${1e18}`,
    data: '0x',
  },
  {
    operation: CPK.CALL,
    to: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
    value: `${1e18}`,
    data: '0x',
  },
]);
```
