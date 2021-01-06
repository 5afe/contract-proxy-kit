module.exports = async function(deployer: Truffle.Deployer, network: string) {
  const deploy = (
    name: string
  ): Truffle.Deployer => deployer.deploy(artifacts.require(name as any));

  if (network === 'test' || network === 'local') {
    await Promise.all([
      'GnosisSafe',
      'GnosisSafe2',
      'GnosisSafeProxyFactory',
      'MultiSend',
      'DefaultCallbackHandler',
      'Multistep',
      'DailyLimitModule',
      'ERC20Mintable',
      'ConditionalTokens'
    ].map(deploy));
  }

  await deployer.deploy(artifacts.require('CPKFactoryV1'));

  await deployer.deploy(
    artifacts.require('CPKFactory'),
    artifacts.require('GnosisSafeProxyFactory').address,
  );

  await deployer.deploy(
    artifacts.require('CPKFactoryFacade'),
    artifacts.require('CPKFactory').address,
    artifacts.require('GnosisSafe').address,
    web3.utils.keccak256(web3.utils.utf8ToHex('Contract Proxy Kit')),
    artifacts.require('DefaultCallbackHandler').address,
  );
} as Truffle.Migration;

export { };
