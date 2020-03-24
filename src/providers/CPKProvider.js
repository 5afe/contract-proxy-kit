class CPKProvider {
  constructor() {
    if (this.constructor == CPKProvider) {
      throw new Error('Abstract classes can\'t be instantiated.');
    }
  }
}

module.exports = CPKProvider;
