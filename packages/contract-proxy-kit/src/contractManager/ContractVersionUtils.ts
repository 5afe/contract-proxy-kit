import { Contract } from '../ethLibAdapters/EthLibAdapter'
import { Address } from '../utils/basicTypes'
import { sentinelModules } from '../utils/constants'

abstract class ContractVersionUtils {
  contract: Contract

  constructor(contract: Contract) {
    this.contract = contract
  }

  async getContractVersion(): Promise<string> {
    return this.contract.call('VERSION', [])
  }

  async getModules(): Promise<Address[]> {
    return this.contract.call('getModules', [])
  }

  abstract isModuleEnabled(moduleAddress: Address): Promise<boolean>

  async encodeEnableModule(moduleAddress: Address): Promise<string> {
    return this.contract.encode('enableModule', [moduleAddress])
  }

  async encodeDisableModule(moduleAddress: Address): Promise<string> {
    const modules = await this.contract.call('getModules', [])
    const index = modules.findIndex(
      (module: Address) => module.toLowerCase() === moduleAddress.toLowerCase()
    )
    const prevModuleAddress = index === 0 ? sentinelModules : modules[index - 1]
    return this.contract.encode('disableModule', [prevModuleAddress, moduleAddress])
  }
}

export default ContractVersionUtils
