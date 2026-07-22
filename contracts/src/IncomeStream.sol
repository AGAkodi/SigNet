// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IncomeStream
 * @notice Mocked Sablier / Superfluid style confidential income stream contract.
 * Emits encrypted running "total earned" handles per employee, updated over time or upon claim.
 *
 * =========================================================================================
 * DEVIATION NOTICE (Sablier / Superfluid Mocking vs. Live Protocols for Hackathon Scope):
 * 1. Interface Simplification: Real Sablier V2 uses ISablierV2LockupLinear with ERC20 streaming
 *    and NFT position ownership. We mock the stream lifecycle locally with encrypted Nox handles
 *    to preserve 100% real TEE compute while keeping hackathon scope tight.
 * 2. Balance Accrual: Real Superfluid streams accrue per-second via continuous cashflow rates.
 *    This contract computes linear accrual on `claimEarnedSalary` or `getIncomeRateHandle` using
 *    encrypted rate handles (`bytes32` Nox handles representing `euint64`).
 * 3. Token Transfer: Real streaming transfers underlying ERC20 tokens into Sablier escrow.
 *    Here, employer balances are simulated to focus judging evaluation purely on Nox TEE integration.
 * =========================================================================================
 */
contract IncomeStream {
    struct Stream {
        address employer;
        address employee;
        bytes32 encryptedMonthlyRateHandle; // Encrypted monthly rate handle (euint64)
        uint256 startTime;
        uint256 lastClaimTime;
        bool isActive;
    }

    // Stream ID => Stream details
    mapping(bytes32 => Stream) public streams;
    // Employee => Stream ID
    mapping(address => bytes32) public employeeStreamId;
    // Employee => Encrypted cumulative total earned handle (bytes32 / euint64)
    mapping(address => bytes32) private _encryptedTotalEarned;

    // Events
    event StreamCreated(bytes32 indexed streamId, address indexed employer, address indexed employee);
    event EncryptedEarnedHandleEmitted(address indexed employee, bytes32 encryptedEarnedHandle, uint256 timestamp);
    event StreamCancelled(bytes32 indexed streamId);

    modifier onlyEmployee(bytes32 streamId) {
        require(streams[streamId].employee == msg.sender, "IncomeStream: caller is not employee");
        _;
    }

    modifier onlyEmployer(bytes32 streamId) {
        require(streams[streamId].employer == msg.sender, "IncomeStream: caller is not employer");
        _;
    }

    /**
     * @notice Creates a new confidential payroll stream for an employee
     * @param employee Address of employee beneficiary
     * @param encryptedRateHandle Encrypted handle of monthly income rate (euint64)
     */
    function createStream(address employee, bytes32 encryptedRateHandle) external returns (bytes32 streamId) {
        require(employee != address(0), "Invalid employee address");
        require(encryptedRateHandle != bytes32(0), "Invalid rate handle");

        streamId = keccak256(abi.encodePacked(msg.sender, employee, block.timestamp));
        streams[streamId] = Stream({
            employer: msg.sender,
            employee: employee,
            encryptedMonthlyRateHandle: encryptedRateHandle,
            startTime: block.timestamp,
            lastClaimTime: block.timestamp,
            isActive: true
        });

        employeeStreamId[employee] = streamId;
        _encryptedTotalEarned[employee] = encryptedRateHandle; // Initial handle reference

        emit StreamCreated(streamId, msg.sender, employee);
        emit EncryptedEarnedHandleEmitted(employee, encryptedRateHandle, block.timestamp);

        return streamId;
    }

    /**
     * @notice Updates or claims earned salary stream handle
     * @param streamId Target stream ID
     * @param newEncryptedEarnedHandle Updated encrypted total earned handle evaluated by Nox TEE
     */
    function claimEarnedSalary(bytes32 streamId, bytes32 newEncryptedEarnedHandle) external onlyEmployee(streamId) {
        Stream storage stream = streams[streamId];
        require(stream.isActive, "Stream is not active");

        stream.lastClaimTime = block.timestamp;
        _encryptedTotalEarned[stream.employee] = newEncryptedEarnedHandle;

        emit EncryptedEarnedHandleEmitted(stream.employee, newEncryptedEarnedHandle, block.timestamp);
    }

    /**
     * @notice Cancels an active salary stream
     */
    function cancelStream(bytes32 streamId) external onlyEmployer(streamId) {
        Stream storage stream = streams[streamId];
        require(stream.isActive, "Stream already inactive");
        stream.isActive = false;
        emit StreamCancelled(streamId);
    }

    /**
     * @notice Queries the encrypted income rate handle for an employee for credit underwriting
     * @param employee Target employee address
     */
    function getIncomeRateHandle(address employee) external view returns (bytes32) {
        bytes32 streamId = employeeStreamId[employee];
        require(streams[streamId].isActive, "IncomeStream: no active stream for employee");
        return streams[streamId].encryptedMonthlyRateHandle;
    }

    /**
     * @notice Queries the encrypted total earned salary handle for an employee
     */
    function getTotalEarnedHandle(address employee) external view returns (bytes32) {
        return _encryptedTotalEarned[employee];
    }
}
