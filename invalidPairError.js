class InvalidPair extends Error {  
    constructor (message, _offendingPair0, _offendingPair1) {
      super(message)
  
      // assign the error class name in your custom error (as a shortcut)
      this.name = this.constructor.name
  
      // capturing the stack trace keeps the reference to your error class
      Error.captureStackTrace(this, this.constructor);
      this.offendingPair0 = _offendingPair0;
      this.offendingPair1 = _offendingPair1;
      
    }
  }
  
  module.exports = InvalidPair  