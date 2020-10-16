import { Contract } from '../ethLibAdapters/EthLibAdapter'

abstract class ContractManager {
  contract: Contract

  constructor(contract: Contract) {
    this.contract = contract
  }
}

export default ContractManager
