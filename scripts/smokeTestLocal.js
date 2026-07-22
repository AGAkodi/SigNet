const hre = require("hardhat");

async function main() {
  console.log("=== Nox Private Credit Local Smoke Test ===");

  const [owner, employer, borrower, liquidator] = await hre.ethers.getSigners();

  // 1. Deploy ERC7984 Credit Token
  const ERC7984Token = await hre.ethers.getContractFactory("ERC7984CreditToken");
  const creditToken = await ERC7984Token.deploy("Nox Credit Token", "NOXCRED", 18);
  await creditToken.waitForDeployment();
  console.log("ERC7984 Credit Token deployed to:", await creditToken.getAddress());

  // 2. Deploy IncomeStream
  const IncomeStream = await hre.ethers.getContractFactory("IncomeStream");
  const incomeStream = await IncomeStream.deploy();
  await incomeStream.waitForDeployment();
  console.log("Income Stream contract deployed to:", await incomeStream.getAddress());

  // 3. Deploy ConfidentialCredit Vault
  const ConfidentialCredit = await hre.ethers.getContractFactory("ConfidentialCredit");
  const creditVault = await ConfidentialCredit.deploy(
    await incomeStream.getAddress(),
    await creditToken.getAddress()
  );
  await creditVault.waitForDeployment();
  console.log("Confidential Credit Vault deployed to:", await creditVault.getAddress());

  // Grant vault permission on token
  await creditToken.setCreditVault(await creditVault.getAddress());
  console.log("Granted vault permissions to ConfidentialCredit contract.");

  console.log("=== Smoke Test Local Deployment Successful! ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
