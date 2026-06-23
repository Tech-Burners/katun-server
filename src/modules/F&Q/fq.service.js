const fqModel = require("./fq.model");


const addFQService = async (data) => {
    const result = await fqModel.insertMany(data); 
    return result;
};


const editFQService = async(id, data)=> {
    const result = await fqModel.findByIdAndUpdate(id, data, {new: true});
    return result
}

const deleteFQService = async(id)=> {
    const result = await fqModel.findById(id);
    return await fqModel.findByIdAndDelete(id);
}


const allFQ = async (options) => {
  const { page = 1, limit = 10 } = options; // default values
  const totalResults = await fqModel.countDocuments();
  const skip = (page - 1) * limit;

  const result = await fqModel
    .find()
    .sort({ createdAt: -1 }) 
    .skip(skip)
    .limit(limit)
    .exec();

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit), 
      currentPage: page,
      limit,
    },
  };
};

module.exports = { addFQService, editFQService, deleteFQService,allFQ }