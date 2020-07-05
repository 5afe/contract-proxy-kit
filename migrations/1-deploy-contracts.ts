import fs from 'fs';
const forwarder = JSON.parse(fs.readFileSync(__dirname+'/../build/gsn/Forwarder.json', 'utf-8')).address

module.exports = function(deployer: Truffle.Deployer, network: string) {
  const deploy = (
    name: string
  ): Truffle.Deployer => deployer.deploy(artifacts.require(name as any));

  ['Migrations'].forEach(deploy);

  (deployer.deploy as any)(artifacts.require('CPKFactory'), forwarder).catch(console.log);

  if (network === 'test' || network === 'local') {
    [
      'GnosisSafe',
      'ProxyFactory',
      'MultiSend',
      'DefaultCallbackHandler',
      'Multistep',
      'ERC20Mintable',
      'ConditionalTokens'
    ].forEach(deploy);
  }

} as Truffle.Migration;

export {};
