const mongoose = require("mongoose");
const adminModel = require("../modules/Admin/admin.model");
const employerModel = require("../modules/Employer/employer.model");
const { getUserById } = require("../modules/Auth/auth.service");

const resolveCompanyId = async (user) => {
    const loggedUser = await getUserById(user);
    // console.log({ loggedUser });

    let company;

    // Sub Admin / HR Admin
    if (
        loggedUser.role === 'sub_hr_admin'
    ) {

        const admin = await adminModel.findOne({
            user: loggedUser._id
        });
        // console.log({ admin });

        if (!admin) {
            throw new Error("Admin profile not found");
        }

        company = await employerModel.findOne({
            user: admin.parent
        });
    }

    // // Main Company Admin
    // else if (loggedUser.role === "admin") {

    //     company = await employerModel.findOne({
    //         user: loggedUser._id
    //     });
    // }

    else if(loggedUser.role === "hr"){
        company = await employerModel.findOne({
            user: loggedUser._id
        });
    }


    if (!company) {
        throw new Error("Company not found");
    }

    return company._id;
};

module.exports = resolveCompanyId;