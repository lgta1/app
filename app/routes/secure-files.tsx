import type { Route } from "./+types/secure-files";

import { FileManager } from "~/components/file-manager";
import { requireAdminLogin } from "~/helpers/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  // Require authentication
  await requireAdminLogin(request);
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Secure File Management" },
    {
      name: "description",
      content: "Secure file upload và management với server-side protection",
    },
  ];
}

export default function SecureFiles() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Quản lý File</h1>
          <p className="mt-2 text-gray-600">
            Upload, quản lý và tải xuống các file của bạn một cách an toàn
          </p>
        </div>

        <FileManager
          bucket="uploads"
          category="user-files"
          allowMultiple={true}
          maxFileSize={10}
          allowedTypes={[
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "application/pdf",
            "text/plain",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ]}
        />
      </div>
    </div>
  );
}
