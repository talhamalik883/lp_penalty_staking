require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("dotenv").config()
// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})
const { removeConsoleLog } = require("hardhat-preprocessor")

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
  networks: {
    hardhat: {
      forking: {
        enabled: process.env.FORKING === "true",
        url: `https://eth-kovan.alchemyapi.io/v2/7hXx5tOjA95V0sjNScp2g6Uf-RXq5cU6`,
      },
      live: false,
      saveDeployments: true,
      tags: ["test", "local"],
    },
    bscTest: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: [process.env.PRIVATE_KEY],
    },
    ethKovan: {
      url: "https://kovan.infura.io/v3/a4273886253a4c01b2e41cbfeb190ccd",
      accounts: [process.env.PRIVATE_KEY],
    },
    ethRinkeby: {
      url: "https://rinkeby.infura.io/v3/a4273886253a4c01b2e41cbfeb190ccd",
      accounts: [process.env.PRIVATE_KEY],
    },
    ethMainnet: {
      url: "https://mainnet.infura.io/v3/a4273886253a4c01b2e41cbfeb190ccd",
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 24000000000
    },
    ganache: {
      url: "http://localhost:8545",
      accounts: {
        mnemonic: "cupboard tennis easy year sunset puppy silent soul athlete good flight resemble",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
  },

  mocha: {
    // enableTimeouts: false,
    timeout: 200000,
  },
  // solidity: "0.7.3",
  preprocess: {
    eachLine: removeConsoleLog((bre) => bre.network.name !== "hardhat" && bre.network.name !== "localhost"),
  },
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  typechain: {
    outDir: "types",
    target: "ethers-v5",
  },
  watcher: {
    compile: {
      tasks: ["compile"],
      files: ["./contracts"],
      verbose: true,
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY
  },
}
