const cron = require("node-cron");
const { processAllExpiredBookings } = require("./bookingExpiry.service");

let isRunning = false;

const startBookingCron = () => {
  // Run every minute
  cron.schedule("* * * * *", async () => {
    if (isRunning) {
      console.log("⏳ Booking expiry cron is already running, skipping overlapping tick.");
      return;
    }

    isRunning = true;
    try {
      await processAllExpiredBookings();
    } catch (err) {
      console.error("❌ Booking expiry cron error:", err.message);
    } finally {
      isRunning = false;
    }
  });

  console.log("🕒 Booking expiry cron job initialized (running every minute)");
};

module.exports = startBookingCron;
