export type IconName =
  | "Home"
  | "ChefHat"
  | "FileText"
  | "ShoppingCart"
  | "BarChart3"
  | "Settings"
  | "Brain"
  | "TrendingUp"
  | "Users"
  | "Shield"
  | "LayoutDashboard"
  | "Plus"
  | "List"
  | "GitCompare"
  | "Target"
  | "Bell";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  {
    label: "Ana Panel",
    href: "/",
    icon: "Home",
  },
  {
    label: "Menü Yönetimi",
    href: "/menu",
    icon: "ChefHat",
    children: [
      { label: "Menü Havuzu", href: "/menu-planner", icon: "ChefHat" },
    ],
  },
  {
    label: "İhale Merkezi",
    href: "/ihale",
    icon: "FileText",
    children: [
      { label: "Dashboard", href: "/ihale", icon: "LayoutDashboard" },
      { label: "Yeni Analiz", href: "/ihale/yeni-analiz", icon: "Plus" },
      { label: "İhale Listesi", href: "/ihale/liste", icon: "List" },
      { label: "Karşılaştırma", href: "/ihale/karsilastirma", icon: "GitCompare" },
      { label: "🆕 İhale Takip (Otomatik)", href: "/ihale-takip", icon: "Target" },
    ],
  },
  {
    label: "Market Fiyatları",
    href: "/price-feed",
    icon: "ShoppingCart",
  },
  {
    label: "Raporlar",
    href: "/analytics",
    icon: "BarChart3",
  },
  {
    label: "Sistem Yönetimi",
    href: "/system",
    icon: "Settings",
    children: [
      { label: "AI Ayarları", href: "/ai-settings", icon: "Brain" },
      { label: "Performans İzleme", href: "/health-monitor", icon: "TrendingUp" },
      { label: "Kullanıcı Yönetimi", href: "/users", icon: "Users" },
      { label: "Güvenlik", href: "/security", icon: "Shield" },
    ],
  },
];

export const bottomNavItems: NavItem[] = [
  { label: "AI Durumu", href: "/ai-status", icon: "Brain" },
  { label: "Profil", href: "/profile", icon: "Users" },
];
