import { PityModel } from "~/database/models/pity.model";

export async function loader() {
  try {
    const pitySettings = await PityModel.find({}).sort({ level: 1 }).lean();
    return Response.json({ success: true, data: pitySettings });
  } catch (error) {
    console.error("Error fetching pity settings:", error);
    return Response.json(
      { success: false, error: "Không thể lấy dữ liệu pity settings" },
      { status: 500 },
    );
  }
}
