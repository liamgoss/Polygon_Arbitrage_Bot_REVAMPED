require("dotenv").config();
const { uFactory, uRouter, sFactory, sRouter, qFactory, qRouter, web3, arbitrage } = require('../helpers/initialization')
const { getTokenAndContract, getPairContract, getPairContractV3, calculatePrice, calculatePriceV3, getEstimatedReturn, getReserves } = require('../helpers/helpers')

const account = process.env.ACCOUNT

const IERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json')
const token0Contract = new web3.eth.Contract(IERC20.abi, "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619")
const token1Contract = new web3.eth.Contract(IERC20.abi, "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174")
const {
    ChainId,
    Token,
    WETH
} = require("@uniswap/sdk")


const main = async (inputNative, priceDifference) => {

    


    const determineDirection = async (priceDifference) => {
        console.log(`Determining Direction...\n`)

        if (priceDifference >= difference) {

            console.log(`Potential Arbitrage Direction:\n`)
            console.log(`Buy\t -->\t Quickswap`)
            console.log(`Sell\t -->\t Sushiswap\n`)
            return [qRouter, sRouter]
            //return [sRouter, qRouter]
            

        } else if (priceDifference <= -(difference)) {

            console.log(`Potential Arbitrage Direction:\n`)
            console.log(`Buy\t -->\t Sushiswap`)
            console.log(`Sell\t -->\t Quickswap\n`)
            return [sRouter, qRouter]
            //return [qRouter, sRouter]
            

        } else {
            return null
        }
    }

    const determineProfitability = async (_routerPath, _token0Contract, _token0, _token1) => {
        console.log(`Determining Profitability...\n`)
        // This is where you can customize your conditions on whether a profitable trade is possible.
        // This is a basic example of trading TOKEN_1/TOKEN_2...

        let reserves, exchangeToBuy, exchangeToSell

        if (_routerPath[0]._address == qRouter._address) {
            reserves = await getReserves(sPair)
            exchangeToBuy = 'Quickswap'
            exchangeToSell = 'Sushiswap'
        } else {
            reserves = await getReserves(qPair)
            exchangeToBuy = 'Sushiswap'
            exchangeToSell = 'Quickswap'
        }

        console.log(`Reserves on ${_routerPath[1]._address}`)
        console.log(`TOKEN_2: ${reserves[0].toString()}`)//${Number(web3.utils.fromWei(reserves[0].toString(), 'ether')).toFixed(0)}`)
        console.log(`TOKEN_1: ${reserves[1].toString()}`)//${web3.utils.fromWei(reserves[1].toString(), 'ether')}\n`)

        
        try {
            
            const inputInWei = web3.utils.toWei(inputNative).toString()
            
            let result = await _routerPath[0].methods.getAmountsOut(inputInWei, [_token0.address, _token1.address]).call()

            const token0In = result[0] // TOKEN_1 (input to first trade)
            const token1In = result[1] // TOKEN_2 (output of first trade) 
                    
            result = await _routerPath[1].methods.getAmountsOut(token1In, [_token1.address, _token0.address]).call()

            console.log(`Estimated amount of TOKEN_1 needed to buy enough TOKEN_2 on ${exchangeToBuy}\t\t| ${token0In}`) // ${web3.utils.fromWei(token0In, 'ether')}
            console.log(`Estimated amount of TOKEN_1 returned after swapping TOKEN_2 on ${exchangeToSell}\t| ${result[1]}\n`)

            

            let amountIn = token0In
            let amountOut = result[1]


            let loanDeduction = inputNative * process.env.LOAN_FEE_PERCENT
        
            console.log("Fee deducted (token1): ", loanDeduction)

            let transactionGas = 23424
            
            estimatedGasCost = transactionGas // in Gwei
            estimatedGasCost = web3.utils.toWei(estimatedGasCost.toString(), 'gwei')
            estimatedGasCost = web3.utils.fromWei(estimatedGasCost.toString(), 'ether')

            let ethBalanceBefore = await web3.eth.getBalance(account)
            ethBalanceBefore = web3.utils.fromWei(ethBalanceBefore, 'ether')
            const ethBalanceAfter = ethBalanceBefore - estimatedGasCost 

            const amountDifference = (amountOut - amountIn) * 10 ** -18
            let wethBalanceBefore = await _token0Contract.methods.balanceOf(account).call()
            wethBalanceBefore = web3.utils.fromWei(wethBalanceBefore, 'ether')

            const wethBalanceAfter = amountDifference + Number(wethBalanceBefore) - loanDeduction
            const wethBalanceDifference = wethBalanceAfter - Number(wethBalanceBefore)

            totalGained = wethBalanceDifference - Number(estimatedGasCost)

            const data = {
                'ETH Balance Before': ethBalanceBefore,
                'ETH Balance After': ethBalanceAfter,
                'ETH Spent (gas)': estimatedGasCost,
                '-': {},
                'TOKEN_0 Balance BEFORE': wethBalanceBefore,
                'TOKEN_0 Balance AFTER': wethBalanceAfter,
                'TOKEN_0 Gained/Lost': wethBalanceDifference,
                '-': {},
                'Total Gained/Lost': totalGained
            }

            console.table(data)
            console.log()
            
            
            if (Number(amountOut) <= Number(amountIn)) {
                return totalGained
            }

            amount = token0In
            return totalGained

        } catch (error) {
            console.log(error) // console.log(error.data.stack) 
            console.log(`\nError occured while trying to determine profitability...\n`)
            //console.log("Error Email Sent!")
            //sendErrorMail(error.message)
            return totalGained
        }
        
    }






    const difference = 0.001
    const routerPath = await determineDirection(priceDifference)
    const token0 = new Token(
        137,
        "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
        18,
        await token0Contract.methods.symbol().call(),
        await token0Contract.methods.name().call()
    )
    const token1 = new Token(
        137,
        "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        6,
        await token1Contract.methods.symbol().call(),
        await token1Contract.methods.name().call()
    )
            
    qPair = await getPairContract(qFactory, token0.address, token1.address)
    sPair = await getPairContract(sFactory, token0.address, token1.address)
    if (!routerPath) {
        console.log(`No Arbitrage Currently Available\n-----------------------------------------\n`)
        isExecuting = false
        return
    }
    const isProfitable = await determineProfitability(routerPath, token0Contract, token0, token1)
    if (!isProfitable) {
        console.log(`No Arbitrage Currently Available\n-----------------------------------------\n`)
        isExecuting = false
        return
    }
    console.log("totalGained: ", totalGained)
    
    process.exit(0);
}
let totalGained

const inputNative = '1'
const priceDifference = 0.845
main(inputNative, priceDifference)
