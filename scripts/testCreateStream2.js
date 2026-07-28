const { ethers } = require("hardhat");

const INCOME_STREAM = "0x94658D76467d322B5D5d77001126bE339DaF1AA9";

async function main() {
  console.log("=== Testing Direct Stream Creation on Arbitrum Sepolia ===");
  const [deployer] = await ethers.getSigners();

  const incomeStreamAbi = [
    "function createStream(address employee, bytes32 rate) external returns (bytes32 streamId)",
    "function employeeStreamId(address employee) external view returns (bytes32)",
    "function getIncomeRateHandle(address employee) external view returns (bytes32)",
  ];

  const incomeStream = new ethers.Contract(INCOME_STREAM, incomeStreamAbi, deployer);

  // Generate a valid 32-byte rate handle (e.g. rate = 1000 units)
  const salaryRate = 1000;
  const rateHandle = ethers.zeroPadValue(ethers.toBeHex(salaryRate), 32);

  console.log(`Sending createStream(address, bytes32) with handle: ${rateHandle}`);
  const tx = await incomeStream["createStream(address,bytes32)"](deployer.address, rateHandle);
  console.log(`Transaction hash: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`✓ Stream created in block ${receipt.blockNumber}, status: ${receipt.status}`);

  const streamId = await incomeStream.employeeStreamId(deployer.address);
  console.log(`Employee Stream ID: ${streamId}`);
  const fetchedRate = await incomeStream.getIncomeRateHandle(deployer.address);
  console.log(`Fetched Rate Handle: ${fetchedRate}`);
}

main().catch((err) => {
  console.error("Create Stream 2 Error:", err);
  process.exitCode = 1;
});
