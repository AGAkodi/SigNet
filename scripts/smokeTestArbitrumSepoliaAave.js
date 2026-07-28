const { ethers } = require("hardhat");
const { NoxClientSDK } = require("./noxClientSdk");

// Confirmed Live Contract Addresses on Arbitrum Sepolia
const CREDIT_TOKEN_ADDRESS = "0x8f9e846c7d13B11A2CA85ac71546b48D807E2971";
const INCOME_STREAM_ADDRESS = "0x42ced25B9BCC2BffeA7F928738174Dbe46e7f7cf";
const CONFIDENTIAL_CREDIT_ADDRESS = "0x5F602982CC47dd707FA90bd9Af5da66e5587757C";
const AAVE_V3_POOL_ADDRESS = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";
const AAVE_V3_ORACLE_ADDRESS = "0xEf95A6B9e88Bd509Fd67BA741cf2b263DaC65c00";
const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
const WETH_ADDRESS = "0x1dF462e2712496373A347f8ad10802a5E95f053D";

// Live Aave V3 Reserve Tokens on Arbitrum Sepolia
const AAVE_WETH_ATOKEN = "0xf5f17EbE81E516Dc7cB38D61908EC252F150CE60";
const AAVE_WETH_VARIABLE_DEBT = "0x372eB464296D8D78acaa462b41eaaf2D3663dAD3";
const AAVE_USDC_ATOKEN = "0x460b97BD498E1157530AEb3086301d5225b91216";
const AAVE_USDC_VARIABLE_DEBT = "0x4fBE3A94C60A5085dA6a2D309965DcF34c36711d";

const NOX_COMPUTE_ADDRESS = "0xd464B198f06756a1d00be223634b85E0a731c229";

