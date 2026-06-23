const payoutCycleModel = require("../modules/Payout/payoutCycle.model");


const getCurrentCycle = async (partnerId, type) => {
  let cycle = await payoutCycleModel.findOne({
    partner: partnerId,
    type,
    status: "open",
  });

  if (!cycle) {
    const now = new Date();

    let startDate = new Date(now);
    let endDate = new Date(now);

    if (type === "weekly") {
      startDate.setDate(now.getDate() - now.getDay());
      endDate.setDate(startDate.getDate() + 6);
    }

    if (type === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    cycle = await payoutCycleModel.create({
      partner: partnerId,
      type,
      startDate,
      endDate,
    });
  }

  return cycle;
};

module.exports = { getCurrentCycle };