const cron = require("node-cron");

const { createPayout } = require("../modules/Payout/payout.service");
const payoutCycleModel = require("../modules/Payout/payoutCycle.model");

cron.schedule("* * * * *", async () => {
  try {
    console.log("🚀 Payout Cron Started");

    const now = new Date();

    const cycles = await payoutCycleModel.find({
      endDate: { $lte: now },
      status: "open",
    });

    for (const cycle of cycles) {
      // cycle.status = "processing";
      // await cycle.save();

      await payoutCycleModel.findOneAndUpdate(
        {
          _id: cycle._id,
          status: "open"
        },
        {
          status: "processing"
        }
      );

      await createPayout(cycle._id);

      cycle.status = "completed";
      await cycle.save();
    }

    console.log("🏁 Payout Cron Completed");
  } catch (err) {
    console.error("❌ Cron Error:", err.message);
  }
});