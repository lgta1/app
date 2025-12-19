import React from "react";
import { useLocation } from "react-router-dom";
import { Copy, Facebook, Twitter, Send, MessageCircle } from "lucide-react";

type ShareButtonsProps = {
  title: string;
  className?: string;
};

// Small, unobtrusive share buttons block
export function ShareButtons({ title, className }: ShareButtonsProps) {
  const location = useLocation();
  const defaultOrigin = typeof window !== "undefined" ? window.location.origin : "https://vinahentai.com";
  const defaultUrl = `${defaultOrigin}${location.pathname}${location.search}`;
  const [shareUrl, setShareUrl] = React.useState(defaultUrl);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href.split("#")[0]);
    }
  }, [location]);

  const encoded = encodeURIComponent(shareUrl || defaultUrl);
  const text = encodeURIComponent(title);

  const items: { label: string; href?: string; onClick?: () => void; icon: React.ReactNode; aria: string }[] = [
    {
      label: copied ? "Đã sao chép" : "Sao chép",
      onClick: () => {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }).catch(() => {});
        }
      },
      icon: <Copy className="h-3.5 w-3.5" />,
      aria: "Sao chép liên kết"
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
      icon: <Facebook className="h-3.5 w-3.5" />,
      aria: "Chia sẻ lên Facebook"
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encoded}&text=${text}`,
      icon: <Twitter className="h-3.5 w-3.5" />,
      aria: "Chia sẻ lên X (Twitter)"
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encoded}&text=${text}`,
      icon: <Send className="h-3.5 w-3.5" />,
      aria: "Chia sẻ lên Telegram"
    },
    {
      label: "Messenger",
      href: `https://www.facebook.com/dialog/send?link=${encoded}`,
      icon: <MessageCircle className="h-3.5 w-3.5" />,
      aria: "Chia sẻ lên Messenger"
    },
  ];

  return (
    <div className={"mt-4 flex flex-col gap-1 " + (className || "")}>
      <div className="text-txt-secondary text-xs font-medium">Chia sẻ truyện này:</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((item) => {
          const commonClass = "flex items-center gap-1 rounded-md border border-bd-default bg-bgc-layer1 px-2 py-1 text-[11px] font-medium text-txt-secondary hover:text-txt-primary hover:bg-white/5 transition-colors";
          if (item.onClick) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                aria-label={item.aria}
                className={commonClass}
              >
                {item.icon}
                <span className="select-none">{item.label}</span>
              </button>
            );
          }
          return (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.aria}
              className={commonClass}
            >
              {item.icon}
              <span className="select-none">{item.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default ShareButtons;