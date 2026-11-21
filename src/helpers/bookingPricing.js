const mongoose = require("mongoose");

/**
 * Server-calculated booking pricing breakdown helper.
 * All amounts are in ₦ (NGN), calculated on the server and rounded to 2 decimals.
 * Never trust totalPrice or fees sent by the client.
 *
 * Shared definitions:
 * - servicePrice: Base price of the option the user booked
 *   (single-session price when isOneTime: true, or pass price when isOneTime: false).
 * - addonsTotal: Sum of addons[].price on the booking (0 if none).
 * - promoDiscount: Flat discount in ₦ from the applied promo code (0 if none).
 * - subtotal: servicePrice + addonsTotal - promoDiscount (never below 0).
 * - platformFee: subtotal * platformFeePercent / 100 (charged to user).
 * - totalPrice: subtotal + platformFee (total user pays).
 * - partnerCommission: subtotal * partnerCommissionPercent / 100 (deducted from partner earnings).
 * - partnerAmount: subtotal - partnerCommission (what partner earns, platform fee excluded).
 */
const calculateBookingPricing = async ({
  serviceDoc,
  isOneTime,
  pass,
  addons = [],
  promoDiscount = 0,
  promoCode = null,
  partnerDoc = null,
  commissionDoc = null,
  categoryCommissionRate = null,
  partnerCommissionRate = null,
  fallbackServicePrice = null,
}) => {
  const isOne = Boolean(isOneTime);

  // 1. servicePrice (base price of the booked option)
  let servicePrice = 0;
  if (isOne) {
    servicePrice =
      Number(serviceDoc?.servicefee) ||
      Number(serviceDoc?.price) ||
      Number(fallbackServicePrice) ||
      0;
  } else {
    servicePrice =
      Number(pass?.price) ||
      Number(serviceDoc?.pass?.price) ||
      Number(fallbackServicePrice) ||
      Number(serviceDoc?.servicefee) ||
      Number(serviceDoc?.price) ||
      0;
  }
  servicePrice = Number(Number(servicePrice).toFixed(2));

  // 2. addonsTotal
  const addonsTotal = Array.isArray(addons)
    ? Number(
        addons
          .reduce((sum, item) => sum + (Number(item?.price) || 0), 0)
          .toFixed(2)
      )
    : 0;

  // 3. promoDiscount
  let finalPromoDiscount = 0;
  if (
    promoDiscount !== undefined &&
    promoDiscount !== null &&
    !isNaN(Number(promoDiscount)) &&
    Number(promoDiscount) > 0
  ) {
    finalPromoDiscount = Number(Number(promoDiscount).toFixed(2));
  } else if (promoCode) {
    try {
      const promoModel = require("../modules/Promo/promo.model");
      const promo = await promoModel.findOne({
        code: String(promoCode).trim(),
        status: "active",
      });
      if (promo && typeof promo.discount === "number" && promo.discount > 0) {
        finalPromoDiscount = Number(Number(promo.discount).toFixed(2));
      }
    } catch (err) {
      // ignore promo lookup error
    }
  }

  // 4. subtotal (never below 0)
  const subtotal = Number(
    Math.max(0, servicePrice + addonsTotal - finalPromoDiscount).toFixed(2)
  );

  // 5. platformFee (charged to user)
  const platformFeePercent = 5;
  const platformFee = Number(
    ((subtotal * platformFeePercent) / 100).toFixed(2)
  );

  // 6. totalPrice (amount user pays)
  const totalPrice = Number((subtotal + platformFee).toFixed(2));

  // 7. partnerCommission (deducted from partner)
  let partnerCommissionPercent = 10;
  if (
    partnerCommissionRate !== null &&
    partnerCommissionRate !== undefined &&
    !isNaN(Number(partnerCommissionRate)) &&
    Number(partnerCommissionRate) > 0
  ) {
    partnerCommissionPercent = Number(partnerCommissionRate);
  } else if (
    commissionDoc &&
    typeof commissionDoc.commission === "number" &&
    commissionDoc.commission > 0
  ) {
    partnerCommissionPercent = commissionDoc.commission;
  } else if (
    categoryCommissionRate !== null &&
    categoryCommissionRate !== undefined &&
    !isNaN(Number(categoryCommissionRate)) &&
    Number(categoryCommissionRate) > 0
  ) {
    partnerCommissionPercent = Number(categoryCommissionRate);
  } else if (
    partnerDoc &&
    typeof partnerDoc.commission === "number" &&
    partnerDoc.commission > 0
  ) {
    partnerCommissionPercent = partnerDoc.commission;
  }
  const partnerCommission = Number(
    ((subtotal * partnerCommissionPercent) / 100).toFixed(2)
  );

  // 8. partnerAmount (what partner earns)
  const partnerAmount = Number(
    Math.max(0, subtotal - partnerCommission).toFixed(2)
  );

  return {
    servicePrice,
    servicefee: servicePrice,
    addonsTotal,
    promoDiscount: finalPromoDiscount,
    subtotal,
    platformFeePercent,
    platformFee,
    totalPrice,
    partnerCommissionPercent,
    partnerCommission,
    partnerAmount,
  };
};

module.exports = {
  calculateBookingPricing,
};
