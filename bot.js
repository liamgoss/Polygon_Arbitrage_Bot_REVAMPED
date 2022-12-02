const Big = require('big.js');
const { randomUUID } = require('crypto'); // Added in: node v14.17.0
const cryptoPair = require("./cryptoPair.js")
const axios = require("axios");
const fs = require('fs');
var nodemailer = require('nodemailer');
const { Token, ChainId } = require('@uniswap/sdk')
var color = require("cli-color")
require('./helpers/server')
const config = require('./config.json')
require("dotenv").config();

const InvalidPair = require("./invalidPairError.js")

const Web3 = require('web3')


const { getTokenAndContract, getPairContract, getPairContractV3, calculatePrice, calculatePriceV3, getEstimatedReturn, getReserves_orig } = require('./helpers/helpers')
//var { uFactory, uRouter, sFactory, sRouter, qFactory, qRouter, web3, arbitrage, switchProvider, currentURL} = require('./helpers/initialization')
var { uFactory, uRouter, sFactory, sRouter, qFactory, qRouter, web3, arbitrage, currentURL} = require('./helpers/initialization');
const { blueBright } = require('cli-color');




/*
    // ----------------------- //
    // DEFINE HELPER FUNCTIONS //
    // ----------------------- //
*/

var emailUser = process.env.GMAIL_USER
var emailPass = process.env.GMAIL_PASS
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
    }
});



/**
 * It sends an email to the recipient specified in the .env file.
 * @param errorMsg - The error message that you want to send in the email
 * @returns The return value of the sendMail function.
 */
function sendErrorMail(errorMsg) {
    // Make sure to enable lesssecureapps for your account if you get an error
    var mailOptions = {
        from: emailUser,
        to: process.env.MAIL_RECIPIENT,
        subject: `Node.js Server Error ${new Date(Date.now()).toLocaleString("en-US", {timeZoneName: "short"})}`,
        text: errorMsg  
    };
    
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
            return error.message
        } else {
            console.log('Email sent: ' + info.response);
            return info.response
        }
    });
}

function sendSucessMail(details) {
    // Make sure to enable lesssecureapps for your account if you get an error
    var mailOptions = {
        from: emailUser,
        to: process.env.MAIL_RECIPIENT,
        subject: `Successful trade! ${new Date(Date.now()).toLocaleString("en-US", {timeZoneName: "short"})}`,
        text: details  
    };
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
            return error.message
        } else {
            console.log('Email sent: ' + info.response);
            return info.response
        }
    });
};


function writeErrorToFile(error_passed) { 
    console.log(process.cwd())
    if (!fs.existsSync(`${process.cwd()}/logs`)) {
        fs.mkdirSync(`${process.cwd()}/logs`, { recursive: true});
    }
    const fileName = randomUUID().toString() + ".log"
    console.log(fileName)
    fs.writeFile(`${process.cwd()}/logs/${fileName}`, error_passed.toString(), function(err) {
        if(err) {
            return console.log(err);
        }
        console.log(`Error message saved to ${fileName}`);
    }); 
}


function deleteTwoPairs(pair1, pair2) { 
    // Nodejs can't pass by reference which hurts the speed and memory efficiency of this function    
    pairs.splice(pairs.indexOf(pair1), 1);
    pairs.splice(pairs.indexOf(pair2), 1);
    
}

async function getGasPrice() {
    try {
        const response = await axios.get(`https://api.polygonscan.com/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`)
        return Number(response.data.result.FastGasPrice)
    }catch (error) {
        console.log(color.redBright("Error occurred in getGasPrice()"))
        console.log(error)
        return 150
    }
}


// -- .ENV VALUES HERE -- //

const arbFor = process.env.ARB_FOR // This is the address of token we are attempting to arbitrage (TOKEN_1)
const arbAgainst = process.env.ARB_AGAINST // TOKEN_2
const account = process.env.ACCOUNT // Account to recieve profit
var units = process.env.UNITS // Used for price display/reporting
const difference = process.env.PRICE_DIFFERENCE



let qPair1, sPair1, amount
let isExecuting = false;
let pairs = []

