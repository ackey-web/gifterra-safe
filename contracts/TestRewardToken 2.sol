// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TestRewardToken
 * @notice ローカルテスト用のERC20トークン
 */
contract TestRewardToken is ERC20 {
    constructor() ERC20("Test Reward Token", "TRT") {
        // 初期供給量: 100万トークン
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    /**
     * @notice テスト用：誰でもミント可能
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
