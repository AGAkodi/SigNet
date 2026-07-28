// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/token/ERC7984.sol";
import {Nox, euint256, externalEuint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

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
     * @dev Override _update to handle uninitialized recipient balances & supply handles safely
     */
    function _update(
        address from,
        address to,
        euint256 amount
    ) internal override returns (euint256 transferred) {
        ERC7984Storage storage $ = _getERC7984Storage();

        if (from == address(0)) {
            // Mint: safely increase total supply.
            euint256 supply = $._totalSupply;
            euint256 newSupply = Nox.isInitialized(supply)
                ? Nox.add(supply, amount)
                : amount;
            Nox.allowThis(newSupply);
            $._totalSupply = newSupply;
        } else {
            // Transfer/burn: safely decrease sender balance.
            euint256 fromBalance = $._balances[from];
            require(Nox.isInitialized(fromBalance), ERC7984ZeroBalance(from));
            (ebool success, euint256 ptr) = Nox.safeSub(fromBalance, amount);
            ptr = Nox.select(success, ptr, fromBalance);
            Nox.allowThis(ptr);
            Nox.allow(ptr, from);
            $._balances[from] = ptr;
        }

        transferred = amount;

        if (to == address(0)) {
            // Burn: decrease total supply by transferred amount.
            euint256 supply = $._totalSupply;
            euint256 newSupply = Nox.sub(supply, transferred);
            Nox.allowThis(newSupply);
            $._totalSupply = newSupply;
        } else {
            // Mint/transfer: increase recipient balance.
            euint256 recipientBal = $._balances[to];
            euint256 newBal = Nox.isInitialized(recipientBal)
                ? Nox.add(recipientBal, transferred)
                : transferred;
            Nox.allowThis(newBal);
            Nox.allow(newBal, to);
            $._balances[to] = newBal;
        }

        if (from != address(0)) {
            Nox.allow(transferred, from);
        }
        if (to != address(0)) {
            Nox.allow(transferred, to);
        }
        Nox.allowThis(transferred);
        emit ConfidentialTransfer(from, to, transferred);
    }

    /**
     * @notice Mint encrypted tokens to a recipient with cryptographic input proof (called by ConfidentialCredit vault)
     * @param to Recipient address
     * @param externalAmount Encrypted external handle
     * @param proof Cryptographic TEE input proof
     */
    function mintEncrypted(
        address to,
        externalEuint256 externalAmount,
        bytes calldata proof
    ) external onlyVault returns (euint256) {
        require(to != address(0), "ERC7984: mint to zero address");
        euint256 amountHandle = Nox.fromExternal(externalAmount, proof);
        return _mint(to, amountHandle);
    }

    /**
     * @notice Mint encrypted tokens to a recipient using an existing handle (called by ConfidentialCredit vault)
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
