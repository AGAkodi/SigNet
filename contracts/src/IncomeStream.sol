// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nox, euint256, externalEuint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/**
 * @title IncomeStream
 * @notice Sablier / Superfluid style confidential income stream contract.
 * Emits real encrypted euint256 total earned handles per employee, updated over time via Nox TEE operations.
 *
 * =========================================================================================
 * IMPLEMENTATION & DEVIATION NOTICE:
 * 1. Real Nox TEE Integration: All salary rates and cumulative total earned balances are stored
 *    as real encrypted `euint256` TEE handles.
 * 2. On-Chain Accrual Computation: `claimEarnedSalary()` computes linear accrual on-chain using
 *    `Nox.mul` (encrypted monthly rate × elapsed time) and `Nox.add` to update total earned.
 *    It does NOT trust unverified caller-supplied input handles.
 * 3. Stream Interface: Simulates continuous cashflow stream lifecycle (employer, employee,
 *    startTime, lastClaimTime) for salary-backed confidential lending.
 * =========================================================================================
 */
contract IncomeStream {
    struct Stream {
        address employer;
        address employee;
        euint256 monthlyRate; // Encrypted monthly rate handle (euint256)
        uint256 startTime;
        uint256 lastClaimTime;
        bool isActive;
    }

    // Stream ID => Stream details
    mapping(bytes32 => Stream) public streams;
    // Employee => Stream ID
    mapping(address => bytes32) public employeeStreamId;
    // Employee => Encrypted monthly rate (euint256)
    mapping(address => euint256) private _encryptedMonthlyRate;
    // Employee => Encrypted cumulative total earned handle (euint256)
    mapping(address => euint256) private _encryptedTotalEarned;

    // Events
    event StreamCreated(bytes32 indexed streamId, address indexed employer, address indexed employee);
    event EncryptedEarnedHandleEmitted(address indexed employee, euint256 encryptedEarnedHandle, uint256 timestamp);
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
     * @notice Creates a new confidential payroll stream for an employee using input proof validation
     * @param employee Address of employee beneficiary
     * @param externalRate External encrypted handle input
     * @param proof Cryptographic TEE input proof
     */
    function createStream(
        address employee,
        externalEuint256 externalRate,
        bytes calldata proof
    ) external returns (bytes32 streamId) {
        euint256 rate = Nox.fromExternal(externalRate, proof);
        return _createStreamInternal(employee, rate);
    }

    /**
     * @notice Creates a new confidential payroll stream for an employee using an existing euint256 handle
     * @param employee Address of employee beneficiary
     * @param rate Encrypted monthly rate handle (euint256)
     */
    function createStream(address employee, euint256 rate) external returns (bytes32 streamId) {
        require(Nox.isInitialized(rate), "IncomeStream: uninitialized rate handle");
        return _createStreamInternal(employee, rate);
    }

    function _createStreamInternal(address employee, euint256 rate) internal returns (bytes32 streamId) {
        require(employee != address(0), "IncomeStream: invalid employee address");

        streamId = keccak256(abi.encodePacked(msg.sender, employee, block.timestamp));
        streams[streamId] = Stream({
            employer: msg.sender,
            employee: employee,
            monthlyRate: rate,
            startTime: block.timestamp,
            lastClaimTime: block.timestamp,
            isActive: true
        });

        employeeStreamId[employee] = streamId;
        _encryptedMonthlyRate[employee] = rate;
        euint256 initialEarned = Nox.toEuint256(0);
        _encryptedTotalEarned[employee] = initialEarned;

        // Grant access permissions for employee and this contract
        Nox.allow(rate, employee);
        Nox.allowThis(rate);
        Nox.allow(initialEarned, employee);
        Nox.allowThis(initialEarned);

        emit StreamCreated(streamId, msg.sender, employee);
        emit EncryptedEarnedHandleEmitted(employee, initialEarned, block.timestamp);

        return streamId;
    }

    /**
     * @notice Claims accrued salary and updates encrypted total earned handle on-chain using Nox primitives
     * @param streamId Target stream ID
     */
    function claimEarnedSalary(bytes32 streamId) external onlyEmployee(streamId) returns (euint256) {
        Stream storage stream = streams[streamId];
        require(stream.isActive, "IncomeStream: stream is not active");

        uint256 elapsedSeconds = block.timestamp - stream.lastClaimTime;
        euint256 elapsedEuint = Nox.toEuint256(elapsedSeconds);

        // Compute accrued salary: monthlyRate * elapsedSeconds
        euint256 accrued = Nox.mul(stream.monthlyRate, elapsedEuint);
        euint256 updatedTotalEarned = Nox.add(_encryptedTotalEarned[stream.employee], accrued);

        _encryptedTotalEarned[stream.employee] = updatedTotalEarned;
        stream.lastClaimTime = block.timestamp;

        // Grant access permissions
        Nox.allow(updatedTotalEarned, stream.employee);
        Nox.allowThis(updatedTotalEarned);

        emit EncryptedEarnedHandleEmitted(stream.employee, updatedTotalEarned, block.timestamp);
        return updatedTotalEarned;
    }

    /**
     * @notice Cancels an active salary stream
     */
    function cancelStream(bytes32 streamId) external onlyEmployer(streamId) {
        Stream storage stream = streams[streamId];
        require(stream.isActive, "IncomeStream: stream already inactive");
        stream.isActive = false;
        emit StreamCancelled(streamId);
    }

    /**
     * @notice Queries the encrypted income rate handle for an employee
     */
    function getIncomeRateHandle(address employee) external returns (euint256) {
        bytes32 streamId = employeeStreamId[employee];
        require(streams[streamId].isActive, "IncomeStream: no active stream for employee");
        euint256 rate = _encryptedMonthlyRate[employee];
        Nox.allowTransient(rate, msg.sender);
        return rate;
    }

    /**
     * @notice Queries the encrypted total earned salary handle for an employee
     */
    function getTotalEarnedHandle(address employee) external view returns (euint256) {
        return _encryptedTotalEarned[employee];
    }
}
