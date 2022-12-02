require("dotenv").config();
const { uFactory, uRouter, sFactory, sRouter, qFactory, qRouter, web3, arbitrage } = require('../helpers/initialization')

const account = process.env.ACCOUNT

const IERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json')
const _token0Contract = new web3.eth.Contract(IERC20.abi, "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174")

const main = async () => {
    console.log("Withdrawing funds!!!")

    
    const ethBalanceBeforeWithdraw = await web3.eth.getBalance(arbitrage._address)
    if (!(Number(ethBalanceBeforeWithdraw) > 0)) {
        console.log("ETH balance is not greater than 0")
    }
    else {
        console.log(`withdrawETH() transferring ${ethBalanceBeforeWithdraw} from contract`)
        var estimatedGasCostWithdraw = await arbitrage.methods.withdrawETH().estimateGas()
        estimatedGasCostWithdraw = estimatedGasCostWithdraw * 2
        console.log("Estimated gas for withdrawETH(): (doubling) ", estimatedGasCostWithdraw)
        const withdrawETHTx = {
            'from' : account,
            'to' : arbitrage._address,
            'data' : arbitrage.methods.withdrawETH().encodeABI(),
            'gas' : estimatedGasCostWithdraw,            
        }
        const signedWithdrawETHTx = await web3.eth.accounts.signTransaction(withdrawETHTx, process.env.DEPLOYMENT_ACCOUNT_KEY)
        let withdrawReceipt = await web3.eth.sendSignedTransaction(signedWithdrawETHTx.rawTransaction)
        console.log(withdrawReceipt)  
    }
    const t0BalanceBeforeWithdraw = await _token0Contract.methods.balanceOf(arbitrage._address).call()
    if (!(Number(t0BalanceBeforeWithdraw) > 0)) {
        console.log(`Token0 balance is not greater than 0`)
    }
    else {
        console.log(`withdrawToken() transferring ${t0BalanceBeforeWithdraw} from contract`)
        var estimatedGasCostWithdrawToken = await arbitrage.methods.withdrawToken(_token0Contract._address).estimateGas()
        estimatedGasCostWithdrawToken = estimatedGasCostWithdrawToken * 2
        console.log("Estimated gas for withdrawToken(): (doubling) ", estimatedGasCostWithdraw) //27244
        const withdrawTokenTx = {
            'from' : account,
            'to' : arbitrage._address,
            'data' : arbitrage.methods.withdrawToken(_token0Contract._address).encodeABI(),
            'gas' : estimatedGasCostWithdrawToken,            
        }
        const signedwithdrawTokenTx = await web3.eth.accounts.signTransaction(withdrawTokenTx, process.env.DEPLOYMENT_ACCOUNT_KEY)
        let withdrawTokenReceipt = await web3.eth.sendSignedTransaction(signedwithdrawTokenTx.rawTransaction)
        console.log(withdrawTokenReceipt)
    }

}
main()