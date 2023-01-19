# Contract Proxy Kit Monorepo

[![Coverage Status](https://coveralls.io/repos/github/gnosis/contract-proxy-kit/badge.svg?branch=master)](https://coveralls.io/github/gnosis/contract-proxy-kit?branch=master)

## Packages

| Package | Description |
| ------- | ----------- |
| [contract-proxy-kit](https://github.com/gnosis/contract-proxy-kit/tree/master/packages/contract-proxy-kit) [![npm version](https://badge.fury.io/js/contract-proxy-kit.svg)](https://badge.fury.io/js/contract-proxy-kit) | TypeScript SDK that enables batched transactions and contract account interactions using a unique deterministic Gnosis Safe. |
| [cpk-configuration-app](https://github.com/gnosis/contract-proxy-kit/tree/master/packages/cpk-configuration-app) | Example Dapp that uses the CPK showing all its possible configurations and allowing to play around with it. |

## Setting up the development environment

### Installing dependencies

```
yarn global add lerna
lerna bootstrap
```

### Running commands

Build the Contract Proxy Kit:
```
yarn cpk:build
```

Test the Contract Proxy Kit:
```
yarn cpk:test
```

Build the CPK Configuration App
```
yarn app:build
```

Run the CPK Configuration App
```
yarn app:start
```

## Useful links

- [API Documentation](https://cpk-docs.surge.sh/)
- [CPK Configuration App demo](https://cpk-app.surge.sh)
- [Video introduction to Building with Safe Apps SDK & Contract Proxy Kit](https://www.youtube.com/watch?v=YGw8WfBw5OI)

You can find more resources on the Contract Proxy Kit in the [Gnosis Safe Developer Portal](https://docs.gnosis.io/safe/docs/sdks_safe_apps/).
