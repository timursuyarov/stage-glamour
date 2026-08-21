import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useAuth, menuVisibility } from '@/contexts/AuthContext';
import { useCollectNotification } from '@/contexts/CollectNotificationContext';
import { useRequiredTransfersNotification } from '@/contexts/RequiredTransfersNotificationContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  PackageOpen,
  ShoppingCart,
  PackageSearch,
  PackageCheck,
  ClipboardCheck,
  RotateCcw,
  Truck,
  ArrowRightLeft,
  History,
  Warehouse,
  Users,
  Grid3X3,
  Box,
  ClipboardList,
  BarChart3,
  Gift,
  Printer,
  Landmark,
  LayoutDashboard,
  Upload,
  FileCheck,
  ArrowLeftRight,
  Repeat,
  Lightbulb,
  DatabaseZap,
  ChevronLeft,
  ChevronDown,
  Sparkles,
  LucideIcon,
} from 'lucide-react';

interface NavItem {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  href: string;
}

/** Parent menu with child links (e.g. Qaytarish -> Qaytarish, Qaytgan tovarlar tarixi) */
interface NavParent {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  children: { id: string; labelKey: string; href: string }[];
}

type NavEntry = NavItem | NavParent;

function isNavParent(entry: NavEntry): entry is NavParent {
  return 'children' in entry && Array.isArray((entry as NavParent).children);
}

interface NavGroup {
  id: string;
  items: NavEntry[];
}

// Flat navigation with groups for dividers; return is a parent with 2 children
const navigationGroups: NavGroup[] = [
  {
    id: 'operational',
    items: [
      {
        id: 'admission',
        labelKey: 'nav.admission',
        icon: PackageOpen,
        children: [
          { id: 'admissionList', labelKey: 'nav.admission', href: '/admission' },
          { id: 'admissionHistory', labelKey: 'nav.admissionHistory', href: '/admission/history' },
        ],
      },
      { id: 'relocation', labelKey: 'nav.relocation', icon:  PackageSearch, href: '/relocation' },
      { id: 'requiredStockTransfer', labelKey: 'nav.requiredStockTransfer', icon:ArrowRightLeft, href: '/required-transfers' },
      { id: 'collect', labelKey: 'nav.collect', icon:  PackageCheck, href: '/collect' },
      { id: 'picklists', labelKey: 'nav.picklists', icon: ClipboardList, href: '/picklists' },
      { id: 'validation', labelKey: 'nav.validation', icon: ClipboardCheck, href: '/validation' },
      {
        id: 'moveToRegion',
        labelKey: 'nav.moveToRegion',
        icon: Truck,
        children: [
          { id: 'moveToRegionList', labelKey: 'nav.moveToRegion', href: '/move-to-region' },
          { id: 'moveToRegionHistory', labelKey: 'nav.moveToRegionHistory', href: '/move-to-region/history' },
        ],
      },
      {
        id: 'return',
        labelKey: 'nav.return',
        icon: RotateCcw,
        children: [
          { id: 'returnDrafts', labelKey: 'nav.returnDrafts', href: '/returns/drafts' },
          { id: 'returnHistory', labelKey: 'nav.returnHistory', href: '/returns/history' },
        ],
      },
    ],
  },
  {
    id: 'masterData',
    items: [
      // { id: 'warehouse', labelKey: 'nav.warehouse', icon: Warehouse, href: '/warehouse' },
      { id: 'history', labelKey: 'nav.history', icon: History, href: '/history' },
      { id: 'employees', labelKey: 'nav.employees', icon: Users, href: '/employees' },
      { id: 'cells', labelKey: 'nav.cells', icon: Grid3X3, href: '/cells' },
      { id: 'goods', labelKey: 'nav.goods', icon: Box, href: '/goods' },
      {
        id: 'inventory',
        labelKey: 'nav.inventory',
        icon: ClipboardList,
        children: [
          { id: 'inventoryList', labelKey: 'nav.inventory', href: '/inventory' },
          { id: 'inventoryCountings', labelKey: 'nav.inventoryCountings', href: '/inventory-countings' },
        ],
      },
      // { id: 'reports', labelKey: 'nav.reports', icon: BarChart3, href: '/reports' },
      { id: 'bonuses', labelKey: 'nav.bonuses', icon: Gift, href: '/bonuses' },
      { id: 'labelPrint', labelKey: 'nav.labelPrint', icon: Printer, href: '/label-print' },
      { id: 'localData', labelKey: 'nav.localData', icon: DatabaseZap, href: '/local-data' },
    ],
  },
  // Accountant section — only visible to the `bugalter` role (see menuVisibility).
  {
    id: 'accounting',
    items: [
      { id: 'accountantDashboard', labelKey: 'nav.accountantDashboard', icon: LayoutDashboard, href: '/accountant/dashboard' },
      { id: 'bankStatements', labelKey: 'nav.bankStatements', icon: Landmark, href: '/bank-statements' },
      { id: 'loadedPayments', labelKey: 'nav.loadedPayments', icon: Upload, href: '/loaded-payments' },
      { id: 'actSverka', labelKey: 'nav.actSverka', icon: FileCheck, href: '/act-sverka' },
      { id: 'conversions', labelKey: 'nav.conversions', icon: ArrowLeftRight, href: '/conversions' },
      { id: 'conversionsUploaded', labelKey: 'nav.conversionsUploaded', icon: Repeat, href: '/conversions/uploaded' },
      { id: 'recommendations', labelKey: 'nav.recommendations', icon: Lightbulb, href: '/recommendations' },
    ],
  },
];