function getRelatedPair(pair, indices=false) {
    
    //const pairIndex = Number(pairs.findIndex((element) => element == pair))
    const pairIndex = pairs.indexOf(pair)
    
    let pair1,pair2;
    if (pairIndex != -1) {
        // Since there will always be two pair objects per token pair (one for sushiswap and one for quickswap)
        // Then if the index is 0 or even, the corresponding object is in index n + 1
        // But if the index is odd, the other pair is n-1
        
        // Not doing any error handling here as I think it would be caught elsewhere
        // But if there's an out of range error, did all pairs get created successfully and added to the array successfully?
        if (pairIndex % 2 == 0) {
            pair1 = pairs[pairIndex];
            pair2 = pairs[pairIndex + 1];
            if (indices) {
                return [pairIndex, pairIndex + 1]
            } else {
                return [pair1, pair2]
            }
        } else {
            pair1 = pairs[pairIndex];
            pair2 = pairs[pairIndex - 1];
            if (indices) {
                return [pairIndex, pairIndex - 1]
            } else {
                return [pair1, pair2]
            }
        }
        
    }
    
    
}

async function getReserves(_pairContract) {
    const reserves = await _pairContract.methods.getReserves().call()
    return [reserves.reserve0, reserves.reserve1]
}

async function calculateClassPrice(_pairObject) {
    const [reserve0, reserve1] = await getReserves(_pairObject.pairContract)
    return Big(reserve0).div(Big(reserve1)).toString()

}

const checkPrice = async (pair1, pair2) => {
    console.time('checkPrice')
    isExecuting = true
    
    console.log(`Swap Initiated, Checking Prices...\n`)
    const fixedPrice1 = Number(await calculateClassPrice(pair1)).toFixed(pair1.units)
    const fixedPrice2 = Number(await calculateClassPrice(pair2)).toFixed(pair2.units)
    const priceDifference = (((fixedPrice1 - fixedPrice2) / fixedPrice2) * 100).toFixed(process.env.PRICEDIFFUNITS)

    
    console.log(`-----------------------------------------`)
    console.log(`EXCHANGE1 | ${pair1.token1Symbol}/${pair1.token0Symbol}\t | ${fixedPrice1}`)
    console.log(`EXCHANGE2 | ${pair2.token1Symbol}/${pair1.token0Symbol}\t | ${fixedPrice2}\n`)
    console.log(`Percentage Difference: ${color.redBright(priceDifference)}%\n`)

    if (isNaN(priceDifference)) {
        console.log(color.redBright("Increase your units in your .env file!"))
        console.log(color.blueBright(`Automatically increasing units by 10 from ${pair1.units} to ${pair1.units + 10}`))
        pair1.units = pair1.units + 10
        pair2.units = pair2.units + 10
        return 0;
    }
    console.timeEnd('checkPrice')
    return priceDifference
}


const determineDirection = async (priceDifference) => {
    console.time("determineDirection")
    //console.log(`Determining Direction...\n`)

    if (priceDifference >= difference) {

        //console.log(`Potential Arbitrage Direction:\n`)
        console.log(`Buy\t -->\t EXCHANGE1`)
        console.log(`Sell\t -->\t EXCHANGE2\n`)
        console.timeEnd("determineDirection")
        return [qRouter, sRouter]
        //return [sRouter, qRouter]
        

    } else if (priceDifference <= -(difference)) {

        console.log(`Buy\t -->\t EXCHANGE2`)
        console.log(`Sell\t -->\t EXCHANGE1\n`)
        console.timeEnd("determineDirection")
        return [sRouter, qRouter]
        //return [qRouter, sRouter]
        

    } else {
        console.timeEnd("determineDirection")
        return null
    }
}

const determineInputAmount = async (_pair) => {

    // maybe call this when the handlers are made and make it an attribute of the class?
    // just to save time

    // In all cases, token0 is assumed to be the "arb for" token
    // If token0 is a stable coin, borrow at least enough to cover 1 of token1
    if (_pair.inputOverride !== -1)  {
        // If we know beforehand how much we want to borrow/input
        console.log(blueBright(`inputNative overridden: ${_pair.inputOverride} | type: ${typeof _pair.inputOverride}`))
        return Number(_pair.inputOverride)
    }
    // stablecoins = USDC, USDT, DAI, FRAX, miMATIC
    
    const stablecoins = [
        {
            symbol: "USDC",
            address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
            decimals: 6
        }, 
        {
            symbol: "USDT",
            address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
            decimals: 6
        },
        {
            symbol: "DAI",
            address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
            decimals: 18
        },
        {
            symbol: "FRAX",
            address: "0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89",
            decimals: 18
        },
        {
            symbol: "miMATIC",
            address: "0xa3Fa99A148fA48D14Ed51d610c367C61876997F1",
            decimals: 18
        },
        {
            symbol: "TUSD",
            address: "0x2e1AD108fF1D8C782fcBbB89AAd783aC49586756",
            decimals: 18
        },
    ]


    var pairPrice = await calculateClassPrice(_pair); // 1752.53580742683958760552
    var _amountToUse = Math.ceil(Number(pairPrice)) // * 2
    
    // what if they are both stable coins? May want to use less? // return _amountToUse * 100 ? 
    if (stablecoins.some(e => e.address === String(_pair.token0Address))) {
        console.log("Token0 is a stablecoin!")
        // Figure out amount to cover at least 1 of token1 here
        return 2500 // hardcoding for now
    }
    else {
        // Not a stable coin, borrow say 5 ~ again, hardcoding for nows
        return _amountToUse
    }
}


