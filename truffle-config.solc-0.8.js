const baseSettings = require('./truffle-config.base');

module.exports = {
  ...baseSettings,
  contracts_directory: "./contracts/solc-0.8",
  compilers: {
    solc: {
      version: "0.8.0",
      settings: {
        optimizer: {
          enabled: true,
        }
      }
    },
  },
};
