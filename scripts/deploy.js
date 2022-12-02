async function main() {
    const deployer = await ethers.getSigner(process.env.ACCOUNT);
  
    console.log("Deploying contracts with the account:", deployer.address);
  
    console.log("Account balance:", (await deployer.getBalance()).toString());
  
    const flashloanContract = await ethers.getContractFactory("Flashloan");
    const contract = await flashloanContract.deploy("{{{{address here}}}");
  
    console.log("Contract address:", contract.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });