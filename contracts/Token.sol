pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ERC20.sol";

// Note: Change TOKENAME and SYMBOL as suited
contract Token is ERC20("TOKENNAME", "TOKENSYMBOL"), Ownable {

    mapping (address => bool) public miners;

    address[] public minersList;

    // add more supply of tokens
    function mint(address _to, uint256 _amount) external onlyMiners  {
        _mint(_to, _amount);
    }

    // grant access to miner
    function addMiner(address _miner) external onlyOwner {
        miners[_miner] = true;
        minersList.push(_miner);
    }

    // grant access from
    function removeMiner(address _miner) external onlyOwner {
        miners[_miner] = false;
    }

    // Only Authorized Miners can mint the reward Token
    modifier onlyMiners() {
        require (owner() == _msgSender() || miners[_msgSender()] == true, "Ownable: caller is not the owner");
        _;
    }

}
