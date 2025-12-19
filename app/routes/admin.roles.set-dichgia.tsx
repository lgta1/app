import type { ActionFunctionArgs, MetaFunction } from 'react-router';
import { requireAdminLogin } from '~/.server/services/auth.server';
import { UserModel } from '~/database/models/user.model';
import { ROLES } from '~/constants/user';
import { BusinessError } from '~/helpers/errors.helper';
import { AdminActionLogModel } from '~/database/models/admin-action-log.model';

export const meta: MetaFunction = () => {
  return [
    { title: 'Set Dịch Giả | Admin' },
    { name: 'description', content: 'Gán quyền dịch giả cho user' },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdminLogin(request);
  const form = await request.formData();
  const userId = form.get('userId');

  if (!userId || typeof userId !== 'string') {
    return Response.json({ success: false, message: 'userId không hợp lệ' }, { status: 400 });
  }

  const user = await UserModel.findById(userId).select('role isDeleted');
  if (!user || user.isDeleted) {
    return Response.json({ success: false, message: 'User không tồn tại' }, { status: 404 });
  }

  if (user.role === ROLES.DICHGIA) {
    return Response.json({ success: true, message: 'User đã là dịch giả' });
  }

  // Không chuyển admin/mod thành dịch giả (giữ nguyên logic scope isolation)
  if (user.role === ROLES.ADMIN || user.role === ROLES.MOD) {
    return Response.json({ success: false, message: 'Không thể đổi vai trò của quản trị' }, { status: 400 });
  }

  await UserModel.findByIdAndUpdate(userId, { $set: { role: ROLES.DICHGIA } });

  try {
    await AdminActionLogModel.create({
      action: 'SET_ROLE_DICHGIA',
      adminId: admin.id,
      targetUserId: String(userId),
    } as any);
  } catch (e) {
    console.warn('[set-dichgia] log failed', e);
  }

  return Response.json({ success: true, message: 'Gán quyền dịch giả thành công' });
}

export default function SetDichGia() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4 text-txt-primary">Gán quyền Dịch giả</h1>
      <form method="post" className="flex items-center gap-2">
        <input name="userId" required placeholder="Nhập ID User" className="rounded border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm" />
        <button className="rounded bg-gradient-to-r from-[#C466FF] via-[#924DBF] to-[#C466FF] px-4 py-2 text-sm font-semibold text-black shadow">Set làm Dịch giả</button>
      </form>
      <p className="mt-4 text-xs text-txt-secondary">Chỉ ADMIN có thể thao tác. Không đổi vai trò Admin/Mod.</p>
    </div>
  );
}