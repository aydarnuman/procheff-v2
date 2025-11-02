"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Menu, X, Activity } from "lucide-react";
import * as Icons from "lucide-react";
import {
  navItems,
  bottomNavItems,
  type NavItem,
  type IconName,
} from "@/lib/navigation/navConfig";

// Icon helper
const getIcon = (iconName: IconName) => {
  const IconComponent = Icons[iconName as keyof typeof Icons] as React.ComponentType<{ className?: string }>;
  return IconComponent;
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href)
        ? prev.filter((item) => item !== href)
        : [...prev, href]
    );
  };

  const isActive = (item: NavItem): boolean => {
    if (item.href === "/" && pathname === "/") return true;
    if (item.href !== "/" && pathname.startsWith(item.href)) return true;
    if (item.children) {
      return item.children.some((child) => pathname.startsWith(child.href));
    }
    return false;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800/40">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">
                  ProCheff AI
                </h2>
                <p className="text-gray-400 text-xs">v8.3.1 Pro</p>
              </div>
            </motion.div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors hidden lg:flex items-center justify-center"
            title="Kenar çubuğunu daralt/genişlet"
          >
            <Menu className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            collapsed={collapsed}
            expanded={expandedItems.includes(item.href)}
            onToggleExpanded={() => toggleExpanded(item.href)}
            isActive={isActive(item)}
            pathname={pathname}
          />
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-gray-800/40 space-y-2">
        {/* AI Durumu */}
        <div
          className={`flex items-center space-x-3 p-3 rounded-lg bg-[rgba(34,197,94,0.1)] border border-green-500/30 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="flex items-center justify-center">
            <Activity className="w-4 h-4 text-green-400" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-green-400 text-xs font-medium">
                AI Sistemi Aktif
              </p>
              <p className="text-green-300 text-xs opacity-75">
                Son analiz: 2 dk önce
              </p>
            </div>
          )}
        </div>

        {/* Bottom Nav Items */}
        {bottomNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors ${
              pathname === item.href
                ? "bg-[rgba(79,70,229,0.2)] border border-blue-500/30"
                : ""
            } ${collapsed ? "justify-center" : ""}`}
          >
            {(() => {
              const Icon = getIcon(item.icon);
              return <Icon
                className={`w-4 h-4 ${
                  pathname === item.href ? "text-blue-400" : "text-gray-400"
                }`}
              />;
            })()}
            {!collapsed && (
              <span
                className={`text-sm ${
                  pathname === item.href ? "text-blue-300" : "text-gray-300"
                }`}
              >
                {item.label}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? "80px" : "280px" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="hidden lg:flex flex-col bg-[rgba(20,20,30,0.8)] backdrop-blur-xl border-r border-gray-800/40 h-screen sticky top-0"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-[rgba(20,20,30,0.9)] backdrop-blur-xl border border-gray-800/40 flex items-center justify-center"
        title="Menüyü aç"
      >
        <Menu className="w-5 h-5 text-white" />
      </button>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="lg:hidden fixed left-0 top-0 h-full w-80 bg-[rgba(20,20,30,0.95)] backdrop-blur-xl border-r border-gray-800/40 z-50"
            >
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors flex items-center justify-center"
                  title="Menüyü kapat"
                >
                  <X className="w-4 h-4 text-gray-300" />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

interface NavItemProps {
  item: NavItem;
  collapsed: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  isActive: boolean;
  pathname: string;
}

function NavItemComponent({
  item,
  collapsed,
  expanded,
  onToggleExpanded,
  isActive,
  pathname,
}: NavItemProps) {
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={onToggleExpanded}
          className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors ${
            isActive ? "bg-[rgba(79,70,229,0.2)] border border-blue-500/30" : ""
          } ${collapsed ? "justify-center" : ""}`}
        >
          <div className="flex items-center space-x-3">
            {(() => {
              const Icon = getIcon(item.icon);
              return <Icon
                className={`w-4 h-4 ${
                  isActive ? "text-blue-400" : "text-gray-400"
                }`}
              />;
            })()}
            {!collapsed && (
              <span
                className={`text-sm font-medium ${
                  isActive ? "text-blue-300" : "text-gray-300"
                }`}
              >
                {item.label}
              </span>
            )}
          </div>
          {!collapsed && (
            <motion.div
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </motion.div>
          )}
        </button>

        <AnimatePresence>
          {expanded && !collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="ml-4 mt-2 space-y-1 border-l border-gray-700/50 pl-4"
            >
              {item.children?.map((child) => {
                const ChildIcon = getIcon(child.icon);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`flex items-center space-x-3 p-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors ${
                      pathname === child.href
                        ? "bg-[rgba(79,70,229,0.15)] text-blue-300"
                        : "text-gray-400"
                    }`}
                  >
                    <ChildIcon className="w-3 h-3" />
                    <span className="text-xs">{child.label}</span>
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors ${
        isActive ? "bg-[rgba(79,70,229,0.2)] border border-blue-500/30" : ""
      } ${collapsed ? "justify-center" : ""}`}
    >
      {(() => {
        const Icon = getIcon(item.icon);
        return <Icon
          className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-gray-400"}`}
        />;
      })()}
      {!collapsed && (
        <span
          className={`text-sm font-medium ${
            isActive ? "text-blue-300" : "text-gray-300"
          }`}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}