const determineProfitability = async (_routerPath, _pair1, _pair2, inputNative) => {
    
    const _token0 = _pair1.token0;
    const _token1 = _pair1.token1;
    const _token0Contract = _pair1.token0Contract;
    const _t0Symbol = _pair1.token0Symbol;
    const _t1Symbol = _pair1.token1Symbol;


    console.time("determineProfitability")
    console.log(`Determining Profitability...\n`)
    // This is where you can customize your conditions on whether a profitable trade is possible.
    // This is a basic example of trading TOKEN_1/TOKEN_2...

    let reserves, exchangeToBuy, exchangeToSell

    if (_routerPath[0]._address == qRouter._address) {
        //reserves = await getReserves(sPair)
        exchangeToBuy = 'Quickswap'
        exchangeToSell = 'Sushiswap'
    } else {
        //reserves = await getReserves(qPair)
        exchangeToBuy = 'Sushiswap'
        exchangeToSell = 'Quickswap'
    }

    //console.log(`Reserves on ${_routerPath[1]._address}`)
    //console.log(`TOKEN_2: ${reserves[0].toString()}`)//${Number(web3.utils.fromWei(reserves[0].toString(), 'ether')).toFixed(0)}`)
    //console.log(`TOKEN_1: ${reserves[1].toString()}`)//${web3.utils.fromWei(reserves[1].toString(), 'ether')}\n`)

    
    try {
        
        let loanDeduction = inputNative * process.env.LOAN_FEE_PERCENT
        //let loanDeduction = web3.utils.toWei((inputNative * process.env.LOAN_FEE_PERCENT).toString(), 'ether')
        
        console.log(`-----------------------\ntypeof: ${web3.utils.toWei(inputNative.toString())}\nvalue: ${web3.utils.toWei(inputNative.toString())}`)

        let result = await _routerPath[0].methods.getAmountsOut(web3.utils.toWei(inputNative.toString()), [_token0.address, _token1.address]).call()

        const token0In = result[0] // TOKEN_1 (input to first trade)
        const token1In = result[1] // TOKEN_2 (output of first trade) 
                
        result = await _routerPath[1].methods.getAmountsOut(token1In, [_token1.address, _token0.address]).call()

       
        

        let amountIn = token0In
        let amountOut = result[1]

        console.log(`Estimated amount of ${_t0Symbol} needed to buy enough ${_t1Symbol} on ${exchangeToBuy}\t| ${token0In}`) // ${web3.utils.fromWei(token0In, 'ether')}
        console.log(`Estimated amount of ${_t0Symbol} returned after swapping ${_t1Symbol} on ${exchangeToSell}\t| ${result[1]}\n`)

        
        
        
        //console.log("Fee deducted (token1): ", loanDeduction)

        //estimatedGasCost = web3.utils.toWei((await getGasPrice() * 25000).toString(), 'gwei')
        
        estimatedGasCost = Math.ceil(24000 * (await getGasPrice())) // round to next highest integer
        
        estimatedGasCost = web3.utils.fromWei(estimatedGasCost.toString(), 'Gwei')
        
        let ethBalanceBefore = web3.utils.fromWei(await web3.eth.getBalance(account), 'ether')

        const ethBalanceAfter = ethBalanceBefore - estimatedGasCost 

        const amountDifference = (amountOut - amountIn) * 10 ** -18
        console.log(`amountIn: ${amountIn}\namountOut: ${amountOut}`)
        console.log(`amountDifference: ${amountDifference}`)
        let wethBalanceBefore = web3.utils.fromWei(await _token0Contract.methods.balanceOf(account).call(), 'ether')

        const wethBalanceAfter = amountDifference + Number(wethBalanceBefore) //- loanDeduction
        const wethBalanceDifference = wethBalanceAfter - Number(wethBalanceBefore)

        const totalGained = wethBalanceDifference - Number(estimatedGasCost)
        
        
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
        
        console.log(`amountOut: ${Number(amountOut)}\nin+loan: ${Number(amountIn) + Number(web3.utils.toWei(loanDeduction.toString(), 'ether'))}`)
        if (Number(amountOut) <= (Number(amountIn) + Number(loanDeduction))) {
            
            console.timeEnd("determineProfitability")
            return false
        }

        amount = token0In
        
        return true

    } catch (error) {
        console.log(error) // console.log(error.data.stack) 
        console.log(color.redBright(`\nError occured while trying to determine profitability...\n`))
        console.log("Error Email Sent!")
        sendErrorMail(error.message)
        writeErrorToFile(error)
        return false
    }
}










