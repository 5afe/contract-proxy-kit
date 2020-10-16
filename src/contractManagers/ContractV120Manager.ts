import ContractManager, { ContractManagerProps } from './'

class ContractV120Manager extends ContractManager {
  static async create(opts: ContractManagerProps): Promise<ContractV120Manager> {
    const contractV120Manager = new ContractV120Manager(opts.ethLibAdapter, opts.network)
    await contractV120Manager.init(opts)
    return contractV120Manager
  }
}

export default ContractV120Manager
