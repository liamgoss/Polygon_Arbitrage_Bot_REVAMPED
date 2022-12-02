// -- IMPORT PACKAGES -- //
require("dotenv").config();
//console.log(require('dotenv').config())
const { ethers } = require("hardhat");


const Web3 = require('web3')
const {
    ChainId,
    Token,
    WETH
} = require("@uniswap/sdk")
const IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json')
const IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json")
const IERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json')

// -- SETUP NETWORK & WEB3 -- //

const chainId = 137
const web3 = new Web3('http://127.0.0.1:8545')

// -- IMPORT HELPER FUNCTIONS -- //

const { getPairContract, calculatePrice } = require('../helpers/helpers')

// -- IMPORT & SETUP UNISWAP/SUSHISWAP CONTRACTS -- //

const config = require('../config.json');

const uFactory = new web3.eth.Contract(IUniswapV2Factory.abi, config.UNISWAP.FACTORY_ADDRESS) // UNISWAP FACTORY CONTRACT
const sFactory = new web3.eth.Contract(IUniswapV2Factory.abi, config.SUSHISWAP.FACTORY_ADDRESS) // SUSHISWAP FACTORY CONTRACT
const uRouter = new web3.eth.Contract(IUniswapV2Router02.abi, config.UNISWAP.V3_ROUTER_02_ADDRESS) // UNISWAP ROUTER CONTRACT
const sRouter = new web3.eth.Contract(IUniswapV2Router02.abi, config.SUSHISWAP.V3_ROUTER_02_ADDRESS) // UNISWAP ROUTER CONTRACT

// -- CONFIGURE VALUES HERE -- //

const V2_FACTORY_TO_USE = sFactory
const V2_ROUTER_TO_USE = sRouter


const UNLOCKED_ACCOUNT = '0x01aeFAC4A308FbAeD977648361fBAecFBCd380C7' // WETH Unlocked Account

const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545")





const AMOUNT = '100000000000000000000000' // 1000 MATIC 
//const AMOUNT = '10000000000'
const GAS = 450000
            

// -- SETUP ERC20 CONTRACT & TOKEN -- //

const ERC20_CONTRACT = new web3.eth.Contract(IERC20.abi, "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270")
const WETH_CONTRACT = new web3.eth.Contract(IERC20.abi, "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619") // WETH address
let balanceBEFORE;
// -- MAIN SCRIPT -- //
//ARB AGAINST = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270
const main = async () => {
    await provider.send('hardhat_impersonateAccount', [UNLOCKED_ACCOUNT])
    const signer = await provider.getSigner(UNLOCKED_ACCOUNT)
    const accounts = await web3.eth.getAccounts()
    const account = accounts[1] // This will be the account to recieve WETH after we perform the swap to manipulate price

    const pairContract = await getPairContract(V2_FACTORY_TO_USE, "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619")
    const token = new Token(
        137,
        "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        18,
        await ERC20_CONTRACT.methods.symbol().call(),
        await ERC20_CONTRACT.methods.name().call()
    )

    // Fetch price of SHIB/WETH before we execute the swap
    const priceBefore = await calculatePrice(pairContract)
    balanceBEFORE = await ERC20_CONTRACT.methods.balanceOf(UNLOCKED_ACCOUNT).call()
    console.log(`\nBalance in UNLOCKED account: ${balanceBEFORE} USDC\n`)

    var balanceWETH = await WETH_CONTRACT.methods.balanceOf(UNLOCKED_ACCOUNT).call()
    console.log(`\nBalance in UNLOCKED account: ${balanceWETH} WETH\n`)
   
    await manipulatePrice(token, account, pairContract)

    // Fetch price of SHIB/WETH after the swap
    const priceAfter = await calculatePrice(pairContract)

    const data = {
        'Price Before': `1 ${"WETH"} = ${Number(priceBefore).toFixed(20)} ${token.symbol}`,
        'Price After': `1 ${"WETH"} = ${Number(priceAfter).toFixed(20)} ${token.symbol}`,
    }

    console.table(data)

    let balanceAfter = await WETH_CONTRACT.methods.balanceOf(account).call()
    balanceAfter = web3.utils.fromWei(balanceAfter.toString(), 'ether')

    console.log(`\nBalance in reciever account: ${balanceAfter} WETH\n`)
}

