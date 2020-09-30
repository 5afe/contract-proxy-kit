# Contract Proxy Kit

[![Build Status](https://travis-ci.org/gnosis/contract-proxy-kit.svg?branch=master)](https://travis-ci.org/gnosis/contract-proxy-kit)
[![Coverage Status](https://coveralls.io/repos/github/gnosis/contract-proxy-kit/badge.svg?branch=master)](https://coveralls.io/github/gnosis/contract-proxy-kit?branch=master)

**Warning:** This documentation is for the 2.x series of the contract proxy kit. For documentation on the 1.x series, go [here](https://github.com/gnosis/contract-proxy-kit/tree/v1.1.1#contract-proxy-kit).

Enable batched transactions and contract account interactions using a unique deterministic Gnosis Safe.

    npm install contract-proxy-kit

## Usage

The Contract Proxy Kit package exposes a *CPK* class:

```js
import CPK from 'contract-proxy-kit'
```

*CPK* requires either [web3.js](https://web3js.readthedocs.io) or [ethers.js](https://docs.ethers.io/ethers.js/html/) to function. Currently the following versions are supported:

* web3.js 1.3
* web3.js 2.0 alpha
* ethers.js 4.0
* ethers.js 5.0

### CPK.create

To create a *CPK* instance, use the static method `CPK.create`. This method accepts an options object as a parameter, and will result in a promise which resolves to a *CPK* instance if successful and rejects with an error otherwise.

This will not deploy a contract on any networks. Rather, the deployment of a proxy gets batched into the first set of transactions when calling [CPK#execTransaction](#cpkexectransactions).

In order to obtain the proxy address, use the property [CPK#address](#cpkaddress). This address is deterministically derived from the owner address, and accessing the property does not require the proxy to be deployed.

#### Using with web3.js

To use *CPK* with web3.js, supply `CPK.create` with a *Web3* instance as the value of the `web3` key. For example:

```js
import CPK, { Web3Adapter } from 'contract-proxy-kit';
import Web3 from 'web3';

const web3 = new Web3(/*...*/);

const ethLibAdapter = new Web3Adapter({ web3 });

const cpk = await CPK.create({ ethLibAdapter });
```

The proxy owner will be inferred by first trying `web3.eth.defaultAccount`, and then trying to select the 0th account from `web3.eth.getAccounts`. However, an owner account may also be explicitly set with the `ownerAccount` key:

```js
const cpk = await CPK.create({ ethLibAdapter, ownerAccount: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1' });
```

#### Using with ethers.js

To use *CPK* with ethers.js, supply `CPK.create` with the `ethers` object and an ethers.js *Signer* which has an active *Provider* connection. For example:

```js
import CPK, { EthersAdapter } from 'contract-proxy-kit';
import { ethers } from 'ethers');

const provider = ethers.getDefaultProvider('homestead');
const wallet = ethers.Wallet.createRandom().connect(provider);

const ethLibAdapter = new EthersAdapter({ ethers, signer: wallet });

const cpk = await CPK.create({ ethLibAdapter });
```

The proxy owner will be the account associated with the signer.

#### Networks configuration

Regardless of which type of underlying API is being used, the *CPK* instance will check the ID of the network given by the provider in order to prepare for contract interactions. By default, Ethereum Mainnet (ID 1) and the Rinkeby (ID 4), Goerli (ID 5), and Kovan (ID 42) test networks will have preconfigured addresses for the required contracts:

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

<!---
#### Transaction relayer configuration

By default, the CPK will not use any transaction relayer. However, the [Safe Relay Service](https://github.com/gnosis/safe-relay-service) can be used to submit all the transactions when the optional property `transactionManager` is passed to the CPK constructor with an instance of the class `SafeRelayTransactionManager`.

```js
const safeRelayTransactionManager = new SafeRelayTransactionManager({ url: 'https://safe-relay.gnosis.io/'})
const cpk = await CPK.create({
  // ...otherOptions,
  transactionManager: safeRelayTransactionManager,
});
```

The URL of the [Safe Relay Service](https://github.com/gnosis/safe-relay-service) is different depending on the network:
 - Mainnet: https://safe-relay.gnosis.io/
 - Rinkeby: https://safe-relay.rinkeby.gnosis.io/
--->

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

This address is calculated even if the proxy has not been deployed yet, and it is deterministically generated from the proxy owner address. This means that for any given owner, the same proxy owner address will always be generated.

#### Support for connection to a Gnosis Safe

If the provider underlying the *CPK* instance is connected to a Gnosis Safe via WalletConnect, the address will match the owner account:

```js
const ownerAccount = await cpk.getOwnerAccount()
cpk.address === ownerAccount // this will be true in that case
```

*CPK* will use the Safe's native support for batching transactions, and will not create an additional proxy contract account.

### CPK#execTransactions

To execute transactions using a *CPK* instance, call `execTransactions` with an *Array* of transactions to execute. If the proxy has not been deployed, this will also batch the proxy's deployment into the transaction. Multiple transactions will be batched and executed together if the proxy has been deployed.

Each of the `transactions` provided as input to this function must be an *Object* with the following properties:

* `operation`: Either `CPK.Call` (0) or `CPK.DelegateCall` (1) to execute the transaction as either a normal call or a delegatecall. Note: when connected to Gnosis Safe via WalletConnect, this property is ignored, and `CPK.Call` is assumed. Optional property, `CPK.Call` is the default value.
* `to`: The target address of the transaction.
* `value`: The amount of ether to send along with this transaction. Optional property, `0` is the default value.
* `data`: The calldata to send along with the transaction. Optional property, `0x` is the default value.

If any of the transactions would revert, this function will reject instead, and nothing will be executed.

For example, if the proxy account holds some ether, it may batch send ether to multiple accounts like so:

```js
const cpk = await CPK.create(/* ... */);
const txObject = await cpk.execTransactions([
  {
    operation: CPK.Call, // Not needed because this is the default value.
    data: '0x', // Not needed because this is the default value.
    to: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
    value: `${1e18}`,
  },
  {
    operation: CPK.Call, // Not needed because this is the default value.
    data: '0x', // Not needed because this is the default value.
    to: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
    value: `${1e18}`,
  },
]);
```

#### Example calls to web3.js/Truffle contracts

The `data` field may be used to make calls to contracts from the proxy account. Suppose that `erc20` is a *web3.eth.Contract* instance for an ERC20 token for which the proxy account holds a balance, and `exchange` is a *web3.eth.Contract* instance of an exchange contract with an deposit requirement, where calling the deposit function on the exchange requires an allowance for the exchange by the depositor. Batching these transactions may be done like so:

```js
const { promiEvent, hash } = await cpk.execTransactions([
  {
    to: erc20.options.address,
    data: erc20.methods.approve(
      exchange.options.address,
      `${1e18}`,
    ).encodeABI(),
  },
  {
    to: exchange.options.address,
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
    to: erc20.address,
    data: erc20.contract.methods.approve(
      exchange.address,
      `${1e18}`,
    ).encodeABI(),
  },
  {
    to: exchange.address,
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
    to: erc20.address,
    data: erc20.interface.functions.approve.encode(
      exchange.address,
      `${1e18}`,
    ),
  },
  {
    to: exchange.address,
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
      to: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
      value: `${1e18}`,
    },
    {
      to: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
      value: `${1e18}`,
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

#### Support for connection to a Gnosis Safe

When connected to a Gnosis Safe, `execTransactions` will use the Safe's native support for sending batch transactions (via `gs_multi_send`). In this case, the gas price option is not available, and `execTransactions` will only return a transaction hash.

```js
const { hash } = await cpk.execTransactions([
  {
    to: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
    value: `${1e18}`,
  },
  {
    to: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
    value: `${1e18}`,
  },
]);
```

## Installation

Install dependencies for the project:
```
yarn install
```

If at some points the contracts are modified, run the following commands to compile them again and generate their new types:
```
rm -R ./build/contracts
rm -R ./types/truffle-contracts
truffle compile
yarn generate-types
```

## Running the tests

Run an instance of `ganache-cli` deterministically:
```
ganache-cli -d
```

Migrate the contracts to the local network:
```
yarn migrate --network local
```

Run the tests against the local network:
```
yarn test
```

## Run your app as a Safe App

*CPK* uses the [Safe Apps SDK](https://github.com/gnosis/safe-apps-sdk), making your app available to be run in an iframe inside the [Safe Web UI](https://gnosis-safe.io/).

Once your app is ready to be deployed, make sure to follow these [steps to run your app as a Safe app](https://github.com/gnosis/safe-apps-sdk#testing-in-the-safe-multisig-application). Apart from that, no extra configuration is needed.

When running your app inside the *Safe Web UI*, the configuration used to instantiate the *CPK* will be ignored because the responsibility to send transactions is now transferred to the *Safe Web UI* and the wallet connected to it.

If needed, the method `CPK.isSafeApp()` is available to check if the app using the *CPK* is running as a Safe App or not.

## In-depth Guide

The Contract Proxy Kit operates primarily using the following technologies:

* Deterministic account creation using the `create2` opcode
* Gnosis Safe contracts
* A `delegatecall`-able `MultiSend` contract
* Its own `CPKFactory` contract

### Using `create2`

The original `create` operation uses the deploying account's address and an autoincrementing nonce to determine the address of the deployed contract. Because users of a factory do not have direct control of a public factory contract's nonce, there is no way to guarantee a user an address with a factory when other users can trigger the creation of new instances and the order of transactions gets determined when blocks are confirmed without using a mapping in storage.

`create2` allows a public factory to strongly associate accounts with their proxies without storage. Moreover, this association may be established without any transactions. The address of a contract deployed with `create2` depends only on the deployer's address, the deployment bytecode, and the chosen salt. By keeping the deployment bytecode the same and hashing account addresses into the chosen salt, the factory contract can guarantee contract addresses for accounts.

### Gnosis Safe

The [Gnosis Safe](https://docs.gnosis.io/safe/) contracts have been formally verified, and offer many features beyond just batch transactions. Since they are primarily used via proxies, deployment of instances are relatively lightweight. Other features of the Safe, such as contract module installation and multi-factor authentication, may also make it into the CPK in the future.

### Batching Transactions

Transactions are batched with the use of the [`MultiSend` contract](https://github.com/gnosis/safe-contracts/blob/development/contracts/libraries/MultiSend.sol), which takes a concatenated sequence of transactions and executes the transactions one by one. If any of the transactions revert, the entire batch reverts.

In order to perform these transactions as the Safe, the `MultiSend` contract gets used with the `delegatecall` mode of `execTransaction`.

### `CPKFactory`

Because of the unique requirements of the contract proxy kit, the [canonical Gnosis Safe proxy factory](https://github.com/gnosis/safe-contracts/blob/development/contracts/proxies/GnosisSafeProxyFactory.sol) isn't used. Instead, a custom proxy factory contract called the `CPKFactory` is used.

The `CPKFactory` contract allows a user to construct Safe instances and perform an `execTransaction` immediately on that instance. These instances have addresses which can deterministically be generated from the user's address, as they are created with `create2` with parameters which vary only by the user's address, and a `saltNonce`.

In this package, the `saltNonce` is set to the *bytes32* value of `0xcfe33a586323e7325be6aa6ecd8b4600d232a9037e83c8ece69413b777dabe65`. This value is derived by the expression: `keccak256(toUtf8Bytes('Contract Proxy Kit'))`.

The `CPKFactory` initializes the constructed Safe instances to be a one out of one signature Safe, as well as registers a default fallback handler on them, in order for the Safes to be receive ERC-721 and ERC-1155 tokens by default. The instances starts out being owned by the factory, which relays the first transaction to be executed to the newly created Safe, and after the transaction, sets the owner of the Safe to be the user creating the Safe.

When constructing the proxy instance, the deployment bytecode for an [ERC DelegateProxy](https://eips.ethereum.org/EIPS/eip-897) pointing at a Gnosis Safe master copy is figured out. The `create2` salt is also calculated with the expression:

```solidity
bytes32 salt = keccak256(abi.encode(msg.sender, saltNonce));
```

where `msg.sender` is the user creating the proxy. The resulting proxy has an address which depends on the user address, the `saltNonce`, the `CPKFactory` address, and Safe master copy used, and the proxy creation bytecode.

To aid with figuring out the proxy address, the `CPKFactory` contract announces the proxy creation bytecode it uses via an accessor `proxyCreationCode`.

### Examples of applications built with the *CPK*

- https://github.com/germartinez/cpk-configuration-app
- https://github.com/gnosis/cpk-compound-tutorial
