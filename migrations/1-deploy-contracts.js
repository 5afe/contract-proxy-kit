"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
module.exports = function (deployer, network) {
    var deploy = function (name) { return deployer.deploy(artifacts.require(name)); };
    ['Migrations', 'CPKFactory'].forEach(deploy);
    if (network === 'test' || network === 'local') {
        [
            'GnosisSafe',
            'ProxyFactory',
            'MultiSend',
            'DefaultCallbackHandler',
            'Multistep',
            'DailyLimitModule',
            'SocialRecoveryModule',
            'ERC20Mintable',
            'ConditionalTokens'
        ].forEach(deploy);
    }
};
//# sourceMappingURL=1-deploy-contracts.js.map