main()



async function manipulatePrice(token, account, pairContract) {
    await provider.send('hardhat_impersonateAccount', [UNLOCKED_ACCOUNT])
    const signer = await provider.getSigner(UNLOCKED_ACCOUNT)
    console.log(`\nBeginning Swap...\n`)

    console.log(`Input Token: ${token.symbol}`)
    console.log(`Output Token: ${"WETH"}\n`)

    /*
    const amountIn = new web3.utils.BN(
        web3.utils.toWei(AMOUNT, 'ether')
    )
    */
    const amountIn = web3.utils.toWei(AMOUNT).toString()
    const path = [token.address, "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"]
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes


 
    
    


    //console.log("__Swap Tx Details__")
    console.log("Amount swapped: ", amountIn)
    //console.log("From: ", UNLOCKED_ACCOUNT)
    //console.log("Who moves funds: ", V2_ROUTER_TO_USE._address)
    console.log("Path:", path)
    //console.log("Funds recipient: ", account)
    //console.log("Deadline: ", deadline)

    //const signedApprovalTx = await web3.eth.accounts.signTransaction(approvalTransaction, process.env.DEPLOYMENT_ACCOUNT_KEY, )

    //const signedTx = await web3.eth.accounts.signTransaction(transaction, process.env.DEPLOYMENT_ACCOUNT_KEY)
 
    
    //const approvalReceipt = await web3.eth.sendSignedTransaction(signedApprovalTx.rawTransaction)


    /*
        Define the above code at the top,
        Then put the rest of your code here, 
        Then use this for the ethers transaction
    */

    const approvalReceiptEthers = await signer.sendTransaction({
        from: UNLOCKED_ACCOUNT,
        to: ERC20_CONTRACT._address,
        data: ERC20_CONTRACT.methods.approve(V2_ROUTER_TO_USE._address, web3.utils.fromWei(amountIn).toString()).encodeABI(),
        gasLimit: GAS
    })
    
    /*
     * Verify that your unlocked account is allowed to use the funds
    */
    var allowance = await ERC20_CONTRACT.methods.allowance(UNLOCKED_ACCOUNT, V2_ROUTER_TO_USE._address).call()
    console.log("ALLOWANCE:\t\t", web3.utils.fromWei(allowance).toString(), 'ether')
    console.log("ATTEMPTED AMOUNT:\t", web3.utils.fromWei(amountIn).toString(), 'ether')
    

    const swapReceiptEthers = await signer.sendTransaction({
        from: UNLOCKED_ACCOUNT,
        to: V2_ROUTER_TO_USE._address,
        data: V2_ROUTER_TO_USE.methods.swapExactTokensForTokens(web3.utils.fromWei(amountIn).toString(), 0, path, account, deadline).encodeABI(),
        gasLimit: GAS
    }).then(console.log)
   
    let balanceAFTER = await ERC20_CONTRACT.methods.balanceOf(UNLOCKED_ACCOUNT).call()
    console.log(`\nBalance in UNLOCKED account: ${balanceBEFORE} USDC\n`)
    console.log(`\nBalance in UNLOCKED account: ${balanceAFTER} USDC\n`)
    
    /*
    console.log("\n__Approval Receipt__\n")
    console.log(approvalReceiptEthers)
    console.log("\n__Swap Receipt__\n")
    // fails on following transaction!
    //const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction).then(console.log)
    console.log(swapReceiptEthers)
    */


    


    //await ERC20_CONTRACT.methods.approve(V2_ROUTER_TO_USE._address, amountIn).send({ from: UNLOCKED_ACCOUNT })
    
    //const receipt = await V2_ROUTER_TO_USE.methods.swapExactTokensForTokens(amountIn, 0, path, account, deadline).send({ from: UNLOCKED_ACCOUNT, gas: GAS });

    console.log(`Swap Complete!\n`)

    return swapReceiptEthers
    
}
