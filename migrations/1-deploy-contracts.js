"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
module.exports = function (deployer, network) {
    const deploy = (name) => deployer.deploy(artifacts.require(name));
    ['Migrations', 'CPKFactory'].forEach(deploy);
    if (network === 'test' || network === 'local') {
        [
            'GnosisSafe',
            'GnosisSafeProxyFactory',
            'MultiSend',
            'DefaultCallbackHandler',
            'Multistep',
            'DailyLimitModule',
            'ERC20Mintable',
            'ConditionalTokens'
        ].forEach(deploy);
    }
};
//# sourceMappingURL=1-deploy-contracts.js.map