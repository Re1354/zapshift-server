const trackingService = require('./tracking.service');

const getTracking = async (req, res) => {
  try {
    const { trackingId } = req.params;

    if (!trackingId || trackingId.trim() === '') {
      return res.status(400).send({
        success: false,
        message: 'Tracking ID is required.',
      });
    }

    const cleanTrackingId = trackingId.trim().toUpperCase();

    const result = await trackingService.getTrackingByTrackingId(cleanTrackingId);

    if (result.notFound) {
      return res.status(404).send({
        success: false,
        message: 'No tracking information found.',
      });
    }

    res.send({
      success: true,
      trackingId: cleanTrackingId,
      parcel: result.parcel,
      logs: result.logs,
    });
  } catch (error) {
    console.error('Get tracking error:', error.message);

    res.status(500).send({
      success: false,
      message: 'Failed to fetch tracking info.',
    });
  }
};

module.exports = {
  getTracking,
};
