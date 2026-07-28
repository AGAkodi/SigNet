const { ethers } = require("hardhat");
const { NoxClientSDK } = require("./noxClientSdk");

const INCOME_STREAM = "0x94658D76467d322B5D5d77001126bE339DaF1AA9";

async function main() {
  console.log("=== Testing Stream Creation on Arbitrum Sepolia ===");
  const [deployer] = await ethers.getSigners();
  const sdk = new NoxClientSDK(deployer);

  const salaryRate = 10000; // $10,000 / month test rate
  const rateInput = await sdk.encryptInput(salaryRate, INCOME_STREAM, deployer.address);

  const incomeStreamAbi = [
    "function createStream(address employee, bytes32 externalRate, bytes calldata proof) external returns (bytes32 streamId)",
    "function employeeStreamId(address employee) external view returns (bytes32)",
    "function getIncomeRateHandle(address employee) external view returns (bytes32)",
  ];

  const incomeStream = new ethers.Contract(INCOME_STREAM, incomeStreamAbi, deployer);

  console.log("Sending createStream transaction...");
  const tx = await incomeStream.createStream(deployer.address, rateInput.encryptedHandle, rateInput.proof);
  console.log(`Transaction hash: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`✓ Stream created in block ${receipt.blockNumber}, status: ${receipt.status}`);

  const streamId = await incomeStream.employeeStreamId(deployer.address);
  console.log(`Employee Stream ID: ${streamId}`);
  const rateHandle = await incomeStream.getIncomeRateHandle(deployer.address);
  console.log(`Income Rate Handle: ${rateHandle}`);
}

main().catch((err) => {
  console.error("Create Stream Error:", err);
  process.exitCode = 1;
});
