import CommonContractManager from './CommonContractManager'
import { Address } from '../utils/basicTypes'

class ContractV111Manager extends CommonContractManager {
  async isModuleEnabled(moduleAddress: Address): Promise<boolean> {
    const modules = await super.contract.call('getModules', [])
    const selectedModules = modules.filter(
      (module: Address) => module.toLowerCase() === moduleAddress.toLowerCase()
    )
    return selectedModules.length > 0
  }
}

export default ContractV111Manager