interface AppSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function AppSidebar({ collapsed, onCollapsedChange }: AppSidebarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const { hasCollectNotification } = useCollectNotification();
  const { hasRequiredTransfersNotification } = useRequiredTransfersNotification();

  const [openParentId, setOpenParentId] = useState<string | null>(null);

  const isReturnRoute = location.pathname.startsWith('/returns');
  const isInventoryRoute = location.pathname === '/inventory' || location.pathname.startsWith('/inventory-countings');
  const isAdmissionRoute = location.pathname === '/admission' || location.pathname.startsWith('/admission/');
  const isMoveToRegionRoute = location.pathname === '/move-to-region' || location.pathname.startsWith('/move-to-region/');
  useEffect(() => {
    if (isReturnRoute) setOpenParentId((prev) => (prev === 'return' ? prev : 'return'));
    else if (isInventoryRoute) setOpenParentId((prev) => (prev === 'inventory' ? prev : 'inventory'));
    else if (isAdmissionRoute) setOpenParentId((prev) => (prev === 'admission' ? prev : 'admission'));
    else if (isMoveToRegionRoute) setOpenParentId((prev) => (prev === 'moveToRegion' ? prev : 'moveToRegion'));
  }, [isReturnRoute, isInventoryRoute, isAdmissionRoute, isMoveToRegionRoute]);

  // When user is null (e.g. token exists but no stored employee) show all menus (admin)
  const visibleMenus = user ? menuVisibility[user.role] : menuVisibility.admin;

  const isItemVisible = (entry: NavEntry): boolean => {
    if (isNavParent(entry)) return visibleMenus.includes(entry.id);
    return visibleMenus.includes(entry.id);
  };

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    if (href === '/inventory') return location.pathname === '/inventory';
    if (href === '/admission') return location.pathname === '/admission';
    if (href === '/move-to-region') return location.pathname === '/move-to-region';
    return location.pathname.startsWith(href);
  };

  // Filter groups to only show visible items (parents count as one)
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(isItemVisible),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">{t('app.name')}</span>
              <span className="text-[10px] text-sidebar-muted uppercase tracking-wider">{t('app.subtitle')}</span>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent',
            collapsed && 'mx-auto'
          )}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 px-2">
        <div className="space-y-2">
          {visibleGroups.map((group, groupIndex) => (
            <div key={group.id}>
              {/* Divider between groups */}
              {groupIndex > 0 && (
                <Separator className="my-3 bg-sidebar-border" />
              )}

              {/* Group items */}
              <div className="space-y-1">
                {group.items.map((entry) => {
                  if (isNavParent(entry)) {
                    const parent = entry;
                    const isChildActive = parent.children.some((c) =>
                      isActive(c.href)
                    );
                    if (collapsed) {
                      return (
                        <NavLink
                          key={parent.id}
                          to={parent.children[0]?.href ?? '#'}
                          className={cn(
                            'flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors',
                            isChildActive
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                            'justify-center px-0'
                          )}
                          title={t(parent.labelKey)}
                        >
                          <parent.icon className="w-5 h-5 flex-shrink-0" />
                        </NavLink>
                      );
                    }
                    const isOpen = openParentId === parent.id;
                    return (
                      <div key={parent.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setOpenParentId((prev) => (prev === parent.id ? null : parent.id))}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors',
                            isChildActive
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                          )}
                        >
                          <parent.icon className="w-5 h-5 flex-shrink-0" />
                          <span className="flex-1 text-left">{t(parent.labelKey)}</span>
                          <ChevronDown
                            className={cn(
                              'w-4 h-4 flex-shrink-0 transition-transform duration-200',
                              isOpen && 'rotate-180'
                            )}
                          />
                        </button>
                        {isOpen &&
                          parent.children.map((child) => (
                            <NavLink
                              key={child.id}
                              to={child.href}
                              className={cn(
                                'flex items-center gap-3 pl-8 pr-3 h-9 rounded-lg text-sm font-medium transition-colors',
                                isActive(child.href)
                                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                  : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                              )}
                            >
                              <span>{t(child.labelKey)}</span>
                            </NavLink>
                          ))}
                      </div>
                    );
                  }
                  const item = entry as NavItem;
                  return (
                    <NavLink
                      key={item.id}
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors',
                        isActive(item.href)
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                        collapsed && 'justify-center px-0'
                      )}
                      title={collapsed ? t(item.labelKey) : undefined}
                    >
                      <span className="relative inline-flex">
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {item.id === 'collect' && hasCollectNotification && (
                          <span
                            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive"
                            aria-hidden
                          />
                        )}
                        {item.id === 'requiredStockTransfer' &&
                          hasRequiredTransfersNotification && (
                            <span
                              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive"
                              aria-hidden
                            />
                          )}
                      </span>
                      {!collapsed && <span>{t(item.labelKey)}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-[10px] text-sidebar-muted text-center">
            {t('app.footer')}
          </div>
        </div>
      )}
    </aside>
  );
}
