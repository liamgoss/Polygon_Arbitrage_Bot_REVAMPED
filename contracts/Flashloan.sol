// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6 || >=0.7.5 || ^0.8.0;
pragma experimental ABIEncoderV2;


import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Flashloan Arbitrage Trading Contract
/// @author Liam Goss
/// @notice You can use this contract to perform a decentralized arbitrage trade utilizing AAVE flashloan lending
/// @dev Make sure the solidity file has "pragma experimental ABIEncoderV2;" at the start! I recommend setting your compiler version to "pragma" if possible.
contract Flashloan is FlashLoanSimpleReceiverBase, Ownable {
    
    // Declare AAVE V3 state variables
    IPoolAddressesProvider public immutable ADDRESS_PROVIDER;
    IPool public immutable LENDINGPOOL;


    /// @author Liam Goss
    /// @notice This constructor is used so that the contract can receive a flashloan from AAVE
    /// @dev Constructor must conform to the IFlashLoanSimpleReceiver.sol interface
    /// @param _addressProvider _addressProvider should be 'IPoolAddressesProvider' in accordance with AAVE docs. For AAVE Polygon: 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb
    constructor(IPoolAddressesProvider _addressProvider) FlashLoanSimpleReceiverBase(_addressProvider) public Ownable() {
        // State variable assignments moved to initRouters(...)
        ADDRESS_PROVIDER = _addressProvider;
        LENDINGPOOL = IPool(_addressProvider.getPool());
    }


    /// @notice This is what will be externally called by your local bot code to initiate a transaction
    /// @param _token0 The address of the token you indent to obtain a loan in
    /// @param _token1 The address of the token you intend to trade against
    /// @param _flashAmount The amount of _token0 you intend to borrow from AAVE
    /// @param _routerA The address of the first router of the trade
    /// @param _routerB The address of the second router of the trade
    /// @param _routerVersions A boolean array to set each router's fork type (see initRouters(...))
    /// @dev If you're sending a signed transaction using Web3.js or similar, be sure to set data as contractVariable.methods.executeTrade(...).encodeABI()
    function executeTrade(
        address _token0,
        address _token1,
        uint256 _flashAmount,
        address _routerA,
        address _routerB,
        bool[] calldata _routerVersions
    ) external {
        bool shouldAUseV2 = _routerVersions[0];
        bool shouldBUseV2 = _routerVersions[1];

        

        bytes memory data = abi.encode(
            _token0,
            _token1,
            _flashAmount,
            _routerA,
            _routerB,
            shouldAUseV2,
            shouldBUseV2
        );

        
        flashLoanSimple(_token0, _flashAmount, data);
    }


    /// @notice This function is called after your contract has received the flash loaned amount
    /// @param _asset The address of the flash-borrowed asset
    /// @param _amount The amount of the flash-borrowed asset
    /// @param _fee The fee of the flash-borrowed asset
    /// @param _initiator The address of the flashloan initiator
    /// @param _params The byte-encoded params passed when initiating the flashloan
    /// @dev Don't change the method inputs or name else you'll change the ABI / bytecode of the method and AAVE *expects* this exact setup. Any extra data you want must be in _params. Ensure that the contract can return the debt + premium, e.g., has enough funds to repay and has approved the Pool to pull the total amount
    /// @return True if the execution of the operation succeeds, false otherwise
    function executeOperation(
        address _asset,
        uint256 _amount,
        uint256 _fee,
        address _initiator,
        bytes calldata _params
    )
        external returns (bool)
    {

        //-------BEGIN CUSTOM LOGIC-------\\
        (
            address token0,
            address token1,
            uint256 flashAmount,
            address routerA,
            address routerB,
            bool shouldAUseV2,
            bool shouldBUseV2
        ) = abi.decode(_params, (address, address, uint256, address, address, bool, bool));


        uint amountToReturn = _amount + _fee;

      
        // Use the money here!
      
        address[] memory path = new address[](2);

        path[0] = token0;
        path[1] = token1;


        uint256 amountOutMin;
        // First trade starting on RouterA
        if (shouldAUseV2) {
            uint[] memory amounts = _swapOnV2Router(routerA, path, flashAmount, 0);
            amountOutMin = amounts[1];
            
        } else {
            amountOutMin = _swapOnV3Router(routerA, path, flashAmount, 0);
        }
        // Change path for second trade
        path[0] = token1;
        path[1] = token0;
        // Second trade on RouterB
        if (shouldBUseV2) {
            uint[] memory amountsFinal = _swapOnV2Router(routerA, path, IERC20(token1).balanceOf(address(this)), uint256(amountOutMin + 1));
            
        } else {
            uint256 amountOutFinal = _swapOnV3Router(routerA, path, IERC20(token1).balanceOf(address(this)), uint256(amountOutMin + 1));
        }
        // Trades are complete!


        //-------END CUSTOM LOGIC-------\\

        // You DO NOT need to transfer the owed amount back to the Pool.
        // The funds will be automatically pulled at the conclusion of your operation.

        // Also note that since the owed amounts will be pulled from your contract, your contract must give allowance to the Pool to pull those funds to pay back the flash loan amount + premiums.
        //require(IERC20(path[0]).approve(ADDRESS_PROVIDER.getPool(), amountToReturn), "AAVE Lending Pool approval failed.");
        

        require(IERC20(token0).approve(address(LENDINGPOOL), amountToReturn), "AAVE Lending Pool approval failed.");
       
        return true;
    }


    /// @notice This function executes the flashloan
    /// @param _asset The address of the token to pull out a loan from
    /// @param _amount The amount of `_asset` to borrow
    /// @param _params Any extra data you want passed to executeOperation(...)
    /// @dev The contract this calls will then call the executeOperation(...) function we defined in our contract
    function flashLoanSimple(address _asset, uint256 _amount, bytes memory _params) public {
        address receiverAddress = address(this);
        uint16 referralCode = 0;

        

        // Error: VM Exception while processing transaction: reverted with reason string 'ERC20: transfer amount exceeds allowance'
        LENDINGPOOL.flashLoanSimple(
            receiverAddress,
            _asset,
            _amount,
            _params,
            referralCode
        );
    }


    // -- INTERNAL FUNCTIONS -- //



    function _swapOnV2Router(address _router, address[] memory _path, uint256 _amountIn, uint256 _amountOut) internal returns (uint[] memory amounts) {
        require(IERC20(_path[0]).approve(_router, _amountIn), "Router approval failed.");
        uint[] memory amounts = IUniswapV2Router02(_router).swapExactTokensForTokens(
            _amountIn,
            _amountOut,
            _path,
            address(this),
            block.timestamp
        );
        return amounts;

    }

    function _swapOnV3Router(address _router, address[] memory _path, uint256 _amountIn, uint256 _amountOut) internal returns (uint256) {
        require(IERC20(_path[0]).approve(_router, _amountIn), "Router approval failed.");
        uint256 amountOut = ISwapRouter(_router).exactInput(
            ISwapRouter.ExactInputParams({
                path: abi.encodePacked(_path),
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: _amountIn,
                amountOutMinimum: _amountOut 
            })
        );
        return amountOut;
    }

    
    
    /// @notice This function withdraws the network's native token from the contract
    function withdrawETH() public payable onlyOwner returns (bool) {
        payable(owner()).transfer(address(this).balance);
        return true;
    }

    /// @notice This function withdraws the given ERC20 token from the contract
    /// @param _token The address of the ERC20 token you wish to withdraw
    function withdrawToken(address _token) public payable onlyOwner returns (bool) {
        uint256 tokenBalance = IERC20(_token).balanceOf(address(this));
        bool sent = IERC20(_token).transfer(payable(owner()), tokenBalance);
        require(sent);
        return true;
    }


    ///@notice This is a fallback function, if anything goes wrong, this function should receive the funds instead of them being lost in cyberspace
    fallback() external payable {}

    // -- TEST FUNCTIONS -- //
    /// @notice This function is called to verify that the lending pool state variable was initialized
    /// @dev This function can also be used to get the lending pool's flashloan premium
    function isLendingPoolAccessible() external view returns (uint128) {
        // Are we able to access IPool functions through our object?
        uint128 loanPreem = LENDINGPOOL.FLASHLOAN_PREMIUM_TOTAL();
        return loanPreem;
    }

}
