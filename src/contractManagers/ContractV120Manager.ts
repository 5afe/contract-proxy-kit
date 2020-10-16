import CommonContractManager from './CommonContractManager'
import { Address } from '../utils/basicTypes'

class ContractV120Manager extends CommonContractManager {
  async isModuleEnabled(moduleAddress: Address): Promise<boolean> {
    return this.contract.call('isModuleEnabled', [moduleAddress])
  }
}

export default ContractV120Manager
