const express = require("express");
const { addAvailabilityController, editAvailabilityController, deleteAvailabilityController, availabilityForAServiceController } = require("./availability.controller");
const router = express.Router();


router.post("/add", addAvailabilityController)
router.put("/edit", editAvailabilityController)
router.delete("/delete/:id", deleteAvailabilityController)
router.get("/availability-for-aservice/:id", availabilityForAServiceController); 

module.exports = router
