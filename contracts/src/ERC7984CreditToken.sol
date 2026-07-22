// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ERC7984CreditToken
 * @dev Confidential Token implementation compliant with ERC7984 standard.
 * Underpins private balance minting and burning for Nox Private Credit vault operations.
 */
contract ERC7984CreditToken {
    // Token Metadata
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    address public owner;
    address public creditVault;

    // Encrypted balance representations (handle references)
    mapping(address => bytes32) private _encryptedBalances;
    bytes32 private _encryptedTotalSupply;

    // Events
    event TransferEncrypted(address indexed from, address indexed to, bytes32 encryptedHandle);
    event MintEncrypted(address indexed to, bytes32 encryptedHandle);
    event BurnEncrypted(address indexed from, bytes32 encryptedHandle);

    modifier onlyVault() {
        require(msg.sender == creditVault, "ERC7984: caller is not credit vault");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "ERC7984: caller is not owner");
        _;
    }

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        owner = msg.sender;
    }

    function setCreditVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Invalid vault address");
        creditVault = _vault;
    }

    /**
     * @notice Mint encrypted tokens to a recipient (called by ConfidentialCredit vault)
     * @param to Recipient address
     * @param encryptedAmountHandle Encrypted input handle from Nox TEE / FHE engine
     */
    function mintEncrypted(address to, bytes32 encryptedAmountHandle) external onlyVault {
        require(to != address(0), "ERC7984: mint to zero address");
        _encryptedBalances[to] = encryptedAmountHandle;
        emit MintEncrypted(to, encryptedAmountHandle);
    }

    /**
     * @notice Burn encrypted tokens from an account (called by ConfidentialCredit vault)
     * @param from Target account address
     * @param encryptedAmountHandle Encrypted input handle representing burn quantity
     */
    function burnEncrypted(address from, bytes32 encryptedAmountHandle) external onlyVault {
        require(from != address(0), "ERC7984: burn from zero address");
        _encryptedBalances[from] = encryptedAmountHandle;
        emit BurnEncrypted(from, encryptedAmountHandle);
    }

    /**
     * @notice Returns the encrypted balance handle for an account
     */
    function balanceOfEncrypted(address account) external view returns (bytes32) {
        return _encryptedBalances[account];
    }
}
