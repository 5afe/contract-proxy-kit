module.exports = (deployer, network) => {
  const deploy = (name) => deployer.deploy(artifacts.require(name));

  ['Migrations', 'CPKFactory'].forEach(deploy);

  if (network === 'local') {
    ['MultiSend', 'DefaultCallbackHandler', 'GnosisSafe', 'ProxyFactory'].forEach(deploy);
  }
};
