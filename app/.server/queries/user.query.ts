import { ROLES } from "~/constants/user";
import { UserModel } from "~/database/models/user.model";

export const getTopUser = async () => {
  return await UserModel.find({
    role: ROLES.USER,
    isDeleted: false,
    isBanned: false,
  })
    .sort({ exp: -1 })
    .limit(10)
    .select("-password -salt")
    .lean();
};

export const getListUser = async (
  page: number = 1,
  limit: number = 10,
  search?: string,
  sortBy: string = "newest",
) => {
  const skip = (page - 1) * limit;
  const query: any = {
    role: ROLES.USER,
    isDeleted: false,
  };

  if (search && search.trim()) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  // Determine sort order based on sortBy parameter
  let sortOrder: any = { createdAt: -1 }; // Default to newest

  switch (sortBy) {
    case "newest":
      sortOrder = { createdAt: -1 };
      break;
    case "oldest":
      sortOrder = { createdAt: 1 };
      break;
    case "most_manga":
      sortOrder = { mangasCount: -1, createdAt: -1 };
      break;
    case "least_manga":
      sortOrder = { mangasCount: 1, createdAt: -1 };
      break;
    case "most_warnings":
      sortOrder = { warningsCount: -1, createdAt: -1 };
      break;
    case "highest_level":
      sortOrder = { level: -1, exp: -1, createdAt: -1 };
      break;
    case "lowest_level":
      sortOrder = { level: 1, exp: 1, createdAt: -1 };
      break;
    default:
      sortOrder = { createdAt: -1 };
  }

  return await UserModel.find(query)
    .sort(sortOrder)
    .select("-password -salt")
    .skip(skip)
    .limit(limit)
    .lean();
};

export const getTotalUserCount = async (search?: string) => {
  const query: any = {
    role: ROLES.USER,
    isDeleted: false,
  };

  if (search && search.trim()) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  return await UserModel.countDocuments(query);
};

export const getListModAndAdmin = async (search?: string) => {
  const query: any = {
    role: { $in: [ROLES.MOD, ROLES.ADMIN] },
    isDeleted: false,
  };

  if (search && search.trim()) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  return await UserModel.find(query)
    .sort({ createdAt: -1 })
    .select("-password -salt")
    .lean();
};
