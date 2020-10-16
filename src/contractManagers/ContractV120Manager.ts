import { Contract } from '../ethLibAdapters/EthLibAdapter'
import ContractManager from '.'

class ContractV120Manager extends ContractManager {
  constructor(contract: Contract) {
    super(contract)
  }
}

export default ContractV120Manager
