require("dotenv").config();
const config = require('../config.json')
const HDWalletProvider = require('@truffle/hdwallet-provider');
const Web3 = require('web3')
let web3
var currentURL = '';

// TODO: recreate switchProvider to properly define web3!

/*
function switchProvider(providerToUse) {
    console.log(`Using ${providerToUse} as Web3 provider`)
    var provider
    if (providerToUse == 'alchemy') {
        provider = new HDWalletProvider({
            privateKeys: [process.env.DEPLOYMENT_ACCOUNT_KEY],
            providerOrUrl: `wss://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        })
        currentURL = 'alchemy'
    }
    else if (providerToUse == 'infura') {
        provider = new HDWalletProvider({
            privateKeys: [process.env.DEPLOYMENT_ACCOUNT_KEY],
            providerOrUrl: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`
        })
        currentURL = "infura"
    }
    else if (providerToUse == 'moralis') {
        provider = new HDWalletProvider({
            privateKeys: [process.env.DEPLOYMENT_ACCOUNT_KEY],
            providerOrUrl: process.env.MORALIS_NODE_URL
        })
        currentURL = "moralis"
    }
    return provider 
}

// Attempt to use alchemy, if there is an issue connecting, try infura, otherwise use moralis
try {

    if (currentURL != "alchemy") {
        web3 = new Web3(`wss://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
        //web3 = new Web3(switchProvider('alchemy'))
    } else if (currentURL != "infura") {
        web3 = new Web3(switchProvider('infura'))
    } else {
        web3 = new Web3(switchProvider('moralis'))
    }

    

} catch (err) {
    console.log(err)
    
    try {
        
        if (currentURL != "infura") {
            web3 = new Web3(switchProvider('infura'))
        } else if (currentURL != "alchemy") {
            web3 = new Web3(switchProvider('alchemy'))
        } else {
            web3 = new Web3(switchProvider('moralis'))
        }

    } catch {
        web3 = new Web3(switchProvider('moralis'))
    }
}
*/

web3 = new Web3(`wss://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
const SushiswapFactory = require("../ABIs/SUSHISWAP_FACTORY.json")
const SushiswapRouter = require("../ABIs/SUSHISWAP_ROUTER.json")
const qSwapFactory = require("../ABIs/QUICKSWAP_FACTORY.json")
const qSwapRouter = require("../ABIs/QUICKSWAP_ROUTER.json")
const UniswapFactory = require("../ABIs/UNISWAPV3_FACTORY.json")
const UniswapRouter = require("../ABIs/UNISWAPV3_ROUTER.json")

const uFactory = new web3.eth.Contract(UniswapFactory.abi, config.UNISWAP.FACTORY_ADDRESS) // UNISWAP FACTORY CONTRACT
const uRouter = new web3.eth.Contract(UniswapRouter.abi, config.UNISWAP.V3_ROUTER_02_ADDRESS) // UNISWAP ROUTER CONTRACT

const sFactory = new web3.eth.Contract(SushiswapFactory.abi, config.SUSHISWAP.FACTORY_ADDRESS) // SUSHISWAP FACTORY CONTRACT
const sRouter = new web3.eth.Contract(SushiswapRouter.abi, config.SUSHISWAP.V3_ROUTER_02_ADDRESS) // SUSHISWAP ROUTER CONTRACT

const qFactory = new web3.eth.Contract(qSwapFactory.abi, config.QUICKSWAP.FACTORY_ADDRESS) // QUICKSWAP FACTORY CONTRACT
const qRouter = new web3.eth.Contract(qSwapRouter.abi, config.QUICKSWAP.V3_ROUTER_02_ADDRESS)
const IArbitrage = require('../ABIs/Flashloan.json')

const arbitrage = new web3.eth.Contract(IArbitrage.abi, process.env.CONTRACT); // ganache test address!

module.exports = {
    uFactory,
    uRouter,
    sFactory,
    sRouter,
    qFactory,
    qRouter,
    web3,
    arbitrage,
    //switchProvider,
    currentURL
}