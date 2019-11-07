const zeroAddress = `0x${'0'.repeat(40)}`;
const notOwnedAddress = '0x0000000000000000000000000000000000000002';

module.exports = (deployer) => {
  deployer.deploy(artifacts.require('GnosisSafe')).then(async (safe) => {
    await safe.setup([notOwnedAddress], 1, zeroAddress,
      '0x',
      zeroAddress,
      zeroAddress,
      0,
      zeroAddress);
  });
};
