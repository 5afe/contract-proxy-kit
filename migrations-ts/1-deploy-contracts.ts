module.exports = function(deployer: Truffle.Deployer, network: string) {
  const deploy = (
    name: string
  ): Truffle.Deployer => deployer.deploy(artifacts.require(name as any));

  ['Migrations', 'CPKFactory'].forEach(deploy);

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
