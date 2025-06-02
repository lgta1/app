// Helper function to calculate status
export const getBannerStatus = (
  startDate: Date,
  endDate: Date,
): "running" | "upcoming" | "ended" => {
  const now = new Date();

  if (endDate < now) {
    return "ended";
  } else if (startDate <= now && endDate >= now) {
    return "running";
  } else {
    return "upcoming";
  }
};
