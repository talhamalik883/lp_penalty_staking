  
const { expect, done, assert } = require("chai")

describe("Token", function () {
  const tokenName = 'TOKENNAME'
  const tokenSymbol = 'TOKENSYMBOL'
  before(async function () {
    this.token = await ethers.getContractFactory("Token")
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
  })

  beforeEach(async function () {
    this.testToken = await this.token.deploy()
    await this.testToken.deployed()
  })

  it("should have correct name and symbol and decimal", async function () {
    const name = await this.testToken.name()
    const symbol = await this.testToken.symbol()
    const decimals = await this.testToken.decimals()
    expect(name, tokenName)
    expect(symbol, tokenSymbol)
    expect(decimals, "18")
  })

  it("should only allow owner to mint token", async function () {
    await this.testToken.mint(this.alice.address, "100")
    await this.testToken.mint(this.bob.address, "1000")
    await expect(this.testToken.connect(this.bob).mint(this.carol.address, "1000")).to.be.revertedWith(
      "Ownable: caller is not the owner"
    )
    const totalSupply = await this.testToken.totalSupply()
    const aliceBal = await this.testToken.balanceOf(this.alice.address)
    const bobBal = await this.testToken.balanceOf(this.bob.address)
    const carolBal = await this.testToken.balanceOf(this.carol.address)
    expect(totalSupply.toString()).to.equal("1100")
    expect(aliceBal.toString()).to.equal("100")
    expect(bobBal.toString()).to.equal("1000")
    expect(carolBal.toString()).to.equal("0")
  })

  it("should supply token transfers properly", async function () {
    await this.testToken.mint(this.alice.address, "100")
    await this.testToken.mint(this.bob.address, "1000")
    await this.testToken.transfer(this.carol.address, "10")
    await this.testToken.connect(this.bob).transfer(this.carol.address, "100")
    const totalSupply = await this.testToken.totalSupply()
    const aliceBal = await this.testToken.balanceOf(this.alice.address)
    const bobBal = await this.testToken.balanceOf(this.bob.address)
    const carolBal = await this.testToken.balanceOf(this.carol.address)
    expect(totalSupply.toString(), "1100")
    expect(aliceBal.toString(), "90")
    expect(bobBal.toString(), "900")
    expect(carolBal.toString(), "110")
  })

  it("should supply token transfers from properly", async function () {
    await this.testToken.mint(this.alice.address, "100")
    await this.testToken.mint(this.bob.address, "1000")
    await this.testToken.connect(this.alice).approve(this.bob.address, "100")
    await this.testToken.connect(this.bob).transferFrom(this.alice.address, this.bob.address, "100") 
    const totalSupply = await this.testToken.totalSupply()
    const aliceBal = await this.testToken.balanceOf(this.alice.address)
    const bobBal = await this.testToken.balanceOf(this.bob.address)
    const carolBal = await this.testToken.balanceOf(this.carol.address)
    expect(totalSupply.toString(), "1100")
    expect(aliceBal.toString(), "90")
    expect(bobBal.toString(), "900")
    expect(carolBal.toString(), "110")
  })

  it("should fail if you try to do bad transfers", async function () {
    await this.testToken.mint(this.alice.address, "100")
    await expect(this.testToken.transfer(this.carol.address, "110")).to.be.revertedWith("ERC20: transfer amount exceeds balance")
    await expect(this.testToken.connect(this.bob).transfer(this.carol.address, "1")).to.be.revertedWith(
      "ERC20: transfer amount exceeds balance"
    )
  })
})