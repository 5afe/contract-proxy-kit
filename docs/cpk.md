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
