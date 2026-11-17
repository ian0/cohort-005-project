// PROTOTYPE — throwaway. Answers "What does the Notification Feed look like in
// Cadence?" (https://github.com/ian0/cohort-005-project/issues/16). Lives on
// the prototype/notification-feed branch only; never merge to main.
//
// Three variants of the Notification Feed, mounted in the real app layout and
// switchable with ?variant=A|B|C (or the floating bar / ← → keys):
//   A — Bell popover: bell in the sidebar header, a popover beside the sidebar.
//       Badge counts UNSEEN; opening the popover marks everything seen.
//   B — Inbox page: a "Notifications" sidebar item with an UNREAD count, and a
//       full /notifications page with Unread/All tabs, grouped by day.
//   C — Drawer: a bell by the user's name, a dot only, opening a full-height
//       right-hand drawer with filter chips by area.
// Everything Knock-side runs in the browser against Knock's headless feed API
// with the public key plus a user token our server signed for the DevUI user.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  NavLink,
  useFetcher,
  useNavigate,
  useSearchParams,
} from "react-router";
import {
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Receipt,
  Settings,
  Star,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";

// ─── Feed data (shared by every variant) ───

export type FeedConfig = {
  publicApiKey: string;
  feedChannelId: string;
  userToken: string;
  knockUserId: string;
};

type FeedItem = {
  id: string;
  inserted_at: string;
  read_at: string | null;
  seen_at: string | null;
  blocks: { name: string; rendered: string }[];
  data: { kind?: string; url?: string } | null;
  actors: { id: string; name?: string }[];
};

type Feed = {
  items: FeedItem[];
  unreadCount: number;
  unseenCount: number;
  markRead: (ids: string[]) => Promise<void>;
  markUnread: (ids: string[]) => Promise<void>;
  markAllSeen: () => Promise<void>;
  markAllRead: () => Promise<void>;
  open: (item: FeedItem) => Promise<void>;
};

const FeedContext = createContext<Feed | null>(null);

export function useFeed() {
  return useContext(FeedContext);
}

export function NotificationFeedProvider({
  config,
  children,
}: {
  config: FeedConfig | null;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [meta, setMeta] = useState({ unread_count: 0, unseen_count: 0 });

  const api = useCallback(
    async (method: string, path: string, body?: unknown) => {
      if (!config) return null;
      const res = await fetch(`https://api.knock.app${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${config.publicApiKey}`,
          "X-Knock-User-Token": config.userToken,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return res.ok ? res.json() : null;
    },
    [config]
  );

  const load = useCallback(async () => {
    if (!config) return;
    const json = await api(
      "GET",
      `/v1/users/${config.knockUserId}/feeds/${config.feedChannelId}?page_size=50`
    );
    if (json) {
      setItems(json.entries);
      setMeta(json.meta);
    }
  }, [api, config]);

  useEffect(() => {
    setItems([]);
    setMeta({ unread_count: 0, unseen_count: 0 });
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const batch = useCallback(
    async (status: string, ids: string[]) => {
      if (ids.length === 0) return;
      await api("POST", `/v1/messages/batch/${status}`, { message_ids: ids });
      await load();
    },
    [api, load]
  );

  const feed = useMemo<Feed>(
    () => ({
      items,
      unreadCount: meta.unread_count,
      unseenCount: meta.unseen_count,
      markRead: (ids) => batch("read", ids),
      markUnread: (ids) => batch("unread", ids),
      markAllSeen: () =>
        batch(
          "seen",
          items.filter((i) => !i.seen_at).map((i) => i.id)
        ),
      markAllRead: () =>
        batch(
          "read",
          items.filter((i) => !i.read_at).map((i) => i.id)
        ),
      open: async (item) => {
        if (!item.read_at) batch("read", [item.id]);
        if (item.data?.url) navigate(item.data.url);
      },
    }),
    [items, meta, batch, navigate]
  );

  return <FeedContext.Provider value={feed}>{children}</FeedContext.Provider>;
}

// ─── Shared bits ───

const KIND: Record<
  string,
  { icon: React.ReactNode; tone: string; area: Area }
> = {
  "open-refund-request": {
    icon: <Receipt className="size-4" />,
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    area: "Refunds",
  },
  "approved-refund-request": {
    icon: <Receipt className="size-4" />,
    tone: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    area: "Refunds",
  },
  "declined-refund-request": {
    icon: <Receipt className="size-4" />,
    tone: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    area: "Refunds",
  },
  "discussion-question": {
    icon: <MessageSquare className="size-4" />,
    tone: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    area: "Discussions",
  },
  "discussion-reply": {
    icon: <MessageSquare className="size-4" />,
    tone: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    area: "Discussions",
  },
  "new-enrollment": {
    icon: <UserPlus className="size-4" />,
    tone: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    area: "Courses",
  },
  rating: {
    icon: <Star className="size-4" />,
    tone: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    area: "Courses",
  },
  "claimed-seat": {
    icon: <UsersRound className="size-4" />,
    tone: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    area: "Courses",
  },
};
type Area = "Refunds" | "Discussions" | "Courses";
const fallbackKind = {
  icon: <Bell className="size-4" />,
  tone: "bg-muted text-muted-foreground",
  area: "Courses" as Area,
};
const kindOf = (item: FeedItem) => KIND[item.data?.kind ?? ""] ?? fallbackKind;

function Body({ item, className }: { item: FeedItem; className?: string }) {
  return (
    <div
      className={cn("[&_p]:m-0 [&_strong]:font-semibold", className)}
      dangerouslySetInnerHTML={{
        __html: item.blocks.find((b) => b.name === "body")?.rendered ?? "",
      }}
    />
  );
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Initials({ name }: { name?: string }) {
  const text = (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
      {text}
    </span>
  );
}

function Empty() {
  return (
    <div className="p-8 text-center text-sm text-muted-foreground">
      You're all caught up.
    </div>
  );
}

// ─── Variant A: bell popover ───

export function VariantABell() {
  const feed = useFeed();
  const [open, setOpen] = useState(false);
  if (!feed) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) feed!.markAllSeen();
  }

  return (
    <>
      <button
        onClick={toggle}
        title="Notifications"
        className="relative ml-auto rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
      >
        <Bell className="size-5" />
        {feed.unseenCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {feed.unseenCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed left-52 top-3 z-50 flex max-h-[80vh] w-96 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="font-semibold">Notifications</span>
              <button
                onClick={feed.markAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all as read
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto">
              {feed.items.length === 0 && <Empty />}
              {feed.items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      feed.open(item);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 border-b px-4 py-3 text-left text-sm hover:bg-muted/60",
                      !item.read_at && "bg-primary/5"
                    )}
                  >
                    <Initials name={item.actors[0]?.name} />
                    <div className="min-w-0 flex-1">
                      <Body item={item} />
                      <div className="mt-1 text-xs text-muted-foreground">
                        {ago(item.inserted_at)}
                      </div>
                    </div>
                    {!item.read_at && (
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <NavLink
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground hover:bg-muted/60"
            >
              <Settings className="size-3" /> Notification settings
            </NavLink>
          </div>
        </>
      )}
    </>
  );
}

// ─── Variant B: sidebar item + full inbox page ───

export function VariantBNavItem() {
  const feed = useFeed();
  if (!feed) return null;
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Bell className="size-4" />
      Notifications
      {feed.unreadCount > 0 && (
        <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
          {feed.unreadCount}
        </span>
      )}
    </NavLink>
  );
}

export function VariantBPage() {
  const feed = useFeed();
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const unseen = feed?.unseenCount ?? 0;

  // Visiting the page counts as seeing everything on it.
  useEffect(() => {
    if (feed && unseen > 0) feed.markAllSeen();
  }, [unseen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!feed) return null;
  const shown = feed.items.filter((i) => tab === "all" || !i.read_at);
  const today = new Date().toDateString();
  const groups: [string, FeedItem[]][] = [
    [
      "Today",
      shown.filter((i) => new Date(i.inserted_at).toDateString() === today),
    ],
    [
      "Earlier",
      shown.filter((i) => new Date(i.inserted_at).toDateString() !== today),
    ],
  ];

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {feed.unreadCount} unread
          </p>
        </div>
        <button
          onClick={feed.markAllRead}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <CheckCheck className="size-4" /> Mark all as read
        </button>
      </div>
      <div className="mb-4 flex gap-1 border-b">
        {(["unread", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize",
              tab === t
                ? "border-primary"
                : "border-transparent text-muted-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {shown.length === 0 && <Empty />}
      {groups
        .filter(([, list]) => list.length > 0)
        .map(([label, list]) => (
          <section key={label} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </h2>
            <ul className="divide-y rounded-lg border">
              {list.map((item) => {
                const k = kindOf(item);
                return (
                  <li
                    key={item.id}
                    className="group flex items-center gap-4 p-4"
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full",
                        k.tone
                      )}
                    >
                      {k.icon}
                    </span>
                    <button
                      onClick={() => feed.open(item)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <Body
                        item={item}
                        className={cn(!item.read_at && "font-medium")}
                      />
                      <div className="mt-1 text-xs text-muted-foreground">
                        {k.area} · {ago(item.inserted_at)}
                      </div>
                    </button>
                    <button
                      onClick={() =>
                        item.read_at
                          ? feed.markUnread([item.id])
                          : feed.markRead([item.id])
                      }
                      className="rounded-md border px-2 py-1 text-xs text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"
                    >
                      {item.read_at ? "Mark unread" : "Mark read"}
                    </button>
                    {!item.read_at && (
                      <span className="size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}

// ─── Variant C: right-hand drawer ───

export function VariantCDrawer() {
  const feed = useFeed();
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState<Area | "All">("All");
  if (!feed) return null;

  const shown = feed.items.filter(
    (i) => area === "All" || kindOf(i).area === area
  );

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          feed.markAllSeen();
        }}
        title="Notifications"
        className="relative rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-4" />
        {feed.unseenCount > 0 && (
          <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-red-500" />
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-[420px] flex-col border-l bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <div className="text-lg font-semibold">Notifications</div>
                <div className="text-xs text-muted-foreground">
                  {feed.unreadCount} unread
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={feed.markAllRead}
                  title="Mark all as read"
                  className="rounded-md p-2 hover:bg-muted"
                >
                  <CheckCheck className="size-4" />
                </button>
                <NavLink
                  to="/settings"
                  onClick={() => setOpen(false)}
                  title="Notification settings"
                  className="rounded-md p-2 hover:bg-muted"
                >
                  <Settings className="size-4" />
                </NavLink>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md p-2 hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-2 border-b px-5 py-3">
              {(["All", "Refunds", "Discussions", "Courses"] as const).map(
                (a) => (
                  <button
                    key={a}
                    onClick={() => setArea(a)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs",
                      area === a
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {a}
                  </button>
                )
              )}
            </div>
            <ul className="flex-1 overflow-y-auto">
              {shown.length === 0 && <Empty />}
              {shown.map((item) => {
                const k = kindOf(item);
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "group flex items-center gap-3 border-b px-5 py-2.5 text-sm",
                      item.read_at && "text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md",
                        k.tone
                      )}
                    >
                      {k.icon}
                    </span>
                    <button
                      onClick={() => {
                        setOpen(false);
                        feed.open(item);
                      }}
                      className="min-w-0 flex-1 truncate text-left"
                    >
                      <Body item={item} className="truncate [&_p]:truncate" />
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground group-hover:hidden">
                      {ago(item.inserted_at)}
                    </span>
                    {!item.read_at && (
                      <button
                        onClick={() => feed.markRead([item.id])}
                        title="Mark read"
                        className="hidden shrink-0 rounded p-1 hover:bg-muted group-hover:block"
                      >
                        <Check className="size-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        </>
      )}
    </>
  );
}

// ─── Floating variant switcher ───

export const VARIANTS = [
  { key: "A", name: "Bell popover" },
  { key: "B", name: "Inbox page" },
  { key: "C", name: "Drawer" },
] as const;
export type VariantKey = (typeof VARIANTS)[number]["key"];

export function useVariant(): VariantKey {
  const [params] = useSearchParams();
  const fromUrl = params.get("variant");
  const [stored, setStored] = useState<string | null>(null);
  useEffect(() => {
    if (fromUrl) localStorage.setItem("prototype-feed-variant", fromUrl);
    setStored(localStorage.getItem("prototype-feed-variant"));
  }, [fromUrl]);
  const v = fromUrl ?? stored ?? "A";
  return (VARIANTS.some((x) => x.key === v) ? v : "A") as VariantKey;
}

export function PrototypeSwitcher({ current }: { current: VariantKey }) {
  const [params, setParams] = useSearchParams();
  const fetcher = useFetcher();
  const i = VARIANTS.findIndex((v) => v.key === current);

  const go = useCallback(
    (delta: number) => {
      const next = VARIANTS[(i + delta + VARIANTS.length) % VARIANTS.length];
      const p = new URLSearchParams(params);
      p.set("variant", next.key);
      setParams(p, { replace: true });
    },
    [i, params, setParams]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-2 py-1.5 text-sm text-white shadow-lg ring-2 ring-amber-400">
      <button
        onClick={() => go(-1)}
        className="rounded-full p-1 hover:bg-white/10"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-36 text-center font-medium">
        {current} ({VARIANTS[i].name})
      </span>
      <button
        onClick={() => go(1)}
        className="rounded-full p-1 hover:bg-white/10"
      >
        <ChevronRight className="size-4" />
      </button>
      <fetcher.Form method="post" action="/notifications">
        <input type="hidden" name="intent" value="send-samples" />
        <button
          className="flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-zinc-900 hover:bg-amber-300"
          disabled={fetcher.state !== "idle"}
        >
          <BookOpen className="size-3" />
          {fetcher.state !== "idle" ? "Sending…" : "Send me samples"}
        </button>
      </fetcher.Form>
    </div>
  );
}
