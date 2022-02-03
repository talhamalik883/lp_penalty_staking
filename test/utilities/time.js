const hre = require("hardhat")
const ethers = hre.ethers
const { BigNumber } = ethers

module.exports.advanceBlock = function () {
  console.log("received")
  return ethers.provider.send("evm_mine", [])
}

module.exports.advanceBlockTo = async function (blockNumber) {
  let updatedNo = 0
  let iterator = 0
  const currentNo = await ethers.provider.getBlockNumber()
  // blockNumber = currentNo + Number(blockNumber)
  // console.log(`from ${currentNo} upto ${currentNo + Number(blockNumber)}`);

  // for (let i = currentNo; i < blockNumber; i++) {
  //   // await this.advanceBlock()
  //   updatedNo = await ethers.provider.send("evm_mine", [])
  // }
  while (iterator < Number(blockNumber)) {
    updatedNo = await ethers.provider.send("evm_mine", [])
    iterator++
  }
  return updatedNo
}

module.exports.increase = async function (value) {
  await ethers.provider.send("evm_increaseTime", [value])
  await ethers.provider.send("evm_mine", [])
}

module.exports.latest = async function () {
  const block = await ethers.provider.getBlock("latest")
  console.log("block.timestamp ", block.timestamp)
  return BigNumber.from(block.timestamp)
}

module.exports.currentBlock = async function () {
  const block = await ethers.provider.getBlock("latest")
  return block.number
}

module.exports.advanceTimeAndBlock = async function (time) {
  await advanceTime(time)
  await advanceBlock()
}

module.exports.advanceTime = async function (time) {
  await ethers.provider.send("evm_increaseTime", [time])
}
module.exports.days = function (val) {
  return BigNumber.from(val).mul(this.hours("24"))
}
