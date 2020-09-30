# CPK methods

## create
```
static async create(opts?: CPKConfig): Promise<CPK>
```
Static method that creates and initializes an instance of the CPK with the selected configuration parameters.

## constructor
```
constructor(opts?: CPKConfig)
```
Creates a non-initialized instance of the CPK with the selected configuration parameters.

## isProxyDeployed
```
async isProxyDeployed(): Promise<boolean>
```
Returns true or false if the Safe Proxy used by the CPK is already deployed (at least one transaction was made) or if it is not (no transactions made yet).

## isSafeApp
```
isSafeApp(): boolean
```
Returns true or false depending if the CPK is running as a Safe App (integrated in the Safe Web UI) or as a standalone app.

## getOwnerAccount
```
async getOwnerAccount(): Promise<Address | undefined>
```
Returns the address of the account connected to the CPK. If the CPK is connected to a Safe or running as a Safe App the Safe address will be returned.

## ethLibAdapter
```
get ethLibAdapter(): EthLibAdapter | undefined
```
Returns the EthLibAdapter in use.

## networks
```
get networks(): NetworksConfig
```
Returns the network configuration in use.

## isConnectedToSafe
```
get isConnectedToSafe(): boolean
```
Returns true or false if the CPK is connected to a Gnosis Safe wallet or not.

## contract
```
get contract(): Contract | undefined
```
Returns an instance of the Safe contract in use.

## multiSend
```
get multiSend(): Contract | undefined
```
Returns an instance of the MultiSend contract in use.

## proxyFactory
```
get proxyFactory(): Contract | undefined
```
Returns an instance of the ProxyFactory contract in use.

## masterCopyAddress
```
get masterCopyAddress(): Address | undefined
```
Returns the Safe masterCopy address in use.

## fallbackHandlerAddress
```
get fallbackHandlerAddress(): Address | undefined
```
Returns the fallbackHandler address in use.

## address
```
get address(): Address | undefined
```
Returns the Safe Proxy address in use.

## setEthLibAdapter
```
setEthLibAdapter(ethLibAdapter: EthLibAdapter): void
```
Overrides the current ethLibAdapter with the new one provided.

## setTransactionManager
```
setTransactionManager(transactionManager: TransactionManager): void
```
Overrides the current transactionManager with the new one provided. When the CPK is running as a Safe App this won't have any effect.

## setNetworks
```
setNetworks(networks: NetworksConfig): void
```
Overrides the current network configuration with the new one provided.

## encodeMultiSendCallData
```
encodeMultiSendCallData(transactions: Transaction[]): string
```
Returns the encoding of a list of transactions.

## execTransactions
```
async execTransactions(transactions: Transaction[], options?: ExecOptions): Promise<TransactionResult>
```
Executes a list of transactions.

## getModules
```
async getModules(): Promise<Address[]>
```
Returns the list of all the enabled Safe modules.

## isModuleEnabled
```
async isModuleEnabled(moduleAddress: Address): Promise<boolean>
```
Returns true or false if the Safe module provided is enabled or not.

## enableModule
```
async enableModule(moduleAddress: Address, options?: ExecOptions): Promise<TransactionResult>
```
Enables a Safe module.

## disableModule
```
async disableModule(moduleAddress: Address, options?: ExecOptions): Promise<TransactionResult>
```
Disables a Safe module.
