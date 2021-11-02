const HDWalletProvider = require("@truffle/hdwallet-provider");

require("babel-register");
require("babel-polyfill");
require("dotenv").config();
const privateKeys = process.env.PRIVATE_KEYS || "";

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*", //match any network ID
    },
    kovan: {
      provider: function () {
        return new HDWalletProvider(
          privateKeys.split(","), //Gives of account private keys
          `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}` //URL to Ethereum node
        );
      },
      gas: 5000000,
      gasPrice: 25000000000,
      network_id: 42,
    },
  },
  contracts_directory: "./src/contracts/",
  contracts_build_directory: "./src/abis/",

  // Configure your compilers
  compilers: {
    solc: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};
