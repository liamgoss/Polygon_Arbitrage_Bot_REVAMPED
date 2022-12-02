const { Token, ChainId } = require('@uniswap/sdk')
const IUniswapV2Pair = require("@uniswap/v2-core/build/IUniswapV2Pair.json")
const IERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json');
var { uFactory, uRouter, sFactory, sRouter, qFactory, qRouter, web3, arbitrage, switchProvider} = require('./helpers/initialization');



module.exports = class cryptoPair {
    constructor(token0Address, token0Decimals, token1Address, token1Decimals, factory, token0inputAmount=-1) {
        this._token0Address = token0Address;
        this._token0Decimals = token0Decimals;
        this._token1Address = token1Address;
        this._token1Decimals = token1Decimals;
        this._factory = factory;    
        
        //console.log(`In class definition, inputOverride=${token0inputAmount} | type: ${typeof token0inputAmount}`)
        this._inputOverride = token0inputAmount;
    }
    // Setter functions
    set token0(web3Token) {
        this._token0 = web3Token;
    }
    set token1(web3Token) {
        this._token1 = web3Token;
    }
    set token0Contract(web3Contract) {
        this._token0Contract = web3Contract;
    }
    set token1Contract(web3Contract) {
        this._token1Contract = web3Contract;
    }
    // Getter functions
    get token0Address() {
        return this._token0Address;
    }
    get token1Address() {
        return this._token1Address;
    }
    get factory() {
        return this._factory;
    }
    get token0Contract() {
        return this._token0Contract;
    }
    get token1Contract() {
        return this._token1Contract;
    }
    get token0() {
        return this._token0;
    }
    get token1() {
        return this._token1;
    }
    get pairContract() {
        return this._pairContract;
    }
    get pairAddress() {
        return this._pairAddress;
    }

    get token0Symbol() {
        return this._t0Symbol;
    }
    
    get token1Symbol() {
        return this._t1Symbol;
    }

    get inputOverride() {
        return this._inputOverride;
    }
    /*
    set inputOverride(_inputAmount) {
        this._inputOverride = Number(_inputAmount);
    }
    */

    get units() {
        return this._units;
    }
    set units(_unitsToUse) {
        this._units = Number(_unitsToUse);
    }



    // The following two functions are nearly identically defined in the "working code"
    // But instead don't use the "this.variableName" syntax
    async defineTokens(t0Address, t0Decimals, t1Address, t1Decimals) {
        try {
            this._token0Contract = new web3.eth.Contract(IERC20.abi, t0Address)
            this._token1Contract = new web3.eth.Contract(IERC20.abi, t1Address)
            this._t0Symbol = await this._token0Contract.methods.symbol().call()
            this._t0Name = await this._token0Contract.methods.name().call()

            this._token0 = new Token(
                ChainId.POLYGON,
                t0Address,
                t0Decimals,
                this._t0Symbol,
                this._t0Name
            )
            
            this._t1Symbol = await this._token1Contract.methods.symbol().call()
            this._t1Name = await this._token1Contract.methods.name().call()
            
            this._token1 = new Token(
                ChainId.POLYGON,
                t1Address,
                t1Decimals,
                this._t1Symbol,
                this._t1Name
            )
        } catch (err) {
            // For some reason, I keep getting the error "hex data is odd-length" in the 
            // class but not when this same code is outside of a class
            console.log("Token creation failed, retrying...")
            this.defineTokens(t0Address,t0Decimals,t1Address,t1Decimals)
        }   
    }

    async definePairContract() {
        this._pairAddress = await this._factory.methods.getPair(this._token0Address, this._token1Address).call();
        
        this._pairContract = new web3.eth.Contract(IUniswapV2Pair.abi, this._pairAddress);
        
    }
}