const allocateModel = require("../Allocate/allocate.model");
const Employee = require("../Employee/employee.model");
const AllocationManagement = require("../AllocationManagement/allocationManagement.model");
const cron = require("node-cron");

const startAllocationCron = () => {
    // Daily at 00:00
    cron.schedule("0 0 * * *", async () => {
        console.log("Running allocation cron job...");

        try {
            const today = new Date();

            const allocations = await allocateModel.find({
                isRecurring: true,
                status: 'active'
            });

            for (const allocation of allocations) {

                const last = allocation.lastExecutedAt || allocation.startDate;
                const nextRun = new Date(last);
                nextRun.setDate(nextRun.getDate() + allocation.frequency);

                if (today >= nextRun) {
                    // Fetch employees for allocation
                    let employees = [];
                    if (allocation.allocateTo === 'all-employee') {
                        employees = await Employee.find({ company: allocation.company });
                    } else if (allocation.allocateTo === 'department') {
                        employees = await Employee.find({ department: allocation.department });
                    } else if (allocation.allocateTo === 'branch') {
                        employees = await Employee.find({ branch: allocation.branch });
                    }

                    // Create wallets
                    const wallets = employees.map(emp => ({
                        user: emp.user,
                        allocation: allocation._id,
                        totalCredit: allocation.creditPerEmployee,
                        remainingCredit: allocation.creditPerEmployee,
                        usedCredit: 0,
                        periodStart: nextRun,
                        periodEnd: new Date(nextRun.getTime() + allocation.frequency * 24 * 60 * 60 * 1000)
                    }));

                    await AllocationManagement.insertMany(wallets);

                    // Update lastExecutedAt
                    allocation.lastExecutedAt = today;
                    await allocation.save();

                    console.log(`Allocation "${allocation.name}" processed for ${employees.length} employees.`);
                }
            }
        } catch (err) {
            console.error("Cron job error:", err);
        }
    });
};

module.exports = startAllocationCron;