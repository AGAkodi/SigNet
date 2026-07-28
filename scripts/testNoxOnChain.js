const { ethers } = require("hardhat");
const { NoxClientSDK } = require("./noxClientSdk");

const INCOME_STREAM = "0x94658D76467d322B5D5d77001126bE339DaF1AA9";
const CONFIDENTIAL_CREDIT = "0x15A9cFA9CD1dF724063511171f5bE34C39654928";

async function main() {
  console.log("=== Testing On-Chain Nox & IncomeStream State ===");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const incomeStreamAbi = [
    "function employeeStreamId(address) view returns (bytes32)",
    "function streams(bytes32) view returns (address employer, address employee, bytes32 monthlyRate, uint256 startTime, uint256 lastClaimTime, bool isActive)",
    "function getIncomeRateHandle(address) view returns (bytes32)",
    "function createStream(address employee, bytes32 externalRate, bytes calldata proof) returns (bytes32)",
  ];

  const incomeStream = new ethers.Contract(INCOME_STREAM, incomeStreamAbi, deployer);

  const streamId = await incomeStream.employeeStreamId(deployer.address);
  console.log(`Existing Stream ID for deployer: ${streamId}`);

  if (streamId !== ethers.ZeroHash) {
    const streamInfo = await incomeStream.streams(streamId);
    console.log(`Stream Details:`);
    console.log(`  Employer:      ${streamInfo.employer}`);
    console.log(`  Employee:      ${streamInfo.employee}`);
    console.log(`  Monthly Rate:  ${streamInfo.monthlyRate}`);
    console.log(`  Is Active:     ${streamInfo.isActive}`);
  } else {
    console.log("No active stream found for deployer. Will need to create one.");
  }
}

main().catch((err) => {
  console.error("Test Error:", err);
  process.exitCode = 1;
});
