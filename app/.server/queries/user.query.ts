import { ROLES } from "~/constants/user";
import { UserModel } from "~/database/models/user.model";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";

export const getTopUser = async (limit: number = 10) => {
  const users = await UserModel.find({
    role: ROLES.USER,
    isDeleted: false,
    isBanned: false,
  })
    .sort({ level: -1, exp: -1, createdAt: 1 })
    .limit(Math.max(1, limit))
    .select("-password -salt")
    .lean();

  return (users as any[]).map((u) => ({
    ...u,
    avatar: typeof u?.avatar === "string" ? rewriteLegacyCdnUrl(u.avatar) : u?.avatar,
  }));
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

  const users = await UserModel.find(query)
    .sort(sortOrder)
    .select("-password -salt")
    .skip(skip)
    .limit(limit)
    .lean();

  return (users as any[]).map((u) => ({
    ...u,
    avatar: typeof u?.avatar === "string" ? rewriteLegacyCdnUrl(u.avatar) : u?.avatar,
  }));
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

  const users = await UserModel.find(query)
    .sort({ createdAt: -1 })
    .select("-password -salt")
    .lean();

  return (users as any[]).map((u) => ({
    ...u,
    avatar: typeof u?.avatar === "string" ? rewriteLegacyCdnUrl(u.avatar) : u?.avatar,
  }));
};

export const getListDichGia = async (search?: string) => {
  const query: any = {
    role: ROLES.DICHGIA,
    isDeleted: false,
  };
  if (search && search.trim()) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  const users = await UserModel.find(query)
    .sort({ createdAt: -1 })
    .select('-password -salt')
    .lean();

  return (users as any[]).map((u) => ({
    ...u,
    avatar: typeof u?.avatar === "string" ? rewriteLegacyCdnUrl(u.avatar) : u?.avatar,
  }));
};
