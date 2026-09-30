// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @dev Stand-in for Tempo's TIP-20 pathUSD: 6 decimals and EIP-2612 permit with domain
///      (name(), "1"), no EIP-3009. Like TIP-1004, a permit overwrites the allowance.
contract MockEIP2612 is ERC20Permit {
    constructor() ERC20("PathUSD", "PathUSD") ERC20Permit("PathUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockFeeOnTransferEIP2612 is MockEIP2612 {
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 burned = value / 100;
            super._update(from, address(0), burned);
            super._update(from, to, value - burned);
        } else {
            super._update(from, to, value);
        }
    }
}
