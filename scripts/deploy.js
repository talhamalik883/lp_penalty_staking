// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat")
const ethers = hre.ethers

const provider = new ethers.getDefaultProvider(process.env.NETWORK)

async function main() {

  // reward per block
  const rewardPerBlock = 2 * Math.pow(10, 18)
  // address where the incurred penalty amount will be sent
  const lockWalletAddress = '0x4281d6888D7a3A6736B0F596823810ffBd7D4808';
  // latest block at the specified chain
  const blockNumber = await provider.getBlockNumber()
  // block number when the staking start
  const startBlock = blockNumber + 2;
  // block number when the staking ends
  const endBlock = startBlock + 100000;
  // Lp address
  const lpAddress = '0xB10cf58E08b94480fCb81d341A63295eBb2062C2'
  // multiplier for boosting reward
  const multiplier = 1

  let token = await hre.ethers.getContractFactory("Token");
  token = await token.deploy();

  await token.deployed();

  console.log("Token deployed at:", token.address);

  const distributor = await hre.ethers.getContractFactory("Distributor")

  const distributor = await distributor.deploy(token.address, true, lockWalletAddress)

  await distributor.deployed()

  // verify token code for transparency
  await hre.run("verify:verify", {
    address: token.address,
    constructorArguments: [],
  });

  // verify token code for transparency
  await hre.run("verify:verify", {
    address: distributor.address,
    constructorArguments: [token.address, true, lockWalletAddress],
  });

  // Note: Below Necessary function calls are added and commented for deployer to utilize whatever is needed

  // await token.mint(distributor.address, '2000000000000000000000')

  // await distributor.addPool(lpAddress, startBlock, endBlock, multiplier, rewardPerBlock.toString(), 600, 5)
  // console.log('pool added');

  // let lpToken = await hre.ethers.getContractFactory("Token");
  // lpToken = await lpToken.attach(lpAddress);

  // await lpToken.approve(distributor.address, '1000000000000000000')
  // console.log('approved');

  // await distributor.deposit(0, '1000000000000000')
  // console.log("distributor Deployed to:", distributor.address)
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
