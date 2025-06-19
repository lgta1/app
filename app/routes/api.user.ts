import type { LoaderFunctionArgs } from "react-router";

import { getUserInfoFromSession } from "@/services/session.svc";

import { UserModel } from "~/database/models/user.model";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getUserInfoFromSession(request);
    if (!user) {
      return Response.json({ success: true, data: null });
    }
    const userFull = await UserModel.findById(user?.id).lean();
    return Response.json({ success: true, data: userFull });
  } catch (error) {
    return Response.json(
      { success: false, error: "Không thể lấy dữ liệu user info" },
      { status: 500 },
    );
  }
}
