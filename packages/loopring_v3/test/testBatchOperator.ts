import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Block, RingInfo } from "./types";

const BatchOperator = artifacts.require("BatchOperator");

contract("BatchOperator", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchangeID = 0;
  let exchangeAddress = "";
  let batchOperator: any;
  const owner = accounts[0];

  const setupRandomRing = async () => {
    const ring: RingInfo = {
      orderA: {
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: new BN(web3.utils.toWei("100", "ether")),
        amountB: new BN(web3.utils.toWei("200", "ether"))
      },
      orderB: {
        tokenS: "GTO",
        tokenB: "WETH",
        amountS: new BN(web3.utils.toWei("200", "ether")),
        amountB: new BN(web3.utils.toWei("100", "ether"))
      },
      expected: {
        orderA: { filledFraction: 1.0, spread: new BN(0) },
        orderB: { filledFraction: 1.0 }
      }
    };
    await exchangeTestUtil.setupRing(ring);
    return ring;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  beforeEach(async () => {
    // Fresh Exchange for each test
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      true
    );
    exchangeAddress = exchangeTestUtil.exchange.address;
    batchOperator = await BatchOperator.new(exchangeAddress);
  });

  // TODO: replace all console.xx to logXX
  describe("batchCall", () => {
    it("gas usage comparison", async () => {
      const batchSize = 2;

      console.log("exchangeID:", exchangeID);
      let allBlocks: any[] = [];
      for (let i = 0; i < batchSize; i++) {
        const ring = await setupRandomRing();
        await exchangeTestUtil.sendRing(exchangeID, ring);
        await exchangeTestUtil.commitDeposits(exchangeID);
        const blocks = await exchangeTestUtil.commitRings(exchangeID);
        allBlocks = allBlocks.concat(blocks);
      }

      let allGasUsed = 0;
      for (const block of allBlocks) {
        console.log("block:", block);
        const receipt = await web3.eth.getTransactionReceipt(
          block.transactionHash
        );
        allGasUsed += receipt.gasUsed;
      }
      console.log("allGasUsed for", batchSize, "trade blocks:", allGasUsed);

      let batchTxDatas: string[] = [];
      exchangeTestUtil.setOperatorContract(batchOperator);
      for (let i = 0; i < batchSize; i++) {
        const ring = await setupRandomRing();
        await exchangeTestUtil.sendRing(exchangeID, ring);
        await exchangeTestUtil.commitDeposits(exchangeID);
        const txDatas = await exchangeTestUtil.packCommitRings(exchangeID);
        batchTxDatas = batchTxDatas.concat(txDatas);
      }
      console.log("batchTxDatas:", batchTxDatas);

      const tx = await batchOperator.batchCall(batchTxDatas);
      console.log("tx:", tx);
    });
  });
});
