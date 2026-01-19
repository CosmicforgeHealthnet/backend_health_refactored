// src/controllers/labFacilityController.js
const labFacilityService = require("../services/lab_facility");
const labFacilitySubService = require("../services/lab_facility/sub");

const { USER_ROLES } = require("../../../shared/utils/constants");

class LabFacilityController {
  /**
   * Register a new lab facility (public endpoint - no auth required)
   * POST /api/lab/facilities/register
   */
  async registerFacility(req, res, next) {
    try {
      const facilityData = req.body;

      const facility = await labFacilityService.registerFacility(facilityData);

      return res.status(201).json({
        success: true,
        message:
          "Lab facility registered successfully. Awaiting admin approval.",
        data: {
          id: facility.id,
          facilityName: facility.facilityName,
          status: facility.status,
          adminEmail: facility.adminEmail,
          submittedAt: facility.createdAt,
        },
      });
    } catch (error) {
      if (
        error.message.includes("already") ||
        error.message.includes("required") ||
        error.message.includes("Invalid")
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  // src/controllers/labFacilityController.js

  /**
   * Step 1: Admin Information
   * POST /api/lab/facilities/register/step1
   */
  async registerStep1(req, res, next) {
    try {
      const step1Data = req.body;
      const facility = await labFacilitySubService.registerStep1(step1Data);

      return res.status(201).json({
        success: true,
        message: "Step 1 completed successfully",
        data: {
          facilityId: facility.id,
          step: 1,
          nextStep: "/api/lab/facilities/register/step2",
        },
      });
    } catch (error) {
      if (
        error.message.includes("already") ||
        error.message.includes("required")
      ) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  /**
   * Step 2: Facility Information
   * PUT /api/lab/facilities/register/step2/:id
   */
  async registerStep2(req, res, next) {
    try {
      const { id } = req.params;
      const step2Data = req.body;

      const facility = await labFacilitySubService.registerStep2(id, step2Data);

      return res.json({
        success: true,
        message: "Step 2 completed successfully",
        data: {
          facilityId: facility.id,
          step: 2,
          nextStep: "/api/lab/facilities/register/step3",
        },
      });
    } catch (error) {
  
        return res.status(400).json({ success: false, error: error.message });
    
    }
  }

  /**
   * Step 3: Address & Final Details
   * PUT /api/lab/facilities/register/step3/:id
   */
  async registerStep3(req, res, next) {
    try {
      const { id } = req.params;
      const step3Data = req.body;

      const facility = await labFacilitySubService.registerStep3(id, step3Data);

      return res.status(201).json({
        success: true,
        message:
          "Lab facility registered successfully. Awaiting admin approval.",
        data: {
          id: facility.id,
          facilityName: facility.facilityName,
          status: facility.status,
          adminEmail: facility.adminEmail,
          submittedAt: facility.createdAt,
        },
      });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Get facility details by ID (public for search purposes)
   * GET /api/lab/facilities/:id
   */
  async getFacilityById(req, res, next) {
    try {
      const { id } = req.params;
      const facility = await labFacilityService.getFacilityById(id);

      return res.json({
        success: true,
        data: facility,
        message: "Facility retrieved successfully",
      });
    } catch (error) {
      if (error.message === "Facility not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Get facilities managed by current lab admin
   * GET /api/lab/facilities/my/managed
   */
  async getMyFacilities(req, res, next) {
    try {
      const { sub: userId, role } = req.user;

      // Only lab admins can access this endpoint

      const facilities = await labFacilityService.getFacilitiesByAdmin(userId);

      return res.json({
        success: true,
        data: facilities,
        message: "Your managed facilities retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update facility information (lab admin only)
   * PUT /api/lab/facilities/:id
   */
  async updateFacility(req, res, next) {
    try {
      const { id } = req.params;
      const { sub: userId, role } = req.user;
      const updateData = req.body;

      // Only lab admins can update facilities
      const facility = await labFacilityService.updateFacility(
        id,
        updateData,
        userId
      );

      return res.json({
        success: true,
        data: facility,
        message: "Facility updated successfully",
      });
    } catch (error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("Only facility admin") ||
        error.message.includes("Cannot update")
      ) {
        const statusCode = error.message === "Facility not found" ? 404 : 403;
        return res.status(statusCode).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Search facilities (public endpoint)
   * GET /api/lab/facilities/search?q=searchterm
   */
  async searchFacilities(req, res, next) {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({
          success: false,
          error: "Search query parameter 'q' is required",
        });
      }

      const facilities = await labFacilityService.searchFacilities(q);

      return res.json({
        success: true,
        data: facilities,
        count: facilities.length,
        message: "Search results retrieved successfully",
      });
    } catch (error) {
      if (error.message.includes("characters")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Get facilities by location (public endpoint)
   * GET /api/lab/facilities/location?city=CityName&state=StateName
   */
  async getFacilitiesByLocation(req, res, next) {
    try {
      const { city, state } = req.query;
      if (!city || !state) {
        return res.status(400).json({
          success: false,
          error: "Both city and state parameters are required",
        });
      }

      const facilities = await labFacilityService.getFacilitiesByLocation(
        city,
        state
      );

      return res.json({
        success: true,
        data: facilities,
        count: facilities.length,
        message: "Facilities by location retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // ============== ADMIN ENDPOINTS ==============

  /**
   * Get pending facility registrations (platform admin only)
   * GET /api/lab/admin/facilities/pending
   */
  async getPendingFacilities(req, res, next) {
    try {
      const { role } = req.user;

      // Only platform admins can view pending facilities

      const facilities = await labFacilityService.getPendingFacilities();

      return res.json({
        success: true,
        data: facilities,
        count: facilities.length,
        message: "Pending facilities retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve facility registration (platform admin only)
   * PUT /api/lab/admin/facilities/:id/approve
   */
  async approveFacility(req, res, next) {
    try {
      const { role, sub: adminId } = req.user;

      // Only platform admins can approve facilities

      const { id } = req.params;

      const facility = await labFacilityService.approveFacility(id, adminId);

      return res.json({
        success: true,
        data: facility,
        message:
          "Facility approved successfully. Lab admin account created and invitation sent.",
      });
    } catch (error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("not pending") ||
        error.message.includes("already exists")
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Reject facility registration (platform admin only)
   * PUT /api/lab/admin/facilities/:id/reject
   */
  async rejectFacility(req, res, next) {
    try {
      const { role, sub: adminId } = req.user;

      // Only platform admins can reject facilities

      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Rejection reason is required",
        });
      }

      const facility = await labFacilityService.rejectFacility(
        id,
        adminId,
        reason.trim()
      );

      return res.json({
        success: true,
        data: facility,
        message:
          "Facility registration rejected. Notification sent to applicant.",
      });
    } catch (error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("not pending")
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Get facility statistics (platform admin only)
   * GET /api/lab/admin/facilities/stats
   */
  async getFacilityStats(req, res, next) {
    try {
      const { role } = req.user;

      const [stats, recentRegistrations] = await Promise.all([
        labFacilityService.getFacilityStats(),
        labFacilityService.getRecentRegistrations(5),
      ]);

      return res.json({
        success: true,
        data: {
          statusCounts: stats,
          recentRegistrations: recentRegistrations,
          totalFacilities: Object.values(stats).reduce(
            (sum, count) => sum + count,
            0
          ),
        },
        message: "Facility statistics retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent facility registrations (platform admin only)
   * GET /api/lab/admin/facilities/recent?limit=10
   */
  async getRecentRegistrations(req, res, next) {
    try {
      const { role } = req.user;

      const limit = parseInt(req.query.limit) || 10;
      if (limit > 50) {
        return res.status(400).json({
          success: false,
          error: "Limit cannot exceed 50",
        });
      }

      const facilities = await labFacilityService.getRecentRegistrations(limit);

      return res.json({
        success: true,
        data: facilities,
        count: facilities.length,
        message: "Recent registrations retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LabFacilityController();
