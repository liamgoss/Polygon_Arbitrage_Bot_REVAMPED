require("dotenv").config();

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 
 require("@nomiclabs/hardhat-ethers");
 require("@nomiclabs/hardhat-etherscan");
 const PRIV_KEY = process.env.HARDHAT_PRIVATE_KEY
 module.exports = {
   defaultNetwork: "matic",
   networks: {
     localGanache: {
       url: "http://127.0.0.1:8545",
       accounts: [PRIV_KEY],
       network_id: "*"
     },
     matic: {
       url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
       accounts: [PRIV_KEY]
     },
     hardhat: {
      forking: {
        url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        accounts: [PRIV_KEY]
      },
      chainId: 137
     }
   },
   etherscan: {
     apiKey: process.env.POLYGONSCAN_API_KEY
   },
   solidity: {
     compilers: [
       {
         version: "0.6.6",
         settings: {
           optimizer: {
           enabled: true,
           runs: 1000
          },
        },
      },
      
      {
        version: "0.8.10",
      },

      {
        version: "0.7.5",
      },
    ],
  },
};
