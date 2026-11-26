const allocateModel = require("../Allocate/allocate.model");
const Employee = require("../Employee/employee.model");
const AllocationManagement = require("../AllocationManagement/allocationManagement.model");
const employerModel = require("../Employer/employer.model");
const userModel = require("../User/user.model");
const transactionModel = require("../Transaction/transaction.model");
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
                    const companyId = allocation.companyId || allocation.company;

                    // Fetch employees for allocation
                    let employees = [];
                    if (allocation.allocateTo === 'all-employee') {
                        employees = await Employee.find({ company: companyId, status: 'active' });
                    } else if (allocation.allocateTo === 'department') {
                        employees = await Employee.find({ department: allocation.department, status: 'active' });
                    } else if (allocation.allocateTo === 'branch') {
                        employees = await Employee.find({ branch: allocation.branch, status: 'active' });
                    }

                    if (employees.length > 0 && companyId) {
                        const totalAllocated = Number(allocation.creditPerEmployee || 0) * employees.length;
                        const company = await employerModel.findById(companyId);

                        if (!company || Number(company.creditBalance || 0) < totalAllocated) {
                            console.warn(`[AllocationCron] Skipped "${allocation.name}": Insufficient company balance`);
                            continue;
                        }

                        // Deduct from company credit balance & increment totalSpent
                        await employerModel.findByIdAndUpdate(companyId, {
                            $inc: { creditBalance: -totalAllocated, totalSpent: totalAllocated }
                        });

                        // Credit user wallets
                        const userIds = employees.map(emp => emp.user).filter(Boolean);
                        if (userIds.length > 0) {
                            await userModel.updateMany(
                                { _id: { $in: userIds } },
                                {
                                    $inc: {
                                        digitalWallet: allocation.creditPerEmployee,
                                        allocatedCredit: allocation.creditPerEmployee
                                    }
                                }
                            );
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

                        // Record Transactions so employees see them in wallet-transactions
                        const companyName = company?.companyName || 'Company HR';
                        const transactionDocs = employees
                            .filter(emp => emp.user)
                            .map((emp) => ({
                                tx_ref: `allocate_cron_${Date.now()}_${emp.user}_${Math.random().toString(36).substring(2, 7)}`,
                                user: emp.user,
                                credit_owner_type: 'company',
                                credit_owner_id: companyId,
                                currency: 'NGN',
                                gross_amount: allocation.creditPerEmployee,
                                commission: 0,
                                net_amount: allocation.creditPerEmployee,
                                status: 'successful',
                                payment_status: 'successful',
                                payment_method: 'wallet',
                                paymentType: 'credit',
                                description: `Recurring HR credit allocated by ${companyName}: ₦${allocation.creditPerEmployee} (${allocation.name})`
                            }));

                        if (transactionDocs.length > 0) {
                            await transactionModel.insertMany(transactionDocs);
                        }

                        // Update lastExecutedAt
                        allocation.lastExecutedAt = today;
                        await allocation.save();

                        console.log(`Allocation "${allocation.name}" processed for ${employees.length} employees.`);
                    }
                }
            }
        } catch (err) {
            console.error("Cron job error:", err);
        }
    });
};

module.exports = startAllocationCron;