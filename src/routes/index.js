const express = require('express');
const router = express.Router();
const authRoutes = require('../modules/Auth/auth.route');
const fqRoutes = require('../modules/F&Q/fq.route');
const branchRoutes = require('../modules/Branch/branch.route');
const departmentRoutes = require('../modules/Department/department.route');
const employeerRoutes = require('../modules/Employer/employer.route');
const employeeRoutes = require('../modules/Employee/employee.route');
const allocateRoutes = require('../modules/Allocate/allocate.route');
const categoryRoutes = require('../modules/Category/category.route');
const subcategoryRoutes = require('../modules/SubCategory/subCategory.route');
const staticContentRoutes = require('../modules/StaticContent/staticContent.route');
const serviceRoutes = require('../modules/Service/service.route');
const availabilityRoutes = require('../modules/Availability/availability.route');
const reportRoutes = require('../modules/Report/report.route');
const feedbackRoutes = require('../modules/FeedBack/feedback.route');
const promoRoutes = require('../modules/Promo/promo.route');
const commissionRoutes = require('../modules/Commission/commission.route');
const bookingRoutes = require('../modules/Booking/booking.route');
const favouriteRoutes = require('../modules/Favourite/favourite.route');
const partnerRoutes = require('../modules/Partner/partner.route');
const adminRoutes = require('../modules/Admin/admin.route');
const transactionRoutes = require('../modules/Transaction/transaction.route');
const homeRoutes = require('../modules/Home/home.route');
const bankRoutes = require('../modules/Bank/bank.route');
const userRoutes = require('../modules/User/user.route');
const staffRoutes = require('../modules/Staffs/staffs.route');
const webHomeRoutes = require('../modules/Website/HomePage/homepage.route');
const webPartnerPageRoutes = require('../modules/Website/PartnerPage/partner.route');
const webEmployerPage = require('../modules/Website/EmployerPage/employerPage.route');
const webAboutPageRoutes = require('../modules/Website/AboutPage/aboutPage.route');
const overviewRoutes = require('../modules/Overview/overview.route');
const auditRoutes = require('../modules/Audit/audit.route');
const contactRoutes = require('../modules/Contact/contact.route');
const payoutRoutes = require('../modules/Payout/payout.route');
const notificationRoutes = require('../modules/Notification/notification.route');


const moduleRoutes = [
  {
    path: '/fandq',
    route: fqRoutes,
  },
  {
    path: '/auth',
    route: authRoutes,
  },
  {
    path: '/user',
    route: userRoutes
  },
  {
    path : '/admin',
    route : adminRoutes
  },
  {
    path: '/branch',
    route: branchRoutes
  },
  {
    path: '/department',
    route: departmentRoutes
  },
  {
    path : '/category',
    route : categoryRoutes
  },
  {
    path : '/sub-category',
    route : subcategoryRoutes
  },
  {
    path: '/employeer',
    route: employeerRoutes
  },
  {
    path : '/employee',
    route : employeeRoutes
  },
  {
    path: '/allocate',
    route: allocateRoutes
  },
  {
    path: '/static-contents',
    route: staticContentRoutes
  },
  {
    path: '/service',
    route: serviceRoutes
  },
  {
    path: '/availability',
    route: availabilityRoutes
  },
  {
    path: '/report',
    route: reportRoutes
  },
  {
    path : '/feedback',
    route : feedbackRoutes
  },
  {
    path : '/promo',
    route: promoRoutes
  },
  {
    path : '/commission',
    route: commissionRoutes
  },
  {
    path : '/book',
    route: bookingRoutes
  },
  {
    path : '/users',
    route: userRoutes
  },
  {
    path : '/favorite',
    route: favouriteRoutes
  },
  {
    path : '/partner',
    route: partnerRoutes
  },
  {
    path : '/transaction',
    route: transactionRoutes
  },
  {
    path : '/home',
    route : homeRoutes
  },
  {
    path : '/bank',
    route : bankRoutes
  },
  {
    path: '/staff',
    route: staffRoutes
  },
  {
    path: '/audit',
    route: auditRoutes
  },
  {
    path: '/web-home',
    route: webHomeRoutes
  },
  {
    path: '/web-partnerpage',
    route: webPartnerPageRoutes
  },
  {
    path: '/web-employerpage',
    route: webEmployerPage
  },
  {
    path : '/web-aboutpage',
    route : webAboutPageRoutes
  },
  {
    path: '/overview',
    route: overviewRoutes
  },
  {
    path: '/contact',
    route: contactRoutes
  },
  {
    path : '/payout',
    route : payoutRoutes
  },
  {
    path: '/notification',
    route: notificationRoutes
  }
];


moduleRoutes.forEach((route) => router.use(route.path, route.route));

module.exports = router;