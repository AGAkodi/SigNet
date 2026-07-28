const { ethers } = require("hardhat");

const NOX_COMPUTE = "0xd464B198f06756a1d00be223634b85E0a731c229";
const CONFIDENTIAL_CREDIT = "0x15A9cFA9CD1dF724063511171f5bE34C39654928";
const CREDIT_TOKEN = "0x7B8902Ab7B59214b66876124710c39d0119a1bB6";
const WETH_ARBITRUM_SEPOLIA = "0x1dF462e2712496373A347f8ad10802a5E95f053D";

async function encryptInputViaGateway(value, solidityType, applicationContract, ownerSigner) {
  const ownerAddress = await ownerSigner.getAddress();
  const hexValue = ethers.zeroPadValue(ethers.toBeHex(BigInt(value)), 32);
  const url = "https://gateway-testnets.noxprotocol.dev/v0/secrets?chain_id=421614";
  const body = {
    value: hexValue,
    solidityType,
    applicationContract,
    owner: ownerAddress,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const handle = json.payload?.handle || json.handle;
  const handleProof = json.payload?.proof || json.proof;
  return { handle, handleProof };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const vaultAbi = [
    "function depositCollateral(address asset, uint256 amount, bytes32 externalAmount, bytes calldata proof) external returns (bytes32)",
  ];
  const noxAbi = [
    "function validateInputProof(bytes32 handle, address owner, bytes calldata proof, uint8 teeType) external",
    "function allow(bytes32 handle, address account) external",
  ];
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT, vaultAbi, deployer);
  const nox = new ethers.Contract(NOX_COMPUTE, noxAbi, deployer);

  const depositAmount = ethers.parseEther("0.001");

  console.log("1. Requesting REAL signed input proof from Nox Gateway (app = deployer)...");
  const { handle, handleProof } = await encryptInputViaGateway(
    depositAmount,
    "uint256",
    deployer.address,
    deployer
  );
  console.log(`   Real Handle: ${handle}`);
  console.log(`   Proof Length: ${(handleProof.length - 2) / 2} bytes`);

  console.log("2. Registering handle owner via nox.validateInputProof...");
  const valTx = await nox.validateInputProof(handle, deployer.address, handleProof, 35); // 35 = Uint256
  await valTx.wait();
  console.log(`   ✓ validateInputProof confirmed: ${valTx.hash}`);

  console.log("3. Granting Nox.allow permissions to Vault and CreditToken...");
  const allowVaultTx = await nox.allow(handle, CONFIDENTIAL_CREDIT);
  await allowVaultTx.wait();
  console.log(`   ✓ Nox.allow(Vault) confirmed: ${allowVaultTx.hash}`);

  const allowTokenTx = await nox.allow(handle, CREDIT_TOKEN);
  await allowTokenTx.wait();
  console.log(`   ✓ Nox.allow(CreditToken) confirmed: ${allowTokenTx.hash}`);

  console.log("4. Executing real depositCollateral transaction...");
  const depTx = await vault.depositCollateral(
    WETH_ARBITRUM_SEPOLIA,
    depositAmount,
    handle,
    handleProof
  );
  console.log(`   Deposit Tx Hash: ${depTx.hash}`);
  const receipt = await depTx.wait();
  console.log(`★ DEPOSIT SUCCESSFUL in block ${receipt.blockNumber}, status: ${receipt.status}`);
}

main().catch((err) => {
  console.error("Deposit Error:", err);
  process.exitCode = 1;
});
