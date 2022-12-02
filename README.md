# Polygon Arbitrage Bot
This code takes advantage of price discrepancies for a token pair between Quickswap, Sushiswap, and UniswapV3 on the Polygon mainnet. In order to maximize profits, these arbitrage opportunities will be exploited with the help of a flashloan from AAVE. 

You'll need to deploy your smart contract onto Polygon and take note of the ABI and contract address, putting the ABI into a json file and the address into your `.env` file.

**Arbitrage:** In its simplest form, crypto arbitrage trading is the process of buying a digital asset on one exchange and selling it (just about) simultaneously on another where the price is higher. Doing so means making profits through a process that involves little or no risks. [Source: coindesk.com](https://www.coindesk.com/learn/crypto-arbitrage-trading-how-to-make-low-risk-gains/#:~:text=In%20its%20simplest%20form%2C%20crypto,involves%20little%20or%20no%20risks.)

**Flashloan:** Unlike normal loans, these loans are 100% collateral free and do not have a limit on how much you can borrow (aside from liquidity restraints). This is made possible through the blockchain and smart contracts. The flashloan will be loaned and repaid back to the provider *within the same transaction!* If the loan cannot be repayed back within the same transaction, the entire process fails. This means that if you borrow 1,000,000 DAI and cannot pay it back, you will **NOT** be responsible for repaying the $1,000,000 loan, but you **will** have to pay the gas fees for a failed transaction. 
