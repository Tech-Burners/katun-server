const userModel = require("./user.model");

const suspendUserService=async(id)=>{
    return await userModel.findOneAndUpdate({ _id: id }, { isBan: true }, { new: true });
}

const activeUserService=async(id)=>{
    return await userModel.findOneAndUpdate({ _id: id }, { isBan: false }, { new: true });
}

const giveFlagService=async(id)=>{
    return await userModel.findOneAndUpdate({ _id: id }, { $inc: { flagCount: 1 } }, { new: true });
}




const giveNoteService=async(id,note)=>{
    return await userModel.findOneAndUpdate({ _id: id }, { note: note }, { new: true });
}

const giveCreditService = async (id, credit) => {
    return await userModel.findOneAndUpdate({ _id: id }, { digitalWallet: credit }, { new: true });
}

module.exports={
    suspendUserService,
    activeUserService,
    giveFlagService,
    giveNoteService,
    giveCreditService
}