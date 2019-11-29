module.exports = (deployer, network) => {
  const deploy = (name) => deployer.deploy(artifacts.require(name));

  ['Migrations', 'CPKFactory'].forEach(deploy);

  if (network === 'test') {
    ['MultiSend', 'DefaultCallbackHandler', 'GnosisSafe'].forEach(deploy);
  }
};