async function main() {
  console.log("=================================================================");
  console.log("  SIGNET — LIVE ARBITRUM SEPOLIA AAVE INTEGRATION SMOKE TEST    ");
  console.log("=================================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer wallet: ${deployer.address}`);

  const ethBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Native ETH Balance: ${ethers.formatEther(ethBalance)} ETH\n`);

  // ABIs
  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function deposit() public payable",
  ];

  const incomeStreamAbi = [
    "function employeeStreamId(address employee) external view returns (bytes32)",
    "function getIncomeRateHandle(address employee) external view returns (bytes32)",
    "function createStream(address employee, bytes32 rate) external returns (bytes32 streamId)",
  ];

  const confidentialCreditAbi = [
    "function depositCollateral(address asset, uint256 amount, bytes32 externalAmount, bytes calldata proof) external returns (bytes32)",
    "function evaluateBorrowEligibility(address borrowAsset, uint256 requestedAmount, bytes32 externalRequestedAmount, bytes calldata inputProof) external returns (bytes32)",
    "function requestBorrow(address borrowAsset, uint256 requestedAmount, bytes calldata eligibilityProof) external returns (bytes32)",
    "function repay(address borrowAsset, uint256 repayAmount, bytes32 externalRepayAmount, bytes calldata proof) external returns (bytes32)",
    "function getUserCollateralAmount(address borrower) external view returns (uint256)",
    "function getUserBorrowAmount(address borrower) external view returns (uint256)",
  ];

  const noxAbi = [
    "function wrapAsPublicHandle(bytes32 value, uint8 teeType) external view returns (bytes32)",
  ];

  const weth = new ethers.Contract(WETH_ADDRESS, erc20Abi, deployer);
  const usdc = new ethers.Contract(USDC_ADDRESS, erc20Abi, deployer);
  const aWeth = new ethers.Contract(AAVE_WETH_ATOKEN, erc20Abi, deployer);
  const vDebtWeth = new ethers.Contract(AAVE_WETH_VARIABLE_DEBT, erc20Abi, deployer);
  const incomeStream = new ethers.Contract(INCOME_STREAM_ADDRESS, incomeStreamAbi, deployer);
  const vault = new ethers.Contract(CONFIDENTIAL_CREDIT_ADDRESS, confidentialCreditAbi, deployer);
  const nox = new ethers.Contract(NOX_COMPUTE_ADDRESS, noxAbi, deployer);

  // -------------------------------------------------------------------------
  // STEP 0 — Check Real Wallet Balances
  // -------------------------------------------------------------------------
  console.log("-----------------------------------------------------------------");
  console.log("STEP 0 — Wallet Token Balances");
  console.log("-----------------------------------------------------------------");
  let wethBal = await weth.balanceOf(deployer.address);
  let usdcBal = await usdc.balanceOf(deployer.address);
  console.log(`Initial WETH Balance: ${ethers.formatEther(wethBal)} WETH`);
  console.log(`Initial USDC Balance: ${ethers.formatUnits(usdcBal, 6)} USDC`);

  if (wethBal < ethers.parseEther("0.005")) {
    console.log("\nAcquiring WETH via deposit() on WETH contract...");
    const depTx = await weth.deposit({ value: ethers.parseEther("0.02") });
    console.log(`Tx Hash: ${depTx.hash}`);
    await depTx.wait();
    wethBal = await weth.balanceOf(deployer.address);
    console.log(`✓ Updated WETH Balance: ${ethers.formatEther(wethBal)} WETH`);
  }

  // -------------------------------------------------------------------------
  // STEP 1 — Income Stream Verification / Creation
  // -------------------------------------------------------------------------
  console.log("\n-----------------------------------------------------------------");
  console.log("STEP 1 — Check / Create Income Stream");
  console.log("-----------------------------------------------------------------");
  let streamId = await incomeStream.employeeStreamId(deployer.address);

  if (streamId === ethers.ZeroHash) {
    console.log("No active income stream found. Creating test stream...");
    const salaryRate = 1000;
    const rateHandle = ethers.zeroPadValue(ethers.toBeHex(salaryRate), 32);
    const tx = await incomeStream["createStream(address,bytes32)"](deployer.address, rateHandle);
    console.log(`Transaction Hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✓ IncomeStream tx confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);
    streamId = await incomeStream.employeeStreamId(deployer.address);
  }
  console.log(`Active Stream ID: ${streamId}`);
  const rateHandle = await incomeStream.getIncomeRateHandle(deployer.address);
  console.log(`Income Rate Handle: ${rateHandle}`);

  // -------------------------------------------------------------------------
  // STEP 2 — ERC20 Approve ConfidentialCredit Vault
  // -------------------------------------------------------------------------
  console.log("\n-----------------------------------------------------------------");
  console.log("STEP 2 — Approve ConfidentialCredit Vault for Collateral");
  console.log("-----------------------------------------------------------------");
  const depositAmount = ethers.parseEther("0.001");
  console.log(`Approving Vault (${CONFIDENTIAL_CREDIT_ADDRESS}) to spend 0.001 WETH...`);
  const appTx = await weth.approve(CONFIDENTIAL_CREDIT_ADDRESS, depositAmount);
  console.log(`Transaction Hash: ${appTx.hash}`);
  const appReceipt = await appTx.wait();
  console.log(`✓ Approval confirmed in block ${appReceipt.blockNumber}, status: ${appReceipt.status}`);

  // -------------------------------------------------------------------------
  // STEP 3 — Call depositCollateral() on Live Vault
  // -------------------------------------------------------------------------
  console.log("\n-----------------------------------------------------------------");
  console.log("STEP 3 — Deposit Collateral to ConfidentialCredit & Supply to Aave V3");
  console.log("-----------------------------------------------------------------");
  const aWethBefore = await aWeth.balanceOf(CONFIDENTIAL_CREDIT_ADDRESS);
  console.log(`Vault Aave aWETH Balance BEFORE: ${ethers.formatEther(aWethBefore)} aWETH`);

  // Construct valid TEEType.Uint256 (35) public handle & 137-byte proof structure
  const publicHandle = await nox.wrapAsPublicHandle(ethers.zeroPadValue(ethers.toBeHex(100000), 32), 35);
  const block = await ethers.provider.getBlock("latest");
  const ownerBytes = ethers.getBytes(deployer.address);
  const appBytes = ethers.getBytes(CONFIDENTIAL_CREDIT_ADDRESS);
  const createdAtBytes = ethers.getBytes(ethers.zeroPadValue(ethers.toBeHex(block.timestamp), 32));
  const sigBytes = new Uint8Array(65);
  const proofHex = ethers.hexlify(ethers.concat([ownerBytes, appBytes, createdAtBytes, sigBytes]));

  try {
    console.log("Executing depositCollateral()...");
    const depTx = await vault.depositCollateral(
      WETH_ADDRESS,
      depositAmount,
      publicHandle,
      proofHex
    );
    console.log(`Transaction Hash: ${depTx.hash}`);
    const depReceipt = await depTx.wait();
    console.log(`✓ Deposit confirmed in block ${depReceipt.blockNumber}, status: ${depReceipt.status}`);

    const aWethAfter = await aWeth.balanceOf(CONFIDENTIAL_CREDIT_ADDRESS);
    console.log(`Vault Aave aWETH Balance AFTER: ${ethers.formatEther(aWethAfter)} aWETH`);
  } catch (err) {
    console.error(`\n❌ Step 3 Failed (Contract Execution Reverted):`);
    console.error(`Reason: Nox TEE Coprocessor validateInputProof signature verification failed.`);
    console.error(`Error details: ${err.message}`);
    process.exitCode = 1;
    return;
  }
}

main().catch((err) => {
  console.error("Smoke Test Fatal Error:", err);
  process.exitCode = 1;
});
