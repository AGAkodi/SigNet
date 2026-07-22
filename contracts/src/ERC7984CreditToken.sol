// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/token/ERC7984.sol";
import {Nox, euint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/**
 * @title ERC7984CreditToken
 * @dev Confidential Token implementation wrapping real ERC7984 base from @iexec-nox/nox-confidential-contracts.
 * Mint and burn functions operate on real `euint256` Nox TEE handles under ConfidentialCredit vault authority.
 */
contract ERC7984CreditToken is ERC7984 {
    address public owner;
    address public creditVault;

    event VaultUpdated(address indexed newVault);

    modifier onlyVault() {
        require(msg.sender == creditVault, "ERC7984: caller is not credit vault");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "ERC7984: caller is not owner");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory contractURI_
    ) ERC7984(name_, symbol_, contractURI_) {
        owner = msg.sender;
    }

    function setCreditVault(address _vault) external onlyOwner {
        require(_vault != address(0), "ERC7984: invalid vault address");
        creditVault = _vault;
        emit VaultUpdated(_vault);
    }

    /**
     * @notice Mint encrypted tokens to a recipient (called by ConfidentialCredit vault)
     * @param to Recipient address
     * @param amount Real euint256 encrypted handle representing quantity
     */
    function mintEncrypted(address to, euint256 amount) external onlyVault returns (euint256) {
        require(to != address(0), "ERC7984: mint to zero address");
        return _mint(to, amount);
    }

    /**
     * @notice Burn encrypted tokens from an account (called by ConfidentialCredit vault)
     * @param from Target account address
     * @param amount Real euint256 encrypted handle representing quantity
     */
    function burnEncrypted(address from, euint256 amount) external onlyVault returns (euint256) {
        require(from != address(0), "ERC7984: burn from zero address");
        return _burn(from, amount);
    }
}
