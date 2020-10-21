require('dotenv').config();
require('ts-node/register');

const seed = process.env.SEED || 'myth like bonus scare over problem client lizard pioneer submit female collect';
const HDWalletProvider = require('@truffle/hdwallet-provider');

const networks = Object.assign(...[
  [1, 'mainnet', `${1e9}`],
  [3, 'ropsten'],
  [4, 'rinkeby'],
  [5, 'goerli', `${2e9}`],
  [42, 'kovan'],
  [77, 'sokol',, true],
  [100, 'dai',, true],
].map(([networkId, network, gasPrice, isPoa]) => ({
  [network]: {
    network_id: networkId,
    gasPrice,
    provider: () => new HDWalletProvider(
      seed,
      isPoa ? `https://${network}.poa.network` : `https://${network}.infura.io/v3/17d5bb5953564f589d48d535f573e486`,
    ),
  },
})), {
  local: {
    host: 'localhost',
    port: 8545,
    network_id: '*',
  },
});

module.exports = {
  networks,
  mocha: {
    bail: true,
  }
};
