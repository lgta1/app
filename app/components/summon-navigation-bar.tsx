import { NavLink } from "react-router";

interface NavigationBarProps {
  navItems: Array<{ label: string; to: string; id: string }>;
}

export function SummonNavigationBar({ navItems }: NavigationBarProps) {
  return (
    <div className="flex w-full items-center justify-center gap-2 py-2 sm:gap-4">
      {navItems.map((item) => (
        <NavLink
          key={item.id}
          to={item.to}
          className={({ isActive }) =>
            `${
              isActive
                ? "bg-btn-primary text-txt-inverse"
                : "bg-bgc-layer-semi-neutral text-txt-primary"
            } rounded-[32px] px-3 py-1.5 text-center text-xs leading-normal font-medium backdrop-blur-[3.4px] sm:text-base`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}
