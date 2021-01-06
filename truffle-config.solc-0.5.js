const baseSettings = require('./truffle-config.base');

module.exports = {
  ...baseSettings,
  contracts_directory: "./contracts/solc-0.5",
  compilers: {
    solc: {
      version: "0.5.17",
      settings: {
        optimizer: {
          enabled: true,
        }
      }
    },
  },
};
