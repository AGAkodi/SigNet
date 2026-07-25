// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MockERC20.sol";

contract MockAavePool {
    mapping(address => mapping(address => uint256)) public supplied;
    mapping(address => mapping(address => uint256)) public borrowed;

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        MockERC20(asset).transferFrom(msg.sender, address(this), amount);
        supplied[asset][onBehalfOf] += amount;
    }

    function borrow(address asset, uint256 amount, uint256, uint16, address onBehalfOf) external {
        borrowed[asset][onBehalfOf] += amount;
        MockERC20(asset).mint(msg.sender, amount);
    }

    function repay(address asset, uint256 amount, uint256, address onBehalfOf) external returns (uint256) {
        MockERC20(asset).transferFrom(msg.sender, address(this), amount);
        if (borrowed[asset][onBehalfOf] >= amount) {
            borrowed[asset][onBehalfOf] -= amount;
        } else {
            borrowed[asset][onBehalfOf] = 0;
        }
        return amount;
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        if (supplied[asset][msg.sender] >= amount) {
            supplied[asset][msg.sender] -= amount;
        } else {
            supplied[asset][msg.sender] = 0;
        }
        MockERC20(asset).mint(to, amount);
        return amount;
    }
}