async function handleSwapEvent(pair) {
    console.log(`handleSwapEvent() called for ${pair.pairAddress}`)

    const pairsReturned = getRelatedPair(pair, indices=false)
    const pair1 = pairsReturned[0];
    const pair2 = pairsReturned[1];
    const priceDifference = await checkPrice(pair1, pair2)
    const routerPath = await determineDirection(priceDifference)
    

    if (!routerPath) {
        console.log(`No Arbitrage Currently Available\n`)
        console.log(`-----------------------------------------\n`)
        isExecuting = false
        return
    }

    const inputAmount = await determineInputAmount(pair1);
    const isProfitable = await determineProfitability(routerPath, pair1, pair2, inputAmount)


    if (!isProfitable) {
        console.log(`No Arbitrage Currently Available\n`)
        console.log(`-----------------------------------------\n`)
        isExecuting = false
        //console.timeEnd("sPair_EventDetected")
        return
    }

    try {
        const receipt = await executeTrade(routerPath, token0Contract, token1Contract)
    } catch (error) {
        console.log(error) // console.log(error.data.stack) 
        console.log(color.redBright(`\nError occured while trying to execute a trade...\n`))
        console.log("Error Email Sent!")
        sendErrorMail(error.message)
    }
    isExecuting = false
}

const executeTrade = async (_routerPath, _pair) => {
    console.time("executeTrade")

    const _token0Contract = _pair.token0Contract;
    const _token1Contract = _pair.token1Contract;

    

    try {
        console.log(`Attempting Arbitrage...\n`)

        let startOnQuickswap // Is router[0] Quickswap?
        let routerA, routerB;
        if (_routerPath[0]._address == qRouter._address) {
            
            startOnQuickswap = true
            routerB = _routerPath[0]._address
            routerA = _routerPath[1]._address
        } else {
            
            startOnQuickswap = false
            routerB = _routerPath[1]._address
            routerA = _routerPath[0]._address
        }
        const routerAV2 = true
        const routerBV2 = true
        // Fetch token balance before
        const balanceBefore = await _token0Contract.methods.balanceOf(account).call()
        const ethBalanceBefore = await web3.eth.getBalance(account)

        /*
        const gasInWei = estimatedGasCost * 10 ** 9
        const execTradeGasInWei = 23500
        */

        // data: ABI byte string containing the data of the function call on a contract
        if (config.PROJECT_SETTINGS.isDeployed) {
            
            console.log("\n\t__executeTrade Parameters__")
            console.log("startOnQuickswap: ", startOnQuickswap)
            console.log("token0 address: ", _token0Contract._address)
            console.log("token1 address: ", _token1Contract._address)
            console.log("amount: ", amount)
            console.log("routerA: ", routerA)
            console.log("routerB: ", routerB)
            console.log("routerVersions[]: ", [routerAV2, routerBV2])
            
            
            var estimatedGasCostByMethod = await arbitrage.methods.executeTrade(_token0Contract._address, _token1Contract._address, amount, routerA, routerB, [routerAV2, routerBV2]).estimateGas()
            console.log(`executeMethod gas: ${estimatedGasCostByMethod}`)
            var baseGasPrice = await getGasPrice()
            var gasToUse = Math.round(estimatedGasCostByMethod * baseGasPrice)
            console.log(`gasToUse (${typeof(gasToUse)}): ${gasToUse}`)
            console.log(`amount (${typeof(amount)}): ${amount}`)
            //console.log("Estimated gas for executeTrade(): ", estimatedGasCostByMethod, " * ", baseGasPrice, " = ", gasToUse) //23424

            const transaction = {
                'from' : account,
                'to' : arbitrage._address,
                'data' : arbitrage.methods.executeTrade(_token0Contract._address, _token1Contract._address, amount, routerA, routerB, [routerAV2, routerBV2]).encodeABI(),
                'gas' : gasToUse,            
            }
            const signedTx = await web3.eth.accounts.signTransaction(transaction, process.env.DEPLOYMENT_ACCOUNT_KEY)
            let transactionReceipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            
            console.log("\n\t_Transaction Receipt__\n", transactionReceipt, "\n\n")
            
        }



        console.log(color.greenBright(`Trade Complete:\n`))

        // Fetch token balance after
        const balanceAfter = await _token0Contract.methods.balanceOf(arbitrage._address).call()
        const balanceAfterT1 = await _token1Contract.methods.balanceOf(arbitrage._address).call()
        const ethBalance = await web3.eth.getBalance(arbitrage._address)
        console.log("---------\nbalanceAfterToken0: ", balanceAfter)
        console.log("balanceAfterToken1: ", balanceAfterT1)
        console.log("balanceAfterETH: ", ethBalance, "\n---------")

        const ethBalanceAfter = await web3.eth.getBalance(account)

        const balanceDifference = balanceAfter - balanceBefore
        const totalSpent = ethBalanceBefore - ethBalanceAfter


        const data = {
            'ETH Balance Before': web3.utils.fromWei(ethBalanceBefore, 'ether'),
            'ETH Balance After': web3.utils.fromWei(ethBalanceAfter, 'ether'),
            'ETH Spent (gas)': web3.utils.fromWei((ethBalanceBefore - ethBalanceAfter).toString(), 'ether'),
            '-': {},
            'TOKEN_0 Balance BEFORE': web3.utils.fromWei(balanceBefore.toString(), 'ether'),
            'TOKEN_0 Balance AFTER': web3.utils.fromWei(balanceAfter.toString(), 'ether'),
            'TOKEN_0 Gained/Lost': web3.utils.fromWei(balanceDifference.toString(), 'ether'),
            '-': {},
            'Total Gained/Lost': `${web3.utils.fromWei((balanceDifference - totalSpent).toString(), 'ether')} ETH`
        }
        console.table(data)
        console.timeEnd("executeTrade")
    } catch (error) {
        console.log(error) // console.log(error.data.stack) 
        console.log(`\nError occured while trying to execute a trade...\n`)
        console.log("Error Email Sent!")
        sendErrorMail(error.message)
        writeErrorToFile(error)
    }


    // ------------------------------------- //
    // -----Withdraw Balance To Account----- //
    // ------------------------------------- //   
    try {
        console.log("Withdrawing funds!!!")
        const t0BalanceBeforeWithdraw = await _token0Contract.methods.balanceOf(arbitrage._address).call()
        const ethBalanceBeforeWithdraw = await web3.eth.getBalance(arbitrage._address)
        const t0BalanceBeforeWithdrawAccount = await _token0Contract.methods.balanceOf(account).call()
        const ethBalanceBeforeWithdrawAccount = await web3.eth.getBalance(account)
    
        
        // ------------------------------------- //
        // ---- BEGIN WITHDRAW TRANSACTIONS ---- //
        // ------------------------------------- //
        
        /* ETH WITHDRAW */
        if (!(Number(ethBalanceBeforeWithdraw) > 0)) {
            console.log("ETH balance is not greater than 0")
        }
        else {
            console.log(`withdrawETH() transferring ${ethBalanceBeforeWithdraw} from contract`)
            var estimatedGasCostWithdraw = await arbitrage.methods.withdrawETH().estimateGas()
            var baseGasPrice = await getGasPrice()
            var gasToUse = Number(estimatedGasCostWithdraw) * baseGasPrice
            
            const withdrawETHTx = {
                'from' : account,
                'to' : arbitrage._address,
                'data' : arbitrage.methods.withdrawETH().encodeABI(),
                'gas' : gasToUse,            
            }
            const signedWithdrawETHTx = await web3.eth.accounts.signTransaction(withdrawETHTx, process.env.DEPLOYMENT_ACCOUNT_KEY)
            let withdrawReceipt = await web3.eth.sendSignedTransaction(signedWithdrawETHTx.rawTransaction)
            console.log(withdrawReceipt)  
        }


        /* TOKEN 0 WITHDRAW */
        if (!(Number(t0BalanceBeforeWithdraw) > 0)) {
            console.log(`Token0 balance is not greater than 0`)
        }
        else {
            console.log(`withdrawToken() transferring ${t0BalanceBeforeWithdraw} from contract`)
            var estimatedGasCostWithdrawToken = await arbitrage.methods.withdrawToken(_token0Contract._address).estimateGas()
            var gasToUse = Number(estimatedGasCostWithdrawToken) * baseGasPrice
            console.log("Estimated gas for withdrawToken(): (doubling) ", estimatedGasCostWithdraw) //27244
            const withdrawTokenTx = {
                'from' : account,
                'to' : arbitrage._address,
                'data' : arbitrage.methods.withdrawToken(_token0Contract._address).encodeABI(),
                'gas' : gasToUse,            
            }
            const signedwithdrawTokenTx = await web3.eth.accounts.signTransaction(withdrawTokenTx, process.env.DEPLOYMENT_ACCOUNT_KEY)
            let withdrawTokenReceipt = await web3.eth.sendSignedTransaction(signedwithdrawTokenTx.rawTransaction)
            console.log(withdrawTokenReceipt)
        }


        // ------------------------------------- //
        // ---- END WITHDRAW TRANSACTIONS ---- //
        // ------------------------------------- //

        
        const t0BalanceAfterWithdraw = await _token0Contract.methods.balanceOf(arbitrage._address).call()
        const ethBalanceAfterWithdraw = await web3.eth.getBalance(arbitrage._address)
        const t0BalanceAfterWithdrawAccount = await _token0Contract.methods.balanceOf(account).call()
        const ethBalanceAfterWithdrawAccount = await web3.eth.getBalance(account)
    
        

        const withdrawData = {
            'Contract ETH Balance Before': ethBalanceBeforeWithdraw,
            'Contract T0 Balance Before': t0BalanceBeforeWithdraw,
            'Account ETH Balance Before': ethBalanceBeforeWithdrawAccount,
            'Account T0 Balance Before': t0BalanceBeforeWithdrawAccount,
            '-': {},
            'Contract ETH Balance After': ethBalanceAfterWithdraw,
            'Contract T0 Balance After': t0BalanceAfterWithdraw,
            'Account ETH Balance After': ethBalanceAfterWithdrawAccount,
            'Account T0 Balance After': t0BalanceAfterWithdrawAccount,
            
        }

        console.table(withdrawData)
        const tradeSymbol = await _token0Contract.methods.symbol().call()
        sendSucessMail(`${web3.utils.fromWei((t0BalanceAfterWithdrawAccount - t0BalanceBeforeWithdrawAccount).toString(), 'ether')} ${tradeSymbol.toString()}`)
    } catch (error) {
        console.log(error) // console.log(error.data.stack) 
        console.log(`\nError occured while trying to withdraw funds...\n`)
        console.log("Error Email Sent!")
        sendErrorMail(error.message)
        writeErrorToFile(error)
    }


}

