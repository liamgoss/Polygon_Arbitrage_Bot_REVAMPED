require("dotenv").config();
const config = require("../config.json")

const univ3prices = require('@thanpolas/univ3prices')


const Big = require('big.js');
const Web3 = require('web3');
let web3

if (!config.PROJECT_SETTINGS.isLocal) {
    //web3 = new Web3(`wss://polygon-mainnet.infura.io/v3/${process.env.INFURA_API_KEY }`)
    web3 = new Web3(`wss://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
} else {
    web3 = new Web3('ws://127.0.0.1:8545')
}

const { ChainId, Token } = require("@uniswap/sdk")
const IUniswapV2Pair = require("@uniswap/v2-core/build/IUniswapV2Pair.json")
const UniswapV3Pool = require("../ABIs/UniswapV3Pool.json");
const IERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json');
const { uFactory, sFactory, qFactory } = require("./initialization");
const req = require("express/lib/request");

/**
 * It takes in two token addresses, and returns the token contracts and token objects
 * @param _token0Address - The address of the first token you want to trade.
 * @param _token1Address - The address of the token you want to trade.
 */
async function getTokenAndContract(_token0Address, _token1Address) {
    const token0Contract = new web3.eth.Contract(IERC20.abi, _token0Address)
    const token1Contract = new web3.eth.Contract(IERC20.abi, _token1Address)


    // Does this assume the token has 18 decimals???
    const token0 = new Token(
        ChainId.MAINNET,
        _token0Address,
        18,
        await token0Contract.methods.symbol().call(),
        await token0Contract.methods.name().call()
    )

    const token1 = new Token(
        ChainId.MAINNET,
        _token1Address,
        18,
        await token1Contract.methods.symbol().call(),
        await token1Contract.methods.name().call()
    )

    return { token0Contract, token1Contract, token0, token1 }
}

/**
 * `getPairAddress` returns the address of the pair of tokens `_token0` and `_token1` from the
 * `_V2Factory` contract
 * @param _V2Factory - The address of the V2Factory contract
 * @param _token0 - The address of the first token in the pair
 * @param _token1 - The address of the first token in the pair.
 * @returns The address of the pair
 */
async function getPairAddress(_V2Factory, _token0, _token1) {
    const pairAddress = await _V2Factory.methods.getPair(_token0, _token1).call()
    return pairAddress
}


function guessFee(_token0, _token1, _overridefee=0) {
    var fee;
    // stablecoins = USDC, USDT, DAI, FRAX, miMATIC, TUSD (TrueUSD)
    const stablecoins = new Set(['0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', 
                                 '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 
                                 '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', 
                                 '0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89',
                                 '0xa3Fa99A148fA48D14Ed51d610c367C61876997F1']);


    switch (_overridefee) {
        case 0:
            if (stablecoins.has(_token0) && stablecoins.has(_token1)) {
                // If both coins are stablecoins
                fee = 100; // 0.01%
            }
            else if (stablecoins.has(_token0) || stablecoins.has(_token1)) {
                // One of the coins is a stablecoin
                fee = 500; // 0.05%
            }
            else {
                fee = 3000; // 0.30%
            }
            break;
        case 1:
            fee = 100;
            break;
        case 3:
            fee = 3000;
            break;
        case 5:
            fee = 500;
            break;
        case 10:
            fee = 10000;
            break;
        default:
            fee = 3000;
    }
    return fee;
}


async function getPairAddressV3(__V3Factory, _token0, _token1, _overridefee) {
    // _fee: The fee collected upon every swap in the pool, denominated in hundredths of a bip

    /*
        Four tier fees: 0.01%, 0.05%, 0.30%, 1%
        UniswapV3 Docs EXPECT (does not say for sure) that stablecoins (less risky trades) will have the lowest fee, while the more risky/volatile pairs gravitate towards the higher fee
        EX: USDT/USDC   = 0.01%
            WETH/USDC   = 0.05%
            WMATIC/WETH = 0.30%
            WETH/LUNA   = 1.00%
    */

    /*
        example: WETH/USDC @ 0.05% fee: 
        getPairAddressV3(0x1F98431c8aD98523631AE4a59f267346ea31F984, 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619, 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174, 500)
    */
    const fee = guessFee(_token0, _token1, _overridefee)
    const pairAddress = await __V3Factory.methods.getPool(_token0, _token1, fee).call()
    return pairAddress // returns address 0 if pool does not exist
}

/**
 * `getPairContract` returns a contract object for the Uniswap V2 pair contract for the given token
 * pair
 * @param _V2Factory - The address of the Uniswap V2 Factory contract.
 * @param _token0 - The address of the first token in the pair.
 * @param _token1 - The address of the token you want to swap for.
 * @returns The pair contract for the given token pair.
 */
async function getPairContract(_V2Factory, _token0, _token1) {
    const pairAddress = await getPairAddress(_V2Factory, _token0, _token1)
    const pairContract = new web3.eth.Contract(IUniswapV2Pair.abi, pairAddress)
    return pairContract
}

async function getPairContractV3(__V3Factory, _token0, _token1, _overridefee=0) {
    const pairAddress = await getPairAddressV3(__V3Factory, _token0, _token1, _overridefee)
    const pairContract = new web3.eth.Contract(UniswapV3Pool.abi, pairAddress)
    return pairContract
}

/**
 * It returns the reserves of a given pair contract
 * @param _pairContract - The address of the pair contract
 * @returns The reserves of the pair contract.
 */
async function getReserves(_pairContract) {
    const reserves = await _pairContract.methods.getReserves().call()
    return [reserves.reserve0, reserves.reserve1]
}



/**
 * It takes a pair contract address as input, and returns the price of the token in the pair contract
 * @param _pairContract - The address of the pair contract
 * @returns The price of the token in terms of the other token.
 */
async function calculatePrice(_pairContract) {
    const [reserve0, reserve1] = await getReserves(_pairContract)
    return Big(reserve0).div(Big(reserve1)).toString()

}



async function calculatePriceV3(_poolContract, _decimals0, _decimals1) {
    /*
            Example slot0 call
    Result {
    '0': '1828823954524831551855870426795661',
    '1': '200947',
    '2': '20',
    '3': '100',
    '4': '100',
    '5': '0',
    '6': true,
    sqrtPriceX96: '1828823954524831551855870426795661',
    tick: '200947',
    observationIndex: '20',
    observationCardinality: '100',
    observationCardinalityNext: '100',
    feeProtocol: '0',
    unlocked: true
}



    */


    const slot0Results = await _poolContract.methods.slot0().call()
    
    const sqrtPrice = slot0Results['sqrtPriceX96']
    
    console.log(univ3prices([_decimals0, _decimals1], sqrtPrice).toAuto())
    console.log(univ3prices([18, 6], sqrtPrice).toSignificant({decimalPlaces: 11}))
    console.log(univ3prices([6, 18], sqrtPrice).toSignificant({decimalPlaces: 11}))
    

    const tick = slot0Results['tick']
    const tickPrice = univ3prices.tickPrice([_decimals0, _decimals1], tick).toAuto()
    
    return tickPrice
}


/**
 * It takes two numbers, subtracts the second from the first, divides the result by the second,
 * multiplies the result by 100, and returns the result as a string with two decimal places
 * @param uPrice - The price of the item on the website
 * @param sPrice - The selling price of the item
 * @returns The difference between the two prices in percentage.
 */
function calculateDifference(uPrice, sPrice) {
    return (((uPrice - sPrice) / sPrice) * 100).toFixed(2)
}

/**
 * It takes an amount of tokens, a path of two routers, and two tokens, and returns the amount of
 * tokens you would get out of the path
 * @param amount - The amount of tokens you want to swap.
 * @param _routerPath - An array of addresses of the routers that will be used to execute the trade.
 * @param _token0 - The token you want to sell
 * @param _token1 - The token you want to buy
 * @returns The amount of tokens that will be received for the amount of tokens sent.
 */
async function getEstimatedReturn(amount, _routerPath, _token0, _token1) {
    const trade1 = await _routerPath[0].methods.getAmountsOut(amount, [_token0.address, _token1.address]).call()
    const trade2 = await _routerPath[1].methods.getAmountsOut(trade1[1], [_token1.address, _token0.address]).call()

    const amountIn = Number(web3.utils.fromWei(trade1[0], 'ether'))
    const amountOut = Number(web3.utils.fromWei(trade2[1], 'ether'))

    return { amountIn, amountOut }
}

module.exports = {
    getTokenAndContract,
    getPairAddress,
    getPairContract,
    getPairContractV3,
    getReserves,
    calculatePrice,
    calculatePriceV3,
    calculateDifference,
    getEstimatedReturn
}