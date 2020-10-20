module.exports = function (deployer: Truffle.Deployer, network: string) {
  const deploy = (name: any): Truffle.Deployer => deployer.deploy(artifacts.require(name))

  deploy('CPKFactory')

  if (network === 'test' || network === 'local') {
    ;[
      'GnosisSafe',
      'GnosisSafe2',
      'GnosisSafeProxyFactory',
      'MultiSend',
      'DefaultCallbackHandler',
      'Multistep',
      'DailyLimitModule',
      'ERC20Mintable',
      'ConditionalTokens'
    ].forEach(deploy)
  }
} as Truffle.Migration

export {}
