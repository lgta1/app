import toast from "react-hot-toast";
import { TriangleAlert } from "lucide-react";

export const toastWarning = (message: string) => {
  return toast(message, {
    icon: <TriangleAlert className="h-5 w-5 text-amber-500" />,
  });
};