const main = async () => {

    // TODO: Add logic for amount to use like wmatic->weth
    //          maybe call the determineInputAmount() func when the handlers are made to save time when a pair is executing

    // TODO: Double check the isExecuting code sections because it seems like the "amount needed to buy" is executing multiple times 
    // TODO: What if adding units is enough to get non-nan but not enough for accurate reading?
    //      ex: current implementation got it to lik 0.00000017 of a difference but we'd need more
    //      What's the math to fix this? Involves decimals/power?
    //      Solution for now: increase by 10 instead of 5
    //              update: didn't work


    /***************************/
    /* Define cutom pairs here */
    /***************************/

    console.log(qFactory.address)
    // WETH/WMATIC
    qPair1 = new cryptoPair("0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", 18, "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", 18, qFactory)
    sPair1 = new cryptoPair("0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", 18, "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", 18, sFactory)

    pairs.push(qPair1) 
    pairs.push(sPair1)

    /*
    // USDC/ASTRAFER // KNOWN FAILURE -> USE TO TEST ERROR HANDLING
    qPair3 = new cryptoPair("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", 6, "0xDfCe1e99A31C4597a3f8A8945cBfa9037655e335", 18, qFactory)
    sPair3 = new cryptoPair("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", 6, "0xDfCe1e99A31C4597a3f8A8945cBfa9037655e335", 18, sFactory)
    
    pairs.push(qPair3) 
    pairs.push(sPair3)
    */

    /*
    // known issue with amountout return values
    // USDC/GDDY
    qPair2 = new cryptoPair("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", 6, "0x67eB41A14C0fe5CD701FC9d5A3D6597A72F641a6", 18, qFactory)
    sPair2 = new cryptoPair("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", 6, "0x67eB41A14C0fe5CD701FC9d5A3D6597A72F641a6", 18, sFactory)
    
    pairs.push(qPair2) 
    pairs.push(sPair2)
    */

    
    


    /********************************/
    /* Start generic per-pair logic */
    /********************************/
    
    
    let handlers = []
    let pairsToHandle = []
    for (const pair of pairs) {
        // Set per-pair units so that they can be adjusted as needed
        pair.units = process.env.UNITS;

        await pair.defineTokens(pair._token0Address, pair._token0Decimals, pair._token1Address, pair._token1Decimals)
        await pair.definePairContract()
        
        if (pair.pairAddress == "0x0000000000000000000000000000000000000000") {
            /**********************************/
            /* Failsafe / Error Handling Pt 1 */
            /**********************************/
            const offendingPairIndices = getRelatedPair(pair,indices=true)
            // If the last pair wasn't 0x0 but should still be deleted, we can use pop
            if (offendingPairIndices[1] < offendingPairIndices[0]) {pairsToHandle.pop();handlers.pop()} else {pairsToHandle[offendingPairIndices[1]]= null;handlers[offendingPairIndices[1]] = null}
            
            console.log(color.redBright(`Invalid pair! Deleting ${pair.token0Symbol}/${pair.token1Symbol}`))

        } else {
            console.log(`Pair created for ${pair.token0Symbol}/${pair.token1Symbol} : ${pair.pairAddress}`)
            handlers.push(`${pair.token0Symbol}/${pair.token1Symbol}`)
            pairsToHandle.push(pair)
        }
    }
    
    console.log(`handlers: ${handlers}`)
    
    
    
    pairsToHandle.filter(e => e !== null).forEach(pair => { // Failsafe / Error Handling Pt 2
        console.log(`Creating async handler for ${pair.pairAddress}`)
        pair.pairContract.events.Swap({}, async () => {
            if (!isExecuting) {
                isExecuting = true
                handleSwapEvent(pair)
                isExecuting = false    
            }
        })
    })
    
        
    
    
    
    console.log("waiting for swap event")
} 

