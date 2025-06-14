import {
  type LoaderFunctionArgs,
  type MetaFunction,
  Outlet,
  redirect,
} from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Bảng xếp hạng | WuxiaWorld" },
    {
      name: "description",
      content: "Xem bảng xếp hạng truyện và thành viên tại WuxiaWorld",
    },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.pathname === "/leaderboard") {
    return redirect("/leaderboard/manga");
  }
};

export default function Layout() {
  return <Outlet />;
}
