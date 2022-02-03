const hre = require("hardhat")
const ethers = hre.ethers
const { expect, done, assert } = require("chai")
const { advanceBlockTo, currentBlock, increase } = require("./utilities/time")

describe("Distributor", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.minter = this.signers[4]
    this.lockwallet = this.signers[5]
    this.rewardPerBlock = 2
    this.startBlock = 100
    this.endBlock = 10000
    this.poolEndTime = Date.now() + 8600 // read only attribute added in each pool for frontend
    this.currentBlock = 0
    this.distributor = await ethers.getContractFactory("Distributor")
    this.token = await ethers.getContractFactory("Token")
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
  })

  beforeEach(async function () {
    this.currentBlock = await currentBlock()
    this.testToken = await this.token.deploy()
    await this.testToken.deployed()
  })

  it("should set correct state variables", async function () {
    this.chef = await this.distributor.deploy(this.testToken.address, true, this.lockwallet.address)
    await this.chef.deployed()
    const testToken = await this.chef.stakingToken()
    expect(testToken).to.equal(this.testToken.address)
  })

  context("With ERC/LP token added to the field", function () {
    beforeEach(async function () {
      this.lp = await this.ERC20Mock.deploy("LPToken", "LP", "10000000000")

      await this.lp.transfer(this.alice.address, "1000")

      await this.lp.transfer(this.bob.address, "1000")

      await this.lp.transfer(this.carol.address, "1000")

      this.lp2 = await this.ERC20Mock.deploy("LPToken2", "LP2", "10000000000")

      await this.lp2.transfer(this.alice.address, "1000")

      await this.lp2.transfer(this.bob.address, "1000")

      await this.lp2.transfer(this.carol.address, "1000")
    })

   
    it("should allow emergency withdraw", async function () {
      // 2 per block farming rate starting at block 100 with bonus of 10 until block farming ends

      this.chef = await this.distributor.deploy(this.testToken.address, false, this.lockwallet.address)
      await this.chef.deployed()

      await this.testToken.mint(this.chef.address, "20000") // block 11

      await this.chef.addPool(this.lp.address,  this.currentBlock + this.startBlock,this.currentBlock + this.endBlock, 20, this.rewardPerBlock.toString(), 0, 0, this.poolEndTime )

      await this.lp.connect(this.bob).approve(this.chef.address, "1000")

      await this.chef.connect(this.bob).deposit(0, "100") // block 15

      await this.chef.connect(this.bob).deposit(0, "100") // block 15

      await this.chef.connect(this.bob).deposit(0, "100") // block 15

      expect((await this.lp.balanceOf(this.bob.address)).toString()).to.equal("700")

      await this.chef.connect(this.bob).emergencyWithdraw(0)

      expect((await this.lp.balanceOf(this.bob.address)).toString()).to.equal("1000")
    })

    it("should not distribute reward tokens if no one deposit", async function () {
      // 2 per block farming rate starting at block 100 with bonus of 10 until block farming ends
      this.chef = await this.distributor.deploy(this.testToken.address, true, this.lockwallet.address)
      await this.chef.deployed()
      await this.testToken.addMiner(this.chef.address)
      await advanceBlockTo("1") // block 13
      await this.chef.addPool(this.lp.address, this.currentBlock + 100, this.currentBlock + this.endBlock, 10, this.rewardPerBlock.toString(), 0, 0, this.poolEndTime )

      await this.lp.connect(this.bob).approve(this.chef.address, "1000") // block 14
      await advanceBlockTo("49") // block 64
      expect((await this.testToken.balanceOf(this.chef.address)).toString()).to.equal("0")
      await advanceBlockTo("30") // block 94
      expect((await this.testToken.balanceOf(this.chef.address)).toString()).to.equal("0")
      await advanceBlockTo("4") // block 98
      await this.chef.connect(this.bob).deposit(0, "10") // block 99
      expect((await this.testToken.balanceOf(this.chef.address)).toString()).to.equal("0")
      expect((await this.testToken.balanceOf(this.bob.address)).toString()).to.equal("0")
      expect((await this.lp.balanceOf(this.bob.address)).toString()).to.equal("990")
      await advanceBlockTo("200")
      await this.chef.connect(this.bob).withdraw(0, "10") // block 300

      expect((await this.testToken.balanceOf(this.chef.address)).toString()).to.equal("0")
      expect((await this.testToken.balanceOf(this.bob.address)).toString()).to.equal("3980")
      expect((await this.lp.balanceOf(this.bob.address)).toString()).to.equal("1000")
    })

    it("should stop giving bonus Adds after the bonus period ends", async function () {
      // 2 per block farming rate starting at block 100 with bonus of 20 until block farming ends
      this.chef = await this.distributor.deploy(this.testToken.address, false, this.lockwallet.address)
      await this.chef.deployed()
      // 20000000000000000000000
      await this.testToken.mint(this.chef.address, "20000") // block 11
      await this.lp.connect(this.alice).approve(this.chef.address, "10000")
      await advanceBlockTo("1")
      await this.chef.addPool(this.lp.address, this.currentBlock + 400, this.currentBlock + this.endBlock, 10, this.rewardPerBlock.toString(), 0, 0, this.poolEndTime )

      // Alice deposits 10 LPs at block 490
      await advanceBlockTo("474")
      await this.chef.connect(this.alice).deposit(0, "10")
      // At block 605, she should have 2 * 10 * 20 + 2*5 = 10500 pending.
      await advanceBlockTo("14")
      let pending = await this.chef.pendingReward(0, this.alice.address);
      expect(pending[0].toString()).to.equal("280")
      // At block 606, Alice withdraws all pending rewards and should get 410.
      await this.chef.connect(this.alice).deposit(0, "0")
      pending = await this.chef.pendingReward(0, this.alice.address);
      expect(pending[0].toString()).to.equal("0")
      expect((await this.testToken.balanceOf(this.alice.address)).toString()).to.equal("300")
      expect((await this.testToken.balanceOf(this.chef.address)).toString()).to.equal("19700")
    })

    it("should Update Reward On Updation Of Multiplier", async function () {
      // 2 per block farming rate starting at block 100 with bonus of 20 until block farming ends
      this.chef = await this.distributor.deploy(this.testToken.address, false, this.lockwallet.address)
      await this.chef.deployed()

      // 20000000000000000000000
      await this.testToken.mint(this.chef.address, "20000") // block 11
      await this.lp.connect(this.alice).approve(this.chef.address, "1000")
      await advanceBlockTo("1")
      await this.chef.addPool(this.lp.address, this.currentBlock + 400, this.currentBlock + this.endBlock, 20, this.rewardPerBlock.toString(), 0, 0, this.poolEndTime )
      // Alice deposits 10 LPs at block 490
      await advanceBlockTo("475")
      await this.chef.connect(this.alice).deposit(0, "10")
      // At block 604, she should have 2 * 10 * 20 + 2* 4 * 20 = 560 pending.
      await advanceBlockTo("14")
      let pending = await this.chef.pendingReward(0, this.alice.address);

      expect(pending[0].toString()).to.equal("560")
      await this.chef.updatePoolMultiplier(0, this.currentBlock + 400, this.currentBlock + this.endBlock, 40)
      // At block 605, she should have 2 * 10 * 40 + 2* 4 * 40 = 1200 pending.
      pending = await this.chef.pendingReward(0, this.alice.address);
      expect(pending[0].toString()).to.equal("0")
      await this.chef.connect(this.alice).deposit(0, "0")
      // At block 606, Alice withdraws all pending rewards and should get 1280.
      pending = await this.chef.pendingReward(0, this.alice.address);
      expect(pending[0].toString()).to.equal("0")
      expect((await this.testToken.balanceOf(this.alice.address)).toString()).to.equal("1280")
      expect((await this.testToken.balanceOf(this.chef.address)).toString()).to.equal("18720")
    })

    it("Verify Multiplier w.r.t Percentage Change", async function () {
      // 2 per block farming rate starting at block 100 with bonus of 20 until block farming ends
      this.chef = await this.distributor.deploy(this.testToken.address, false, this.lockwallet.address)
      await this.chef.deployed()
 
      // 20000000000000000000000
      await this.testToken.mint(this.chef.address, "20000") // block 11
      await this.lp.connect(this.alice).approve(this.chef.address, "1000")
      await advanceBlockTo("1")
      await this.chef.addPool(this.lp.address, this.currentBlock + 401, this.currentBlock + this.endBlock, 20, this.rewardPerBlock.toString(), 5, 3, this.poolEndTime )
      // Alice deposits 10 LPs at block 490
      await advanceBlockTo("475")
      await this.chef.connect(this.alice).deposit(0, "10") 
      // At block 604, she should have 2 * 10 * 20 + 2* 4 * 20 = 560 pending.
      await advanceBlockTo("14")
      await increase(10)
      let pending = await this.chef.pendingReward(0, this.alice.address);

      expect(pending[0].toString()).to.equal("600")
      await this.chef.connect(this.alice).deposit(0, "10")
      await this.chef.updatePoolMultiplier(0, this.currentBlock + 400, this.currentBlock + this.endBlock, 40)
      // At block 605, she should have 2 * 10 * 40 + 2* 4 * 40 = 1200 pending.
      pending = await this.chef.pendingReward(0, this.alice.address);
      expect(pending[0].toString()).to.equal("0")
      await this.chef.connect(this.alice).deposit(0, "0")
      // At block 606, Alice withdraws all pending rewards and should get 1280.
      pending = await this.chef.pendingReward(0, this.alice.address);
      expect(pending[0].toString()).to.equal("0")
      expect((await this.testToken.balanceOf(this.alice.address)).toString()).to.equal("720")
      expect((await this.testToken.balanceOf(this.chef.address)).toString()).to.equal("19280")
    })
  })
})
