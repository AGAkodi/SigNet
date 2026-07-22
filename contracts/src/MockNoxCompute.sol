// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {INoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/interfaces/INoxCompute.sol";
import {TEEType} from "@iexec-nox/nox-protocol-contracts/contracts/shared/TypeUtils.sol";

/**
 * @title MockNoxCompute
 * @notice Mock NoxCompute contract deployed to 0x39847AeBa923Cc7367d4684194091D022B3F8548 on local chain (31337)
 * to handle INoxCompute calls during local testing and simulation.
 */
contract MockNoxCompute is INoxCompute {
    mapping(bytes32 => mapping(address => bool)) private _allowed;
    mapping(bytes32 => mapping(address => bool)) private _viewers;
    mapping(bytes32 => bool) private _publiclyDecryptable;

    function wrapAsPublicHandle(bytes32 value, TEEType) external pure override returns (bytes32) {
        return value;
    }

    function validateInputProof(
        bytes32,
        address,
        bytes calldata,
        TEEType
    ) external pure override {}

    function validateDecryptionProof(
        bytes32 handle,
        bytes calldata proof
    ) external pure override returns (bytes memory) {
        if (proof.length > 0) {
            return proof;
        }
        bytes memory res = new bytes(32);
        bytes32 val = handle;
        assembly {
            mstore(add(res, 32), val)
        }
        return res;
    }

    function add(bytes32 left, bytes32 right) external pure override returns (bytes32) {
        return bytes32(uint256(left) + uint256(right));
    }

    function sub(bytes32 left, bytes32 right) external pure override returns (bytes32) {
        return bytes32(uint256(left) > uint256(right) ? uint256(left) - uint256(right) : 0);
    }

    function mul(bytes32 left, bytes32 right) external pure override returns (bytes32) {
        return bytes32(uint256(left) * uint256(right));
    }

    function div(bytes32 left, bytes32 right) external pure override returns (bytes32) {
        if (uint256(right) == 0) return bytes32(type(uint256).max);
        return bytes32(uint256(left) / uint256(right));
    }

    function safeAdd(bytes32 left, bytes32 right) external pure override returns (bytes32 success, bytes32 result) {
        uint256 res = uint256(left) + uint256(right);
        return (bytes32(uint256(1)), bytes32(res));
    }

    function safeSub(bytes32 left, bytes32 right) external pure override returns (bytes32 success, bytes32 result) {
        if (uint256(left) >= uint256(right)) {
            return (bytes32(uint256(1)), bytes32(uint256(left) - uint256(right)));
        } else {
            return (bytes32(uint256(0)), bytes32(0));
        }
    }

    function safeMul(bytes32 left, bytes32 right) external pure override returns (bytes32 success, bytes32 result) {
        return (bytes32(uint256(1)), bytes32(uint256(left) * uint256(right)));
    }

    function safeDiv(bytes32 left, bytes32 right) external pure override returns (bytes32 success, bytes32 result) {
        if (uint256(right) == 0) return (bytes32(0), bytes32(0));
        return (bytes32(uint256(1)), bytes32(uint256(left) / uint256(right)));
    }

    function select(bytes32 condition, bytes32 ifTrue, bytes32 ifFalse) external pure override returns (bytes32) {
        return uint256(condition) != 0 ? ifTrue : ifFalse;
    }

    function eq(bytes32 left, bytes32 right) external pure override returns (bytes32) {
        return bytes32(uint256(left == right ? 1 : 0));
    }

    function ne(bytes32 left, bytes32 right) external pure override returns (bytes32) {
        return bytes32(uint256(left != right ? 1 : 0));
    }

    function lt(bytes32 left, bytes32 right) external pure override returns (bytes32) {
        return bytes32(uint256(uint256(left) < uint256(right) ? 1 : 0));
    }

    function le(bytes32 left, bytes32 right) external pure override returns (bytes32) {
        return bytes32(uint256(uint256(left) <= uint256(right) ? 1 : 0));
    }

    function gt(bytes32 left, bytes32 right) external pure override returns (bytes32) {
        return bytes32(uint256(uint256(left) > uint256(right) ? 1 : 0));
    }

    function ge(bytes32 left, bytes32 right) external pure override returns (bytes32) {
        return bytes32(uint256(uint256(left) >= uint256(right) ? 1 : 0));
    }

    function transfer(bytes32 balanceFrom, bytes32 balanceTo, bytes32 amount) external pure override returns (bytes32 success, bytes32 newFrom, bytes32 newTo) {
        if (uint256(balanceFrom) >= uint256(amount)) {
            return (bytes32(uint256(1)), bytes32(uint256(balanceFrom) - uint256(amount)), bytes32(uint256(balanceTo) + uint256(amount)));
        }
        return (bytes32(0), balanceFrom, balanceTo);
    }

    function mint(bytes32 balanceTo, bytes32 amount, bytes32 totalSupply) external pure override returns (bytes32 success, bytes32 newTo, bytes32 newSupply) {
        return (bytes32(uint256(1)), bytes32(uint256(balanceTo) + uint256(amount)), bytes32(uint256(totalSupply) + uint256(amount)));
    }

    function burn(bytes32 balanceFrom, bytes32 amount, bytes32 totalSupply) external pure override returns (bytes32 success, bytes32 newFrom, bytes32 newSupply) {
        if (uint256(balanceFrom) >= uint256(amount)) {
            return (bytes32(uint256(1)), bytes32(uint256(balanceFrom) - uint256(amount)), bytes32(uint256(totalSupply) - uint256(amount)));
        }
        return (bytes32(0), balanceFrom, totalSupply);
    }

    function allow(bytes32 handle, address account) external override {
        _allowed[handle][account] = true;
    }

    function allowTransient(bytes32 handle, address account) external override {
        _allowed[handle][account] = true;
    }

    function disallowTransient(bytes32 handle, address account) external override {
        _allowed[handle][account] = false;
    }

    function isAllowed(bytes32 handle, address account) external view override returns (bool) {
        return _allowed[handle][account];
    }

    function validateAllowedForAll(address account, bytes32[] calldata handles) external view override {
        for (uint256 i = 0; i < handles.length; i++) {
            require(_allowed[handles[i]][account], "MockNox: handle not allowed");
        }
    }

    function addViewer(bytes32 handle, address viewer) external override {
        _viewers[handle][viewer] = true;
    }

    function isViewer(bytes32 handle, address viewer) external view override returns (bool) {
        return _viewers[handle][viewer] || _publiclyDecryptable[handle];
    }

    function allowPublicDecryption(bytes32 handle) external override {
        _publiclyDecryptable[handle] = true;
    }

    function isPubliclyDecryptable(bytes32 handle) external view override returns (bool) {
        return _publiclyDecryptable[handle];
    }

    function setKmsPublicKey(bytes calldata) external override {}
    function setGateway(address) external override {}
    function setProofExpirationDuration(uint256) external override {}

    function kmsPublicKey() external pure override returns (bytes memory) { return new bytes(33); }
    function gateway() external pure override returns (address) { return address(0); }
    function proofExpirationDuration() external pure override returns (uint256) { return 3600; }
}
