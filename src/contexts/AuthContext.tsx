import React, { createContext, useContext, useState, ReactNode } from 'react';
import { getStoredToken, getStoredEmployee, type LoginEmployee } from '@/lib/authStorage';

/** Backend sends jobTitle: "Admin" | "Tekshiruvchi" | "Qaytaruvchi" | "Bugalter" */
export type UserRole = 'admin' | 'validator' | 'returner' | 'bugalter';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  employeeId: string;
}

/** Map backend jobTitle to UserRole. Role is derived from employee.jobTitle. */
export function jobTitleToRole(jobTitle: string): UserRole {
  const t = (jobTitle || '').trim().toLowerCase();
  if (t === 'admin') return 'admin';
  if (t === 'tekshiruvchi') return 'validator';
  if (t === 'qaytaruvchi') return 'returner';
  if (t === 'bugalter' || t === 'buxgalter') return 'bugalter';
  return 'admin';
}

/** Map login API employee to User. Role is taken from employee.jobTitle. */
export function userFromEmployee(employee: LoginEmployee): User {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(' ') || '—';
  const role = jobTitleToRole(employee.jobTitle);
  return {
    id: String(employee.employeeId),
    name,
    role,
    employeeId: String(employee.employeeId),
  };
}

function getInitialUser(): User | null {
  const token = getStoredToken();
  if (!token) return null;
  const employee = getStoredEmployee();
  if (!employee) return null;
  return userFromEmployee(employee);
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  hasPermission: (module: string, action: string) => boolean;
}

// RBAC Permissions Matrix (admin = all; validator = validation; returner = return)
const permissions: Record<UserRole, Record<string, string[]>> = {
  admin: {
    admission: ['create', 'edit', 'view'],
    order: ['manage', 'view'],
    collect: ['manage', 'view'],
    validation: ['approve', 'reject', 'view'],
    return: ['manage', 'create', 'edit', 'view'],
    masterData: ['view'],
    move: ['initiate', 'view'],
    relocation: ['initiate', 'view'],
    history: ['view'],
    warehouse: ['view'],
    employees: ['view'],
    cells: ['view'],
    goods: ['view'],
    inventory: ['view'],
    reports: ['view'],
  },
  validator: {
    admission: [],
    order: [],
    collect: [],
    validation: ['approve', 'reject', 'view'],
    return: [],
    masterData: [],
    move: [],
    relocation: [],
    history: [],
    warehouse: [],
    employees: [],
    cells: [],
    goods: [],
    inventory: [],
    reports: [],
  },
  returner: {
    admission: [],
    order: [],
    collect: [],
    validation: [],
    return: ['manage', 'create', 'edit', 'view'],
    masterData: [],
    move: [],
    relocation: [],
    history: [],
    warehouse: [],
    employees: [],
    cells: [],
    goods: [],
    inventory: [],
    reports: [],
  },
  bugalter: {
    admission: [],
    order: [],
    collect: [],
    validation: [],
    return: [],
    masterData: [],
    move: [],
    relocation: [],
    history: [],
    warehouse: [],
    employees: [],
    cells: [],
    goods: [],
    inventory: [],
    reports: [],
  },
};

// Menu visibility: Admin = everything; Tekshiruvchi = validation; Qaytaruvchi = return (parent + children)
export const menuVisibility: Record<UserRole, string[]> = {
  admin: [
    'admission', 'relocation', 'requiredStockTransfer', 'collect', 'picklists', 'validation',
    'moveToRegion', 'return', 'history', 'employees', 'cells', 'goods', 'inventory', 'inventoryCountings', 'bonuses', 'labelPrint',
    // Destructive maintenance screen — admin only.
    'localData',
  ],
  validator: ['validation', 'history', 'cells', 'goods'],
  returner: ['return'],
  // Accountant-only: these pages are visible to and reachable by bugalter only.
  bugalter: [
    'accountantDashboard', 'bankStatements', 'loadedPayments', 'actSverka',
    'conversions', 'conversionsUploaded', 'recommendations',
  ],
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getInitialUser);

  const hasPermission = (module: string, action: string): boolean => {
    if (!user) return false;
    const rolePermissions = permissions[user.role];
    const modulePermissions = rolePermissions[module];
    if (!modulePermissions) return false;
    return modulePermissions.includes(action) || modulePermissions.includes('manage');
  };

  return (
    <AuthContext.Provider value={{ user, setUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