main()



/*
    might be an issue where a value isn't converted properly as per here going from USDC (6 decimals) to GDDY (18)

-----------------------------------------
EXCHANGE1 | GIDDY/USDC   | 0.00000
EXCHANGE2 | GIDDY/USDC   | 0.000000000000038

Percentage Difference: -100.000%

checkPrice: 227.101ms
Buy      -->     EXCHANGE2
Sell     -->     EXCHANGE1

determineDirection: 0.048ms
Token0 is a stablecoin!
Determining Profitability...

-----------------------
typeof: 2500000000000000000000
value: 2500000000000000000000
Estimated amount of USDC needed to buy enough GIDDY on Sushiswap        | 2500000000000000000000
Estimated amount of USDC returned after swapping GIDDY on Quickswap     | 2775

amountIn: 2500000000000000000000
amountOut: 2775
amountDifference: -2500
┌────────────────────────┬────────────────────────┐
│        (index)         │         Values         │
├────────────────────────┼────────────────────────┤
│   ETH Balance Before   │ '4.636756445466644627' │
│   ETH Balance After    │   4.635170045466645    │
│    ETH Spent (gas)     │      '0.0015864'       │
│           -            │                        │
│ TOKEN_0 Balance BEFORE │          '0'           │
│ TOKEN_0 Balance AFTER  │         -2500          │
│  TOKEN_0 Gained/Lost   │         -2500          │
│   Total Gained/Lost    │     -2500.0015864      │
└────────────────────────┴────────────────────────┘
amountOut: 2775
in+loan: 2.50125e+21
determineProfitability: 1.131s
No Arbitrage Currently Available


*/