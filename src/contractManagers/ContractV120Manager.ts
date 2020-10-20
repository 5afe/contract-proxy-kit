import { Address } from '../utils/basicTypes'
import CommonContractManager from './CommonContractManager'

class ContractV120Manager extends CommonContractManager {
  async isModuleEnabled(moduleAddress: Address): Promise<boolean> {
    return this.contract.call('isModuleEnabled', [moduleAddress])
  }
}

export default ContractV120Manager
