const { default: mongoose, Mongoose } = require("mongoose");
const Feedback = require("./feedback.model");
const { emailWithNodemailer } = require("../../helpers/email");



const addFeedback = async (data) => {
  return Feedback.create(data);
};


const getFeedbackForAService = async (serviceId, options = {}) => {
  const { rating, sort = 'newest' } = options;
  
  // Build match query
  const matchQuery = {
    service: new mongoose.Types.ObjectId(serviceId),
  };

  // Add rating filter if provided
  if (rating && rating !== 'all') {
    matchQuery.rating = Number(rating);
  }

  // Determine sort order
  let sortOption = { createdAt: -1 }; // default newest
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  }

  const result = await Feedback.aggregate([
    {
      $match: matchQuery,
    },
    {
      $facet: {
        feedback: [
          {
            $lookup: {
              from: "users",
              localField: "sender",
              foreignField: "_id",
              as: "sender",
            },
          },
          {
            $unwind: {
              path: "$sender",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              text: 1,
              rating: 1,
              createdAt: 1,
              senderName: "$sender.fullName",
              senderImage: "$sender.image",
            }
          },
          {
            $sort: sortOption
          }
        ],
        ratingCounts: [
          {
            $group: {
              _id: "$rating",
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: 0,
              rating: "$_id",
              count: 1
            }
          }
        ],
        totalFeedback: [
          {
            $count: "total"
          }
        ]
      }
    }
  ]);

  const { feedback, ratingCounts, totalFeedback } = result[0];
  
  // Initialize all rating counts with 0
  const ratingStats = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    total: totalFeedback[0]?.total || 0
  };

  // Populate actual counts from aggregation
  ratingCounts.forEach(item => {
    if (item.rating >= 1 && item.rating <=5) {
      ratingStats[item.rating] = item.count;
    }
  });

  // Calculate average rating
  let averageRating = 0;
  let totalRatingsCount = 0;
  for (let r=1; r<=5; r++) {
    averageRating += r * ratingStats[r];
    totalRatingsCount += ratingStats[r];
  }
  ratingStats.average = totalRatingsCount > 0 ? (averageRating / totalRatingsCount).toFixed(1) : 0;

  return {
    feedback,
    stats: ratingStats
  };
}


const partnerFeedbackService = async (partnerId, options = {}) => {
  const { rating, sort = 'newest' } = options;
  
  // Build match query
  const matchQuery = {
    targetUser: new mongoose.Types.ObjectId(partnerId),
  };

  // Add rating filter if provided
  if (rating && rating !== 'all') {
    matchQuery.rating = Number(rating);
  }

  // Determine sort order
  let sortOption = { createdAt: -1 }; // default newest
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  }

  const result = await Feedback.aggregate([
    {
      $match: matchQuery,
    },
    {
      $facet: {
        feedback: [
          {
            $lookup: {
              from: "users",
              localField: "sender",
              foreignField: "_id",
              as: "sender",
            },
          },
          {
            $unwind: {
              path: "$sender",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              text: 1,
              rating: 1,
              createdAt: 1,
              senderName: "$sender.fullName",
              senderImage: "$sender.image",
            }
          },
          {
            $sort: sortOption
          }
        ],
        ratingCounts: [
          {
            $group: {
              _id: "$rating",
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: 0,
              rating: "$_id",
              count: 1
            }
          }
        ],
        totalFeedback: [
          {
            $count: "total"
          }
        ]
      }
    }
  ]);

  const { feedback, ratingCounts, totalFeedback } = result[0];
  
  // Initialize all rating counts with 0
  const ratingStats = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    total: totalFeedback[0]?.total || 0
  };

  // Populate actual counts from aggregation
  ratingCounts.forEach(item => {
    if (item.rating >= 1 && item.rating <=5) {
      ratingStats[item.rating] = item.count;
    }
  });

  // Calculate average rating
  let averageRating = 0;
  let totalRatingsCount = 0;
  for (let r=1; r<=5; r++) {
    averageRating += r * ratingStats[r];
    totalRatingsCount += ratingStats[r];
  }
  ratingStats.average = totalRatingsCount > 0 ? (averageRating / totalRatingsCount).toFixed(1) : 0;

  return {
    feedback,
    stats: ratingStats
  };
}

const replyService = async (data) => {
  await emailWithNodemailer({
    email: data.senderEmail,
    subject: "We’ve responded to your request",
    html: `
      <div style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:24px;border-radius:8px;">

          <!-- Header -->
          <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid #eee;">
            <h2 style="margin:0;color:#111;">Support Response</h2>
            <p style="margin:5px 0 0;color:#666;font-size:14px;">We’ve replied to your request</p>
          </div>

          <!-- Greeting -->
          <div style="padding:20px 0;">
            <p style="font-size:15px;color:#333;margin:0 0 12px;">
              Hello,
            </p>

            <p style="font-size:15px;color:#333;margin:0 0 16px;">
              Thank you for reaching out to our support team. We’ve reviewed your request and responded below.
            </p>

            <!-- Reply Message -->
            <div style="background:#f1f5f9;padding:15px;border-left:4px solid #3b82f6;border-radius:6px;">
              <p style="margin:0;color:#111;font-size:14px;white-space:pre-line;">
                ${data.reply}
              </p>
            </div>
          </div>

          <!-- User Original Message -->
          <div style="margin-top:20px;">
            <p style="font-size:13px;color:#666;margin-bottom:6px;">Your message:</p>
            <div style="background:#fafafa;padding:12px;border:1px solid #eee;border-radius:6px;">
              <p style="margin:0;color:#444;font-size:13px;white-space:pre-line;">
                ${data.text}
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top:30px;padding-top:15px;border-top:1px solid #eee;text-align:center;">
            <p style="font-size:12px;color:#aaa;margin-top:6px;">
              © ${new Date().getFullYear()} ${process.env.APPNAME}.. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    `,
  });
};

const getMyFeedbackService = async (user, options) => {
  const { page = 1, limit = 10, rating, date } = options;
  const skip = (page - 1) * limit;
  const sortOption = {};
  if (rating) sortOption.rating = rating === 'asc' ? 1 : -1;
  if (date) sortOption.createdAt = date === 'asc' ? 1 : -1;

  const result = await Feedback.aggregate([
    {
      $match: {
        targetUser: new mongoose.Types.ObjectId(user)
      }
    },
    {
      $lookup: {
        from: "users", 
        localField: "sender",
        foreignField: "_id",
        as: "sender"
      }
    },
    {
      $unwind: {
        path: "$sender",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        text: 1,
        rating: 1,
        createdAt: 1,
        senderName : "$sender.fullName",
        senderImage : "$sender.image",
        senderEmail : "$sender.email",
        senderId : "$sender._id"
      }
    },
    {
      $sort: Object.keys(sortOption).length ? sortOption : { createdAt: -1 }
    },

    {
      $facet: {
        feedback: [
          { $skip: skip },
          { $limit: Number(limit) }
        ],
        totalCount: [
          { $count: "count" }
        ]
      }
    }
  ]);

  const feedback = result[0].feedback;
  const totalResults = result[0].totalCount[0]?.count || 0;
  const totalPages = Math.ceil(totalResults / limit);

  return {
    feedback,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      totalPages,
      totalResults,
      currentPage: Number(page)
    }
  };
}



module.exports = { addFeedback, getMyFeedbackService, replyService, getFeedbackForAService, partnerFeedbackService };