import { Address } from '../utils/basicTypes'
import ContractVersionUtils from './ContractVersionUtils'

class ContractV120Utils extends ContractVersionUtils {
  async isModuleEnabled(moduleAddress: Address): Promise<boolean> {
    return this.contract.call('isModuleEnabled', [moduleAddress])
  }
}

export default ContractV120Utils
