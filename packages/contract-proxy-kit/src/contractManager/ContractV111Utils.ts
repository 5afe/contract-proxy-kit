import { Address } from '../utils/basicTypes'
import ContractVersionUtils from './ContractVersionUtils'

class ContractV111Utils extends ContractVersionUtils {
  async isModuleEnabled(moduleAddress: Address): Promise<boolean> {
    const modules = await super.contract.call('getModules', [])
    const selectedModules = modules.filter(
      (module: Address) => module.toLowerCase() === moduleAddress.toLowerCase()
    )
    return selectedModules.length > 0
  }
}

export default ContractV111Utils
