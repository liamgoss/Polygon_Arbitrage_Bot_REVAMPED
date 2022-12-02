const { expect } = require("chai");
require("@nomiclabs/hardhat-ethers");

describe("Flashloan", function () {
   let Flashloan, flashloan
   before(async function () {
      Flashloan = await ethers.getContractFactory('Flashloan')
   })

   
   beforeEach(async function () {
      flashloan = await Flashloan.deploy("{{address here}}")
      await flashloan.deployed()
   })
   

   it('Lending Pool fee should be accessible and equal to 5', async function() {
      let lendingPoolFee = (await flashloan.isLendingPoolAccessible()).toString()
      //console.log(lendingPoolFee)      
      expect(lendingPoolFee).to.equal('5');
   })

})
