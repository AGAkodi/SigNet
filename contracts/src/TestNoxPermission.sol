// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {ERC7984CreditToken} from "./ERC7984CreditToken.sol";

contract TestNoxPermission {
    ERC7984CreditToken public creditToken;

    constructor() {
        creditToken = new ERC7984CreditToken("Nox Credit Token", "NOXCRED", "https://signet.finance");
        creditToken.setCreditVault(address(this));
    }

    function testPermission(externalEuint256 extAmount, bytes calldata proof, address target) external {
        euint256 handle = Nox.fromExternal(extAmount, proof);
        Nox.allow(handle, address(creditToken));
        Nox.allow(handle, target);
        Nox.allowThis(handle);

        creditToken.mintEncrypted(target, handle);
    }
}
